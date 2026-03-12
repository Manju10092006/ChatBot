const express = require("express");
const { chat } = require("../services/geminiService");

const router = express.Router();

router.post("/", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  // Basic validation – every entry must have role + content strings
  const valid = messages.every(
    (m) =>
      typeof m.role === "string" &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
  );
  if (!valid) {
    return res
      .status(400)
      .json({ error: "Each message must have a role and non-empty content." });
  }

  try {
    const reply = await chat(messages);
    return res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    return res.status(500).json({ error: "Failed to get a response from the AI." });
  }
});

module.exports = router;
