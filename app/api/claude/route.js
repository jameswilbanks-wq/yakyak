// Server-side proxy to the Anthropic API.
// Keeps the API key on the server — never exposed to the browser.
// Screens that were calling api.anthropic.com directly from inside a
// Claude artifact should call this route instead once ported here.
// Cloudflare Pages Functions require the edge runtime (no Node.js APIs).
export const runtime = 'edge';

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY is not set on the server. Add it in Vercel → Project Settings → Environment Variables.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const body = await req.text();
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
}
