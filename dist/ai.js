"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
});
const SYSTEM_PROMPT = process.env.BOT_SYSTEM_PROMPT || 'Kamu adalah asisten yang ramah dan membantu. Jawab dalam bahasa yang sama dengan pengguna.';
const MODEL = process.env.AI_MODEL || 'deepseek/deepseek-r1-0528:free';
// Simple in-memory conversation history per JID (last 10 messages)
const history = new Map();
async function chat(jid, userMessage) {
    if (!process.env.OPENROUTER_API_KEY)
        return '';
    const msgs = history.get(jid) || [];
    msgs.push({ role: 'user', content: userMessage });
    if (msgs.length > 10)
        msgs.splice(0, msgs.length - 10);
    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...msgs,
        ],
    });
    const reply = response.choices[0]?.message?.content || '';
    msgs.push({ role: 'assistant', content: reply });
    history.set(jid, msgs);
    return reply;
}
