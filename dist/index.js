"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBot = startBot;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const baileys_1 = __importStar(require("baileys"));
const pino_1 = __importDefault(require("pino"));
const auth_state_1 = require("./db/auth-state");
const rabbitmq_1 = require("./queue/rabbitmq");
const web_1 = require("./web");
const ai_1 = require("./ai");
const pool_1 = require("./db/pool");
const logger = (0, pino_1.default)({ level: process.env.LOG_LEVEL || 'silent' });
(0, web_1.startWebServer)();
let currentSock = null;
async function startBot() {
    if (currentSock) {
        currentSock.ev.removeAllListeners('connection.update');
        currentSock.ev.removeAllListeners('creds.update');
        currentSock.ev.removeAllListeners('messages.upsert');
        currentSock.end(undefined);
        currentSock = null;
    }
    // RabbitMQ non-blocking — bot tetap jalan walau queue gagal
    (0, rabbitmq_1.connectRabbitMQ)().catch((err) => console.error('RabbitMQ error:', err.message));
    const { state, saveCreds } = await (0, auth_state_1.usePostgresAuthState)();
    const { version } = await (0, baileys_1.fetchLatestBaileysVersion)();
    const sock = (0, baileys_1.default)({
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
            (0, web_1.setQR)(qr);
            (0, web_1.setStatus)('waiting_scan');
        }
        if (connection === 'close') {
            (0, web_1.setQR)(null);
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === baileys_1.DisconnectReason.loggedOut) {
                (0, web_1.setStatus)('logged_out');
                console.log('Logged out. Resetting auth state...');
                resetAndRestart();
            }
            else {
                (0, web_1.setStatus)('reconnecting');
                console.log(`Connection closed (${reason}). Reconnecting in 3s...`);
                setTimeout(() => startBot(), 3000);
            }
        }
        if (connection === 'open') {
            (0, web_1.setQR)(null);
            (0, web_1.setStatus)('open');
            (0, web_1.setSendFn)(async (jid, text) => { await sock.sendMessage(jid, { text }); });
            console.log('Connected to WhatsApp');
        }
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify')
            return;
        for (const msg of messages) {
            if (msg.key.fromMe)
                continue;
            const jid = msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            await (0, rabbitmq_1.publishIncoming)({
                jid,
                messageId: msg.key.id,
                pushName: msg.pushName,
                text,
                timestamp: msg.messageTimestamp,
            });
            if (text) {
                const reply = await (0, ai_1.chat)(jid, text);
                if (reply)
                    await sock.sendMessage(jid, { text: reply });
            }
        }
    });
    (0, rabbitmq_1.consumeOutgoing)(async ({ jid, text }) => {
        await sock.sendMessage(jid, { text });
    }).catch((err) => console.error('consumeOutgoing error:', err.message));
}
async function resetAndRestart() {
    await pool_1.pool.query('DELETE FROM auth_creds');
    await pool_1.pool.query('DELETE FROM auth_keys');
    console.log('Auth state cleared. Restarting...');
    startBot();
}
(0, web_1.setResetFn)(resetAndRestart);
process.on('SIGHUP', () => {
    console.log('Received SIGHUP, exiting...');
    process.exit(0);
});
startBot().catch((err) => {
    console.error('startBot failed:', err.message);
    console.log('Retrying in 5s...');
    setTimeout(() => startBot().catch(console.error), 5000);
});
