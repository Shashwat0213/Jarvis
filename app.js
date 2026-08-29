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

$("logoutBtn").onclick = () => {

  signOut(auth);

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


  // ----------------------------------------
  // CHECK MICROPHONE
  // ----------------------------------------

  if (!navigator.mediaDevices?.getUserMedia) {

    $("micText").textContent =
      "This browser does not expose microphone access.";

    return;
  }


  try {

    // --------------------------------------
    // REQUEST MICROPHONE PERMISSION
    // --------------------------------------

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


    // --------------------------------------
    // SPEECH RECOGNITION
    // --------------------------------------

    if (SpeechRecognition) {

      const recognition =
        new SpeechRecognition();


      recognition.lang =
        "en-IN";

      recognition.interimResults =
        false;

      recognition.maxAlternatives =
        1;


      // ------------------------------------
      // LISTENING START
      // ------------------------------------

      recognition.onstart = () => {

        $("micIndicator").innerHTML =
          "<span></span> LISTENING";

        $("coreState").textContent =
          "LISTENING";

        $("micText").textContent =
          "Listening...";
      };


      // ------------------------------------
      // VOICE RESULT
      // ------------------------------------

      recognition.onresult = event => {

        const transcript =
          event.results[0][0].transcript;


        console.log(
          "VOICE COMMAND:",
          transcript
        );


        $("commandInput").value =
          transcript;


        // Send voice command
        // to online backend

        sendCommand();
      };


      // ------------------------------------
      // VOICE ERROR
      // ------------------------------------

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


      // ------------------------------------
      // VOICE END
      // ------------------------------------

      recognition.onend = () => {

        $("coreState").textContent =
          "ONLINE";

        $("micIndicator").innerHTML =
          "<span></span> MIC READY";
      };


      // ------------------------------------
      // START LISTENING
      // ------------------------------------

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
// SEND COMMAND TO ONLINE JARVIS BACKEND
// ========================================

async function sendCommand() {

  const text =
    $("commandInput").value.trim();


  // ----------------------------------------
  // EMPTY COMMAND
  // ----------------------------------------

  if (!text) {
    return;
  }


  console.log(
    "COMMAND SENT:",
    text
  );


  // ----------------------------------------
  // UI PROCESSING STATE
  // ----------------------------------------

  $("response").textContent =
    "Jarvis is thinking...";

  $("coreState").textContent =
    "PROCESSING";


  try {

    // ======================================
    // ONLINE RENDER BACKEND
    // ======================================

    const response =
      await fetch(
        "https://jarvis-ai-by-shashwat.onrender.com/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            message: text
          })
        }
      );


    // --------------------------------------
    // READ SERVER RESPONSE
    // --------------------------------------

    const data =
      await response.json();


    console.log(
      "BACKEND RESPONSE:",
      data
    );


    // --------------------------------------
    // SERVER ERROR
    // --------------------------------------

    if (!response.ok) {

      throw new Error(
        data.error ||
        `Server error: ${response.status}`
      );
    }


    // --------------------------------------
    // SHOW JARVIS REPLY
    // --------------------------------------

    $("response").textContent =
      data.reply ||
      "No reply received.";


    $("coreState").textContent =
      "ONLINE";


  } catch (error) {

    console.error(
      "JARVIS BACKEND ERROR:",
      error
    );


    $("response").textContent =
      "Jarvis backend से connection नहीं हो पाया।";


    $("coreState").textContent =
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

      sendCommand();
    }

  }
);
