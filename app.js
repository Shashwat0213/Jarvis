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

// 1. सबसे ज़रूरी फिक्स: लॉगिन याद रखने के लिए (System Lock बार-बार न आए)
setPersistence(auth, browserLocalPersistence).catch(console.error);

// ========================================
// VOICE OUTPUT (TEXT-TO-SPEECH)
// ========================================
let voiceEnabled = true;
let selectedVoice = null;

if ("speechSynthesis" in window) {
  const loadVoices = () => {
    const v = window.speechSynthesis.getVoices();
    // आवाज़ चुनना (प्राथमिकता: इंडियन इंग्लिश -> ब्रिटिश -> कोई भी इंग्लिश)
    selectedVoice = v.find(x => x.lang === "en-IN") || v.find(x => x.lang === "en-GB") || v.find(x => x.lang.startsWith("en")) || v[0];
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

// ========================================
// AUTHENTICATION & CLOUD SYNC
// ========================================
$("loginBtn").onclick = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  // पहले दोनों को छुपा दें ताकि रिफ्रेश पर स्क्रीन ब्लैक न हो
  if ($("loginPanel")) $("loginPanel").classList.add("hidden");
  if ($("dashboard")) $("dashboard").classList.add("hidden");

  if (user) {
    if ($("dashboard")) $("dashboard").classList.remove("hidden");
    
    if ($("statusText")) { $("statusText").textContent = "ONLINE"; $("statusDot").style.background = "#00ff88"; }
    if ($("userName")) $("userName").textContent = user.displayName || "User";
    if ($("authState")) $("authState").textContent = "CONNECTED";

    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid, name: user.displayName, email: user.email, lastLogin: serverTimestamp()
      }, { merge: true });
      if ($("profileState")) $("profileState").textContent = "SYNCED";
    } catch (e) {
      if ($("profileState")) $("profileState").textContent = "ERROR";
    }
  } else {
    if ($("loginPanel")) $("loginPanel").classList.remove("hidden");
    if ($("statusText")) { $("statusText").textContent = "OFFLINE"; $("statusDot").style.background = "#555"; }
  }
});

// ========================================
// CHAT SYSTEM
// ========================================
const chatBox = $("chatContainer");
function addMsg(text, sender, isError = false) {
  if (!chatBox) return;
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
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  
  addMsg(text, "user");
  input.value = "";
  const typing = addMsg("...", "jarvis");
  
  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (typing) typing.remove();
    
    if (data.reply) { 
      addMsg(data.reply, "jarvis"); 
      speak(data.reply); 
    } else {
      throw new Error();
    }
  } catch (e) {
    if (typing) typing.remove();
    addMsg("Error connecting to backend.", "jarvis", true);
  }
}

if ($("sendBtn")) $("sendBtn").onclick = sendCommand;
if ($("commandInput")) $("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") sendCommand(); });

// ========================================
// MICROPHONE & WAKE WORD ("HEY JARVIS") - FIXED
// ========================================
let recognition = null;
let isListeningForWakeWord = false;
const micBtn = $("micBtn");

if (micBtn) {
  micBtn.onclick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Aapka browser voice recognition support nahi karta. Please Chrome use karein.");
      return;
    }

    // अगर माइक पहले से चालू है, तो बंद कर दें
    if (isListeningForWakeWord) {
      isListeningForWakeWord = false;
      if (recognition) recognition.stop();
      resetMicUI();
      return;
    }

    // माइक चालू करें
    startListeningForWakeWord();
  };
}

function startListeningForWakeWord() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.lang = "en-IN"; 
  recognition.continuous = true; 
  recognition.interimResults = true; 

  recognition.onstart = () => {
    isListeningForWakeWord = true;
    micBtn.classList.add("listening");
    $("micIndicator").classList.add("on");
    $("micIndicator").textContent = "LISTENING (Say 'Hey Jarvis')";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    
    const lowerText = transcript.toLowerCase();

    // वेक-वर्ड डिटेक्शन
    if (lowerText.includes("hey jarvis") || lowerText.includes("hello jarvis") || lowerText.includes("hey jervis")) {
      
      isListeningForWakeWord = false;
      recognition.stop(); // वेक-वर्ड मिलते ही माइक बंद करें
      
      $("micIndicator").textContent = "YES SIR? LISTENING...";
      
      // 0.5 सेकंड रुककर असली कमांड सुनें
      setTimeout(() => {
        listenForCommand();
      }, 500);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      alert("Microphone permission denied. Please allow it in browser settings.");
    }
    if (event.error !== "no-speech") {
      resetMicUI();
    }
  };

  recognition.onend = () => {
    // अगर ब्राउज़र ने अपने आप माइक बंद कर दिया, तो फिर से चालू करें
    if (isListeningForWakeWord) {
      recognition.start();
    }
  };

  recognition.start();
}

function listenForCommand() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.lang = "en-IN";
  recognition.continuous = false; 
  recognition.interimResults = false;

  recognition.onstart = () => {
    $("micIndicator").textContent = "LISTENING TO COMMAND...";
  };

  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript;
    if ($("commandInput")) $("commandInput").value = command;
    sendCommand();
  };

  recognition.onerror = () => {
    resetMicUI();
  };

  recognition.onend = () => {
    resetMicUI();
  };

  recognition.start();
}

function resetMicUI() {
  isListeningForWakeWord = false;
  if (micBtn) micBtn.classList.remove("listening");
  if ($("micIndicator")) {
    $("micIndicator").classList.remove("on");
    $("micIndicator").textContent = "MIC OFF";
  }
}
