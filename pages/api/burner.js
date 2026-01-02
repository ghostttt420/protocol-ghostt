import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export default async function handler(req, res) {
  // CREATE MODE (POST)
  if (req.method === 'POST') {
    const { message } = req.body;
    try {
      const docRef = await addDoc(collection(db, "burner_vault"), {
        message,
        timestamp: serverTimestamp(),
        active: true
      });
      res.status(200).json({ id: docRef.id });
    } catch (e) { res.status(500).json({ error: "Write Failed" }); }
  } 
  
  // READ & DESTROY MODE (GET)
  else if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing ID" });

    const docRef = doc(db, "burner_vault", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // DESTROY IMMEDIATELY
      await deleteDoc(docRef);
      res.status(200).json({ message: data.message });
    } else {
      res.status(404).json({ error: "MESSAGE DESTROYED OR INVALID" });
    }
  }
}
