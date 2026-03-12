const express = require("express");

const router = express.Router();

// The API key is provided by each user/company at widget init time.
// The backend acts as a proxy and never stores or uses a server-side key.

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT =
  "You are Aura, a refined, warm, and brilliant AI assistant. " +
  "You speak with elegance and precision. Responses are clear, " +
  "insightful, and beautifully structured.";

router.post("/", async (req, res) => {
  const { messages, apiKey } = req.body;

  // Validate that the caller supplied their own Gemini API key.
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return res.status(400).json({ error: "A valid Gemini API key is required in the request body (apiKey)." });
  }

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
    // Convert { role, content } messages into Gemini format.
    // "assistant" role is represented as "model" in the Gemini API.
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Use the user-supplied API key to proxy the request to Gemini.
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey.trim()}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: 2048 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return res.status(geminiRes.status).json({ error: "Gemini API error: " + errText });
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't generate a response.";

    return res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    return res.status(500).json({ error: "Failed to get a response from the AI." });
  }
});

module.exports = router;
