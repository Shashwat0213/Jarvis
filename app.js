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
// NOTE: Firebase API key public rakhna SAFE hai.
// Ye project identifier hai, password nahi.
// Asli security Firestore Rules aur Auth se aati hai.

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
// BACKEND URL
// ========================================

const JARVIS_BACKEND = "https://jarvis-7es3.onrender.com";
const REQUEST_TIMEOUT_MS = 90000;

// ========================================
// HELPERS
// ========================================

const $ = id => document.getElementById(id);

// ========================================
// ELEMENTS
// ========================================

const loginPanel = $("loginPanel");
const dashboard = $("dashboard");

// ========================================
// TEXT-TO-SPEECH (JARVIS की आवाज़)
// ========================================

let voiceEnabled = true;
let selectedVoice = null;

// Best available voice chunne ka function
function pickBestVoice() {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Priority order:
  // 1. Indian English Male
  // 2. Indian English (any)
  // 3. British English Male
  // 4. Any English Male
  // 5. Any English
  // 6. Default

  const priorities = [
    v => v.lang === "en-IN" && /male/i.test(v.name),
    v => v.lang === "en-IN",
    v => v.lang === "en-GB" && /male/i.test(v.name),
    v => v.lang.startsWith("en") && /male/i.test(v.name),
    v => v.lang.startsWith("en"),
    v => true
  ];

  for (const test of priorities) {
    const found = voices.find(test);
    if (found) return found;
  }

  return voices[0];
}

// Voices load hone par best voice chuno
if ("speechSynthesis" in window) {
  // Pehli baar turant try karo
  selectedVoice = pickBestVoice();

  // Agar pehli baar nahi mile, to voices-changed event par
  window.speechSynthesis.onvoiceschanged = () => {
    selectedVoice = pickBestVoice();
    if (selectedVoice) {
      console.log("JARVIS voice ready:", selectedVoice.name, selectedVoice.lang);
    }
  };
}

// JARVIS bolne ka function
function speak(text) {
  if (!voiceEnabled) return;

  if (!("speechSynthesis" in window)) {
    console.warn("TTS not supported in this browser");
    return;
  }

  // Agar pehle se bol raha hai, to rok do
  window.speechSynthesis.cancel();

  // Agar selectedVoice null hai, fresh try karo
  if (!selectedVoice) {
    selectedVoice = pickBestVoice();
  }

  const utterance = new SpeechSynthesisUtterance(text);

  // Voice settings
  utterance.lang = selectedVoice?.lang || "en-IN";
  utterance.rate = 1.0;    // Speed (0.5 = slow, 2.0 = fast)
  utterance.pitch = 0.95;  // Thoda low pitch (male JARVIS feel)
  utterance.volume = 1.0;  // Full volume

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  // Error handling
  utterance.onerror = (event) => {
    console.error("TTS ERROR:", event.error);
  };

  utterance.onend = () => {
    console.log("JARVIS finished speaking");
  };

  window.speechSynthesis.speak(utterance);
}

// Bolna band karo
function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// ========================================
// VOICE TOGGLE BUTTON
// ========================================

// Voice toggle button agar HTML me hai to setup karo
const voiceToggleBtn = $("voiceToggle");

if (voiceToggleBtn) {
  // Initial state set karo
  voiceToggleBtn.textContent = voiceEnabled ? "🔊 Voice: ON" : "🔇 Voice: OFF";

  voiceToggleBtn.onclick = () => {
    voiceEnabled = !voiceEnabled;

    if (!voiceEnabled) {
      stopSpeaking();
      voiceToggleBtn.textContent = "🔇 Voice: OFF";
      const hint = $("voiceHint");
      if (hint) hint.textContent = "JARVIS will not speak replies";
    } else {
      voiceToggleBtn.textContent = "🔊 Voice: ON";
      const hint = $("voiceHint");
      if (hint) hint.textContent = "JARVIS will speak replies";
    }

    console.log("Voice toggled:", voiceEnabled);
  };
}

// ========================================
// GOOGLE LOGIN
// ========================================

$("loginBtn").onclick = async () => {
  $("loginMessage").textContent = "Opening Google sign-in…";
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    $("loginMessage").textContent =
      e.code === "auth/popup-blocked"
        ? "Popup blocked. Allow popups for this site and try again."
        : e.message;
  }
};

