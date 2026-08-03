# YakYak — deploy to Cloudflare Pages 

This is a Next.js 14 app: onboarding + dashboard + AI-powered lesson generation,
with a server-side proxy route (`app/api/claude/route.js`) that keeps your
Anthropic API key off the client. It's set up to build via
`@cloudflare/next-on-pages`, which is Cloudflare's official adapter for
running Next.js (including API routes) on Pages Functions.

## One-time setup

```bash
npm install
npm install -g wrangler      # if you don't already have it
wrangler login                # opens a browser to authenticate with Cloudflare
```

## Deploy

```bash
npm run pages:deploy
```

This runs the Cloudflare adapter build, then deploys to a Pages project named
`yakyak` (change the name in `wrangler.toml` and in the `pages:deploy` script
in `package.json` if you want something else — it just has to be unique in
your account).

First deploy will prompt you to confirm creating the project. After that,
running `npm run pages:deploy` again just ships updates to the same project.

## Required environment variable

The lesson-generation feature calls Claude through the proxy route, which
needs your Anthropic API key set server-side. In the Cloudflare dashboard:

**Workers & Pages → yakyak → Settings → Environment variables → Production**
→ add `ANTHROPIC_API_KEY` with your key, then redeploy (or it'll pick it up
on the next deploy automatically).

Without this set, the app still runs fine — onboarding, the dashboard, the
CEFR ladder, all of it — but tapping "Start lesson" will show a clear
"Couldn't generate your lesson" error with a Try Again button, rather than
failing silently.

## What's in here

- `app/page.js` — the whole client app: onboarding flow, dashboard, lesson screen
- `app/layout.js` — page metadata
- `app/api/claude/route.js` — the server-side Claude proxy (edge runtime, required for Cloudflare Pages Functions)
- `wrangler.toml` — Cloudflare project config
- `next.config.js` — minimal Next.js config

## Notes

- No database yet — onboarding data and progress live only in browser memory
  for this session. Supabase is connected on the Claude side whenever you're
  ready to wire up real accounts and persistence.
- The mascot ("Yak") is a simple CSS blob shape, not custom illustrated art.
  If you want real character illustrations later, that's a separate
  image-generation pass.
