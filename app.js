import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
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

// TTS (Voice)
let voiceEnabled = true;
let selectedVoice = null;
if ("speechSynthesis" in window) {
  const loadVoices = () => {
    const v = window.speechSynthesis.getVoices();
    selectedVoice = v.find(x => x.lang === "en-IN" && /male/i.test(x.name)) || v.find(x => x.lang.startsWith("en")) || v[0];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}
function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 0.95;
  if (selectedVoice) u.voice = selectedVoice;
  window.speechSynthesis.speak(u);
}
$("voiceToggle").onclick = () => {
  voiceEnabled = !voiceEnabled;
  $("voiceToggle").textContent = voiceEnabled ? "🔊 Voice ON" : "🔇 Voice OFF";
};

// Auth & Sync
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (user) {
    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("statusText").textContent = "ONLINE";
    $("statusDot").style.background = "#00ff88";
    $("userName").textContent = user.displayName || "User";
    $("authState").textContent = "CONNECTED";

    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp()
      }, { merge: true });
      $("profileState").textContent = "SYNCED";
    } catch (e) {
      $("profileState").textContent = "ERROR";
    }
  } else {
    $("loginPanel").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
    $("statusText").textContent = "OFFLINE";
    $("statusDot").style.background = "#555";
    $("profileState").textContent = "WAITING";
    $("userName").textContent = "—";
  }
});

// Chat
const chatBox = $("chatContainer");
function addMsg(text, sender, isError = false) {
  if (chatBox.children.length === 1 && chatBox.children[0].textContent.includes("System online")) chatBox.innerHTML = "";
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
  const typing = addMsg("...", "jarvis");
  
  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    typing.remove();
    if (data.reply) { addMsg(data.reply, "jarvis"); speak(data.reply); }
    else throw new Error();
  } catch (e) {
    typing.remove();
    addMsg("Error connecting to backend.", "jarvis", true);
  }
}
$("sendBtn").onclick = sendCommand;
$("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") sendCommand(); });

// Mic & Wake Word
let rec = null;
const micBtn = $("micBtn");
micBtn.onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert("Use Chrome.");
  if (rec) { rec.stop(); rec = null; resetMic(); return; }
  startWakeWord();
};

function startWakeWord() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  rec = new SR(); rec.lang = "en-IN"; rec.continuous = true; rec.interimResults = true;
  
  rec.onstart = () => {
    micBtn.classList.add("listening");
    $("micIndicator").classList.add("on");
    $("micIndicator").textContent = "LISTENING FOR 'HEY JARVIS'...";
  };

  rec.onresult = (e) => {
    const t = Array.from(e.results).map(r => r[0].transcript).join("").toLowerCase();
    if (t.includes("hey jarvis") || t.includes("hello jarvis")) {
      rec.stop(); rec = null;
      $("micIndicator").textContent = "LISTENING...";
      setTimeout(startCommandListen, 300);
    }
  };
  rec.onerror = () => resetMic();
  rec.onend = () => { if (rec) rec.start(); };
  rec.start();
}

function startCommandListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  rec = new SR(); rec.lang = "en-IN"; rec.continuous = false;
  rec.onresult = (e) => { $("commandInput").value = e.results[0][0].transcript; sendCommand(); };
  rec.onend = () => resetMic();
  rec.onerror = () => resetMic();
  rec.start();
}

function resetMic() {
  rec = null;
  micBtn.classList.remove("listening");
  $("micIndicator").classList.remove("on");
  $("micIndicator").textContent = "MIC OFF";
}
