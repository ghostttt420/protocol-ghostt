import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || "Unknown Device";
  
  try {
    await addDoc(collection(db, "hunter_logs"), {
      ip: ip,
      device: userAgent,
      timestamp: serverTimestamp(),
      read: false // Mark as unread so it triggers alarm
    });
  } catch (e) { console.error(e); }

  res.redirect(307, 'https://www.google.com');
}
