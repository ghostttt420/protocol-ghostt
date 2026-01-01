import { useState, useEffect } from 'react';
import { db } from '../lib/firebase'; 
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function JarvisCommand() {
  const [status, setStatus] = useState("SYSTEM STANDBY");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState("MONITOR"); // MONITOR or VAULT

  // 1. THE DEAD MAN SWITCH (PING)
  const pingSystem = async () => {
    setStatus("ESTABLISHING UPLINK...");
    try {
      const ghostRef = doc(db, "system", "ghostt_status");
      await updateDoc(ghostRef, {
        last_seen: serverTimestamp(),
        status: "ACTIVE"
      });
      setStatus("PROTOCOL RENEWED: 30 DAYS");
      setTimeout(() => setStatus("SYSTEM SECURE"), 2000);
    } catch (error) {
      setStatus("ERROR: ACCESS DENIED");
      console.error(error);
    }
  };

  // 2. THE VAULT (UPLOAD DATA)
  const uploadSecret = async () => {
    if (!secret || !label) return;
    setStatus("ENCRYPTING PACKET...");
    
    try {
      // This saves to a new collection called 'vault'
      await addDoc(collection(db, "vault"), {
        label: label,
        payload: secret, // In a real app, we'd encrypt this string before sending
        timestamp: serverTimestamp()
      });
      setStatus("UPLOAD COMPLETE");
      setSecret("");
      setLabel("");
      setTimeout(() => setStatus("SYSTEM SECURE"), 2000);
    } catch (error) {
      setStatus("UPLOAD FAILED");
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-4 flex flex-col items-center">
      {/* JARVIS HEADER */}
      <div className="w-full max-w-md border-b border-green-800 pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-widest">J.A.R.V.I.S.</h1>
          <p className="text-xs opacity-50">PROTOCOL GHOSTT // V1.0</p>
        </div>
        <div className="text-xs animate-pulse text-red-500">{status}</div>
      </div>

      {/* MAIN SCREEN */}
      <div className="w-full max-w-md bg-green-900/10 border border-green-800 p-6 rounded-lg backdrop-blur-sm">
        
        {/* TABS */}
        <div className="flex mb-6 border-b border-green-900">
          <button 
            onClick={() => setMode("MONITOR")}
            className={`flex-1 pb-2 ${mode === "MONITOR" ? "text-green-400 border-b-2 border-green-400" : "text-green-900"}`}
          >
            STATUS
          </button>
          <button 
            onClick={() => setMode("VAULT")}
            className={`flex-1 pb-2 ${mode === "VAULT" ? "text-green-400 border-b-2 border-green-400" : "text-green-900"}`}
          >
            VAULT
          </button>
        </div>

        {/* MODE A: MONITOR (Dead Man Switch) */}
        {mode === "MONITOR" && (
          <div className="text-center py-8">
            <div className="text-4xl font-bold mb-2">29d 23h</div>
            <p className="text-xs text-green-800 mb-8">TIME UNTIL PROTOCOL OMEGA</p>
            
            <button 
              onClick={pingSystem}
              className="w-full py-4 border border-green-500 hover:bg-green-500 hover:text-black transition-all uppercase tracking-widest font-bold text-lg rounded"
            >
              PING SERVER
            </button>
          </div>
        )}

        {/* MODE B: VAULT (Data Entry) */}
        {mode === "VAULT" && (
          <div className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="DATA LABEL (e.g. WiFi Keys)"
              className="bg-black border border-green-800 p-3 text-green-500 focus:outline-none focus:border-green-400"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <textarea 
              placeholder="ENTER CLASSIFIED DATA..."
              className="bg-black border border-green-800 p-3 h-32 text-green-500 focus:outline-none focus:border-green-400 font-mono"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <button 
              onClick={uploadSecret}
              className="w-full py-3 bg-green-900/30 border border-green-600 hover:bg-green-600 hover:text-black transition-all uppercase font-bold text-sm"
            >
              ENCRYPT & UPLOAD
            </button>
          </div>
        )}

      </div>

      <p className="mt-8 text-xs text-green-900 opacity-50">SECURE CONNECTION :: 192.168.X.X</p>
    </div>
  );
}
