import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// CONFIGURATION
// ========================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// 🌟 SMART FALLBACK CHAIN (Priority Order)
const MODEL_CHAIN = [
  { provider: "groq", model: "llama-3.3-70b-versatile" }, // 1. सबसे तेज़ और स्मार्ट
  { provider: "gemini", model: "gemini-3.8-flash" },      // 2. लेटेस्ट Gemini
  { provider: "gemini", model: "gemini-3.5-flash-lite" }, // 3. फास्ट Gemini
  { provider: "gemini", model: "gemini-2.5-flash" }       // 4. पुराना स्टेबल Gemini
];

const ALLOWED_ORIGINS = [
  "https://shashwat0213.github.io",
  "http://localhost:3000",
  "http://localhost:5500"
];

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (origin.startsWith("https://shashwat0213.github.io")) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"]
}));

app.use(express.json({ limit: "1mb" }));

// ========================================
// AI PROVIDERS
// ========================================

// 1. Groq API Call (सबसे तेज़)
async function callGroq(model, message, history) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: "You are JARVIS, a highly intelligent personal AI assistant created by Shashwat. You speak with a polite, confident British tone. Address the user as 'Sir'." },
        ...history,
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Groq Error ${res.status}`);
  return data.choices[0].message.content;
}

// 2. Gemini API Call (बैकअप)
async function callGemini(model, message, history) {
  const contents = history.map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }]
  }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "You are JARVIS, a highly intelligent personal AI assistant created by Shashwat. You speak with a polite, confident British tone. Address the user as 'Sir'." }]
      },
      contents: contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gemini Error ${res.status}`);
  return data.candidates[0].content.parts[0].text;
}

// ========================================
// SMART ROUTER (Fallback Logic)
// ========================================
async function getJarvisReply(message, history = []) {
  const errors = [];

  for (const item of MODEL_CHAIN) {
    try {
      console.log(`⚡ Trying ${item.provider} model: ${item.model}`);
      
      let reply;
      if (item.provider === "groq") {
        if (!GROQ_API_KEY) throw new Error("Groq API key missing");
        reply = await callGroq(item.model, message, history);
      } else if (item.provider === "gemini") {
        if (!GEMINI_API_KEY) throw new Error("Gemini API key missing");
        reply = await callGemini(item.model, message, history);
      }
      
      console.log(`✅ Success with ${item.model}`);
      return { reply, provider: item.provider, model: item.model };

    } catch (err) {
      console.warn(`❌ Failed ${item.model}:`, err.message);
      errors.push(`${item.model}: ${err.message}`);
      // Loop apne aap agle model par chala jayega
    }
  }

  throw new Error("All AI models failed.");
}

// ========================================
// ENDPOINTS
// ========================================
app.get("/", (req, res) => {
  res.json({
    status: "online",
    system: "JARVIS Hybrid System",
    providers: {
      groq: GROQ_API_KEY ? "configured" : "missing",
      gemini: GEMINI_API_KEY ? "configured" : "missing"
    },
    chain: MODEL_CHAIN.map(m => m.model)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    console.log("JARVIS COMMAND:", message);

    // Frontend se aayi history ko format karna
    const formattedHistory = history && Array.isArray(history) ? history.map(h => ({
      role: h.sender === "user" ? "user" : "assistant",
      content: h.text
    })) : [];

    const result = await getJarvisReply(message, formattedHistory);

    res.json({ 
      reply: result.reply,
      provider: result.provider,
      model: result.model
    });

  } catch (error) {
    console.error("❌ SERVER ERROR:", error.message);
    res.status(500).json({ error: "JARVIS is currently unable to respond." });
  }
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log(`🚀 JARVIS Hybrid Server running on port ${PORT}`);
  console.log(`Groq Key: ${GROQ_API_KEY ? "OK" : "MISSING"}`);
  console.log(`Gemini Key: ${GEMINI_API_KEY ? "OK" : "MISSING"}`);
  console.log("--- Fallback Chain ---");
  MODEL_CHAIN.forEach((m, i) => console.log(`${i+1}. ${m.provider.toUpperCase()} → ${m.model}`));
});
