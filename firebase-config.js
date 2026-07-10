// ════════════════ CONFIGURATION FIREBASE ════════════════
// Connexion à ta base de données Firestore (projet: aichola-media)
const firebaseConfig = {
  apiKey: "AIzaSyDpmObwVF3yWAn1IkRyTudQmbTx1U9gI6E",
  authDomain: "aichola-media.firebaseapp.com",
  projectId: "aichola-media",
  storageBucket: "aichola-media.firebasestorage.app",
  messagingSenderId: "579124743221",
  appId: "1:579124743221:web:5fdacb365e3c7e770ff57c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
