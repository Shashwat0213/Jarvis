import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


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


// ========================================
// FIREBASE INITIALIZATION
// ========================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();


// ========================================
// JARVIS BACKEND
// ========================================

const JARVIS_BACKEND =
  "https://jarvis-ai-by-shashwat.onrender.com";


// ========================================
// HELPER
// ========================================

const $ = id => document.getElementById(id);


// ========================================
// ELEMENTS
// ========================================

const loginPanel = $("loginPanel");
const dashboard = $("dashboard");


// ========================================
// GOOGLE LOGIN
// ========================================

$("loginBtn").onclick = async () => {

  $("loginMessage").textContent =
    "Opening Google sign-in…";

  try {

    await signInWithPopup(auth, provider);

  } catch (e) {

    console.error("LOGIN ERROR:", e);

    $("loginMessage").textContent =
      e.code === "auth/popup-blocked"
        ? "Popup blocked. Allow popups for this site and try again."
        : e.message;
  }
};


// ========================================
// LOGOUT
// ========================================

$("logoutBtn").onclick = async () => {

  try {

    await signOut(auth);

  } catch (e) {

    console.error("LOGOUT ERROR:", e);
  }

};


// ========================================
// AUTH STATE
// ========================================

onAuthStateChanged(auth, async user => {

  if (!user) {

    loginPanel.classList.remove("hidden");
    dashboard.classList.add("hidden");

    $("statusText").textContent =
      "OFFLINE";

    $("statusDot").style.background =
      "#596773";

    $("coreState").textContent =
      "STANDBY";

    $("greeting").textContent =
      "Awaiting authentication.";

    return;
  }


  // ----------------------------------------
  // USER LOGGED IN
  // ----------------------------------------

  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");


  $("statusText").textContent =
    "ONLINE";

  $("statusDot").style.background =
    "#64dfff";

  $("coreState").textContent =
    "ONLINE";

  $("greeting").textContent =
    `Welcome, ${user.displayName || "Operator"}. Jarvis is ready.`;

  $("userName").textContent =
    user.displayName || "Jarvis User";

  $("userEmail").textContent =
    user.email || "";

  $("authState").textContent =
    "CONNECTED";


  // ----------------------------------------
  // FIRESTORE USER SYNC
  // ----------------------------------------

  try {

    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        lastLogin: serverTimestamp()
      },
      {
        merge: true
      }
    );

    $("profileState").textContent =
      "SYNCED";

  } catch (e) {

    console.error(
      "FIRESTORE ERROR:",
      e
    );

    $("profileState").textContent =
      "ERROR";
  }

});


// ========================================
// MICROPHONE + VOICE RECOGNITION
// ========================================

$("micBtn").onclick = async () => {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!navigator.mediaDevices?.getUserMedia) {

    $("micText").textContent =
      "This browser does not expose microphone access.";

    return;
  }


  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });


    stream
      .getTracks()
      .forEach(track => track.stop());


    $("micIndicator").classList.add("on");

    $("micIndicator").innerHTML =
      "<span></span> MIC READY";


    $("micText").textContent =
      SpeechRecognition
        ? "Microphone permission granted. Tap again to speak."
        : "Microphone permission granted.";


    if (SpeechRecognition) {

      const recognition =
        new SpeechRecognition();


      recognition.lang =
        "en-IN";

      recognition.interimResults =
        false;

      recognition.maxAlternatives =
        1;


      recognition.onstart = () => {

        $("micIndicator").innerHTML =
          "<span></span> LISTENING";

        $("coreState").textContent =
          "LISTENING";

        $("micText").textContent =
          "Listening...";
      };


      recognition.onresult = event => {

        const transcript =
          event.results[0][0].transcript;


        console.log(
          "VOICE COMMAND:",
          transcript
        );


        $("commandInput").value =
          transcript;


        sendCommand();
      };


      recognition.onerror = event => {

        console.error(
          "VOICE ERROR:",
          event.error
        );


        $("coreState").textContent =
          "ONLINE";

        $("micIndicator").innerHTML =
          "<span></span> MIC READY";

        $("micText").textContent =
          "Voice recognition error. Try again.";
      };


      recognition.onend = () => {

        $("coreState").textContent =
          "ONLINE";

        $("micIndicator").innerHTML =
          "<span></span> MIC READY";
      };


      recognition.start();

    }

  } catch (e) {

    console.error(
      "MICROPHONE ERROR:",
      e
    );


    $("micText").textContent =
      e.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow it in browser site settings."
        : e.message;
  }

};


// ========================================
// SEND COMMAND TO JARVIS
// ========================================

async function sendCommand() {

  const input =
    $("commandInput");

  const responseBox =
    $("response");

  const coreState =
    $("coreState");


  const text =
    input.value.trim();


  // ----------------------------------------
  // EMPTY COMMAND
  // ----------------------------------------

  if (!text) {

    responseBox.textContent =
      "Please enter a command.";

    return;
  }


  console.log(
    "JARVIS REQUEST:",
    text
  );


  // ----------------------------------------
  // PROCESSING UI
  // ----------------------------------------

  responseBox.textContent =
    "Jarvis is thinking...";

  coreState.textContent =
    "PROCESSING";


  try {

    console.log(
      "Connecting to:",
      JARVIS_BACKEND + "/api/chat"
    );


    // ======================================
    // SEND REQUEST
    // ======================================

    const response =
      await fetch(
        JARVIS_BACKEND + "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },

          body: JSON.stringify({
            message: text
          })
        }
      );


    console.log(
      "HTTP STATUS:",
      response.status
    );


    // ======================================
    // READ RESPONSE SAFELY
    // ======================================

    const contentType =
      response.headers.get("content-type") || "";


    let data;


    if (contentType.includes("application/json")) {

      data =
        await response.json();

    } else {

      const raw =
        await response.text();

      console.error(
        "NON-JSON BACKEND RESPONSE:",
        raw
      );

      throw new Error(
        `Backend returned ${response.status} instead of JSON.`
      );
    }


    console.log(
      "JARVIS BACKEND RESPONSE:",
      data
    );


    // ======================================
    // BACKEND ERROR
    // ======================================

    if (!response.ok) {

      throw new Error(
        data?.error ||
        `Server error: ${response.status}`
      );
    }


    // ======================================
    // JARVIS REPLY
    // ======================================

    const reply =
      data?.reply;


    if (!reply) {

      throw new Error(
        "Backend connected, but no JARVIS reply was received."
      );
    }


    responseBox.textContent =
      reply;


    coreState.textContent =
      "ONLINE";


    console.log(
      "JARVIS REPLY:",
      reply
    );


  } catch (error) {

    console.error(
      "JARVIS CONNECTION ERROR:",
      error
    );


    // ======================================
    // SHOW REAL ERROR
    // ======================================

    responseBox.textContent =
      "JARVIS ERROR: " +
      (error?.message || "Unknown error");


    coreState.textContent =
      "ERROR";
  }

}


// ========================================
// SEND BUTTON
// ========================================

$("sendBtn").onclick =
  sendCommand;


// ========================================
// ENTER KEY
// ========================================

$("commandInput").addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      event.preventDefault();

      sendCommand();
    }

  }
);