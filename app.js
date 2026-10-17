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

// --- VOICE OUTPUT (TTS) ---
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
  u.rate = 1.0; u.pitch = 0.9;
  if (selectedVoice) u.voice = selectedVoice;
  window.speechSynthesis.speak(u);
}

$("voiceToggle").onclick = () => {
  voiceEnabled = !voiceEnabled;
  $("voiceToggle").textContent = voiceEnabled ? "🔊 AUDIO: ON" : "🔇 AUDIO: OFF";
};

// --- AUTHENTICATION ---
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if ($("loginPanel")) $("loginPanel").classList.add("hidden");
  if ($("dashboard")) $("dashboard").classList.add("hidden");

  if (user) {
    if ($("dashboard")) $("dashboard").classList.remove("hidden");
    if ($("statusText")) $("statusText").textContent = "ONLINE";
    if ($("userName")) $("userName").textContent = user.displayName || "OPERATOR";
    if ($("authState")) $("authState").textContent = "SECURE";
    if ($("coreState")) $("coreState").textContent = "ACTIVE";

    try {
      await setDoc(doc(db, "users", user.uid), { uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp() }, { merge: true });
      if ($("profileState")) $("profileState").textContent = "SYNCED";
    } catch (e) {
      if ($("profileState")) $("profileState").textContent = "ERROR";
    }
  } else {
    if ($("loginPanel")) $("loginPanel").classList.remove("hidden");
    if ($("statusText")) $("statusText").textContent = "STANDBY";
    if ($("coreState")) $("coreState").textContent = "STANDBY";
  }
});

// --- CHAT SYSTEM & CORE ANIMATION ---
const chatBox = $("chatContainer");
const coreText = $("coreState");

function addMsg(text, sender, isError = false) {
  if (chatBox.children.length === 1 && chatBox.children[0].textContent.includes("All systems operational")) chatBox.innerHTML = "";
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
  
  if (coreText) coreText.textContent = "PROCESSING";
  if (coreText) coreText.style.color = "#ffaa00";
  
  const typing = addMsg("...", "jarvis");
  
  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (typing) typing.remove();
    
    if (coreText) { coreText.textContent = "ACTIVE"; coreText.style.color = "#fff"; }

    if (data.reply) { 
      addMsg(data.reply, "jarvis"); 
      speak(data.reply); 
    } else {
      throw new Error();
    }
  } catch (e) {
    if (typing) typing.remove();
    if (coreText) { coreText.textContent = "ERROR"; coreText.style.color = "#ff3333"; }
    addMsg("System Error: Cannot reach core.", "jarvis", true);
    setTimeout(() => { if (coreText) { coreText.textContent = "ONLINE"; coreText.style.color = "#fff"; } }, 2000);
  }
}

if ($("sendBtn")) $("sendBtn").onclick = sendCommand;
if ($("commandInput")) $("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") sendCommand(); });


// --- MICROPHONE & "HEY JARVIS" (BUG FIXED) ---
let recognition = null;
let isListeningMode = false; // क्या माइक एक्टिव है?
const micBtn = $("micBtn");
const micIndicator = $("micIndicator");

if (micBtn) {
  micBtn.onclick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice recognition requires Chrome.");
    
    // अगर माइक पहले से ऑन है, तो बंद कर दें
    if (isListeningMode) {
      stopMic();
      return;
    }
    
    // माइक चालू करें
    startMic();
  };
}

function startMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; 
  recognition.continuous = true; 
  recognition.interimResults = true; 

  recognition.onstart = () => {
    isListeningMode = true;
    if (micBtn) micBtn.classList.add("listening");
    if (micIndicator) { micIndicator.classList.add("on"); micIndicator.textContent = "LISTENING (Say 'Hey Jarvis')"; }
    if (coreText) { coreText.textContent = "LISTENING"; coreText.style.color = "#00e5ff"; }
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    const lowerTranscript = transcript.toLowerCase();
    
    // वेक-वर्ड डिटेक्शन
    if (lowerTranscript.includes("hey jarvis") || lowerTranscript.includes("hello jarvis")) {
      
      // वेक-वर्ड मिलते ही माइक को पूरी तरह बंद करें ताकि बार-बार ट्रिगर न हो
      stopMic(); 
      
      if (micIndicator) micIndicator.textContent = "COMMAND MODE...";
      
      // अब असली कमांड सुनें
      setTimeout(() => { listenForCommand(); }, 600);
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== "no-speech") stopMic();
  };

  // अगर ब्राउज़र अपने आप बंद कर दे, तो फिर से चालू करें (जब तक यूज़र ने खुद बंद न किया हो)
  recognition.onend = () => { 
    if (isListeningMode) recognition.start(); 
  };
  
  recognition.start();
}

function listenForCommand() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; 
  recognition.continuous = false; // सिर्फ एक बार सुनेगा
  recognition.interimResults = false;

  recognition.onstart = () => {
    if (micIndicator) micIndicator.textContent = "LISTENING TO COMMAND...";
  };

  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript;
    if ($("commandInput")) $("commandInput").value = command;
    stopMic(); // कमांड मिलते ही माइक बंद
    sendCommand(); // सर्वर को भेजें
  };

  recognition.onerror = () => { stopMic(); };
  recognition.onend = () => { stopMic(); }; // कमांड के बाद हमेशा बंद हो जाए

  recognition.start();
}

// माइक और UI को रीसेट करने का फंक्शन
function stopMic() {
  isListeningMode = false;
  if (recognition) {
    recognition.onend = null; // रीस्टार्ट लूप रोकने के लिए
    recognition.stop();
    recognition = null;
  }
  if (micBtn) micBtn.classList.remove("listening");
  if (micIndicator) { micIndicator.classList.remove("on"); micIndicator.textContent = "OFFLINE"; }
  if (coreText) { coreText.textContent = "ACTIVE"; coreText.style.color = "#fff"; }
}