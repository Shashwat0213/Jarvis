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
const $ = (selector) => document.querySelector(selector);

setPersistence(auth, browserLocalPersistence).catch(console.error);

// --- UI ELEMENTS ---
const chatLog = $("#chatLog");
const commandInput = $("#commandInput");
const micButton = $("#micButton");
const micLabel = $("#micLabel");
const voiceHint = $("#voiceHint");

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
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 0.9; u.lang = "hi-IN";
  if (selectedVoice) u.voice = selectedVoice;
  window.speechSynthesis.speak(u);
}

// --- CHAT & MEMORY ---
let chatHistory = []; 

function addMessage(text, sender = "jarvis", isError = false) {
  if (chatLog.children.length === 1 && chatLog.children[0].textContent.includes("Systems online")) chatLog.innerHTML = "";
  const row = document.createElement("div");
  row.className = `message ${sender === "user" ? "user-message" : "jarvis-message"}`;
  const icon = document.createElement("span");
  icon.textContent = sender === "user" ? "YOU" : "J";
  const bubble = document.createElement("p");
  bubble.textContent = text;
  row.append(icon, bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function handleCommand(raw) {
  const command = raw.trim();
  if (!command) return;
  
  addMessage(command, "user");
  commandInput.value = "";
  chatHistory.push({ sender: "user", text: command });
  
  document.body.classList.add("thinking");
  const typing = addMessage("...", "jarvis");

  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: command, history: chatHistory.slice(0, -1) })
    });
    const data = await res.json();
    if (typing) typing.remove();
    document.body.classList.remove("thinking");
    
    if (data.reply) { 
      addMessage(data.reply, "jarvis"); 
      chatHistory.push({ sender: "jarvis", text: data.reply });
      if (chatHistory.length > 10) chatHistory.shift(); 
      speak(data.reply); 
    } else { throw new Error(); }
  } catch (e) {
    if (typing) typing.remove();
    document.body.classList.remove("thinking");
    addMessage("System Error.", "jarvis", true);
  }
}

$("#commandForm").addEventListener("submit", (event) => {
  event.preventDefault();
  handleCommand(commandInput.value);
});

// --- AUTH ---
$("#loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("#logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (user) {
    $("#userName").textContent = user.displayName ? user.displayName.split(" ")[0] : "Commander";
    $("#authState").textContent = "AUTH: SECURE";
    $("#authStatus").textContent = "CONNECTED";
    $("#authStatus").className = "tag tag-live";
    $("#systemStatus").textContent = "ONLINE";
    try {
      await setDoc(doc(db, "users", user.uid), { uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp() }, { merge: true });
      $("#profileState").textContent = "Cloud Sync: SYNCED";
    } catch (e) { $("#profileState").textContent = "Sync Error"; }
  } else {
    $("#userName").textContent = "Commander.";
    $("#authState").textContent = "AUTH: WAITING";
    $("#authStatus").textContent = "PENDING";
    $("#authStatus").className = "tag tag-pending";
    $("#systemStatus").textContent = "OFFLINE";
    $("#profileState").textContent = "Cloud Sync: WAITING";
  }
});

// --- MIC & WAKE WORD (NO LOOP BUG) ---
let recognition = null;
let isListeningMode = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  micButton.addEventListener("click", () => {
    if (isListeningMode) { stopMic(); return; }
    startWakeWord();
  });
}

function startWakeWord() {
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN"; // Hindi / English
  recognition.continuous = false; // सिर्फ एक बार सुनेगा, लूप नहीं बनेगा
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListeningMode = true;
    micButton.classList.add("listening");
    micLabel.textContent = "LISTENING...";
    voiceHint.textContent = "Boliye... (Say Hey Jarvis)";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    
    if (transcript.includes("hey jarvis") || transcript.includes("hello jarvis")) {
      micLabel.textContent = "YES SIR?";
      voiceHint.textContent = "Listening to command...";
      setTimeout(listenForCommand, 300); // 0.3 सेकंड बाद कमांड सुनें
    } else {
      // अगर 'Hey Jarvis' नहीं बोला, तो फिर से सुनो
      micLabel.textContent = "TRY AGAIN";
      voiceHint.textContent = "I didn't hear 'Hey Jarvis'.";
      stopMic();
    }
  };

  recognition.onerror = () => stopMic();
  recognition.onend = () => { if (isListeningMode && micLabel.textContent === "LISTENING...") stopMic(); };
  recognition.start();
}

function listenForCommand() {
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN"; 
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript;
    handleCommand(command);
  };
  recognition.onend = () => stopMic(); // कमांड के बाद माइक खुद बंद हो जाएगा
  recognition.onerror = () => stopMic();
  recognition.start();
}

function stopMic() {
  isListeningMode = false;
  if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  micButton.classList.remove("listening");
  micLabel.textContent = "TAP TO SPEAK";
  voiceHint.textContent = "Say 'Hey Jarvis' or click to speak.";
}

// --- SVG HUD ANIMATION (Simplified for Mobile Performance) ---
(() => {
  const NS = 'http://www.w3.org/2000/svg', hud = document.querySelector('#hud');
  const C = '#38e8ff', O = '#ff8a2a';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rad = d => d * Math.PI / 180;
  const pt = (r, a) => [Math.cos(rad(a)) * r, Math.sin(rad(a)) * r];
  
  function el(tag, at, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in at) e.setAttribute(k, at[k]);
    (parent || hud).appendChild(e);
    return e;
  }
  
  const layer = (sp, R) => {
    const g = el('g', { class: 'rot', style: `animation-duration:${Math.abs(sp)}s; animation-direction:${sp < 0 ? 'reverse' : 'normal'}` });
    el('circle', { r: R, fill: 'none', stroke: 'none' }, g);
    return g;
  };
  
  const ring = (g, r, w, col, op) => el('circle', { r, fill: 'none', stroke: col, 'stroke-width': w, opacity: op }, g);
  
  let g = layer(100, 200);
  ring(g, 150, 1, C, .5);
  
  g = layer(-80, 150);
  ring(g, 120, .8, C, .6);
  
  g = layer(50, 100);
  ring(g, 80, 1.5, C, .8);
  
  el('circle', { class: 'glowc', r: 40, fill: 'rgba(56,232,255,0.2)' });
  el('circle', { r: 15, fill: '#fff', opacity: 0.8 });

})();