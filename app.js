import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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

// --- VOICE SETUP ---
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
  
  const orb = $("coreOrb");
  if (orb) orb.className = "core-orb speaking";

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 0.9; 
  u.lang = "hi-IN";
  if (selectedVoice) u.voice = selectedVoice;
  
  u.onend = () => { if (orb) orb.className = "core-orb"; };
  window.speechSynthesis.speak(u);
}

// --- AUTH ---
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if ($("loginPanel")) $("loginPanel").classList.add("hidden");
  if ($("dashboard")) $("dashboard").classList.add("hidden");

  if (user) {
    if ($("dashboard")) $("dashboard").classList.remove("hidden");
    $("systemStatus").textContent = "SYS: ONLINE";
    $("userName").textContent = user.displayName || "Operator";
    
    // Load Memory from Firestore
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().memory) {
        chatHistory = docSnap.data().memory;
      }
      
      await setDoc(doc(db, "users", user.uid), { 
        uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp() 
      }, { merge: true });
      $("profileState").textContent = "SYNCED";
    } catch (e) {
      console.error("Firestore error:", e);
      $("profileState").textContent = "ERROR";
    }
  } else {
    if ($("loginPanel")) $("loginPanel").classList.remove("hidden");
    $("systemStatus").textContent = "SYS: OFFLINE";
  }
});

// --- CHAT & MEMORY ---
const chatBox = $("chatContainer");
let chatHistory = []; // Memory Array

function addMsg(text, sender, isError = false) {
  if (chatBox.children.length === 1 && chatBox.children[0].textContent.includes("Systems initialized")) chatBox.innerHTML = "";
  
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${isError ? 'error' : sender}`;
  
  const content = document.createElement("div");
  content.className = "msg-content";
  content.textContent = text;
  
  msgDiv.appendChild(content);
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msgDiv;
}

async function saveMemory() {
  const user = auth.currentUser;
  if (user) {
    try {
      await setDoc(doc(db, "users", user.uid), { memory: chatHistory.slice(-20) }, { merge: true });
    } catch (e) { console.error("Memory save failed", e); }
  }
}

async function sendCommand() {
  const input = $("commandInput");
  const text = input.value.trim();
  if (!text) return;
  
  addMsg(text, "user");
  input.value = "";
  chatHistory.push({ sender: "user", text: text });
  saveMemory(); // Save Memory
  
  const orb = $("coreOrb");
  if (orb) orb.className = "core-orb thinking";
  
  const typing = addMsg("...", "jarvis");
  
  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: text, 
        history: chatHistory.slice(0, -1) 
      })
    });
    
    if (!res.ok) throw new Error("Server Error");

    const data = await res.json();
    if (typing) typing.remove();

    if (data.reply) { 
      addMsg(data.reply, "jarvis"); 
      chatHistory.push({ sender: "jarvis", text: data.reply });
      if (chatHistory.length > 20) chatHistory.shift(); // Limit memory
      saveMemory(); // Save Memory
      speak(data.reply); 
    } else {
      throw new Error("Invalid response");
    }
  } catch (e) {
    if (typing) typing.remove();
    if (orb) orb.className = "core-orb error";
    addMsg("Error: " + e.message, "jarvis", true);
    setTimeout(() => { if (orb) orb.className = "core-orb"; }, 2000);
  }
}

$("sendBtn").onclick = sendCommand;
$("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") sendCommand(); });

// --- MIC & WAKE WORD ---
let recognition = null;
let isListeningMode = false;
const micBtn = $("micBtn");
const micIndicator = $("micIndicator");
const coreOrb = $("coreOrb");

if (micBtn) {
  micBtn.onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Browser voice support nahi karta.");
    
    if (isListeningMode) { stopMic(); return; }
    startWakeWord();
  };
}

function startWakeWord() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "hi-IN"; 
  recognition.continuous = false; 
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListeningMode = true;
    micBtn.classList.add("listening");
    micIndicator.classList.add("on");
    micIndicator.textContent = "LISTENING...";
    if (coreOrb) coreOrb.className = "core-orb listening";
    speak("Yes Sir, I am listening."); // Voice Feedback
  };

  recognition.onresult = (event) => {
    const t = event.results[0][0].transcript.toLowerCase();
    if (t.includes("hey jarvis") || t.includes("hello jarvis")) {
      micIndicator.textContent = "YES SIR?";
      setTimeout(listenForCommand, 300);
    } else {
      stopMic();
    }
  };

  recognition.onerror = () => stopMic();
  recognition.onend = () => { if (isListeningMode) stopMic(); };
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
  if (coreOrb && coreOrb.classList.contains("listening")) coreOrb.className = "core-orb";
}
