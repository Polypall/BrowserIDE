// ============================================================
// SERVER.JS — Indicolite backend
// Serves the static IDE AND proxies AI requests to Anthropic so
// end users never need their own API key. Run as a Render Web
// Service (or any Node host). If ANTHROPIC_API_KEY is not set, the
// AI proxy is disabled and the app falls back to per-user keys.
// ============================================================

const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// The shared key lives only on the server, read from the environment.
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
// Default to the most capable model. Override with ANTHROPIC_MODEL
// (e.g. "claude-sonnet-5" or "claude-haiku-4-5") to lower cost.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

// Abuse protection: cap requests per IP per hour so a public proxy
// can't run up your Anthropic bill. Tune with MAX_REQUESTS_PER_HOUR.
const MAX_PER_HOUR = parseInt(process.env.MAX_REQUESTS_PER_HOUR || '40', 10);
const WINDOW_MS = 60 * 60 * 1000;

const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

app.use(express.json({ limit: '1mb' }));

// ------------------------------------------------------------
// Simple in-memory per-IP rate limiter (fixed window)
// ------------------------------------------------------------
const hits = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
    const now = Date.now();
    let rec = hits.get(ip);
    if (!rec || now > rec.resetAt) {
        rec = { count: 0, resetAt: now + WINDOW_MS };
        hits.set(ip, rec);
    }
    rec.count++;
    return rec.count > MAX_PER_HOUR;
}

// Periodically clear expired records so the map doesn't grow forever.
setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of hits) if (now > rec.resetAt) hits.delete(ip);
}, WINDOW_MS).unref();

// ------------------------------------------------------------
// Health / capability probe — the browser calls this on load to
// decide whether to hide the API-key field.
// ------------------------------------------------------------
app.get('/api/health', (req, res) => {
    res.json({ backend: true, aiEnabled: !!client, model: client ? MODEL : null });
});

// ------------------------------------------------------------
// AI proxy — forwards the browser's message payload to Anthropic
// with the server-held key. The browser sends { system, messages,
// max_tokens }; nothing sensitive ever reaches the client.
// ------------------------------------------------------------
app.post('/api/ai', async (req, res) => {
    if (!client) {
        return res.status(503).json({ error: 'AI is not configured on this server. Set ANTHROPIC_API_KEY.' });
    }

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .toString().split(',')[0].trim();
    if (rateLimited(ip)) {
        return res.status(429).json({ error: 'Rate limit reached. Please wait a bit and try again.' });
    }

    const { system, messages, max_tokens } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required.' });
    }

    try {
        const message = await client.messages.create({
            model: MODEL,
            max_tokens: Math.min(Math.max(parseInt(max_tokens, 10) || 4096, 256), 8192),
            system: typeof system === 'string' ? system : undefined,
            messages: messages.slice(-16), // bound history size
        });
        const text = (message.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('');
        res.json({ text });
    } catch (e) {
        const status = e.status || 500;
        res.status(status).json({ error: e.message || 'AI request failed.' });
    }
});

// ------------------------------------------------------------
// Static IDE — serve everything else from the repo root.
// ------------------------------------------------------------
app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`Indicolite running on port ${PORT}`);
    console.log(`AI proxy: ${client ? `enabled (${MODEL})` : 'disabled — users supply their own key'}`);
});
