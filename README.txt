JARVIS AI V1
=============

ARCHITECTURE
------------
Frontend (GitHub Pages)  : index.html, style.css, app.js
Backend  (Render)        : server.js, package.json
Auth + Database          : Firebase Auth + Firestore

SETUP INSTRUCTIONS
------------------

1. Firebase Setup
   - Firebase Console > Authentication > Sign-in method > Google enable karein.
   - Authentication > Settings > Authorized domains mein add karein:
       * shashwat0213.github.io
       * localhost (development ke liye)
   - Firestore Database > Create database (production mode).
   - Firestore > Rules mein neeche wale rules paste karein:

     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{userId} {
           allow read, write: if request.auth != null
                              && request.auth.uid == userId;
         }
       }
     }

2. Google Cloud Console (API Restrictions)
   - https://console.cloud.google.com/apis/credentials kholein.
   - Firebase API key select karein (jo app.js mein hai).
   - Application restrictions > HTTP referrers:
       * https://shashwat0213.github.io/*
       * http://localhost:*
   - API restrictions:
       * Sirf Firebase se related APIs allow karein.
       * Generative Language API (Gemini) ko ALLOW NA karein.

3. Render Backend Setup
   - render.com par new Web Service banayein.
   - GitHub repo connect karein: Shashwat0213/Jarvis
   - Settings:
       Root Directory : (khaali)
       Build Command  : npm install
       Start Command  : npm start
       Runtime        : Node
       Instance Type  : Free
   - Environment tab mein add karein:
       GEMINI_API_KEY = apni Gemini key (aistudio.google.com/apikey se)
   - Deploy karein.

4. Frontend Update
   - Render deploy hone ke baad URL copy karein.
   - app.js mein JARVIS_BACKEND line update karein.
   - GitHub par commit karein.

5. Cold Start Notice (Free Tier)
   - Render free tier 15 min inactivity ke baad sleep ho jata hai.
   - First request 30-60 seconds le sakti hai.
   - Permanent fix ke liye cron-job.org se har 5 min ping karwayein.

SECURITY NOTES
--------------

* Firebase API key (jo app.js mein hai) PUBLIC rakhna SAFE hai.
  Ye project identifier hai, koi password nahi.
  Asli security Firestore Rules aur Auth settings se aati hai.

* Gemini API key KABHI app.js ya frontend code mein na rakhein.
  Ye sirf server par (Render environment variables) rehni chahiye.

* Agar kabhi galti se Gemini key public ho jaye:
  1. aistudio.google.com/apikey par jaayein.
  2. Us key ko turant revoke karein.
  3. Nayi key banayein.
  4. Nayi key sirf Render environment mein daalein.

* Firestore Rules hamesha authentication-based rakhein.

* Render par CORS allowed origins hamesha restrict rakhein.

FILES
-----

Frontend : index.html, style.css, app.js
Backend  : server.js, package.json, package-lock.json
Docs     : README.txt

NOTES
-----

- Alexa integration nahi hai.
- ChatGPT integration future mein aayega.
- Gemini abhi main AI brain hai.
- Voice recognition Chrome/Edge mein sabse acche se kaam karta hai.

Powered by SHASHWAT