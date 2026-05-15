import amqplib from 'amqplib';

const QUEUE_INCOMING = 'wa_messages_incoming';
const QUEUE_OUTGOING = 'wa_messages_outgoing';

let channel: amqplib.Channel | null = null;
let channelReady: Promise<void>;
let resolveChannel: () => void;

channelReady = new Promise((r) => { resolveChannel = r; });

export async function connectRabbitMQ() {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_INCOMING, { durable: true });
  await channel.assertQueue(QUEUE_OUTGOING, { durable: true });
  resolveChannel();
}

export async function publishIncoming(message: any) {
  if (!channel) return;
  channel.sendToQueue(QUEUE_INCOMING, Buffer.from(JSON.stringify(message)), { persistent: true });
}

export async function consumeOutgoing(handler: (msg: { jid: string; text: string }) => Promise<void>) {
  await channelReady;
  channel!.consume(QUEUE_OUTGOING, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      await handler(data);
      channel!.ack(msg);
    } catch {
      channel!.nack(msg, false, true);
    }
  });
}
