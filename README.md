# Alvin AI Assistant

Alvin is a light-theme AI personal assistant built with React + Vite + Supabase.

## Architecture

User input -> `items` inbox -> Alvin AI understands context -> creates/updates:
- notes
- ideas
- tasks
- transactions

The raw item is preserved so Alvin can use it as conversational context.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the Supabase URL and publishable key in `.env.local`.

## Important

AI provider secrets must stay server-side. The current UI falls back to a local demo response when `/api/alvin-chat` is unavailable; wire the Netlify Function before production AI use.

Supabase project: `pduvjnptopmqsjhlhsnj`
Netlify site: `alvinxai`
