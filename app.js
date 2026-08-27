import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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

const $ = id => document.getElementById(id);
const loginPanel = $("loginPanel"), dashboard = $("dashboard");

$("loginBtn").onclick = async () => {
  $("loginMessage").textContent = "Opening Google sign-in…";
  try { await signInWithPopup(auth, provider); }
  catch (e) { $("loginMessage").textContent = e.code === "auth/popup-blocked" ? "Popup blocked. Allow popups for this site and try again." : e.message; }
};

$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginPanel.classList.remove("hidden"); dashboard.classList.add("hidden");
    $("statusText").textContent = "OFFLINE"; $("statusDot").style.background = "#596773";
    $("coreState").textContent = "STANDBY"; $("greeting").textContent = "Awaiting authentication.";
    return;
  }
  loginPanel.classList.add("hidden"); dashboard.classList.remove("hidden");
  $("statusText").textContent = "ONLINE"; $("statusDot").style.background = "#64dfff";
  $("coreState").textContent = "ONLINE"; $("greeting").textContent = `Welcome, ${user.displayName || "Operator"}. Jarvis is ready.`;
  $("userName").textContent = user.displayName || "Jarvis User";
  $("userEmail").textContent = user.email || "";
  $("authState").textContent = "CONNECTED";
  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid, name: user.displayName || "", email: user.email || "",
      photoURL: user.photoURL || "", lastLogin: serverTimestamp()
    }, { merge: true });
    $("profileState").textContent = "SYNCED";
  } catch (e) { $("profileState").textContent = "ERROR"; console.error(e); }
});

$("micBtn").onclick = async () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!navigator.mediaDevices?.getUserMedia) {
    $("micText").textContent = "This browser does not expose microphone access.";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    stream.getTracks().forEach(t => t.stop());
    $("micIndicator").classList.add("on"); $("micIndicator").innerHTML = "<span></span> MIC READY";
    $("micText").textContent = SpeechRecognition ? "Microphone permission granted. Tap again to speak." : "Microphone permission granted.";
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN"; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onstart = () => { $("micIndicator").innerHTML = "<span></span> LISTENING"; $("coreState").textContent = "LISTENING"; };
      recognition.onresult = e => { $("commandInput").value = e.results[0][0].transcript; sendCommand(); };
      recognition.onerror = () => { $("coreState").textContent = "ONLINE"; $("micIndicator").innerHTML = "<span></span> MIC READY"; };
      recognition.onend = () => { $("coreState").textContent = "ONLINE"; $("micIndicator").innerHTML = "<span></span> MIC READY"; };
      recognition.start();
    }
  } catch (e) {
    $("micText").textContent = e.name === "NotAllowedError" ? "Microphone permission was denied. Allow it in browser site settings." : e.message;
  }
};

function sendCommand() {
  const text = $("commandInput").value.trim();
  if (!text) return;
  $("response").textContent = `Command received: "${text}". AI orchestration is the next module.`;
}
$("sendBtn").onclick = sendCommand;
$("commandInput").addEventListener("keydown", e => { if (e.key === "Enter") sendCommand(); });
