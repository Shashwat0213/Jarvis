import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ========================================
// CONFIG & SETUP
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

const $ = (selector) => document.querySelector(selector);
setPersistence(auth, browserLocalPersistence).catch(console.error);

// ========================================
// UI ELEMENTS & VOICE (Hindi Support)
// ========================================
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
    // हिंदी सपोर्ट के लिए hi-IN को प्राथमिकता
    selectedVoice = v.find(x => x.lang === "hi-IN") || v.find(x => x.lang === "en-IN") || v.find(x => x.lang === "en-GB") || v[0]; 
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 0.9;
  u.lang = "hi-IN"; // हिंदी आवाज़ के लिए
  if (selectedVoice) u.voice = selectedVoice;
  window.speechSynthesis.speak(u);
}

// ========================================
// CHAT SYSTEM & CONTEXT MEMORY
// ========================================
let chatHistory = []; // 🆕 पिछले मैसेज याद रखने के लिए

function addMessage(text, sender = "jarvis", isError = false) {
  if (chatLog.children.length === 1 && chatLog.children[0].textContent.includes("Systems online")) chatLog.innerHTML = "";
  const row = document.createElement("div");
  row.className = `message ${sender === "user" ? "user-message" : "jarvis-message"}`;
  if (isError) row.classList.add("error-msg");
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
  
  // 🆕 हिस्ट्री में यूज़र का मैसेज सेव करें
  chatHistory.push({ sender: "user", text: command });
  
  document.body.classList.add("thinking");
  const typing = addMessage("...", "jarvis");

  try {
    const res = await fetch(JARVIS_BACKEND + "/api/chat", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: command,
        history: chatHistory.slice(0, -1) // 🆕 पिछले मैसेज भेजें
      })
    });
    const data = await res.json();
    if (typing) typing.remove();
    
    document.body.classList.remove("thinking");
    if (data.reply) { 
      addMessage(data.reply, "jarvis"); 
      
      // 🆕 हिस्ट्री में JARVIS का जवाब सेव करें
      chatHistory.push({ sender: "jarvis", text: data.reply });
      if (chatHistory.length > 10) chatHistory.shift(); // हिस्ट्री लिमिट 10

      speak(data.reply); 
    } else {
      throw new Error();
    }
  } catch (e) {
    if (typing) typing.remove();
    document.body.classList.remove("thinking");
    addMessage("System Error: Cannot reach core.", "jarvis", true);
  }
}

$("#commandForm").addEventListener("submit", (event) => {
  event.preventDefault();
  handleCommand(commandInput.value);
});

// ========================================
// AUTHENTICATION
// ========================================
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
    } catch (e) {
      $("#profileState").textContent = "Cloud Sync: ERROR";
    }
  } else {
    $("#userName").textContent = "Commander.";
    $("#authState").textContent = "AUTH: WAITING";
    $("#authStatus").textContent = "PENDING";
    $("#authStatus").className = "tag tag-pending";
    $("#systemStatus").textContent = "OFFLINE";
    $("#profileState").textContent = "Cloud Sync: WAITING";
  }
});

// ========================================
// MIC & WAKE WORD (हिंदी सपोर्ट के साथ)
// ========================================
let recognition = null;
let isListeningMode = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  micButton.addEventListener("click", () => {
    if (isListeningMode) { stopMic(); return; }
    startWakeWord();
  });
} else {
  micButton.addEventListener("click", () => {
    voiceHint.textContent = "Speech recognition not supported in this browser.";
  });
}

function startWakeWord() {
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN"; // 🆕 हिंदी में सुनने के लिए (en-IN भी रख सकते हैं)
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isListeningMode = true;
    micButton.classList.add("listening");
    micLabel.textContent = "LISTENING...";
    voiceHint.textContent = "Say 'Hey Jarvis' to wake me up.";
    document.body.classList.add("thinking");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    
    if (transcript.toLowerCase().includes("hey jarvis") || transcript.toLowerCase().includes("hello jarvis")) {
      stopMic();
      micLabel.textContent = "YES SIR?";
      voiceHint.textContent = "Listening to command...";
      setTimeout(listenForCommand, 500);
    }
  };

  recognition.onerror = () => stopMic();
  recognition.onend = () => { if (isListeningMode) recognition.start(); };
  recognition.start();
}

