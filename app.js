import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCIiomQVg4N5Fnp9u15yXasBfuny8Of6FQ",
  authDomain: "jarvis-44a31.firebaseapp.com",
  projectId: "jarvis-44a31",
  storageBucket: "jarvis-44a31.firebasestorage.app",
  messagingSenderId: "330404685457",
  appId: "1:330404685457:web:20e0539a2a145717cfc130",
  measurementId: "G-B2XDSYTX8M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// BACKEND URL
const JARVIS_BACKEND = "https://jarvis-7es3.onrender.com"; // अपना URL यहाँ चेक करें
const REQUEST_TIMEOUT_MS = 90000;

const $ = id => document.getElementById(id);
const loginPanel = $("loginPanel");
const dashboard = $("dashboard");

// TEXT-TO-SPEECH
let voiceEnabled = true;
let selectedVoice = null;

function pickBestVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  return voices.find(v => v.lang === "en-IN" && /male/i.test(v.name)) || voices.find(v => v.lang === "en-IN") || voices[0];
}

if ("speechSynthesis" in window) {
  selectedVoice = pickBestVoice();
  window.speechSynthesis.onvoiceschanged = () => { selectedVoice = pickBestVoice(); };
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0; utterance.pitch = 0.95;
  if (selectedVoice) utterance.voice = selectedVoice;
  window.speechSynthesis.speak(utterance);
}
function stopSpeaking() { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }

$("voiceToggle").onclick = () => {
  voiceEnabled = !voiceEnabled;
  if (!voiceEnabled) stopSpeaking();
  $("voiceToggle").textContent = voiceEnabled ? "🔊 Voice: ON" : "🔇 Voice: OFF";
  $("voiceHint").textContent = voiceEnabled ? "JARVIS will speak replies" : "JARVIS will not speak";
};

// CHAT UI LOGIC
const chatContainer = $("chatContainer");

function addMessage(text, sender, isError = false) {
  // अगर पहला मैसेज "Jarvis is ready" है तो उसे हटा दें
  if (chatContainer.children.length === 1 && chatContainer.children[0].textContent === "Jarvis is ready.") {
    chatContainer.innerHTML = "";
  }

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message");
  
  if (isError) {
    msgDiv.classList.add("jarvis-error");
  } else {
    msgDiv.classList.add(sender === "user" ? "user-msg" : "jarvis-msg");
  }
  
  msgDiv.textContent = text;
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight; // स्क्रॉल नीचे रखें
  return msgDiv;
}

function showTypingIndicator() {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message", "jarvis-msg");
  msgDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msgDiv;
}

// AUTH
$("loginBtn").onclick = async () => {
  $("loginMessage").textContent = "Opening Google sign-in…";
  try { await signInWithPopup(auth, provider); } 
  catch (e) { $("loginMessage").textContent = e.message; }
};

$("logoutBtn").onclick = async () => {
  stopSpeaking(); await signOut(auth);
};

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginPanel.classList.remove("hidden");
    dashboard.classList.add("hidden");
    $("statusText").textContent = "OFFLINE"; $("statusDot").style.background = "#596773";
    $("coreState").textContent = "STANDBY"; $("greeting").textContent = "Awaiting authentication.";
    return;
  }
  loginPanel.classList.add("hidden"); dashboard.classList.remove("hidden");
  $("statusText").textContent = "ONLINE"; $("statusDot").style.background = "#64dfff";
  $("coreState").textContent = "ONLINE"; $("greeting").textContent = `Welcome, ${user.displayName || "Operator"}.`;
  $("userName").textContent = user.displayName || "Jarvis User"; $("userEmail").textContent = user.email || "";
  $("authState").textContent = "CONNECTED";

  try {
    await setDoc(doc(db, "users", user.uid), { uid: user.uid, name: user.displayName || "", email: user.email || "", lastLogin: serverTimestamp() }, { merge: true });
    $("profileState").textContent = "SYNCED";
  } catch (e) { $("profileState").textContent = "ERROR"; }
});

// MICROPHONE
let recognition = null;
let isListening = false;
const micBtn = $("micBtn");

micBtn.onclick = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { addMessage("Voice recognition not supported. Use Chrome.", "jarvis", true); return; }
  
  if (isListening && recognition) { recognition.stop(); return; }
  stopSpeaking();

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; recognition.interimResults = false; recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true; micBtn.classList.add("listening");
    $("micIndicator").classList.add("on"); $("micIndicator").innerHTML = "<span></span> LISTENING";
    $("coreState").textContent = "LISTENING"; $("micText").textContent = "Listening... speak now.";
  };

  recognition.onresult = event => {
    $("commandInput").value = event.results[0][0].transcript;
    sendCommand();
  };

  recognition.onerror = event => {
    isListening = false; micBtn.classList.remove("listening");
    $("micIndicator").innerHTML = "<span></span> MIC OFF"; $("micIndicator").classList.remove("on");
    $("micText").textContent = `Error: ${event.error}`;
  };

  recognition.onend = () => {
    isListening = false; micBtn.classList.remove("listening");
    $("coreState").textContent = "ONLINE";
    $("micIndicator").innerHTML = "<span></span> MIC READY"; 
    if ($("micText").textContent.includes("Listening")) $("micText").textContent = "Click mic to speak.";
  };

  try { recognition.start(); } catch (e) { addMessage(e.message, "jarvis", true); }
};

// SEND COMMAND
async function sendCommand() {
  const input = $("commandInput");
  const text = input.value.trim();
  if (!text) return;

  stopSpeaking();
  addMessage(text, "user"); // यूज़र का मैसेज ऐड करें
  input.value = "";
  
  $("coreState").textContent = "PROCESSING";
  const typingMsg = showTypingIndicator(); // टाइपिंग एनिमेशन दिखाएं

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
      signal: controller.signal
    });

    clearTimeout(timer);
    const data = await response.json();
    typingMsg.remove(); // टाइपिंग हटाएं

    if (!response.ok) throw new Error(data?.error || `Server error: ${response.status}`);
    const reply = data?.reply;
    if (!reply) throw new Error("No JARVIS reply received.");

    addMessage(reply, "jarvis"); // JARVIS का जवाब दिखाएं
    $("coreState").textContent = "ONLINE";
    speak(reply); // 🔊 बोलें

  } catch (error) {
    clearTimeout(timer);
    typingMsg.remove();
    let friendlyMsg = error?.message || "Unknown error";
    if (error.name === "AbortError") friendlyMsg = "Request timed out.";
    
    addMessage(friendlyMsg, "jarvis", true); // एरर मैसेज
    $("coreState").textContent = "ERROR";
  }
}

$("sendBtn").onclick = sendCommand;
$("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sendCommand(); } });
window.addEventListener("beforeunload", () => stopSpeaking());