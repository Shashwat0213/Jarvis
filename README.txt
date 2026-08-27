JARVIS AI V1
=============
1. Upload index.html, style.css and app.js to your web host (GitHub Pages is fine).
2. In Firebase Console > Authentication > Settings > Authorized domains, add your site's domain.
3. In Firestore Database, create a database in production/test mode as appropriate.
4. The app signs users in with Google and creates/updates users/{UID}.
5. Microphone access requires HTTPS (or localhost) and the browser's normal permission prompt.

Architecture:
- ChatGPT = main brain (to be connected through a secure backend later)
- Gemini = tool/working brain (to be connected through a secure backend later)
- Firebase Auth + Firestore = identity, profile and sync foundation
- Local/device agents = future execution layer
- Alexa = not included

IMPORTANT:
Never put ChatGPT/Gemini secret API keys in this browser code. They belong behind a server/backend or secure serverless function.
