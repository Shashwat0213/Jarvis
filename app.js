import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ========================================
// FIREBASE CONFIG
// ========================================
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

// ========================================
// BACKEND URL (अपना Render URL यहाँ डालें)
// ========================================
const JARVIS_BACKEND = "https://jarvis-7es3.onrender.com"; 
const REQUEST_TIMEOUT_MS = 90000;

const $ = id => document.getElementById(id);
const loginPanel = $("loginPanel");
const dashboard = $("dashboard");

// ========================================
// TEXT-TO-SPEECH (Voice Output)
// ========================================
let voiceEnabled = true;
let selectedVoice = null;

function pickBestVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  return voices.find(v => v.lang === "en-IN" && /male/i.test(v.name)) || voices.find(v => v.lang === "en-GB") || voices[0];
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
  
  const icon = voiceEnabled ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
  
  $("voiceToggle").innerHTML = icon + (voiceEnabled ? ' Voice ON' : ' Voice OFF');
  $("voiceHint").textContent = voiceEnabled ? "JARVIS voice output active" : "JARVIS is muted";
};

// ========================================
// CHAT UI
// ========================================
const chatContainer = $("chatContainer");

function addMessage(text, sender, isError = false) {
  if (chatContainer.children.length === 1 && chatContainer.children[0].textContent.includes("Jarvis online")) {
    chatContainer.innerHTML = "";
  }
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message");
  if (isError) msgDiv.classList.add("jarvis-error");
  else msgDiv.classList.add(sender === "user" ? "user-msg" : "jarvis-msg");
  msgDiv.textContent = text;
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
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

// ========================================
// AUTHENTICATION
// ========================================
$("loginBtn").onclick = async () => {
  $("loginMessage").textContent = "Authenticating…";
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
  $("coreState").textContent = "ONLINE"; $("greeting").textContent = `Welcome back, ${user.displayName || "Operator"}.`;
  $("userName").textContent = user.displayName || "Authorized User"; $("userEmail").textContent = user.email || "Secure Connection";
  $("authState").textContent = "CONNECTED";

  try {
    await setDoc(doc(db, "users", user.uid), { uid: user.uid, name: user.displayName || "", email: user.email || "", lastLogin: serverTimestamp() }, { merge: true });
    $("profileState").textContent = "SYNCED";
  } catch (e) { $("profileState").textContent = "ERROR"; }
});

// ========================================
// MICROPHONE (Part 1 End)
// ========================================
// ========================================
// MICROPHONE & WAKE WORD ("HEY JARVIS")
// ========================================
let recognition = null;
let isListening = false;
let isWakeWordMode = false;
const micBtn = $("micBtn");

micBtn.onclick = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { addMessage("Voice recognition not supported. Use Chrome.", "jarvis", true); return; }
  
  // अगर पहले से सुन रहा है, तो बंद कर दें
  if (isListening) { 
    isListening = false;
    if (recognition) recognition.stop(); 
    micBtn.classList.remove("listening");
    $("micIndicator").classList.remove("on");
    $("micIndicator").innerHTML = "<span></span> MIC OFF";
    $("coreState").textContent = "ONLINE";
    $("micText").textContent = "Say 'Hey Jarvis'";
    return; 
  }
  
  stopSpeaking();
  startWakeWordListening();
};

function startWakeWordListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; 
  recognition.continuous = true; 
  recognition.interimResults = true; 

  recognition.onstart = () => {
    isListening = true; 
    isWakeWordMode = true;
    micBtn.classList.add("listening");
    $("micIndicator").classList.add("on"); 
    $("micIndicator").innerHTML = "<span></span> WAITING FOR 'HEY JARVIS'";
    $("coreState").textContent = "STANDBY"; 
    $("micText").textContent = "Say 'Hey Jarvis' or 'Hello Jarvis' to wake me up.";
  };

  recognition.onresult = event => {
    const transcript = Array.from(event.results).map(result => result[0].transcript).join("").toLowerCase();
    
    // वेक वर्ड डिटेक्शन
    if (isWakeWordMode && (transcript.includes("hey jarvis") || transcript.includes("hello jarvis") || transcript.includes("hey jervis"))) {
      isWakeWordMode = false;
      $("coreState").textContent = "LISTENING";
      $("micText").textContent = "Yes Sir? I'm listening...";
      $("micIndicator").innerHTML = "<span></span> LISTENING";
      
      recognition.stop(); 
      setTimeout(startCommandListening, 500); 
    }
  };

  recognition.onerror = event => {
    if (event.error !== "no-speech") {
      isListening = false;
      micBtn.classList.remove("listening");
      $("micIndicator").innerHTML = "<span></span> MIC OFF"; 
      $("micIndicator").classList.remove("on");
      $("micText").textContent = `Error: ${event.error}`;
    }
  };

  recognition.onend = () => {
    if (isListening && isWakeWordMode) {
      try { recognition.start(); } catch(e) {}
    } else if (!isWakeWordMode && isListening) {
      // कमांड मोड का इंतज़ार
    } else {
      micBtn.classList.remove("listening");
      $("coreState").textContent = "ONLINE";
      $("micIndicator").innerHTML = "<span></span> MIC READY"; 
      $("micIndicator").classList.remove("on");
    }
  };

  try { recognition.start(); } catch (e) { addMessage(e.message, "jarvis", true); }
}

// असली कमांड सुनने का फंक्शन (वेक वर्ड के बाद)
function startCommandListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; 
  recognition.continuous = false; 
  recognition.interimResults = false; 

  recognition.onstart = () => {
    isListening = true;
    $("coreState").textContent = "LISTENING";
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    $("commandInput").value = transcript;
    isListening = false;
    micBtn.classList.remove("listening");
    sendCommand(); 
  };

  recognition.onerror = event => {
    isListening = false;
    micBtn.classList.remove("listening");
    $("coreState").textContent = "ONLINE";
    if(event.error === "no-speech") $("micText").textContent = "I didn't hear anything. Click mic to try again.";
    startWakeWordListening(); 
  };

  recognition.onend = () => {
    if (isListening) { 
      isListening = false;
      micBtn.classList.remove("listening");
      startWakeWordListening(); 
    }
  };

  try { recognition.start(); } catch (e) { startWakeWordListening(); }
}

// ========================================
// SEND COMMAND TO BACKEND
// ========================================
async function sendCommand() {
  const input = $("commandInput");
  const text = input.value.trim();
  if (!text) return;

  stopSpeaking();
  addMessage(text, "user");
  input.value = "";
  
  $("coreState").textContent = "PROCESSING";
  const typingMsg = showTypingIndicator();

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
    typingMsg.remove(); 

    if (!response.ok) throw new Error(data?.error || `Server error: ${response.status}`);
    const reply = data?.reply;
    if (!reply) throw new Error("No JARVIS reply received.");

    addMessage(reply, "jarvis"); 
    $("coreState").textContent = "ONLINE";
    speak(reply); 

  } catch (error) {
    clearTimeout(timer);
    typingMsg.remove(); 
    
    let friendlyMsg = error?.message || "Unknown error";
    if (error.name === "AbortError") friendlyMsg = "Request timed out. Please try again.";
    else if (error.message?.includes("Failed to fetch")) friendlyMsg = "Cannot reach JARVIS backend. Check Render.";
    
    addMessage(friendlyMsg, "jarvis", true); 
    $("coreState").textContent = "ERROR";
  }
}

// ========================================
// BUTTONS & INPUTS
// ========================================
$("sendBtn").onclick = sendCommand;
$("commandInput").addEventListener("keydown", e => { 
  if (e.key === "Enter") { e.preventDefault(); sendCommand(); } 
});

window.addEventListener("beforeunload", () => stopSpeaking());