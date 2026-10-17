import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ========================================
// FIREBASE CONFIG
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyCIiomQVg4N5Fnp9u15yXasBfuny8Of6FQ",
  authDomain: "jarvis-44a31.firebaseapp.com",
  projectId: "jarvis-44a31",
  storageBucket: "jarvis-44a31.firebasestorage.app",
  messagingSenderId: "330404685457",
  appId: "1:330404685457:web:20e0539a2a145717cfc130",
  measurementId: "G-B2XDSYTX8M"
};

// ========================================
// FIREBASE INIT
// ========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ========================================
// BACKEND URL & SETTINGS
// ========================================
const JARVIS_BACKEND = "https://jarvis-7es3.onrender.com"; // आपका रेंडर URL
const REQUEST_TIMEOUT_MS = 90000;

// ========================================
// HELPERS
// ========================================
const $ = id => document.getElementById(id);

const loginPanel = $("loginPanel");
const dashboard = $("dashboard");

// ========================================
// TEXT-TO-SPEECH (JARVIS की आवाज़)
// ========================================
let voiceEnabled = true;
let selectedVoice = null;

function pickBestVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // प्राथमिकता: इंडियन इंग्लिश मेल -> ब्रिटिश मेल -> कोई भी इंग्लिश
  const priorities = [
    v => v.lang === "en-IN" && /male/i.test(v.name),
    v => v.lang === "en-IN",
    v => v.lang === "en-GB" && /male/i.test(v.name),
    v => v.lang.startsWith("en"),
    v => true
  ];

  for (const test of priorities) {
    const found = voices.find(test);
    if (found) return found;
  }
  return voices[0];
}

if ("speechSynthesis" in window) {
  selectedVoice = pickBestVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    selectedVoice = pickBestVoice();
  };
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  
  if (!selectedVoice) selectedVoice = pickBestVoice();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = selectedVoice?.lang || "en-IN";
  utterance.rate = 1.0; 
  utterance.pitch = 0.95; 
  if (selectedVoice) utterance.voice = selectedVoice;

  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// Voice Toggle
const voiceToggleBtn = $("voiceToggle");
if (voiceToggleBtn) {
  voiceToggleBtn.onclick = () => {
    voiceEnabled = !voiceEnabled;
    if (!voiceEnabled) stopSpeaking();
    voiceToggleBtn.textContent = voiceEnabled ? "🔊 Voice: ON" : "🔇 Voice: OFF";
    const hint = $("voiceHint");
    if (hint) hint.textContent = voiceEnabled ? "JARVIS will speak replies" : "JARVIS will not speak";
  };
}

// ========================================
// GOOGLE LOGIN / LOGOUT
// ========================================
$("loginBtn").onclick = async () => {
  $("loginMessage").textContent = "Opening Google sign-in…";
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    $("loginMessage").textContent = e.code === "auth/popup-blocked" ? "Popup blocked. Allow popups." : e.message;
  }
};

$("logoutBtn").onclick = async () => {
  try {
    stopSpeaking();
    await signOut(auth);
  } catch (e) {
    console.error("LOGOUT ERROR:", e);
  }
};

// ========================================
// AUTH STATE
// ========================================
onAuthStateChanged(auth, async user => {
  if (!user) {
    loginPanel.classList.remove("hidden");
    dashboard.classList.add("hidden");
    $("statusText").textContent = "OFFLINE";
    $("statusDot").style.background = "#596773";
    $("coreState").textContent = "STANDBY";
    $("greeting").textContent = "Awaiting authentication.";
    return;
  }

  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");

  $("statusText").textContent = "ONLINE";
  $("statusDot").style.background = "#64dfff";
  $("coreState").textContent = "ONLINE";
  $("greeting").textContent = `Welcome, ${user.displayName || "Operator"}. Jarvis is ready.`;
  $("userName").textContent = user.displayName || "Jarvis User";
  $("userEmail").textContent = user.email || "";
  $("authState").textContent = "CONNECTED";

  // Firestore Sync
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        lastLogin: serverTimestamp()
      },
      { merge: true }
    );
    $("profileState").textContent = "SYNCED";
  } catch (e) {
    console.error("FIRESTORE ERROR:", e);
    $("profileState").textContent = "ERROR";
  }
});

// ========================================
// MICROPHONE + VOICE RECOGNITION (STT)
// ========================================
let recognition = null;
let isListening = false;

$("micBtn").onclick = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("micText").textContent = "Voice recognition not supported. Use Chrome.";
    return;
  }
  if (isListening && recognition) {
    recognition.stop();
    return;
  }
  stopSpeaking(); // बोलना बंद करो

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    $("micIndicator").classList.add("on");
    $("micIndicator").innerHTML = "<span></span> LISTENING";
    $("coreState").textContent = "LISTENING";
    $("micText").textContent = "Listening... speak now.";
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    console.log("VOICE COMMAND:", transcript);
    $("commandInput").value = transcript;
    sendCommand();
  };

  recognition.onerror = event => {
    isListening = false;
    $("coreState").textContent = "ONLINE";
    $("micIndicator").innerHTML = "<span></span> MIC READY";
    $("micIndicator").classList.remove("on");
    $("micText").textContent = event.error === "not-allowed" ? "Mic permission denied." : `Voice error: ${event.error}`;
  };

  recognition.onend = () => {
    isListening = false;
    $("coreState").textContent = "ONLINE";
    $("micIndicator").innerHTML = "<span></span> MIC READY";
    $("micIndicator").classList.remove("on");
  };

  try { recognition.start(); } 
  catch (e) { $("micText").textContent = e.message; }
};

// ========================================
// SEND COMMAND & CHAT ANIMATION
// ========================================
async function sendCommand() {
  const input = $("commandInput");
  const responseBox = $("response");
  const coreState = $("coreState");

  const text = input.value.trim();
  if (!text) {
    responseBox.textContent = "Please enter a command.";
    return;
  }

  stopSpeaking();
  
  // Typing Animation start
  responseBox.textContent = "JARVIS is analyzing";
  responseBox.classList.add("thinking");
  coreState.textContent = "PROCESSING";
  input.value = "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ message: text }),
      signal: controller.signal
    });

    clearTimeout(timer);
    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      throw new Error(`Backend returned ${response.status} instead of JSON.`);
    }

    if (!response.ok) throw new Error(data?.error || `Server error: ${response.status}`);
    const reply = data?.reply;
    if (!reply) throw new Error("No JARVIS reply received.");

    // Typing animation stop & Show reply
    responseBox.classList.remove("thinking");
    responseBox.textContent = reply;
    coreState.textContent = "ONLINE";

    speak(reply); // 🔊 JARVIS BOLEGA

  } catch (error) {
    clearTimeout(timer);
    responseBox.classList.remove("thinking"); // Error पर भी हटाएँ
    
    let friendlyMsg = error?.message || "Unknown error";
    if (error.name === "AbortError") {
      friendlyMsg = "Request timed out. Please try again.";
    } else if (error.message?.includes("Failed to fetch")) {
      friendlyMsg = "Cannot reach JARVIS backend. Check Render.";
    }
    
    responseBox.textContent = "JARVIS ERROR: " + friendlyMsg;
    coreState.textContent = "ERROR";
  }
}

// ========================================
// SEND BUTTON & ENTER KEY
// ========================================
$("sendBtn").onclick = sendCommand;

$("commandInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendCommand();
  }
});

window.addEventListener("beforeunload", () => stopSpeaking());