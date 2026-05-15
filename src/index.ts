import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { usePostgresAuthState } from './db/auth-state';
import { connectRabbitMQ, publishIncoming, consumeOutgoing } from './queue/rabbitmq';
import { startWebServer, setQR, setStatus, setSendFn } from './web';
import { chat } from './ai';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

startWebServer();

let currentSock: ReturnType<typeof makeWASocket> | null = null;

async function startBot() {
  // Close existing socket to ensure single session
  if (currentSock) {
    currentSock.ev.removeAllListeners('connection.update');
    currentSock.ev.removeAllListeners('creds.update');
    currentSock.ev.removeAllListeners('messages.upsert');
    currentSock.end(undefined);
    currentSock = null;
  }

  await connectRabbitMQ();
  const { state, saveCreds } = await usePostgresAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['WABO', 'Chrome', '1.0.0'],
  });
  currentSock = sock;

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
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
        console.log(`Connection closed (${reason}). Reconnecting in 3s...`);
        setTimeout(() => startBot(), 3000);
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
