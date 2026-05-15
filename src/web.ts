import express from 'express';
import qrterm from 'qrcode-terminal';

let connectionStatus: string = 'disconnected';
let sendMessage: ((jid: string, text: string) => Promise<void>) | null = null;
let resetSession: (() => Promise<void>) | null = null;

export function setQR(qr: string | null) {
  if (qr) qrterm.generate(qr, { small: true });
}
export function setStatus(status: string) { connectionStatus = status; }
export function setSendFn(fn: (jid: string, text: string) => Promise<void>) { sendMessage = fn; }
export function setResetFn(fn: () => Promise<void>) { resetSession = fn; }

export function startWebServer() {
  const app = express();
  const port = parseInt(process.env.PORT || '8300');
  const host = process.env.HOST || '0.0.0.0';

  app.use(express.json());

  const apiKey = process.env.API_KEY;
  app.use('/api', (req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.key;
    if (apiKey && key !== apiKey) { res.status(401).json({ error: 'Unauthorized' }); return; }
    next();
  });

  app.get('/api/status', (_req, res) => {
    res.json({ status: connectionStatus });
  });

  app.post('/api/reset', async (_req, res) => {
    if (!resetSession) { res.status(503).json({ error: 'Not ready' }); return; }
    await resetSession();
    res.json({ success: true, message: 'Session reset' });
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

  app.listen(port, host, () => {
    console.log(`API server: http://${host}:${port}`);
  });
}
