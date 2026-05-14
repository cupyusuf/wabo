"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
exports.swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'WABO - WhatsApp Bot API',
        version: '1.0.0',
        description: 'REST API untuk mengirim pesan WhatsApp dan memonitor status bot. Bot otomatis membalas pesan menggunakan AI via OpenRouter (gratis).',
    },
    paths: {
        '/api/status': {
            get: {
                summary: 'Cek status koneksi bot',
                tags: ['Bot'],
                responses: {
                    '200': {
                        description: 'Status koneksi',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Status' } } },
                    },
                },
            },
        },
        '/api/send': {
            post: {
                summary: 'Kirim pesan WhatsApp',
                tags: ['Pesan'],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessage' } } },
                },
                responses: {
                    '200': { description: 'Pesan berhasil dikirim ke queue', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
                    '400': { description: 'Parameter tidak lengkap' },
                    '503': { description: 'Bot belum terhubung' },
                },
            },
        },
    },
    components: {
        schemas: {
            SendMessage: {
                type: 'object',
                required: ['jid', 'text'],
                properties: {
                    jid: { type: 'string', example: '6281234567890@s.whatsapp.net', description: 'Nomor tujuan format JID (nomor@s.whatsapp.net)' },
                    text: { type: 'string', example: 'Hello dari WABO!', description: 'Isi pesan teks' },
                },
            },
            Status: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['disconnected', 'waiting_scan', 'open', 'reconnecting', 'logged_out'] },
                },
            },
            Success: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Message queued' },
                },
            },
        },
    },
};