// ========================================
// LOGOUT
// ========================================

$("logoutBtn").onclick = async () => {
  try {
    stopSpeaking(); // Logout par bolna band karo
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

  // ----------------------------------------
  // USER LOGGED IN
  // ----------------------------------------

  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");

  $("statusText").textContent = "ONLINE";
  $("statusDot").style.background = "#64dfff";
  $("coreState").textContent = "ONLINE";
  $("greeting").textContent =
    `Welcome, ${user.displayName || "Operator"}. Jarvis is ready.`;
  $("userName").textContent = user.displayName || "Jarvis User";
  $("userEmail").textContent = user.email || "";
  $("authState").textContent = "CONNECTED";

  // ----------------------------------------
  // FIRESTORE SYNC
  // ----------------------------------------

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
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    $("micText").textContent =
      "This browser does not support voice recognition. Use Chrome or Edge.";
    return;
  }

  // Agar pehle se sun raha hai to stop karo
  if (isListening && recognition) {
    recognition.stop();
    return;
  }

  // Agar JARVIS bol raha hai to rok do
  stopSpeaking();

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
    console.error("VOICE ERROR:", event.error);
    isListening = false;
    $("coreState").textContent = "ONLINE";
    $("micIndicator").innerHTML = "<span></span> MIC READY";
    $("micIndicator").classList.remove("on");

    if (event.error === "not-allowed") {
      $("micText").textContent =
        "Microphone permission denied. Allow it in browser site settings.";
    } else if (event.error === "no-speech") {
      $("micText").textContent = "No speech detected. Try again.";
    } else {
      $("micText").textContent = `Voice error: ${event.error}`;
    }
  };

  recognition.onend = () => {
    isListening = false;
    $("coreState").textContent = "ONLINE";
    $("micIndicator").innerHTML = "<span></span> MIC READY";
    $("micIndicator").classList.remove("on");
  };

  try {
    recognition.start();
  } catch (e) {
    console.error("RECOGNITION START ERROR:", e);
    $("micText").textContent = e.message || "Could not start recognition.";
  }
};

// ========================================
// SEND COMMAND TO JARVIS
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

  console.log("JARVIS REQUEST:", text);

  // Agar JARVIS pehle bol raha tha to band karo
  stopSpeaking();

  responseBox.textContent =
    "Jarvis is waking up... (may take up to 60 seconds on first request)";
  coreState.textContent = "PROCESSING";

  // Input clear karo
  input.value = "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    console.log("Connecting to:", JARVIS_BACKEND + "/api/chat");

    const response = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ message: text }),
      signal: controller.signal
    });

    clearTimeout(timer);
    console.log("HTTP STATUS:", response.status);

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const raw = await response.text();
      console.error("NON-JSON BACKEND RESPONSE:", raw);
      throw new Error(
        `Backend returned ${response.status} instead of JSON. Is the backend running?`
      );
    }

    console.log("JARVIS BACKEND RESPONSE:", data);

    if (!response.ok) {
      throw new Error(
        data?.error || `Server error: ${response.status}`
      );
    }

    const reply = data?.reply;

    if (!reply) {
      throw new Error("Backend connected, but no JARVIS reply was received.");
    }

    // UI update
    responseBox.textContent = reply;
    coreState.textContent = "ONLINE";
    console.log("JARVIS REPLY:", reply);

    // 🔊 JARVIS BOLEGA!
    speak(reply);

  } catch (error) {
    clearTimeout(timer);
    console.error("JARVIS CONNECTION ERROR:", error);

    let friendlyMsg = error?.message || "Unknown error";

    if (error.name === "AbortError") {
      friendlyMsg =
        "Request timed out after 90 seconds. Please try again.";
    } else if (error.message?.includes("Failed to fetch")) {
      friendlyMsg =
        "Cannot reach JARVIS backend. Check if Render service is running.";
    }

    responseBox.textContent = "JARVIS ERROR: " + friendlyMsg;
    coreState.textContent = "ERROR";
  }
}

// ========================================
// SEND BUTTON
// ========================================

$("sendBtn").onclick = sendCommand;

// ========================================
// ENTER KEY
// ========================================

$("commandInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendCommand();
  }
});

// ========================================
// PAGE UNLOAD — bolna band
// ========================================

window.addEventListener("beforeunload", () => {
  stopSpeaking();
});