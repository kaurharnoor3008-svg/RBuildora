require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "\n⚠️  ANTHROPIC_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key,\n" +
    "    or the AI features (polish summary, polish bullets, suggest skills, spelling fix) will fail.\n"
  );
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

// Simple in-memory rate limiter so one browser tab can't hammer your API key.
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 30;
  const record = hits.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  hits.set(key, record);
  if (record.count > max) {
    return res.status(429).json({ error: "Too many AI requests — please wait a moment and try again." });
  }
  next();
}

// Single generic endpoint: the frontend sends a system prompt + user prompt,
// this forwards it to Claude and returns plain text. Reused for every AI
// feature (polish summary, polish bullets, suggest skills, spelling fix).
app.post("/api/ai/complete", rateLimit, async (req, res) => {
  const { system, user } = req.body || {};
  if (!user || typeof user !== "string") {
    return res.status(400).json({ error: "Missing 'user' text in request body." });
  }
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it to backend/.env and restart." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        system: system || undefined,
        messages: [{ role: "user", content: user }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return res.status(502).json({ error: `Anthropic API error (${response.status})` });
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    if (!text) {
      return res.status(502).json({ error: "Empty response from Claude." });
    }

    res.json({ text });
  } catch (err) {
    console.error("AI request failed:", err);
    res.status(500).json({ error: "AI request failed. Check the server logs." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Optionally serve the built frontend (run `npm run build` in /frontend first)
// so the whole app can run from a single server/port.
const distPath = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(PORT, () => {
  console.log(`RBuildora backend running at http://localhost:${PORT}`);
});
