import { useState, useEffect } from 'react';
import { db } from '../lib/firebase'; 
import { doc, updateDoc, collection, addDoc, getDoc, serverTimestamp } from "firebase/firestore";

// --- ICONS ---
const FingerprintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 text-green-500 animate-pulse cursor-pointer">
    <path d="M12 2a10 10 0 0 0-7.07 17.07l1.41-1.41A8 8 0 1 1 12 4v0zm0 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="currentColor"/>
    <path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8H2c0 5.52 4.48 10 10 10z" fill="currentColor" opacity="0.5"/>
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);

export default function ProtocolGhostt() {
  // --- UI STATES ---
  const [view, setView] = useState("BOOT"); 
  const [logs, setLogs] = useState([]);
  const [currentTime, setCurrentTime] = useState("");
  const [battery, setBattery] = useState(100);
  
  // --- LOGIC STATES ---
  const [status, setStatus] = useState("STANDBY"); // STANDBY | PROCESSING | SUCCESS | ERROR
  const [statusMsg, setStatusMsg] = useState("SYSTEM OPTIMAL");
  const [countdown, setCountdown] = useState("CALCULATING...");
  
  // --- DATA INPUTS ---
  const [mode, setMode] = useState("DASHBOARD");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState(""); 
  const [lastSeen, setLastSeen] = useState(null);

  // 1. INITIALIZATION & CLOCK
  useEffect(() => {
    // Boot Sequence
    const bootText = ["INITIALIZING GHOSTT PROTOCOL...", "LOADING KERNEL...", "CONNECTING TO SATELLITE...", "SYSTEM ONLINE."];
    let delay = 0;
    bootText.forEach((text, i) => {
      delay += 800;
      setTimeout(() => {
        setLogs(prev => [...prev, `> ${text}`]);
        if (i === bootText.length - 1) setTimeout(() => setView("LOCK"), 1000);
      }, delay);
    });

    // Real-time Clock (Updates every second)
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
    }, 1000);

    // Battery Check
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      navigator.getBattery().then(b => setBattery(Math.floor(b.level * 100)));
    }

    // Fetch Initial Status
    fetchLastSeen();

    return () => clearInterval(clockInterval);
  }, []);

  // 2. LIVE COUNTDOWN LOGIC
  useEffect(() => {
    if (!lastSeen) return;
    
    const timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const deadLine = lastSeen.getTime() + (30 * 24 * 60 * 60 * 1000); // 30 Days from last seen
      const distance = deadLine - now;

      if (distance < 0) {
        setCountdown("PROTOCOL OMEGA EXECUTED");
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown(`${days}D ${hours}H ${minutes}M ${seconds}S`);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [lastSeen]);

  // --- ACTIONS ---

  const fetchLastSeen = async () => {
    try {
      const docRef = doc(db, "system", "ghostt_status");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setLastSeen(docSnap.data().last_seen.toDate());
        setEmail(docSnap.data().emergency_email || "");
      } else {
        // If first run, set "now" as start
        setLastSeen(new Date());
      }
    } catch (e) {
      console.log("Offline Mode");
    }
  };

  const handleUnlock = () => {
    setLogs(prev => [...prev, "> BIOMETRIC VERIFIED", "> WELCOME, GHOSTT."]);
    setTimeout(() => setView("HUD"), 1000);
  };

  const pingSystem = async () => {
    setStatus("PROCESSING");
    setStatusMsg("CONTACTING SATELLITE...");
    
    try {
      const ghostRef = doc(db, "system", "ghostt_status");
      // Update timestamp AND "Active" status
      await updateDoc(ghostRef, { 
        last_seen: serverTimestamp(), 
        status: "ACTIVE" 
      });
      
      // Fake delay for effect
      setTimeout(() => {
        setLastSeen(new Date()); // Update local state immediately
        setStatus("SUCCESS");
        setStatusMsg("SIGNAL LOCKED. TIMER RESET.");
        setTimeout(() => {
          setStatus("STANDBY");
          setStatusMsg("SYSTEM OPTIMAL");
        }, 3000);
      }, 1500);

    } catch (e) {
      setStatus("ERROR");
      setStatusMsg("CONNECTION FAILED");
    }
  };

  const uploadSecret = async () => {
    if (!secret || !label) {
      setStatus("ERROR");
      setStatusMsg("MISSING DATA FIELDS");
      setTimeout(() => setStatus("STANDBY"), 2000);
      return;
    }

    setStatus("PROCESSING");
    setStatusMsg("ENCRYPTING PACKET (AES-256)...");

    try {
      // 1. Upload Secret
      await addDoc(collection(db, "vault"), { 
        label, 
        payload: secret, 
        timestamp: serverTimestamp() 
      });

      // 2. Update Emergency Email if changed
      if (email) {
        const ghostRef = doc(db, "system", "ghostt_status");
        await updateDoc(ghostRef, { emergency_email: email });
      }

      setTimeout(() => {
        setStatus("SUCCESS");
        setStatusMsg("UPLOAD SECURE. DATA FRAGMENTED.");
        setSecret("");
        setLabel("");
        setTimeout(() => {
          setStatus("STANDBY");
          setStatusMsg("SYSTEM OPTIMAL");
        }, 3000);
      }, 2000);

    } catch (e) {
      setStatus("ERROR");
      setStatusMsg("UPLOAD FAILED");
    }
  };

  // --- VIEWS ---

  if (view === "BOOT") return (
    <div className="min-h-screen bg-black text-green-600 font-mono p-6 flex flex-col justify-end">
      {logs.map((log, i) => <div key={i} className="opacity-80 text-sm">{log}</div>)}
      <div className="animate-pulse mt-2">_</div>
    </div>
  );

  if (view === "LOCK") return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-900 to-black"></div>
      <div className="z-10 flex flex-col items-center" onClick={handleUnlock}>
        <div className="border-2 border-green-500 rounded-full p-8 hover:bg-green-900/20 transition-all duration-300 active:scale-95 cursor-pointer shadow-[0_0_30px_rgba(0,255,0,0.3)]">
          <FingerprintIcon />
        </div>
        <p className="mt-8 tracking-[0.5em] text-xs animate-pulse">TOUCH TO AUTHENTICATE</p>
      </div>
      <div className="absolute bottom-8 text-xs text-green-900">SECURE ACCESS // LEVEL 10</div>
    </div>
  );

  // HUD VIEW
  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-2 overflow-hidden relative selection:bg-green-900 selection:text-white flex flex-col">
      {/* BACKGROUND EFFECTS */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.25)_50%)] bg-[length:100%_4px]"></div>
      
      {/* TOP HEADER */}
      <header className="flex justify-between items-start border-b border-green-800 pb-2 mb-4 px-2 pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-widest text-green-300">GHOSTT_OS</h1>
          <div className="text-[10px] text-green-700">VPN: ACTIVE // ENCRYPTION: MAX</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-widest">{currentTime}</div>
          <div className="text-[10px] flex justify-end items-center gap-2 text-green-600">
            <span>PWR: {battery}%</span>
            <div className={`w-2 h-2 rounded-full ${status === "ERROR" ? "bg-red-500" : "bg-green-500"} animate-pulse`}></div>
          </div>
        </div>
      </header>

      {/* STATUS BANNER (Dynamic Feedback) */}
      <div className={`mb-4 mx-2 p-2 border text-center text-xs font-bold tracking-widest transition-colors duration-500 ${
        status === "PROCESSING" ? "border-yellow-600 text-yellow-500 bg-yellow-900/10" :
        status === "SUCCESS" ? "border-green-500 text-green-400 bg-green-900/20" :
        status === "ERROR" ? "border-red-600 text-red-500 bg-red-900/20" :
        "border-green-900 text-green-700"
      }`}>
        STATUS: {statusMsg}
      </div>

      <main className="flex-1 max-w-lg mx-auto w-full relative z-10 flex flex-col gap-4">
        
        {/* TIMER MODULE */}
        <div className="border border-green-800 bg-green-900/5 p-6 relative overflow-hidden text-center">
          <div className="absolute top-2 right-2 opacity-50"><LockIcon /></div>
          <h2 className="text-xs text-green-600 mb-2 tracking-widest">PROTOCOL OMEGA DEADLINE</h2>
          
          <div className="text-3xl font-bold text-white mb-6 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
            {countdown}
          </div>
          
          <button 
            onClick={pingSystem}
            disabled={status === "PROCESSING"}
            className={`w-full py-4 text-sm font-bold tracking-[0.2em] transition-all uppercase border 
              ${status === "PROCESSING" 
                ? "border-yellow-600 text-yellow-600 cursor-wait" 
                : "border-green-500 hover:bg-green-500 hover:text-black hover:shadow-[0_0_20px_rgba(0,255,0,0.4)]"
              }`}
          >
            {status === "PROCESSING" ? "UPLINKING..." : "RENEW SIGNAL"}
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-green-800 mx-2">
          <button onClick={() => setMode("DASHBOARD")} className={`flex-1 py-3 text-xs tracking-widest transition-colors ${mode === "DASHBOARD" ? "bg-green-500 text-black font-bold" : "text-green-800 hover:text-green-500"}`}>CONSOLE</button>
          <button onClick={() => setMode("VAULT")} className={`flex-1 py-3 text-xs tracking-widest transition-colors ${mode === "VAULT" ? "bg-green-500 text-black font-bold" : "text-green-800 hover:text-green-500"}`}>SECURE VAULT</button>
        </div>

        {/* DYNAMIC CONTENT AREA */}
        <div className="flex-1 bg-black p-4 mx-2 border-x border-b border-green-800 min-h-[300px]">
          
          {mode === "DASHBOARD" ? (
            <div className="space-y-2 font-mono text-xs h-full flex flex-col justify-end">
              {logs.slice(-8).map((log, i) => (
                 <div key={i} className="border-l-2 border-green-900 pl-2 text-green-500/70">
                   <span className="text-green-800">[{currentTime}]</span> {log}
                 </div>
              ))}
              <div className="animate-pulse text-green-500">_</div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 h-full">
              <div className="text-[10px] text-green-700 mb-2 uppercase border-b border-green-900 pb-2">
                Destination: If Timer = 0, Send Data To:
              </div>
              <input 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="EMERGENCY CONTACT EMAIL" 
                className="bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs tracking-widest placeholder-green-900"
              />

              <div className="text-[10px] text-green-700 mt-2 uppercase border-b border-green-900 pb-2">
                Payload Encryption
              </div>
              <input 
                value={label} 
                onChange={(e) => setLabel(e.target.value)}
                placeholder="DATA LABEL (e.g. Ledger Key)" 
                className="bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs tracking-widest placeholder-green-900"
              />
              <textarea 
                value={secret} 
                onChange={(e) => setSecret(e.target.value)}
                placeholder="ENTER SENSITIVE DATA..." 
                className="flex-1 bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs font-mono resize-none placeholder-green-900"
              />
              
              <button 
                onClick={uploadSecret} 
                disabled={status === "PROCESSING"}
                className={`py-3 border text-xs font-bold tracking-widest transition-colors uppercase
                  ${status === "PROCESSING" ? "border-green-900 text-green-900" : "border-green-600 text-green-600 hover:bg-green-600 hover:text-black"}`}
              >
                {status === "PROCESSING" ? "ENCRYPTING..." : "UPLOAD TO VAULT"}
              </button>
            </div>
          )}
        </div>

      </main>
      
      {/* FOOTER */}
      <footer className="p-4 text-center text-[10px] text-green-900 border-t border-green-900 mt-auto">
        SECURE CONNECTION ESTABLISHED // V2.0.4
      </footer>
    </div>
  );
}
