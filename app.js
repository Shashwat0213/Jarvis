import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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

// VOICE
let voiceEnabled = true;
let selectedVoice = null;
if ("speechSynthesis" in window) {
  const loadVoices = () => {
    const v = window.speechSynthesis.getVoices();
    selectedVoice = v.find(x => x.lang === "en-GB") || v.find(x => x.lang === "en-IN") || v[0];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}
function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 0.9; // Deep classic voice
  if (selectedVoice) u.voice = selectedVoice;
  window.speechSynthesis.speak(u);
}

// AUTH
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if ($("loginPanel")) $("loginPanel").classList.add("hidden");
  if ($("dashboard")) $("dashboard").classList.add("hidden");

  if (user) {
    if ($("dashboard")) $("dashboard").classList.remove("hidden");
    if ($("statusText")) $("statusText").textContent = "ONLINE";
    if ($("userName")) $("userName").textContent = user.displayName || "Operator";
    if ($("authState")) $("authState").textContent = "AUTH: SECURE";

    try {
      await setDoc(doc(db, "users", user.uid), { uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp() }, { merge: true });
      if ($("profileState")) $("profileState").textContent = "SYNCED";
    } catch (e) {
      if ($("profileState")) $("profileState").textContent = "ERROR";
    }
  } else {
    if ($("loginPanel")) $("loginPanel").classList.remove("hidden");
    if ($("statusText")) $("statusText").textContent = "STANDBY";
  }
});

// CHAT & ORB ANIMATION
const chatBox = $("chatContainer");
const orb = document.querySelector(".orb"); // Central Orb Element

function addMsg(text, sender, isError = false) {
  if (chatBox.children.length === 1 && chatBox.children[0].textContent.includes("Systems initialized")) chatBox.innerHTML = "";
  const div = document.createElement("div");
  div.className = `msg ${isError ? 'error' : sender}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

async function sendCommand() {
  const input = $("commandInput");
  const text = input.value.trim();
  if (!text) return;
  
  addMsg(text, "user");
  input.value = "";
  
  // Orb Processing State ON
  if (orb) orb.classList.add("processing");
  const typing = addMsg("...", "jarvis");
  
  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (typing) typing.remove();
    
    // Orb Processing State OFF
    if (orb) orb.classList.remove("processing");

    if (data.reply) { 
      addMsg(data.reply, "jarvis"); 
      speak(data.reply); 
    } else {
      throw new Error();
    }
  } catch (e) {
    if (typing) typing.remove();
    if (orb) orb.classList.remove("processing");
    addMsg("System Error: Cannot reach backend.", "jarvis", true);
  }
}

if ($("sendBtn")) $("sendBtn").onclick = sendCommand;
if ($("commandInput")) $("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") sendCommand(); });

// MIC & WAKE WORD
let recognition = null;
let isListeningForWakeWord = false;
const micBtn = $("micBtn");

if (micBtn) {
  micBtn.onclick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice recognition requires Chrome.");
    
    if (isListeningForWakeWord) {
      isListeningForWakeWord = false;
      if (recognition) recognition.stop();
      resetMicUI();
      return;
    }
    startWakeWord();
  };
}

function startWakeWord() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; 
  recognition.continuous = true; 
  recognition.interimResults = true; 

  recognition.onstart = () => {
    isListeningForWakeWord = true;
    if (micBtn) micBtn.classList.add("listening");
    if ($("micIndicator")) { $("micIndicator").classList.add("on"); $("micIndicator").textContent = "LISTENING (Say 'Hey Jarvis')"; }
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    
    if (transcript.toLowerCase().includes("hey jarvis") || transcript.toLowerCase().includes("hello jarvis")) {
      isListeningForWakeWord = false;
      recognition.stop();
      if ($("micIndicator")) $("micIndicator").textContent = "COMMAND MODE...";
      setTimeout(listenForCommand, 500);
    }
  };

  recognition.onerror = () => resetMicUI();
  recognition.onend = () => { if (isListeningForWakeWord) recognition.start(); };
  recognition.start();
}

function listenForCommand() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; 
  recognition.continuous = false; 

  recognition.onresult = (event) => {
    if ($("commandInput")) $("commandInput").value = event.results[0][0].transcript;
    sendCommand();
  };
  recognition.onend = () => resetMicUI();
  recognition.onerror = () => resetMicUI();
  recognition.start();
}

function resetMicUI() {
  isListeningForWakeWord = false;
  if (micBtn) micBtn.classList.remove("listening");
  if ($("micIndicator")) { $("micIndicator").classList.remove("on"); $("micIndicator").textContent = "VOICE MODULE: OFF"; }
}