function listenForCommand() {
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN"; // 🆕 हिंदी कमांड के लिए
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript;
    handleCommand(command);
  };
  recognition.onend = () => stopMic();
  recognition.onerror = () => stopMic();
  recognition.start();
}

function stopMic() {
  isListeningMode = false;
  if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  micButton.classList.remove("listening");
  micLabel.textContent = "TAP TO SPEAK";
  voiceHint.textContent = "Say 'Hey Jarvis' or click to speak.";
  document.body.classList.remove("thinking");
}

// ========================================
// JARVIS HUD CORE ANIMATION (SVG + Canvas)
// ========================================
(() => {
  const core = document.querySelector("#core");
  const sys = document.querySelector("#systemStatus"), stageStatus = document.querySelector("#stageStatus");
  new MutationObserver(() => { 
    if(stageStatus) stageStatus.textContent = sys.textContent === "ONLINE" ? "Online" : sys.textContent === "OFFLINE" ? "Standby" : sys.textContent; 
  }).observe(sys, { childList: true, characterData: true, subtree: true });

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
    const g = el('g', { class: 'rot', style: `animation-duration:calc(${Math.abs(sp)}s*var(--k));animation-direction:${sp < 0 ? 'reverse' : 'normal'}` });
    el('circle', { r: R, fill: 'none', stroke: 'none' }, g);
    return g;
  };
  const ring = (g, r, w, col, op, dash) => el('circle', { r, fill: 'none', stroke: col, 'stroke-width': w, opacity: op, 'stroke-dasharray': dash || 'none' }, g);
  function arc(g, r, a0, a1, w, col, op) {
    const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
    el('path', { d: `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`, fill: 'none', stroke: col, 'stroke-width': w, opacity: op == null ? 1 : op }, g);
  }
  function arcs(g, r, n, w, col, orange) {
    let a = rnd() * 360;
    for (let i = 0; i < n; i++) { const len = 14 + rnd() * 50; arc(g, r, a, a + len, w, orange && i === 0 ? O : col, .55 + rnd() * .45); a += len + 20 + rnd() * 50; }
  }
  function ticks(g, r, n, len, every, col, op) {
    for (let i = 0; i < n; i++) {
      const long = i % every === 0, a = i * 360 / n, [x0, y0] = pt(r, a), [x1, y1] = pt(r + (long ? len * 1.8 : len), a);
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: col, 'stroke-width': long ? 1.6 : .7, opacity: long ? op : op * .55 }, g);
    }
  }
  function hex(g, cx, cy, s, col, op) {
    const p = [...Array(6)].map((_, i) => (cx + Math.cos(rad(60 * i + 30)) * s) + ',' + (cy + Math.sin(rad(60 * i + 30)) * s)).join(' ');
    el('polygon', { points: p, fill: 'none', stroke: col, 'stroke-width': .8, opacity: op }, g);
  }

  const S = el('g', {});
  for (const a of [0, 90, 45, 135]) {
    const [x, y] = pt(240, a);
    el('line', { x1: -x, y1: -y, x2: x, y2: y, stroke: C, 'stroke-width': .8, opacity: a % 90 ? .12 : .4 }, S);
  }
  for (let i = 0; i < 28; i++) {
    const a = rnd() * 360, r0 = 70 + rnd() * 60, r1 = r0 + 40 + rnd() * 110, [x0, y0] = pt(r0, a), [x1, y1] = pt(r1, a);
    el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: rnd() < .12 ? O : C, 'stroke-width': .6, opacity: .15 + rnd() * .3 }, S);
  }
  ring(S, 52, 1.2, C, .8); ring(S, 46, .8, C, .6, '2 3');

  let g = layer(120, 280);
  ring(g, 228, 1, C, .5, '1 7');
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 360, r = 190 + rnd() * 38, [x, y] = pt(r, a), sz = 7 + rnd() * 7;
    hex(g, x, y, sz, C, .5);
    if (rnd() < .6) hex(g, x + sz * 1.75 * Math.cos(rad(a)), y + sz * 1.75 * Math.sin(rad(a)), sz, C, .35);
  }
  g = layer(-150, 210); ticks(g, 200, 150, 3.5, 10, C, .8); ring(g, 196, .8, C, .5);
  g = layer(80, 190); arcs(g, 184, 5, 7, C, true); ring(g, 170, .8, C, .4);
  g = layer(-40, 170); ring(g, 162, .9, C, .7);
  [40, 160, 255].forEach(a => { const [x, y] = pt(162, a); el('circle', { cx: x, cy: y, r: 3, fill: C }, g); el('circle', { cx: x, cy: y, r: 7, fill: 'none', stroke: C, 'stroke-width': .8 }, g); });
  g = layer(-90, 165); ticks(g, 150, 72, 5, 6, C, .9);
  g = layer(30, 140); arcs(g, 130, 4, 5, C, false);
  g = layer(-50, 125); hex(g, 0, 0, 112, C, .9); hex(g, 0, 0, 104, C, .35);
  g = layer(18, 100); ring(g, 92, 1.2, C, .8, '6 5');
  g = layer(12, 90); arcs(g, 80, 3, 9, C, true);
  g = layer(-25, 75); ticks(g, 58, 48, 3, 4, C, .9); ring(g, 66, .8, C, .5);
  g = layer(4, 125); arc(g, 118, 0, 34, 2.5, '#fff');
  g = layer(6, 45); ring(g, 40, 1, C, .8, '2 4'); ring(g, 34, 1.5, C, .9, '20 10');

  el('circle', { class: 'glowc', r: 48, fill: 'url(#g)' });
  el('circle', { r: 19, fill: 'url(#lens)' });
  el('circle', { r: 19, fill: 'none', stroke: '#fff', 'stroke-opacity': .7 });

  const T = el('g', { fill: C, 'font-size': 6.5, 'font-family': 'ui-monospace,Menlo,monospace', opacity: .6 });
  for (let i = 0; i < 10; i++) {
    const [x, y] = pt(120 + rnd() * 100, rnd() * 360);
    const tx = el('text', { x, y, fill: rnd() < .25 ? O : C }, T);
    tx.textContent = rnd() < .5 ? '0x' + ((rnd() * 65535) | 0).toString(16).toUpperCase().padStart(4, '0') : (rnd() * 99).toFixed(2) + '%';
  }
  for (let i = 0; i < 44; i++) {
    const [x, y] = pt(40 + rnd() * 210, rnd() * 360);
    el('circle', { cx: x, cy: y, r: .8 + rnd() * 1.8, fill: rnd() < .15 ? O : C, class: 'tw', style: `animation-delay:${rnd() * 4}s;animation-duration:${2 + rnd() * 3}s` });
  }

  const cv = document.querySelector('#wave'), cx = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion:reduce)').matches;
  let W = 0, t = 0, amp = .15;
  function fit() { const d = devicePixelRatio || 1; W = cv.clientWidth; cv.width = cv.height = W * d; cx.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener('resize', fit); fit();
  function draw() {
    t += .016;
    amp += ((document.body.classList.contains("thinking") ? 1 : .18) - amp) * .04;
    cx.clearRect(0, 0, W, W);
    const u = W / 500, c = W / 2, r0 = 137 * u, N = 120;
    cx.lineCap = 'round'; cx.lineWidth = 1.8 * u;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, n = (Math.sin(a * 5 + t * 2.2) + Math.sin(a * 9 - t * 1.7) + Math.sin(a * 3 + t * .9)) / 6 + .5;
      const h = (2 + n * 9 * amp + .6 * Math.sin(t * 3 + i)) * u, m = Math.pow(Math.max(0, Math.cos(a + .5)), 3);
      const x = Math.cos(a), y = Math.sin(a);
      cx.strokeStyle = `rgba(${(56 + 199 * m) | 0},${(232 - 94 * m) | 0},${(255 - 213 * m) | 0},${.35 + .6 * amp * n})`;
      cx.beginPath(); cx.moveTo(c + x * r0, c + y * r0); cx.lineTo(c + x * (r0 + h), c + y * (r0 + h)); cx.stroke();
    }
    if (!still) requestAnimationFrame(draw);
  }
  draw();

  addEventListener('pointermove', e => {
    if (still) return;
    const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
    core.style.transform = `perspective(900px) rotateX(${-y * 10}deg) rotateY(${x * 12}deg)`;
  });
})();