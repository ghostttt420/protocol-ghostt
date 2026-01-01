import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase'; 
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

// --- SVG ASSETS (ICONS) ---
const FingerprintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 text-green-500 animate-pulse">
    <path d="M12 2a10 10 0 0 0-7.07 17.07l1.41-1.41A8 8 0 1 1 12 4v0zm0 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="currentColor"/>
    <path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8H2c0 5.52 4.48 10 10 10z" fill="currentColor" opacity="0.5"/>
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);

export default function ProtocolGhostt() {
  // SYSTEM STATES
  const [view, setView] = useState("BOOT"); // BOOT -> LOCK -> HUD
  const [status, setStatus] = useState("STANDBY");
  const [logs, setLogs] = useState([]);
  const [battery, setBattery] = useState(100);
  
  // DATA STATES
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState("DASHBOARD");

  // --- 1. BOOT SEQUENCE EFFECT ---
  useEffect(() => {
    const bootText = [
      "INITIALIZING GHOSTT PROTOCOL...",
      "LOADING KERNEL MODULES...",
      "BYPASSING FIREWALL...",
      "CONNECTING TO SATELLITE UPLINK...",
      "SYSTEM ONLINE."
    ];
    
    let delay = 0;
    bootText.forEach((text, index) => {
      delay += 800;
      setTimeout(() => {
        setLogs(prev => [...prev, `> ${text}`]);
        if (index === bootText.length - 1) setTimeout(() => setView("LOCK"), 1000);
      }, delay);
    });

    // Fake Battery API
    if (navigator.getBattery) {
      navigator.getBattery().then(b => setBattery(Math.floor(b.level * 100)));
    }
  }, []);

  // --- 2. CORE FUNCTIONS ---
  const handleUnlock = () => {
    setLogs(prev => [...prev, "> BIOMETRIC SCAN: VERIFIED", "> WELCOME BACK, GHOSTT."]);
    setTimeout(() => setView("HUD"), 1500);
  };

  const pingSystem = async () => {
    setStatus("SYNCING...");
    try {
      const ghostRef = doc(db, "system", "ghostt_status");
      await updateDoc(ghostRef, { last_seen: serverTimestamp(), status: "ACTIVE" });
      setStatus("RENEWED");
      setTimeout(() => setStatus("SECURE"), 2000);
    } catch (e) {
      setStatus("ERROR");
    }
  };

  const uploadSecret = async () => {
    if (!secret) return;
    setStatus("ENCRYPTING...");
    try {
      await addDoc(collection(db, "vault"), { label, payload: secret, timestamp: serverTimestamp() });
      setStatus("UPLOADED");
      setSecret("");
      setTimeout(() => setStatus("SECURE"), 2000);
    } catch (e) { setStatus("FAILED"); }
  };

  // --- RENDER: BOOT SCREEN ---
  if (view === "BOOT") return (
    <div className="min-h-screen bg-black text-green-600 font-mono p-6 flex flex-col justify-end">
      {logs.map((log, i) => <div key={i} className="opacity-80 text-sm">{log}</div>)}
      <div className="animate-pulse mt-2">_</div>
    </div>
  );

  // --- RENDER: LOCK SCREEN ---
  if (view === "LOCK") return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Grid Animation */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, #00ff00 25%, #00ff00 26%, transparent 27%, transparent 74%, #00ff00 75%, #00ff00 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #00ff00 25%, #00ff00 26%, transparent 27%, transparent 74%, #00ff00 75%, #00ff00 76%, transparent 77%, transparent)', backgroundSize: '50px 50px' }}></div>
      
      <div className="z-10 flex flex-col items-center cursor-pointer" onClick={handleUnlock}>
        <div className="border-2 border-green-500 rounded-full p-8 hover:bg-green-900/20 transition-all duration-500 hover:scale-110 shadow-[0_0_30px_rgba(0,255,0,0.3)]">
          <FingerprintIcon />
        </div>
        <p className="mt-8 tracking-[0.5em] text-xs animate-pulse">TOUCH TO AUTHENTICATE</p>
      </div>
      
      <div className="absolute bottom-8 text-xs text-green-900">SECURE ACCESS // LEVEL 10</div>
    </div>
  );

  // --- RENDER: MAIN HUD (THE IRON MAN INTERFACE) ---
  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-2 overflow-hidden relative selection:bg-green-900 selection:text-white">
      
      {/* SCAN LINE EFFECT */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.25)_50%)] bg-[length:100%_4px]"></div>

      {/* TOP BAR */}
      <header className="flex justify-between items-center border-b border-green-800 pb-2 mb-4 px-2">
        <div>
          <h1 className="text-xl font-bold tracking-widest text-green-300">GHOSTT<span className="animate-pulse">_</span>OS</h1>
          <div className="text-[10px] text-green-700">ENCRYPTION: AES-256 // VPN: ACTIVE</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}</div>
          <div className="text-[10px] flex justify-end items-center gap-2">
            <span>BATTERY: {battery}%</span>
            <div className={`w-2 h-2 rounded-full ${status === "ERROR" ? "bg-red-500" : "bg-green-500"} animate-pulse`}></div>
          </div>
        </div>
      </header>

      {/* MAIN DASHBOARD GRID */}
      <main className="grid grid-cols-1 gap-4 max-w-lg mx-auto relative z-10">
        
        {/* WIDGET 1: DEAD MAN SWITCH */}
        <div className="border border-green-800 bg-green-900/5 p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-50"><LockIcon /></div>
          
          <h2 className="text-xs text-green-600 mb-2 tracking-widest">PROTOCOL OMEGA STATUS</h2>
          <div className="text-5xl font-bold text-white mb-4 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
            29<span className="text-xl text-green-600">D</span> 23<span className="text-xl text-green-600">H</span>
          </div>
          
          <button 
            onClick={pingSystem}
            className="w-full bg-green-500/10 hover:bg-green-500 hover:text-black border border-green-500 py-3 text-sm font-bold tracking-widest transition-all uppercase flex items-center justify-center gap-2"
          >
            {status === "SYNCING..." ? <span className="animate-spin">⟳</span> : "RENEW SIGNAL"}
          </button>
        </div>

        {/* WIDGET 2: NAVIGATION TABS */}
        <div className="flex border-b border-green-800">
          <button onClick={() => setMode("DASHBOARD")} className={`flex-1 py-2 text-xs ${mode === "DASHBOARD" ? "bg-green-500 text-black font-bold" : "text-green-700 hover:text-green-400"}`}>CONSOLE</button>
          <button onClick={() => setMode("VAULT")} className={`flex-1 py-2 text-xs ${mode === "VAULT" ? "bg-green-500 text-black font-bold" : "text-green-700 hover:text-green-400"}`}>SECURE VAULT</button>
        </div>

        {/* WIDGET 3: DYNAMIC CONTENT */}
        <div className="min-h-[200px] border-x border-b border-green-800 p-4 bg-black">
          
          {mode === "DASHBOARD" ? (
            <div className="space-y-1 font-mono text-xs">
              {logs.slice(-6).map((log, i) => (
                <div key={i} className="border-l-2 border-green-800 pl-2 text-green-500/80">
                  <span className="text-green-800">[{new Date().toLocaleTimeString()}]</span> {log}
                </div>
              ))}
              <div className="animate-pulse text-green-500">_</div>
            </div>
          ) : (
            <div className="space-y-3">
              <input 
                value={label} 
                onChange={e => setLabel(e.target.value)}
                placeholder="DATA LABEL" 
                className="w-full bg-green-900/10 border border-green-800 p-2 text-green-400 focus:outline-none focus:border-green-400 text-sm"
              />
              <textarea 
                value={secret} 
                onChange={e => setSecret(e.target.value)}
                placeholder="INPUT BINARY DATA..." 
                className="w-full h-24 bg-green-900/10 border border-green-800 p-2 text-green-400 focus:outline-none focus:border-green-400 text-sm font-mono resize-none"
              />
              <button onClick={uploadSecret} className="w-full border border-green-600 text-green-600 py-2 hover:bg-green-600 hover:text-black text-xs font-bold transition-colors">
                ENCRYPT & UPLOAD
              </button>
            </div>
          )}
        </div>

      </main>

      {/* FOOTER DECORATION */}
      <footer className="fixed bottom-0 left-0 w-full p-2 border-t border-green-900 bg-black z-20 flex justify-between text-[10px] text-green-800">
        <span>LOC: 6.5244° N, 3.3792° E</span>
        <span>SYS.VER. 2.4.0</span>
      </footer>
    </div>
  );
}
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
