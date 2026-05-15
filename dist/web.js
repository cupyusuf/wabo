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
        res.json({ status: connectionStatus, hasQR: !!currentQR });
    });
    app.get('/api/qr', async (_req, res) => {
        if (!currentQR) {
            res.status(204).end();
            return;
        }
        const png = await qrcode_1.default.toBuffer(currentQR, { width: 300 });
        res.type('image/png').send(png);
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
    app.get('/', (_req, res) => {
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WABO</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff}
.status{padding:8px 16px;border-radius:4px;margin:16px;font-size:1.2em}
.open{background:#1b5e20}.disconnected,.logged_out{background:#b71c1c}.waiting_scan,.reconnecting{background:#e65100}
img{border-radius:8px;margin:16px}#msg{margin:16px;font-size:1.1em}</style></head><body>
<h1>WABO - WhatsApp Bot</h1>
<div class="status" id="st">...</div>
<div id="qr"></div>
<div id="msg"></div>
<script>
async function poll(){
  try{
    const r=await fetch('/api/status');
    const d=await r.json();
    const st=document.getElementById('st');
    st.textContent=d.status.toUpperCase();
    st.className='status '+d.status;
    const qr=document.getElementById('qr');
    const msg=document.getElementById('msg');
    if(d.status==='open'){
      qr.innerHTML='';msg.textContent='Bot terhubung ke WhatsApp';
    }else if(d.hasQR){
      qr.innerHTML='<img src="/api/qr?t='+Date.now()+'" alt="QR"/>';
      msg.textContent='Scan QR dengan WhatsApp (Linked Devices)';
    }else{
      qr.innerHTML='';msg.textContent='Menunggu QR dari WhatsApp...';
    }
  }catch(e){}
  setTimeout(poll,3000);
}
poll();
</script></body></html>`);
    });
    app.listen(port, host, () => {
        console.log(`Web GUI: http://${host}:${port}`);
    });
}
