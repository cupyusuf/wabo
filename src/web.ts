import express from 'express';
import QRCode from 'qrcode';
import { swaggerSpec } from './swagger';
import qrterm from 'qrcode-terminal';

let currentQR: string | null = null;
let connectionStatus: string = 'disconnected';
let sendMessage: ((jid: string, text: string) => Promise<void>) | null = null;

export function setQR(qr: string | null) {
  currentQR = qr;
  if (qr) qrterm.generate(qr, { small: true });
}
export function setStatus(status: string) { connectionStatus = status; }
export function setSendFn(fn: (jid: string, text: string) => Promise<void>) { sendMessage = fn; }

export function startWebServer() {
  const app = express();
  const port = parseInt(process.env.PORT || '8300');
  const host = process.env.HOST || '0.0.0.0';

  app.use(express.json());

  // Swagger JSON spec
  app.get('/docs/swagger.json', (_req, res) => { res.json(swaggerSpec); });

  // Swagger UI via CDN
  app.get('/docs', (_req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WABO API Docs</title>
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
    if (!jid || !text) { res.status(400).json({ error: 'jid and text are required' }); return; }
    if (connectionStatus !== 'open') { res.status(503).json({ error: 'Bot not connected' }); return; }
    try {
      await sendMessage!(jid, text);
      res.json({ success: true, message: 'Message sent' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Main page
  app.get('/', async (_req, res) => {
    let qrHtml = '';
    if (currentQR) {
      const dataUrl = await QRCode.toDataURL(currentQR, { width: 300 });
      qrHtml = `<p>Scan QR dengan WhatsApp (Linked Devices):</p><img src="${dataUrl}"/>`;
    } else if (connectionStatus === 'open') {
      qrHtml = '<p>✅ Bot terhubung ke WhatsApp</p>';
    } else {
      qrHtml = '<p>Menunggu koneksi...</p>';
    }
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WABO</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff}
.status{padding:8px 16px;border-radius:4px;margin:16px;font-size:1.2em}
.open{background:#1b5e20}.disconnected,.logged_out{background:#b71c1c}.waiting_scan,.reconnecting{background:#e65100}
img{border-radius:8px}a{color:#4fc3f7;margin-top:16px}</style></head><body>
<h1>WABO - WhatsApp Bot</h1>
<div class="status ${connectionStatus}">${connectionStatus.toUpperCase()}</div>
${qrHtml}
<a href="/docs">📖 API Docs</a>
<script>setTimeout(()=>location.reload(),5000)</script>
</body></html>`);
  });

  app.listen(port, host, () => {
    console.log(`Web GUI: http://${host}:${port}`);
  });
}
