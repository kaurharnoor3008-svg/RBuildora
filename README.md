# RBuildora — Resume Builder

Full-stack app: a React (Vite) frontend and a small Express backend that
proxies AI writing requests to the Claude API, so your API key never sits in
the browser.

```
rbuildora/
├── backend/     # Express server — talks to the Anthropic API
└── frontend/    # React + Vite + Tailwind — the resume builder UI
```

## 1. Prerequisites

- Node.js 18 or newer (check with `node -v`)
- An Anthropic API key from https://console.anthropic.com/

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and paste your key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Then start it:

```bash
npm start
```

You should see `RBuildora backend running at http://localhost:3001`.
Leave this running in its own terminal.

## 3. Frontend setup

In a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Vite will print a local URL, typically **http://localhost:5173** — open that
in your browser. The dev server proxies any `/api/...` request to the
backend on port 3001, so both must be running.

## 4. Using the app

- Fill in the form on the left; the resume preview updates live on the right.
- "Polish with AI", "Turn into bullet points", and "Suggest skills" call your
  backend, which calls Claude.
- Spelling/capitalization is corrected automatically when you leave a field.
- "Download PDF" opens the browser's print dialog on just the resume — save
  as PDF from there (this works entirely client-side, no backend needed).

## 5. Running it as one server (optional)

If you'd rather serve everything from a single port:

```bash
cd frontend
npm run build      # outputs frontend/dist

cd ../backend
npm start           # now also serves the built frontend at http://localhost:3001
```

The backend automatically serves `frontend/dist` if it finds that folder, so
in this mode you only need `http://localhost:3001` — the Vite dev server on
5173 is no longer needed.

## Notes

- No database yet — all resume data lives in the browser tab's memory and is
  lost on refresh. If you want saved/multiple resumes and user accounts,
  that needs a database (e.g. SQLite/Postgres) and some auth — happy to add
  that next if useful.
- The backend has a basic in-memory rate limiter (30 AI requests/minute per
  IP) so a stray loop can't burn through your API credits. Fine for local
  use; swap for something more robust before any public deployment.
- Check `backend/.env.example` for the model name — update it if Anthropic
  releases a newer one you'd rather use.
