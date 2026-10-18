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

// Voice
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

// Auth
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if ($("loginPanel")) $("loginPanel").classList.add("hidden");
  if ($("dashboard")) $("dashboard").classList.add("hidden");

  if (user) {
    if ($("dashboard")) $("dashboard").classList.remove("hidden");
    $("systemStatus").textContent = "SYS: ONLINE";
    $("userName").textContent = user.displayName || "Operator";
    $("authState").textContent = "AUTH: SECURE";

    try {
      await setDoc(doc(db, "users", user.uid), { uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp() }, { merge: true });
      $("profileState").textContent = "SYNCED";
    } catch (e) {
      $("profileState").textContent = "ERROR";
    }
  } else {
    if ($("loginPanel")) $("loginPanel").classList.remove("hidden");
    $("systemStatus").textContent = "SYS: OFFLINE";
  }
});

// Chat & Memory
const chatBox = $("chatContainer");
let chatHistory = [];

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
  chatHistory.push({ sender: "user", text: text });
  
  const typing = addMsg("...", "jarvis");
  
  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: chatHistory.slice(0, -1) })
    });
    const data = await res.json();
    if (typing) typing.remove();

    if (data.reply) { 
      addMsg(data.reply, "jarvis"); 
      chatHistory.push({ sender: "jarvis", text: data.reply });
      if (chatHistory.length > 10) chatHistory.shift();
      speak(data.reply); 
    } else throw new Error();
  } catch (e) {
    if (typing) typing.remove();
    addMsg("System Error.", "jarvis", true);
  }
}

$("sendBtn").onclick = sendCommand;
$("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") sendCommand(); });

// Mic (Fixed Loop)
let recognition = null;
let isListeningMode = false;
const micBtn = $("micBtn");
const micIndicator = $("micIndicator");

if (micBtn) {
  micBtn.onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Use Chrome.");
    
    if (isListeningMode) { stopMic(); return; }
    startWakeWord();
  };
}

function startWakeWord() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "hi-IN"; 
  recognition.continuous = false; // Loop fix
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListeningMode = true;
    micBtn.classList.add("listening");
    micIndicator.classList.add("on");
    micIndicator.textContent = "LISTENING (Say 'Hey Jarvis')";
  };

  recognition.onresult = (event) => {
    const t = event.results[0][0].transcript.toLowerCase();
    if (t.includes("hey jarvis") || t.includes("hello jarvis") || t.includes("हे जार्विस")) {
      micIndicator.textContent = "ACTIVE...";
      setTimeout(listenForCommand, 300);
    } else {
      stopMic(); // अगर गलत बोला तो बंद करो
    }
  };

  recognition.onerror = () => stopMic();
  recognition.onend = () => { if (isListeningMode && micIndicator.textContent.includes("LISTENING")) stopMic(); };
  recognition.start();
}

function listenForCommand() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "hi-IN"; 
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript;
    if ($("commandInput")) $("commandInput").value = command;
    sendCommand();
  };
  recognition.onend = () => stopMic();
  recognition.onerror = () => stopMic();
  recognition.start();
}

function stopMic() {
  isListeningMode = false;
  if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  if (micBtn) micBtn.classList.remove("listening");
  if (micIndicator) { micIndicator.classList.remove("on"); micIndicator.textContent = "VOICE: OFF"; }
}
