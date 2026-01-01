// This file runs when you click the button
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, serverTimestamp } from "firebase/firestore";

// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY, // We will set these in Netlify settings later
  authDomain: "protocol-ghostt.firebaseapp.com",
  projectId: "protocol-ghostt",
  // ... rest of config
};

// Initialize only once
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const ghostRef = doc(db, "system", "ghostt_status");
    
    // Update the database
    await updateDoc(ghostRef, {
      last_seen: serverTimestamp(),
      status: "ACTIVE"
    });

    res.status(200).json({ success: true });
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
