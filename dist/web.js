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
const swagger_1 = require("./swagger");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
let currentQR = null;
let connectionStatus = 'disconnected';
let sendMessage = null;
function setQR(qr) {
    currentQR = qr;
    if (qr)
        qrcode_terminal_1.default.generate(qr, { small: true });
}
function setStatus(status) { connectionStatus = status; }
function setSendFn(fn) { sendMessage = fn; }
function waitForQR(timeoutMs = 30000) {
    return new Promise((resolve) => {
        if (currentQR) {
            resolve(currentQR);
            return;
        }
        if (connectionStatus === 'open') {
            resolve(null);
            return;
        }
        const start = Date.now();
        const interval = setInterval(() => {
            if (currentQR) {
                clearInterval(interval);
                resolve(currentQR);
            }
            else if (connectionStatus === 'open') {
                clearInterval(interval);
                resolve(null);
            }
            else if (Date.now() - start >= timeoutMs) {
                clearInterval(interval);
                resolve(null);
            }
        }, 500);
    });
}
function startWebServer() {
    const app = (0, express_1.default)();
    const port = parseInt(process.env.PORT || '8300');
    const host = process.env.HOST || '0.0.0.0';
    app.use(express_1.default.json());
    app.get('/docs/swagger.json', (_req, res) => { res.json(swagger_1.swaggerSpec); });
    app.get('/docs', (_req, res) => {
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WABO API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/docs/swagger.json',dom_id:'#swagger-ui'})</script>
</body></html>`);
    });
    app.get('/api/status', (_req, res) => {
        res.json({ status: connectionStatus, hasQR: !!currentQR });
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
    // Main page - waits for QR like wage does
    app.get('/', async (_req, res) => {
        const qr = await waitForQR(15000);
        let body = '';
        if (qr) {
            const dataUrl = await qrcode_1.default.toDataURL(qr, { width: 300 });
            body = `<p>Scan QR dengan WhatsApp (Linked Devices):</p><img src="${dataUrl}"/>`;
        }
        else if (connectionStatus === 'open') {
            body = '<p>Bot terhubung ke WhatsApp</p>';
        }
        else {
            body = '<p>QR belum tersedia. <a href="/">Refresh</a></p>';
        }
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WABO</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff}
.status{padding:8px 16px;border-radius:4px;margin:16px;font-size:1.2em}
.open{background:#1b5e20}.disconnected,.logged_out{background:#b71c1c}.waiting_scan,.reconnecting{background:#e65100}
img{border-radius:8px}a{color:#4fc3f7;margin-top:16px}</style></head><body>
<h1>WABO - WhatsApp Bot</h1>
<div class="status ${connectionStatus}">${connectionStatus.toUpperCase()}</div>
${body}
<a href="/docs">API Docs</a>
<script>if('${connectionStatus}'!=='open')setTimeout(()=>location.reload(),10000)</script>
</body></html>`);
    });
    app.listen(port, host, () => {
        console.log(`Web GUI: http://${host}:${port}`);
    });
}
