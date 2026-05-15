import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { usePostgresAuthState } from './db/auth-state';
import { connectRabbitMQ, publishIncoming, consumeOutgoing } from './queue/rabbitmq';
import { startWebServer, setQR, setStatus, setSendFn, setResetFn } from './web';
import { chat } from './ai';
import { pool } from './db/pool';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

startWebServer();

let currentSock: ReturnType<typeof makeWASocket> | null = null;

export async function startBot() {
  if (currentSock) {
    currentSock.ev.removeAllListeners('connection.update');
    currentSock.ev.removeAllListeners('creds.update');
    currentSock.ev.removeAllListeners('messages.upsert');
    currentSock.end(undefined);
    currentSock = null;
  }

  // RabbitMQ non-blocking — bot tetap jalan walau queue gagal
  connectRabbitMQ().catch((err) => console.error('RabbitMQ error:', err.message));

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
        console.log('Logged out. Resetting auth state...');
        resetAndRestart();
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

      if (text) {
        const reply = await chat(jid, text);
        if (reply) await sock.sendMessage(jid, { text: reply });
      }
    }
  });

  consumeOutgoing(async ({ jid, text }) => {
    await sock.sendMessage(jid, { text });
  }).catch((err) => console.error('consumeOutgoing error:', err.message));
}

async function resetAndRestart() {
  await pool.query('DELETE FROM auth_creds');
  await pool.query('DELETE FROM auth_keys');
  console.log('Auth state cleared. Restarting...');
  startBot();
}

setResetFn(resetAndRestart);

process.on('SIGHUP', () => {
  console.log('Received SIGHUP, exiting...');
  process.exit(0);
});

startBot().catch((err) => {
  console.error('startBot failed:', err.message);
  console.log('Retrying in 5s...');
  setTimeout(() => startBot().catch(console.error), 5000);
});
