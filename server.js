import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://shashwat0213.github.io"
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "online",
    system: "JARVIS",
    version: "V1",
    message: "Jarvis backend is running."
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    // ChatGPT connection will be added here next.
    res.json({
      reply: `Jarvis received: ${message}`
    });

  } catch (error) {
    console.error("JARVIS ERROR:", error);

    res.status(500).json({
      error: "Jarvis backend error."
    });
  }
});

app.listen(PORT, () => {
  console.log(`JARVIS backend running on port ${PORT}`);
});