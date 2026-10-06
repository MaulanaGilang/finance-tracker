# Ledger

Personal income and spending tracker. Mercury-inspired layout on a light "Forest" palette, mobile-first, free to run.

## Stack

- Vite + React + TypeScript, Tailwind v4, Recharts, Phosphor icons
- Fonts: Archivo (wide display, standing in for Mercury's Söhne Breit) + Inter, self-hosted via Fontsource
- Data: Supabase free tier (project `budget-tracker`, Singapore)
- Installable as an app on your phone (PWA)

## How access works

There are no accounts. On first open the app asks you to create a 6-digit PIN.

- The browser only holds Supabase's **publishable** key, which on its own can read nothing: the tables have RLS on with no policies, and direct access returns 401.
- All reads and writes go through Postgres functions (`supabase/migrations/001_schema.sql`) that require a session token. You get a token only by entering the right PIN (stored bcrypt-hashed).
- After 5 wrong PINs, login is blocked for 15 minutes. Sessions last 180 days per device; "Lock this device" in Settings ends one.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Deploy (free, Vercel)

1. Push this folder to a GitHub repo.
2. On vercel.com: **Add New → Project**, import the repo. Vercel detects Vite automatically.
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (values in `.env`).
4. Deploy, open the URL on your phone, then **Add to Home Screen**.

## Notes

- Supabase pauses free projects after 7 days without any requests. Using the app regularly keeps it awake; if it pauses, restore it from the Supabase dashboard.
- Forgot your PIN? Run `delete from private.settings; delete from private.sessions;` in the Supabase SQL editor, then reopen the app to set a new one. Your transactions are kept.
