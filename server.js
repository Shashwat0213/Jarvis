import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// CONFIG
// ========================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// CORS — allowed origins
const ALLOWED_ORIGINS = [
  "https://shashwat0213.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

// ========================================
// SECURITY HEADERS MIDDLEWARE
// ========================================

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "microphone=(self)");
  res.removeHeader("X-Powered-By");
  next();
});

// ========================================
// CORS MIDDLEWARE
// ========================================

app.use(cors({
  origin: (origin, callback) => {
    // curl, Postman jaise tools ke liye origin nahi hota
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn("CORS BLOCKED:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"],
  credentials: false
}));

// ========================================
// BODY PARSER
// ========================================

app.use(express.json({ limit: "100kb" }));

// ========================================
// RATE LIMITING (simple in-memory)
// ========================================

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;  // 1 minute
const RATE_LIMIT_MAX = 20;            // 20 requests per minute per IP

function rateLimit(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW };

  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + RATE_LIMIT_WINDOW;
  }

  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "Too many requests. Please wait a minute and try again."
    });
  }

  next();
}

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

app.post("/api/chat", rateLimit, async (req, res) => {
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
        error: "Message too long (max 4000 characters)."
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
    // GEMINI REQUEST (with timeout)
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
// ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({
    error: "Internal server error."
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