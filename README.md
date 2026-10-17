# Life Studio app design


## Deploying to Netlify

1. Connect this repo in Netlify. `netlify.toml` sets the build (`pnpm build` → `dist`) and functions.
2. In **Site configuration → Environment variables**, add `CLOUDFLARE_KEY`, `CF_GATEWAY_URL`, `AI_MODEL` and `STUDIO_PASSCODE` (copy the values from your local `.env`). Keep these values out of the repo: Netlify's secrets scanning fails the build if a secret-marked value appears in code.
3. Deploy, then open **My Studio → Sync across devices** on each device and enter the passcode. Data and voice notes sync through Netlify Blobs (free).
4. AI runs through `/api/ai` (a Netlify Function), so the key never reaches the browser. Speech-to-text uses the browser's built-in recognition (free, no AI).

Local dev with AI: `netlify dev` (plain `vite` serves the UI, but AI falls back to offline suggestions).
