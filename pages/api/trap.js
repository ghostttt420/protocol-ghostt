import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

// Re-use your config logic
const firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export default async function handler(req, res) {
  // 1. Capture the Victim's Info
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || "Unknown Device";
  
  // 2. Log it to your "Hunter" database
  try {
    await addDoc(collection(db, "hunter_logs"), {
      ip: ip,
      device: userAgent,
      timestamp: serverTimestamp(),
      type: "INTRUSION"
    });
  } catch (e) {
    console.error("Trap Error", e);
  }

  // 3. Redirect them to Google (so they don't suspect anything)
  res.redirect(307, 'https://www.google.com');
}
