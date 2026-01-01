import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase'; 
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, getDoc } from "firebase/firestore";

// --- AUDIO ENGINE ---
const playSound = (type) => {
  if (typeof window === 'undefined') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'hover') {
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } else if (type === 'click') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.1);
  } else if (type === 'alert') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  }
  osc.start();
};

export default function ProtocolGhostt() {
  // STATES
  const [view, setView] = useState("BOOT"); 
  const [logs, setLogs] = useState([]); 
  const [clockTime, setClockTime] = useState(""); 
  const [battery, setBattery] = useState(100);
  const [mode, setMode] = useState("DASHBOARD"); // DASHBOARD | VAULT | HUNTER
  const [status, setStatus] = useState("STANDBY");
  const [countdown, setCountdown] = useState("CALCULATING...");

  // DATA
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [trapLink, setTrapLink] = useState("");
  const [hunterHits, setHunterHits] = useState([]);
  
  // LOGIC
  const [lastSeen, setLastSeen] = useState(null);

  const addLog = (message, type = "info") => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    setLogs(prev => [...prev.slice(-7), { time, msg: message, type }]);
  };

  // 1. INITIALIZATION
  useEffect(() => {
    // Boot Sequence
    const bootText = ["INITIALIZING...", "LOADING KERNEL...", "CONNECTING SATELLITE...", "SYSTEM ONLINE"];
    let delay = 0;
    bootText.forEach((text, i) => {
      delay += 600;
      setTimeout(() => {
        addLog(text);
        playSound('click');
        if (i === bootText.length - 1) setTimeout(() => setView("LOCK"), 800);
      }, delay);
    });

    // Clock
    setInterval(() => {
      const now = new Date();
      setClockTime(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
    }, 1000);

    // Battery
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      navigator.getBattery().then(b => setBattery(Math.floor(b.level * 100)));
    }

    fetchLastSeen();

    // --- REALTIME LISTENER FOR HUNTER TRAPS ---
    // This watches the database. If a trap is clicked, it ALERTS you instantly.
    const q = query(collection(db, "hunter_logs"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hits = snapshot.docs.map(doc => doc.data());
      setHunterHits(hits);
      // Simple logic to detect new hits would go here
    });

    return () => unsubscribe();
  }, []);

  // 2. COUNTDOWN
  useEffect(() => {
    if (!lastSeen) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const deadLine = lastSeen.getTime() + (30 * 24 * 60 * 60 * 1000);
      const distance = deadLine - now;
      if (distance < 0) setCountdown("EXECUTED");
      else {
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setCountdown(`${d}D ${h}H`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  // ACTIONS
  const fetchLastSeen = async () => {
    try {
      const docSnap = await getDoc(doc(db, "system", "ghostt_status"));
      if (docSnap.exists()) setLastSeen(docSnap.data().last_seen.toDate());
    } catch(e) {}
  };

  const handleUnlock = () => {
    playSound('click');
    addLog("IDENTITY VERIFIED");
    setTimeout(() => setView("HUD"), 800);
  };

  const generateTrap = () => {
    // In a real deployment, this URL matches your Netlify domain
    const url = `${window.location.origin}/api/trap`;
    setTrapLink(url);
    addLog("TRAP LINK GENERATED");
    playSound('click');
  };

  const pingSystem = async () => {
    setStatus("PROCESSING");
    playSound('click');
    try {
      await updateDoc(doc(db, "system", "ghostt_status"), { last_seen: serverTimestamp(), status: "ACTIVE" });
      setTimeout(() => {
        setLastSeen(new Date());
        setStatus("SUCCESS");
        addLog("PROTOCOL RENEWED");
        setTimeout(() => setStatus("STANDBY"), 2000);
      }, 1000);
    } catch(e) { setStatus("ERROR"); }
  };

  // VIEWS
  if (view === "BOOT") return <div className="min-h-screen bg-black text-green-600 font-mono p-6 flex flex-col justify-end text-xs">{logs.map((l,i)=><div key={i}>[{l.time}] {l.msg}</div>)}</div>;

  if (view === "LOCK") return (
    <div onClick={handleUnlock} className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center justify-center cursor-pointer">
      <div className="border-2 border-green-500 rounded-full p-8 animate-pulse">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
      </div>
      <p className="mt-8 tracking-[0.3em] text-xs">TAP TO AUTHENTICATE</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-2 flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="flex justify-between items-start border-b border-green-800 pb-2 mb-2 pt-2">
        <div>
          <h1 className="text-lg font-bold tracking-widest text-green-300">GHOSTT_OS</h1>
          <div className="text-[10px] text-green-700">SECURE SHELL // V5.0</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tracking-widest">{clockTime}</div>
          <div className="text-[10px] text-green-600">BAT: {battery}%</div>
        </div>
      </header>

      {/* STATUS BAR */}
      <div className={`mb-2 p-1 border text-center text-[10px] font-bold tracking-widest ${status==="ERROR"?"border-red-600 text-red-500":"border-green-800 text-green-600"}`}>
        STATUS: {status}
      </div>

      <main className="flex-1 flex flex-col gap-3">
        {/* DEAD MAN SWITCH WIDGET */}
        <div className="border border-green-800 bg-green-900/5 p-4 text-center">
          <h2 className="text-[10px] text-green-600 mb-1 tracking-widest">PROTOCOL DEADLINE</h2>
          <div className="text-2xl font-bold text-white mb-2">{countdown}</div>
          <button onClick={pingSystem} disabled={status==="PROCESSING"} className="w-full py-2 text-xs border border-green-600 hover:bg-green-600 hover:text-black transition-colors uppercase">
            {status==="PROCESSING" ? "SYNCING..." : "RENEW SIGNAL"}
          </button>
        </div>

        {/* NAVIGATION */}
        <div className="flex border-b border-green-800">
          {["DASHBOARD", "HUNTER", "VAULT"].map(m => (
            <button key={m} onClick={()=>{setMode(m); playSound('click');}} className={`flex-1 py-2 text-[10px] tracking-widest ${mode===m?"bg-green-600 text-black font-bold":"text-green-700"}`}>
              {m}
            </button>
          ))}
        </div>

        {/* DYNAMIC CONTENT */}
        <div className="flex-1 bg-green-900/5 border-x border-b border-green-800 p-3 min-h-[250px] overflow-y-auto">
          
          {mode === "DASHBOARD" && (
            <div className="space-y-1 text-[10px]">
              {logs.map((log, i) => (
                 <div key={i} className="border-l border-green-800 pl-2 opacity-80">
                   <span className="text-green-600">[{log.time}]</span> {log.msg}
                 </div>
              ))}
              <div className="animate-pulse">_</div>
            </div>
          )}

          {mode === "HUNTER" && (
            <div className="flex flex-col h-full">
              <div className="text-center mb-4">
                <button onClick={generateTrap} className="border border-red-500 text-red-500 px-4 py-2 text-xs hover:bg-red-500 hover:text-black transition-colors uppercase">
                  GENERATE TRAP LINK
                </button>
                {trapLink && (
                  <div className="mt-2 text-[10px] break-all bg-red-900/20 p-2 border border-red-900 text-red-400 select-all">
                    {trapLink}
                  </div>
                )}
              </div>
              
              <div className="flex-1 border-t border-green-800 pt-2">
                <h3 className="text-[10px] text-green-600 mb-2">RECENT INTERCEPTS</h3>
                <div className="space-y-2">
                  {hunterHits.length === 0 ? <span className="text-[10px] opacity-30">NO TARGETS ACQUIRED</span> : 
                   hunterHits.map((hit, i) => (
                    <div key={i} className="bg-red-900/10 border border-red-900/30 p-2 text-[10px]">
                      <div className="text-red-400 font-bold">INTRUSION DETECTED</div>
                      <div className="opacity-70">IP: {hit.ip || "UNKNOWN"}</div>
                      <div className="opacity-50 text-[8px] truncate">{hit.device}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === "VAULT" && (
            <div className="text-center pt-10 text-[10px] opacity-50">
              [VAULT LOCKED // V5.0 UPDATE REQUIRED]
            </div>
          )}

        </div>
      </main>

      <footer className="text-center text-[8px] text-green-900 mt-2">
        ENCRYPTED CONNECTION // ID: GHOSTT
      </footer>
    </div>
  );
}
