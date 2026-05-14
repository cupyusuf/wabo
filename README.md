# WABO - WhatsApp Bot (Baileys + PostgreSQL + RabbitMQ)

WhatsApp bot menggunakan [Baileys](https://github.com/WhiskeySockets/Baileys) dengan PostgreSQL untuk menyimpan auth state dan RabbitMQ sebagai message queue. Dijalankan di [alwaysdata](https://www.alwaysdata.com/) sebagai Service.

## Arsitektur

```
WhatsApp <-> Baileys Socket <-> RabbitMQ (alwaysdata managed)
                  |                 |
                  v                 v
            PostgreSQL        wa_messages_incoming (consume di service lain)
         (alwaysdata managed) wa_messages_outgoing (publish dari service lain)
```

## Prasyarat

- Akun [alwaysdata](https://admin.alwaysdata.com)
- PostgreSQL database (buat di **Databases > PostgreSQL**)
- RabbitMQ (buat di **Databases > RabbitMQ**)
- Node.js 18+ (set di **Environment > Node.js**)

## Deploy ke alwaysdata

### 1. Buat Database

Di admin panel alwaysdata:
- **Databases > PostgreSQL** → buat database (misal: `account_wabo`)
- **Databases > RabbitMQ** → buat user/vhost

### 2. Upload Project

Via SSH (`ssh account@ssh-account.alwaysdata.net`):

```bash
cd $HOME
git clone <repo-url> wabo
cd wabo
npm install
```

### 3. Konfigurasi Environment

```bash
cp .env.example .env
# Edit .env sesuai credentials dari admin panel:
# DATABASE_URL=postgresql://USER:PASS@postgresql-ACCOUNT.alwaysdata.net:5432/ACCOUNT_wabo
# RABBITMQ_URL=amqp://USER:PASS@rabbitmq-ACCOUNT.alwaysdata.net:5672
```

### 4. Build & Migrasi

```bash
npm run build
npm run migrate
```

### 5. Daftarkan sebagai Service

Di admin panel: **Advanced > Services** → tambah service baru:

| Field | Value |
|-------|-------|
| Command | `node $HOME/wabo/dist/index.js` |
| Working directory | `$HOME/wabo` |
| Environment variables | (kosong, sudah pakai .env) |

Bot akan otomatis jalan dan restart jika crash.

### 6. Pairing WhatsApp via Web GUI

Buka browser ke `http://services-ACCOUNT.alwaysdata.net:8300`

Halaman akan menampilkan:
- **QR Code** — scan dengan WhatsApp (Linked Devices)
- **Status koneksi** — auto-refresh setiap 5 detik

> Port `8300` termasuk dalam range service alwaysdata (`8300-8499`).

## Queues

| Queue | Arah | Format |
|-------|------|--------|
| `wa_messages_incoming` | WA → App | `{ jid, messageId, pushName, text, timestamp }` |
| `wa_messages_outgoing` | App → WA | `{ jid, text }` |

Untuk mengirim pesan, publish ke queue `wa_messages_outgoing`:

```json
{ "jid": "6281234567890@s.whatsapp.net", "text": "Hello!" }
```

## Scripts

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Jalankan dengan ts-node (development) |
| `npm run build` | Compile TypeScript |
| `npm start` | Jalankan hasil build |
| `npm run migrate` | Buat tabel di PostgreSQL |

## Catatan alwaysdata

- Bot berjalan sebagai **Service** (foreground, auto-restart)
- Log tersedia di `$HOME/admin/logs/services/`
- PostgreSQL max 50 koneksi simultan (Public Cloud)
- Tidak perlu Docker — semua managed oleh alwaysdata
