import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// CONFIG (Gemini Fallback Chain)
// ========================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// स्मार्ट स्विचिंग के लिए मॉडल्स का क्रम
const MODEL_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash"
];

const ALLOWED_ORIGINS = [
  "https://shashwat0213.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

// ========================================
// SECURITY HEADERS & CORS
// ========================================

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "microphone=(self)");
  res.removeHeader("X-Powered-By");
  next();
});

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
    return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  }
  next();
}

// ========================================
// GEMINI API CALL (Single Model)
// ========================================

async function callGemini(model, message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      signal: controller.signal,
      body: JSON.stringify({
        // 🧠 यहाँ JARVIS की पर्सनालिटी और प्रोजेक्ट्स की जानकारी दी गई है
        systemInstruction: {
          parts: [{ 
            text: "You are JARVIS, the highly intelligent and loyal personal AI assistant created by Shashwat. " +
                  "You speak with a polite, confident, and slightly witty British tone. " +
                  "Address Shashwat as 'Sir' or 'Shashwat' occasionally. " +
                  "Do not sound like a generic search engine; sound like a trusted partner. " +
                  
                  "Here is information about Shashwat's projects: " +
                  "1. CINEVAULT: A personal web project for movies (like a movie vault or tracker). " +
                  "2. MCU TRACKER: A web project dedicated to tracking Marvel Cinematic Universe (MCU) movies, shows, and timelines. " +
                  
                  "If Shashwat asks about these projects, provide helpful answers, ideas, or discuss them based on this context."
          }]
        },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      })
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`${model} failed: ${data?.error?.message || response.status}`);
    }

    const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!reply) throw new Error(`${model} returned empty response`);

    return reply;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ========================================
// SMART FALLBACK (Try all models)
// ========================================

async function getJarvisReply(message) {
  const errors = [];
  for (const model of MODEL_CHAIN) {
    try {
      console.log(`Trying model: ${model}`);
      const reply = await callGemini(model, message);
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
// ENDPOINTS
// ========================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    provider: "Gemini",
    persona: "JARVIS (Personal Assistant for Shashwat)",
    models: MODEL_CHAIN,
    apiKey: GEMINI_API_KEY ? "configured" : "MISSING",
    message: "Jarvis backend is running."
  });
});

app.post("/api/chat", rateLimit, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI service is not configured." });
    }

    console.log("JARVIS COMMAND:", message);
    const { reply, model } = await getJarvisReply(message);
    console.log(`JARVIS REPLY (via ${model}):`, reply);
    
    res.json({ reply, model });

  } catch (error) {
    console.error("JARVIS SERVER ERROR:", error);
    res.status(500).json({ error: "Jarvis is currently unable to respond. Please try again." });
  }
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`JARVIS backend running on port ${PORT}`);
  console.log(`Provider: Gemini (Fallback Chain)`);
  console.log(`Models: ${MODEL_CHAIN.join(" → ")}`);
  console.log(`API key: ${GEMINI_API_KEY ? "OK" : "MISSING"}`);
});