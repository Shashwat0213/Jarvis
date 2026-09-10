import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors({
  origin: "https://shashwat0213.github.io"
}));

app.use(express.json());


// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    system: "JARVIS",
    version: "V1",
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
    // CHECK MESSAGE
    // ----------------------------------------

    if (!message || typeof message !== "string") {

      return res.status(400).json({
        error: "Message is required."
      });

    }


    // ----------------------------------------
    // CHECK GEMINI KEY
    // ----------------------------------------

    if (!GEMINI_API_KEY) {

      console.error(
        "GEMINI_API_KEY is missing."
      );

      return res.status(500).json({
        error: "Gemini API key is not configured on the server."
      });

    }


    console.log(
      "JARVIS COMMAND:",
      message
    );


    // ----------------------------------------
    // GEMINI API REQUEST
    // ----------------------------------------

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },

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
              parts: [
                {
                  text: message
                }
              ]
            }
          ]

        })
      }
    );


    // ----------------------------------------
    // READ GEMINI RESPONSE
    // ----------------------------------------

    const data = await geminiResponse.json();


    console.log(
      "GEMINI STATUS:",
      geminiResponse.status
    );


    // ----------------------------------------
    // GEMINI ERROR
    // ----------------------------------------

    if (!geminiResponse.ok) {

      console.error(
        "GEMINI API ERROR:",
        data
      );

      return res.status(502).json({
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });

    }


    // ----------------------------------------
    // EXTRACT AI REPLY
    // ----------------------------------------

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();


    if (!reply) {

      console.error(
        "EMPTY GEMINI RESPONSE:",
        data
      );

      return res.status(502).json({
        error: "Gemini returned an empty response."
      });

    }


    // ----------------------------------------
    // SEND TO FRONTEND
    // ----------------------------------------

    console.log(
      "JARVIS REPLY:",
      reply
    );


    res.json({
      reply
    });


  } catch (error) {

    console.error(
      "JARVIS SERVER ERROR:",
      error
    );

    res.status(500).json({
      error:
        "Jarvis backend error: " +
        (error.message || "Unknown error")
    });

  }

});


// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {

  console.log(
    `JARVIS backend running on port ${PORT}`
  );

});