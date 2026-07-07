# Deploying Indicolite

Indicolite runs two ways. Pick based on whether you want a shared AI key.

## Option A — Static site (free, users bring their own key)

No backend. The AI panel asks each user for their own Anthropic key.

- **Render:** New → **Static Site**
  - Build Command: *(leave blank)*
  - Publish Directory: `.`
- Or GitHub Pages / Netlify Drop — just serve the repo root.

Nothing else to configure. `server.js` and `package.json` are ignored by a static host.

## Option B — Web Service (shared AI key, users enter nothing)  ⭐

Runs `server.js`, which serves the site **and** proxies AI through your key.
Users never see or need a key.

### Render setup

1. New → **Web Service** → connect this repo
2. **Branch:** `claude/eager-meitner-d1mlg8`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. **Environment Variables:**

   | Key | Value | Required |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key | ✅ Yes — this is what makes it work |
   | `ANTHROPIC_MODEL` | e.g. `claude-sonnet-5` or `claude-haiku-4-5` | Optional — defaults to `claude-opus-4-8` |
   | `MAX_REQUESTS_PER_HOUR` | e.g. `40` | Optional — per-IP rate limit (default 40) |

6. Deploy. On boot the log prints `AI proxy: enabled (<model>)`.

### 💸 Cost control (important)

With a shared key, **you pay for every user's AI usage.** Protect yourself:

- **Set a spend cap** in the Anthropic Console (Billing → Usage limits).
- Keep `MAX_REQUESTS_PER_HOUR` conservative.
- Default model is `claude-opus-4-8` (most capable, most expensive).
  Set `ANTHROPIC_MODEL=claude-sonnet-5` or `claude-haiku-4-5` to cut cost.

### How the app decides

On load the browser calls `GET /api/health`. If the server reports the key is
configured, the AI panel hides the key field and routes requests through
`POST /api/ai`. If there's no backend (static host) or no key set, it falls
back to asking each user for their own key. Same codebase, both modes.
