import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ========================================
// CONFIG & INITIALIZATION
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

// ========================================
// VOICE OUTPUT (TEXT-TO-SPEECH)
// ========================================
let voiceEnabled = true;
let selectedVoice = null;

function loadVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  selectedVoice = voices.find(v => v.lang === "en-IN" && /male/i.test(v.name)) || voices.find(v => v.lang.startsWith("en")) || voices[0];
}

if ("speechSynthesis" in window) {
  loadVoice();
  window.speechSynthesis.onvoiceschanged = loadVoice;
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
  $("voiceToggle").textContent = voiceEnabled ? "🔊 Voice: ON" : "🔇 Voice: OFF";
};

// ========================================
// AUTHENTICATION & CLOUD SYNC
// ========================================
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (user) {
    // UI Switch
    $("loginPanel").classList.add("hidden");
    $("heroSection").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    
    // Update UI Info
    $("statusText").textContent = "ONLINE";
    $("statusDot").style.background = "#64dfff";
    $("userName").textContent = user.displayName || "Authorized User";
    $("userEmail").textContent = user.email;
    $("authState").textContent = "CONNECTED";

    // Firestore Sync
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        lastLogin: serverTimestamp()
      }, { merge: true });
      $("profileState").textContent = "SYNCED";
    } catch (e) {
      console.error("Firestore Error:", e);
      $("profileState").textContent = "ERROR";
    }
  } else {
    // Logout UI Switch
    $("loginPanel").classList.remove("hidden");
    $("heroSection").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
    $("statusText").textContent = "OFFLINE";
    $("statusDot").style.background = "#596773";
    $("profileState").textContent = "WAITING";
    $("userName").textContent = "—";
  }
});

// ========================================
// CHAT SYSTEM (SEND & RECEIVE)
// ========================================
const chatBox = $("chatContainer");

function addMsg(text, sender, isError = false) {
  // पहला 'Jarvis online' मैसेज हटाएं
  if (chatBox.children.length === 1 && chatBox.children[0].textContent.includes("Jarvis online")) {
    chatBox.innerHTML = "";
  }
  
  const div = document.createElement("div");
  div.className = `chat-message ${isError ? 'jarvis-error' : sender === 'user' ? 'user-msg' : 'jarvis-msg'}`;
  div.textContent = text;
  chatBox.appendChild(div);
  
  // स्क्रॉल को नीचे रखें
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

async function sendCommand() {
  const input = $("commandInput");
  const text = input.value.trim();
  if (!text) return;

  addMsg(text, "user");
  input.value = "";
  
  // टाइपिंग इंडिकेटर
  const typing = addMsg("...", "jarvis");
  
  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    
    const data = await res.json();
    typing.remove();
    
    if (data.reply) {
      addMsg(data.reply, "jarvis");
      speak(data.reply);
    } else {
      throw new Error(data.error || "No reply");
    }
  } catch (e) {
    typing.remove();
    addMsg("Error: Cannot reach JARVIS backend.", "jarvis", true);
  }
}

$("sendBtn").onclick = sendCommand;
$("commandInput").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); sendCommand(); }
});

// ========================================
// MICROPHONE & WAKE WORD ("HEY JARVIS")
// ========================================
let recognition = null;
let isWakeWordMode = false;
const micBtn = $("micBtn");

micBtn.onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { addMsg("Voice recognition not supported. Use Chrome.", "jarvis", true); return; }
  
  if (recognition) { 
    recognition.stop(); recognition = null; resetMicUI(); return; 
  }
  startWakeWord();
};

function startWakeWord() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "en-IN";
  recognition.continuous = true;
  recognition.interimResults = true;
  isWakeWordMode = true;

  recognition.onstart = () => {
    micBtn.classList.add("listening");
    $("micIndicator").classList.add("on");
    $("micIndicator").innerHTML = "<span></span> LISTENING...";
    $("commandInput").placeholder = "Say 'Hey Jarvis'...";
  };

  recognition.onresult = (e) => {
    const t = Array.from(e.results).map(r => r[0].transcript).join("").toLowerCase();
    
    if (isWakeWordMode && (t.includes("hey jarvis") || t.includes("hello jarvis"))) {
      isWakeWordMode = false;
      recognition.stop();
      
      $("commandInput").placeholder = "Yes Sir? I'm listening...";
      $("micIndicator").innerHTML = "<span></span> ACTIVE";
      
      setTimeout(startCommandListen, 300);
    }
  };

  recognition.onerror = (e) => { if (e.error !== "no-speech") resetMicUI(); };
  
  recognition.onend = () => {
    if (isWakeWordMode && recognition) { try { recognition.start(); } catch(e) {} }
  };

  try { recognition.start(); } catch (e) { addMsg(e.message, "jarvis", true); }
}

function startCommandListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    $("micIndicator").innerHTML = "<span></span> LISTENING...";
  };

  recognition.onresult = (e) => {
    $("commandInput").value = e.results[0][0].transcript;
    sendCommand();
  };

  recognition.onerror = (e) => {
    if (e.error === "no-speech") $("commandInput").placeholder = "Didn't catch that. Try again.";
    resetMicUI();
  };

  recognition.onend = () => { resetMicUI(); };
  try { recognition.start(); } catch (e) { resetMicUI(); }
}

function resetMicUI() {
  recognition = null;
  isWakeWordMode = false;
  micBtn.classList.remove("listening");
  $("micIndicator").classList.remove("on");
  $("micIndicator").innerHTML = "<span></span> MIC OFF";
  $("commandInput").placeholder = "Type a command or say 'Hey Jarvis'...";
}

// विंडो बंद होने पर सब बंद करें
window.addEventListener("beforeunload", () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (recognition) recognition.stop();
});
