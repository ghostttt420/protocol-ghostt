// pages/index.js
import { useState } from 'react';
import { db } from '../lib/firebase'; // Importing from the file we just made
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function GhosttCommand() {
  const [status, setStatus] = useState("SYSTEM STANDBY");

  const pingSystem = async () => {
    setStatus("CONTACTING SERVER...");
    try {
      // Direct connection to Firebase from the phone
      const ghostRef = doc(db, "system", "ghostt_status");
      
      await updateDoc(ghostRef, {
        last_seen: serverTimestamp(),
        status: "ACTIVE"
      });
      
      setStatus("PROTOCOL RENEWED: 30 DAYS");
      setTimeout(() => setStatus("SYSTEM SECURE"), 2000);
    } catch (error) {
      console.error(error);
      setStatus("ERROR: " + error.message);
    }
  };

  return (
    <div style={{ backgroundColor: 'black', height: '100vh', color: '#00ff00', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: '2rem', borderBottom: '1px solid #00ff00', paddingBottom: '10px' }}>PROTOCOL GHOSTT</h1>
      
      <p style={{ marginTop: '20px', fontSize: '1.5rem', color: status.includes("ERROR") ? 'red' : '#00ff00' }}>
        {status}
      </p>
      
      <button 
        onClick={pingSystem}
        style={{ marginTop: '40px', padding: '20px 40px', fontSize: '1.2rem', backgroundColor: 'transparent', border: '2px solid #00ff00', color: '#00ff00', cursor: 'pointer' }}
      >
        RENEW TIMER
      </button>
    </div>
  );
}
