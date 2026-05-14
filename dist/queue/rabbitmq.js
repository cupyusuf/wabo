"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRabbitMQ = connectRabbitMQ;
exports.publishIncoming = publishIncoming;
exports.consumeOutgoing = consumeOutgoing;
const amqplib_1 = __importDefault(require("amqplib"));
const QUEUE_INCOMING = 'wa_messages_incoming';
const QUEUE_OUTGOING = 'wa_messages_outgoing';
let channel;
async function connectRabbitMQ() {
    const conn = await amqplib_1.default.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await conn.createChannel();
    await channel.assertQueue(QUEUE_INCOMING, { durable: true });
    await channel.assertQueue(QUEUE_OUTGOING, { durable: true });
}
async function publishIncoming(message) {
    channel.sendToQueue(QUEUE_INCOMING, Buffer.from(JSON.stringify(message)), { persistent: true });
}
async function consumeOutgoing(handler) {
    channel.consume(QUEUE_OUTGOING, async (msg) => {
        if (!msg)
            return;
        try {
            const data = JSON.parse(msg.content.toString());
            await handler(data);
            channel.ack(msg);
        }
        catch {
            channel.nack(msg, false, true);
        }
    });
}
