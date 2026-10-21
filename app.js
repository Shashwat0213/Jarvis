import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ========================================
// FIREBASE CONFIG
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyCIiomQVg4N5Fnp9u15yXasBfuny8Of6FQ",
  authDomain: "jarvis-44a31.firebaseapp.com",
  projectId: "jarvis-44a31",
  storageBucket: "jarvis-44a31.firebasestorage.app",
  messagingSenderId: "330404685457",
  appId: "1:330404685457:web:20e0539a2a145717cfc130"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const JARVIS_BACKEND = "https://jarvis-7es3.onrender.com"; 

const $ = id => document.getElementById(id);
setPersistence(auth, browserLocalPersistence).catch(console.error);

// ========================================
// UI ELEMENTS
// ========================================
const messages = $("messages");
const input = $("userInput");
const toast = $("toast");
const coreOrb = $("coreOrb");
const coreCaption = $("coreCaption");
const micBtn = $("micBtn");

// Greeting Time
const hour = new Date().getHours();
$("dayPeriod").textContent = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

// ========================================
// VOICE SETUP
// ========================================
let voiceEnabled = true;
let selectedVoice = null;
if ("speechSynthesis" in window) {
  const loadVoices = () => {
    const v = window.speechSynthesis.getVoices();
    selectedVoice = v.find(x => x.lang === "hi-IN") || v.find(x => x.lang === "en-IN") || v[0];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  if (coreOrb) coreOrb.className = "core speaking";
  if (coreCaption) coreCaption.textContent = "SPEAKING...";

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 0.9; u.lang = "hi-IN";
  if (selectedVoice) u.voice = selectedVoice;
  
  u.onend = () => { 
    if (coreOrb) coreOrb.className = "core"; 
    if (coreCaption) coreCaption.textContent = "CORE ACTIVE";
  };
  window.speechSynthesis.speak(u);
}

// ========================================
// AUTHENTICATION & MEMORY
// ========================================
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));

onAuthStateChanged(auth, async user => {
  if ($("loginPanel")) $("loginPanel").classList.add("hidden");
  if ($("dashboard")) $("dashboard").classList.add("hidden");

  if (user) {
    if ($("dashboard")) $("dashboard").classList.remove("hidden");
    $("statusText").textContent = "ONLINE";
    $("userName").textContent = user.displayName ? user.displayName.split(" ")[0] : "Boss";
    
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().memory) {
        chatHistory = docSnap.data().memory;
      }
      
      await setDoc(doc(db, "users", user.uid), { 
        uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp() 
      }, { merge: true });
      $("connectionLabel").textContent = "SYNCED";
    } catch (e) {
      console.error("Firestore error:", e);
    }
  } else {
    if ($("loginPanel")) $("loginPanel").classList.remove("hidden");
    $("statusText").textContent = "OFFLINE";
  }
});

// ========================================
// CHAT SYSTEM
// ========================================
let chatHistory = [];

function addMessage(text, who = "jarvis") {
  const bubble = document.createElement("div");
  bubble.className = "message" + (who === "user" ? " user" : "");

  const sender = document.createElement("span");
  sender.className = "sender";
  sender.textContent = who === "user" ? "YOU" : "J.A.R.V.I.S.";

  bubble.appendChild(sender);
  bubble.appendChild(document.createTextNode(text));
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

async function saveMemory() {
  const user = auth.currentUser;
  if (user) {
    try {
      await setDoc(doc(db, "users", user.uid), { memory: chatHistory.slice(-20) }, { merge: true });
    } catch (e) { console.error("Memory save failed", e); }
  }
}

async function sendMessage(text) {
  text = text.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  toast.textContent = "";
  
  chatHistory.push({ sender: "user", text: text });
  saveMemory();

  if (coreOrb) coreOrb.className = "core thinking";
  if (coreCaption) coreCaption.textContent = "PROCESSING...";

  const waiting = addMessage("Establishing secure connection...");

  try {
    const response = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: text,
        history: chatHistory.slice(0, -1)
      })
    });

    if (!response.ok) throw new Error("Backend returned HTTP " + response.status);

    const data = await response.json();
    waiting.remove();

    const reply = data.reply ?? data.response ?? data.message;
    addMessage(typeof reply === "string" ? reply : "The server did not provide a readable reply.");

    chatHistory.push({ sender: "jarvis", text: reply });
    if (chatHistory.length > 20) chatHistory.shift();
    saveMemory();

    if (coreOrb) coreOrb.className = "core";
    if (coreCaption) coreCaption.textContent = "CORE ACTIVE";
    speak(reply); 
    $("connectionLabel").textContent = "BACKEND CONNECTED";

  } catch (error) {
    waiting.remove();
    addMessage("I couldn't connect to the JARVIS backend. Please check your internet.");
    toast.textContent = "Connection issue: " + error.message;
    $("connectionLabel").textContent = "CONNECTION ISSUE";
    if (coreOrb) coreOrb.className = "core error";
    if (coreCaption) coreCaption.textContent = "ERROR";
    setTimeout(() => { 
      if (coreOrb) coreOrb.className = "core"; 
      if (coreCaption) coreCaption.textContent = "CORE ACTIVE";
    }, 2000);
  }
}

$("chatForm").addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});

// ========================================
// MIC & WAKE WORD ("Hey Jarvis")
// ========================================
let recognition = null;
let isListeningMode = false;

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast.textContent = "Voice recognition isn't supported in this browser.";
    return;
  }

  recognition = new SR();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  toast.textContent = "Listening... Speak now.";
  if (coreCaption) coreCaption.textContent = "LISTENING...";
  if (coreOrb) coreOrb.className = "core listening";
  micBtn.classList.add("listening");

  recognition.onresult = event => {
    input.value = event.results[0][0].transcript;
    toast.textContent = "Voice captured. Sending command...";
    sendMessage(input.value);
  };

  recognition.onerror = () => {
    toast.textContent = "Couldn't capture voice. Please try again.";
    if (coreCaption) coreCaption.textContent = "CORE ACTIVE";
    if (coreOrb) coreOrb.className = "core";
    micBtn.classList.remove("listening");
  };

  recognition.onend = () => {
    if (coreCaption && coreCaption.textContent === "LISTENING...") {
      coreCaption.textContent = "CORE ACTIVE";
      if (coreOrb) coreOrb.className = "core";
    }
    micBtn.classList.remove("listening");
  };

  recognition.start();
}

micBtn.addEventListener("click", startVoice);

// ========================================
// QUICK ACTIONS
// ========================================
document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "voice") { startVoice(); return; }
    const prompts = {
      projects: "Help me manage my JARVIS and MCU Tracker projects.",
      device: "Tell me which device tools are available in this web interface.",
      memory: "Help me organize my project notes and important information."
    };
    sendMessage(prompts[action]);
  });
}); 