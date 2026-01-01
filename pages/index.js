import { useState, useEffect } from 'react';
import { db } from '../lib/firebase'; 
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, getDoc } from "firebase/firestore";

// --- AUDIO ENGINE (Safeguarded) ---
let audioCtx = null;

const initAudio = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !audioCtx) {
      audioCtx = new AudioContext();
    }
    // Resume if suspended (common mobile fix)
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.error("Audio init failed, continuing silent mode.");
  }
};

const playSound = (type) => {
  // If audio system is broken, just exit function (don't crash app)
  if (!audioCtx) { initAudio(); if (!audioCtx) return; }
  
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'hover') {
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.02, now);
      osc.stop(now + 0.05);
    } else if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.stop(now + 0.1);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.stop(now + 0.4);
    } else if (type === 'alarm') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
    osc.start(now);
  } catch (e) {
    console.log("Audio play error (silent mode active)");
  }
};

export default function ProtocolGhostt() {
  // STATES
  const [view, setView] = useState("BOOT"); 
  const [logs, setLogs] = useState([]); 
  const [clockTime, setClockTime] = useState("--:--"); 
  const [battery, setBattery] = useState(100);
  const [mode, setMode] = useState("DASHBOARD"); 
  const [status, setStatus] = useState("STANDBY");
  const [countdown, setCountdown] = useState("CALCULATING...");
  const [alarmActive, setAlarmActive] = useState(false);

  // DATA
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [trapLink, setTrapLink] = useState("");
  const [hunterHits, setHunterHits] = useState([]);
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
      delay += 800;
      setTimeout(() => {
        addLog(text);
        if (i === bootText.length - 1) setTimeout(() => setView("LOCK"), 1000);
      }, delay);
    });

    // Clock
    const timer = setInterval(() => {
      const now = new Date();
      setClockTime(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
    }, 1000);

    // Battery
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      navigator.getBattery().then(b => setBattery(Math.floor(b.level * 100)));
    }

    fetchLastSeen();

    // Hunter Listener
    try {
      const q = query(collection(db, "hunter_logs"), orderBy("timestamp", "desc"), limit(5));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const hits = snapshot.docs.map(doc => doc.data());
        if (hits.length > 0 && hunterHits.length > 0 && hits[0].timestamp > hunterHits[0].timestamp) {
             triggerAlarm();
        }
        setHunterHits(hits);
      });
      return () => { clearInterval(timer); unsubscribe(); };
    } catch (e) {}
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
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown(`${d}D ${h}H ${m}M ${s}S`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  // ACTIONS
  const triggerAlarm = () => {
    setAlarmActive(true);
    playSound('alarm');
    addLog("WARNING: INTRUSION DETECTED", "alert");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => setAlarmActive(false), 3000);
  };

  const fetchLastSeen = async () => {
    try {
      const docSnap = await getDoc(doc(db, "system", "ghostt_status"));
      if (docSnap.exists()) {
          setLastSeen(docSnap.data().last_seen.toDate());
          setEmail(docSnap.data().emergency_email || "");
      }
    } catch(e) {}
  };

  // --- THE FIX: UNLOCK LOGIC ---
  const handleUnlock = () => {
    // 1. Force the UI change FIRST (so it never gets stuck)
    setView("HUD"); 
    
    // 2. Try Audio SECOND (safe mode)
    try {
      initAudio(); 
      playSound('success');
      addLog("IDENTITY VERIFIED");
    } catch (e) {
      console.log("Audio failed start");
    }
  };

  const generateTrap = () => {
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
        playSound('success');
        addLog("PROTOCOL RENEWED");
        setTimeout(() => setStatus("STANDBY"), 2000);
      }, 1000);
    } catch(e) { setStatus("ERROR"); }
  };

  const uploadSecret = async () => {
    playSound('click');
    if (!secret || !label) {
        setStatus("ERROR"); addLog("MISSING FIELDS"); return;
    }
    setStatus("PROCESSING");
    try {
      await addDoc(collection(db, "vault"), { label, payload: secret, timestamp: serverTimestamp() });
      if (email) await updateDoc(doc(db, "system", "ghostt_status"), { emergency_email: email });
      setTimeout(() => {
        setStatus("SUCCESS"); playSound('success'); addLog("UPLOAD SECURE"); setSecret(""); setLabel("");
        setTimeout(() => setStatus("STANDBY"), 2000);
      }, 1500);
    } catch(e) { setStatus("ERROR"); }
  };

  // VIEWS
  if (view === "BOOT") return (
    <div onClick={() => setView("LOCK")} className="min-h-screen bg-black text-green-600 font-mono p-6 flex flex-col justify-end text-xs cursor-pointer">
      {logs.map((l,i)=><div key={i}>[{l.time}] {l.msg}</div>)}
      <div className="animate-pulse mt-2">_</div>
    </div>
  );

  if (view === "LOCK") return (
    // Added explicit full-screen click handler backup
    <div onClick={handleUnlock} className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center justify-center cursor-pointer">
      <div className="border-2 border-green-500 rounded-full p-8 animate-pulse shadow-[0_0_20px_rgba(0,255,0,0.4)]">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
      </div>
      <p className="mt-8 tracking-[0.3em] text-xs">TAP TO AUTHENTICATE</p>
    </div>
  );

  return (
    <div className={`min-h-screen font-mono p-2 flex flex-col overflow-hidden transition-colors duration-200 ${alarmActive ? "bg-red-900" : "bg-black"} text-green-400`}>
      
      {/* HEADER */}
      <header className="flex justify-between items-start border-b border-green-800 pb-2 mb-2 pt-2">
        <div>
          <h1 className="text-lg font-bold tracking-widest text-green-300">GHOSTT_OS</h1>
          <div className="text-[10px] text-green-700">SECURE SHELL // V6.1</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tracking-widest">{clockTime}</div>
          <div className="text-[10px] text-green-600">BAT: {battery}%</div>
        </div>
      </header>

      {/* STATUS BAR */}
      <div className={`mb-2 p-1 border text-center text-[10px] font-bold tracking-widest ${alarmActive ? "border-red-500 text-white animate-pulse" : status==="ERROR"?"border-red-600 text-red-500":"border-green-800 text-green-600"}`}>
        STATUS: {alarmActive ? "INTRUSION DETECTED" : status}
      </div>

      <main className="flex-1 flex flex-col gap-3">
        {/* DEAD MAN SWITCH */}
        <div className="border border-green-800 bg-green-900/5 p-4 text-center">
          <h2 className="text-[10px] text-green-600 mb-1 tracking-widest">PROTOCOL DEADLINE</h2>
          <div className="text-2xl font-bold text-white mb-2">{countdown}</div>
          <button onClick={pingSystem} disabled={status==="PROCESSING"} className="w-full py-2 text-xs border border-green-600 hover:bg-green-600 hover:text-black transition-colors uppercase">
            {status==="PROCESSING" ? "SYNCING..." : "RENEW SIGNAL"}
          </button>
        </div>

        {/* NAV */}
        <div className="flex border-b border-green-800">
          {["DASHBOARD", "HUNTER", "VAULT"].map(m => (
            <button key={m} onClick={()=>{setMode(m); playSound('click');}} className={`flex-1 py-2 text-[10px] tracking-widest ${mode===m?"bg-green-600 text-black font-bold":"text-green-700"}`}>
              {m}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 bg-green-900/5 border-x border-b border-green-800 p-3 min-h-[250px] overflow-y-auto">
          
          {mode === "DASHBOARD" && (
            <div className="space-y-1 text-[10px]">
              {logs.map((log, i) => (
                 <div key={i} className={`border-l pl-2 opacity-80 ${log.type==='alert'?'border-red-500 text-red-400':'border-green-800'}`}>
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
              <div className="space-y-2 mt-2">
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
          )}

          {mode === "VAULT" && (
            <div className="flex flex-col gap-3">
              <div className="text-[10px] text-green-700 uppercase border-b border-green-900 pb-1">Destination</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="EMERGENCY EMAIL" className="bg-green-900/10 border border-green-800 p-2 text-green-400 text-xs" />
              
              <div className="text-[10px] text-green-700 uppercase border-b border-green-900 pb-1 mt-2">Payload</div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="DATA LABEL" className="bg-green-900/10 border border-green-800 p-2 text-green-400 text-xs" />
              <textarea value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="SENSITIVE DATA..." className="flex-1 bg-green-900/10 border border-green-800 p-2 text-green-400 text-xs font-mono h-24" />
              
              <button onClick={uploadSecret} disabled={status==="PROCESSING"} className="py-2 border border-green-600 text-green-600 text-xs uppercase hover:bg-green-600 hover:text-black">
                {status==="PROCESSING" ? "ENCRYPTING..." : "UPLOAD TO VAULT"}
              </button>
            </div>
          )}

        </div>
      </main>
      <footer className="text-center text-[8px] text-green-900 mt-2">ENCRYPTED CONNECTION // ID: GHOSTT</footer>
    </div>
  );
}
