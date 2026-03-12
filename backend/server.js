require("dotenv").config();
const express = require("express");
const cors = require("cors");
const chatRoute = require("./routes/chat");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/chat", chatRoute);

// Health check
app.get("/", (_req, res) => res.json({ status: "Aura backend is running." }));

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✦ Aura backend listening on http://localhost:${PORT}`);
});
