import express from 'express';
import QRCode from 'qrcode';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

let currentQR: string | null = null;
let connectionStatus: string = 'disconnected';
let sendMessage: ((jid: string, text: string) => Promise<void>) | null = null;

export function setQR(qr: string | null) {
  currentQR = qr;
  if (qr) console.log('QR updated, visit /qr to scan');
}
export function setStatus(status: string) { connectionStatus = status; }
export function setSendFn(fn: (jid: string, text: string) => Promise<void>) { sendMessage = fn; }

export function startWebServer() {
  const app = express();
  const port = parseInt(process.env.PORT || '8300');

  app.use(express.json());
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get('/api/status', (_req, res) => {
    res.json({ status: connectionStatus, hasQR: !!currentQR });
  });

  app.post('/api/send', async (req, res) => {
    const { jid, text } = req.body;
    if (!jid || !text) { res.status(400).json({ error: 'jid and text are required' }); return; }
    if (connectionStatus !== 'open') { res.status(503).json({ error: 'Bot not connected' }); return; }
    try {
      await sendMessage!(jid, text);
      res.json({ success: true, message: 'Message queued' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // QR as PNG image
  app.get('/qr', async (_req, res) => {
    if (!currentQR) { res.status(404).send('No QR available'); return; }
    const buffer = await QRCode.toBuffer(currentQR, { width: 400 });
    res.type('image/png').send(buffer);
  });

  // Main page
  app.get('/', async (_req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WABO</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff}
.status{padding:8px 16px;border-radius:4px;margin:16px;font-size:1.2em}
.open{background:#1b5e20}.disconnected,.logged_out{background:#b71c1c}.waiting_scan,.reconnecting{background:#e65100}
img{border-radius:8px}a{color:#4fc3f7;margin-top:16px}</style></head><body>
<h1>WABO - WhatsApp Bot</h1>
<div class="status ${connectionStatus}">${connectionStatus.toUpperCase()}</div>
${currentQR ? `<p>Scan QR dengan WhatsApp (Linked Devices):</p><img src="/qr?t=${Date.now()}" alt="QR Code" width="300"/>` : connectionStatus === 'open' ? '<p>✅ Bot terhubung ke WhatsApp</p>' : '<p>Menunggu koneksi...</p>'}
<a href="/docs">📖 API Documentation (Swagger)</a>
<script>setTimeout(()=>location.reload(),5000)</script>
</body></html>`);
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Web GUI: http://0.0.0.0:${port}`);
    console.log(`Swagger: http://0.0.0.0:${port}/docs`);
  });
}
