// lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA37uQloCPi5ccXl3GiEm3VY1DANX86y0Y",
  authDomain: "protocol-ghostt.firebaseapp.com",
  projectId: "protocol-ghostt",
  storageBucket: "protocol-ghostt.firebasestorage.app",
  messagingSenderId: "153888551978",
  appId: "1:153888551978:web:afdc85f351b37488c47f53"
};

// This prevents Firebase from crashing if it tries to load twice
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };
