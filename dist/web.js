"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setQR = setQR;
exports.setStatus = setStatus;
exports.setSendFn = setSendFn;
exports.setResetFn = setResetFn;
exports.startWebServer = startWebServer;
const express_1 = __importDefault(require("express"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
let connectionStatus = 'disconnected';
let sendMessage = null;
let resetSession = null;
function setQR(qr) {
    if (qr)
        qrcode_terminal_1.default.generate(qr, { small: true });
}
function setStatus(status) { connectionStatus = status; }
function setSendFn(fn) { sendMessage = fn; }
function setResetFn(fn) { resetSession = fn; }
function startWebServer() {
    const app = (0, express_1.default)();
    const port = parseInt(process.env.PORT || '8300');
    const host = process.env.HOST || '0.0.0.0';
    app.use(express_1.default.json());
    const apiKey = process.env.API_KEY;
    app.use('/api', (req, res, next) => {
        const key = req.headers['x-api-key'] || req.query.key;
        if (apiKey && key !== apiKey) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        next();
    });
    app.get('/api/status', (_req, res) => {
        res.json({ status: connectionStatus });
    });
    app.post('/api/reset', async (_req, res) => {
        if (!resetSession) {
            res.status(503).json({ error: 'Not ready' });
            return;
        }
        await resetSession();
        res.json({ success: true, message: 'Session reset' });
    });
    app.post('/api/send', async (req, res) => {
        const { jid, text } = req.body;
        if (!jid || !text) {
            res.status(400).json({ error: 'jid and text are required' });
            return;
        }
        if (connectionStatus !== 'open') {
            res.status(503).json({ error: 'Bot not connected' });
            return;
        }
        try {
            await sendMessage(jid, text);
            res.json({ success: true, message: 'Message sent' });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.listen(port, host, () => {
        console.log(`API server: http://${host}:${port}`);
    });
}
