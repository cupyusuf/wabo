import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { usePostgresAuthState } from './db/auth-state';
import { connectRabbitMQ, publishIncoming, consumeOutgoing } from './queue/rabbitmq';
import { startWebServer, setQR, setStatus, setSendFn } from './web';
import { chat } from './ai';
import qrcode from 'qrcode-terminal';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

startWebServer();

async function startBot() {
  await connectRabbitMQ();
  const { state, saveCreds } = await usePostgresAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log('connection.update:', connection || '', qr ? 'QR received' : '');

    if (qr) {
      qrcode.generate(qr, { small: true });
      setQR(qr);
      setStatus('waiting_scan');
    }

    if (connection === 'close') {
      setQR(null);
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        setStatus('logged_out');
        console.log('Logged out. Clear auth state and restart.');
      } else {
        setStatus('reconnecting');
        console.log(`Connection closed (${reason}). Reconnecting...`);
        startBot();
      }
    }

    if (connection === 'open') {
      setQR(null);
      setStatus('open');
      setSendFn(async (jid, text) => { await sock.sendMessage(jid, { text }); });
      console.log('Connected to WhatsApp');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const jid = msg.key.remoteJid!;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

      await publishIncoming({
        jid,
        messageId: msg.key.id,
        pushName: msg.pushName,
        text,
        timestamp: msg.messageTimestamp,
      });

      // Auto-reply with DeepSeek AI
      if (text) {
        const reply = await chat(jid, text);
        if (reply) await sock.sendMessage(jid, { text: reply });
      }
    }
  });

  await consumeOutgoing(async ({ jid, text }) => {
    await sock.sendMessage(jid, { text });
  });
}

process.on('SIGHUP', () => {
  console.log('Received SIGHUP, exiting...');
  process.exit(0);
});

startBot().catch(console.error);
