"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setQR = setQR;
exports.setStatus = setStatus;
exports.setSendFn = setSendFn;
exports.startWebServer = startWebServer;
const express_1 = __importDefault(require("express"));
const qrcode_1 = __importDefault(require("qrcode"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./swagger");
let currentQR = null;
let connectionStatus = 'disconnected';
let sendMessage = null;
function setQR(qr) { currentQR = qr; }
function setStatus(status) { connectionStatus = status; }
function setSendFn(fn) { sendMessage = fn; }
function startWebServer() {
    const app = (0, express_1.default)();
    const port = parseInt(process.env.PORT || '8300');
    const host = process.env.HOST || '::';
    app.use(express_1.default.json());
    // Swagger UI
    app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
    // API routes
    app.get('/api/status', (_req, res) => {
        res.json({ status: connectionStatus });
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
            res.json({ success: true, message: 'Message queued' });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // QR / Status GUI
    app.get('/', async (_req, res) => {
        let qrImg = '';
        if (currentQR) {
            qrImg = await qrcode_1.default.toDataURL(currentQR, { width: 300 });
        }
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WABO</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff}
.status{padding:8px 16px;border-radius:4px;margin:16px;font-size:1.2em}
.open{background:#1b5e20}.disconnected,.logged_out{background:#b71c1c}.waiting_scan,.reconnecting{background:#e65100}
img{border-radius:8px}a{color:#4fc3f7;margin-top:16px}</style></head><body>
<h1>WABO - WhatsApp Bot</h1>
<div class="status ${connectionStatus}">${connectionStatus.toUpperCase()}</div>
${currentQR ? `<p>Scan QR dengan WhatsApp (Linked Devices):</p><img src="${qrImg}" alt="QR Code"/>` : connectionStatus === 'open' ? '<p>✅ Bot terhubung ke WhatsApp</p>' : '<p>Menunggu koneksi...</p>'}
<a href="/docs">📖 API Documentation (Swagger)</a>
<script>setTimeout(()=>location.reload(),5000)</script>
</body></html>`);
    });
    app.listen(port, host, () => {
        console.log(`Web GUI: http://localhost:${port}`);
        console.log(`Swagger: http://localhost:${port}/docs`);
    });
}
