// ════════════════ CONFIGURATION FIREBASE ════════════════
// Connexion à ta base de données Firestore (projet: aichola-media-3602f)
const firebaseConfig = {
  apiKey: "AIzaSyDCcJIdDxILnOgv-UPLc0Uco2x0h7FFP_k",
  authDomain: "aichola-media-3602f.firebaseapp.com",
  projectId: "aichola-media-3602f",
  storageBucket: "aichola-media-3602f.firebasestorage.app",
  messagingSenderId: "268440301834",
  appId: "1:268440301834:web:ada706d94aab90a7454af3"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
