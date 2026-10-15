import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ========================================
// CONFIG
// ========================================

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ALLOWED_ORIGINS = [
  "https://shashwat0213.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn("CORS BLOCKED:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"]
}));

app.use(express.json({ limit: "1mb" }));

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    system: "JARVIS",
    version: "V1",
    model: GEMINI_MODEL,
    geminiKey: GEMINI_API_KEY ? "configured" : "MISSING",
    message: "Jarvis backend is running."
  });
});

// ========================================
// JARVIS CHAT
// ========================================

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // ----------------------------------------
    // VALIDATE INPUT
    // ----------------------------------------

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: "Message too long (max 4000 chars)."
      });
    }

    // ----------------------------------------
    // CHECK API KEY
    // ----------------------------------------

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing.");
      return res.status(500).json({
        error: "Gemini API key is not configured on the server."
      });
    }

    console.log("JARVIS COMMAND:", message);

    // ----------------------------------------
    // GEMINI REQUEST
    // ----------------------------------------

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let geminiResponse;
    try {
      geminiResponse = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are JARVIS, a helpful personal AI assistant. " +
                  "Be clear, intelligent, concise and friendly. " +
                  "Answer the user's questions naturally. " +
                  "Do not claim to have performed an action unless you actually did it."
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: message }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === "AbortError") {
        return res.status(504).json({
          error: "Gemini API timed out. Please try again."
        });
      }
      throw fetchErr;
    }
    clearTimeout(timeout);

    // ----------------------------------------
    // PARSE RESPONSE
    // ----------------------------------------

    const data = await geminiResponse.json();
    console.log("GEMINI STATUS:", geminiResponse.status);

    if (!geminiResponse.ok) {
      console.error("GEMINI API ERROR:", JSON.stringify(data, null, 2));
      return res.status(502).json({
        error:
          data?.error?.message ||
          `Gemini API failed with status ${geminiResponse.status}.`
      });
    }

    // ----------------------------------------
    // EXTRACT REPLY
    // ----------------------------------------

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      console.error("EMPTY GEMINI RESPONSE:", JSON.stringify(data, null, 2));
      return res.status(502).json({
        error: "Gemini returned an empty response."
      });
    }

    console.log("JARVIS REPLY:", reply);

    res.json({ reply });

  } catch (error) {
    console.error("JARVIS SERVER ERROR:", error);
    res.status(500).json({
      error: "Jarvis backend error: " + (error.message || "Unknown error")
    });
  }
});

// ========================================
// 404 FALLBACK
// ========================================

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`JARVIS backend running on port ${PORT}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
  console.log(`Gemini key: ${GEMINI_API_KEY ? "OK" : "MISSING"}`);
});