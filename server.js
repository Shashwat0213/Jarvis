import express from "express";
import cors from "dotenv"; // typo fix: dotenv should be imported normally
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// CONFIG (OpenRouter)
// ========================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Model priority list — Free models first, then paid as fallback
const MODEL_CHAIN = [
  "meta-llama/llama-3-8b-instruct:free",   // 1. Free Llama 3
  "google/gemma-7b-it:free",               // 2. Free Gemma
  "mistralai/mistral-7b-instruct:free",    // 3. Free Mistral
  "openai/gpt-4o-mini",                    // 4. Paid OpenAI (Fast)
  "anthropic/claude-3-haiku"               // 5. Paid Claude (Fast)
];

// CORS allowed origins
const ALLOWED_ORIGINS = [
  "https://shashwat0213.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

// ========================================
// SECURITY HEADERS
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
// CORS
// ========================================

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (origin.startsWith("https://shashwat0213.github.io")) {
      return callback(null, true);
    }
    console.warn("CORS BLOCKED:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"],
  credentials: false
}));

app.use(express.json({ limit: "100kb" }));

// ========================================
// RATE LIMITING
// ========================================

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 20;

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
      error: "Too many requests. Please wait a minute."
    });
  }
  next();
}

// ========================================
// OPENROUTER API CALL
// ========================================

async function callOpenRouter(model, message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shashwat0213.github.io/Jarvis/", // Required by OpenRouter
        "X-Title": "JARVIS AI" // Required by OpenRouter
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are JARVIS, a helpful personal AI assistant. " +
              "Be clear, intelligent, concise and friendly. " +
              "Answer the user's questions naturally. " +
              "Do not claim to have performed an action unless you actually did it."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      const errMsg =
        data?.error?.message ||
        data?.error ||
        `Status ${response.status}`;
      throw new Error(`${model} failed: ${errMsg}`);
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error(`${model} returned empty response`);
    }

    return reply;

  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ========================================
// SMART FALLBACK
// ========================================

async function getJarvisReply(message) {
  const errors = [];

  for (const model of MODEL_CHAIN) {
    try {
      console.log(`Trying model: ${model}`);
      const reply = await callOpenRouter(model, message);
      console.log(`SUCCESS with model: ${model}`);
      return { reply, model };

    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message);
      errors.push(`${model}: ${err.message}`);
    }
  }

  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    system: "JARVIS",
    version: "V3",
    provider: "OpenRouter",
    models: MODEL_CHAIN,
    apiKey: OPENROUTER_API_KEY ? "configured" : "MISSING",
    message: "Jarvis backend is running."
  });
});

// ========================================
// JARVIS CHAT
// ========================================

app.post("/api/chat", rateLimit, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: "Message too long (max 4000 characters)."
      });
    }

    if (!OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY is missing.");
      return res.status(500).json({
        error: "AI service is not configured on the server."
      });
    }

    console.log("JARVIS COMMAND:", message);

    const { reply, model } = await getJarvisReply(message);

    console.log(`JARVIS REPLY (via ${model}):`, reply);

    res.json({
      reply: reply,
      model: model
    });

  } catch (error) {
    console.error("JARVIS SERVER ERROR:", error);
    res.status(500).json({
      error: "Jarvis is currently unable to respond. Please try again."
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
  res.status(500).json({ error: "Internal server error." });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`JARVIS backend running on port ${PORT}`);
  console.log(`Provider: OpenRouter`);
  console.log(`Model chain: ${MODEL_CHAIN.join(" → ")}`);
  console.log(`API key: ${OPENROUTER_API_KEY ? "OK" : "MISSING"}`);
});