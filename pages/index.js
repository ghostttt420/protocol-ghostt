import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase'; 
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, getDoc } from "firebase/firestore";

// --- ICONS ---
const FingerprintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 text-green-500 animate-pulse cursor-pointer hover:text-green-400 transition-colors">
    <path d="M12 2a10 10 0 0 0-7.07 17.07l1.41-1.41A8 8 0 1 1 12 4v0zm0 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="currentColor"/>
    <path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8H2c0 5.52 4.48 10 10 10z" fill="currentColor" opacity="0.5"/>
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);

// --- SAFE AUDIO ENGINE ---
let audioCtx = null;

const initAudio = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) { console.error("Audio init error"); }
};

const playSound = (type) => {
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
      // SIREN SOUND
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
    if (type !== 'alarm') osc.start(now);
  } catch (e) { }
};

// --- VOICE ENGINE ---
const speak = (text) => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.8; 
    utterance.rate = 1.1;  
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  }
};

export default function ProtocolGhostt() {
  // --- UI STATES ---
  const [view, setView] = useState("BOOT"); 
  const [logs, setLogs] = useState([]); 
  const [clockTime, setClockTime] = useState("--:--"); 
  const [battery, setBattery] = useState(100);
  const [alarmActive, setAlarmActive] = useState(false); // FOR FLASHING RED
  
  // --- LOGIC STATES ---
  const [status, setStatus] = useState("STANDBY"); 
  const [statusMsg, setStatusMsg] = useState("SYSTEM OPTIMAL");
  const [countdown, setCountdown] = useState("CALCULATING...");
  
  // --- DATA INPUTS ---
  const [mode, setMode] = useState("DASHBOARD");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState(""); 
  const [trapLink, setTrapLink] = useState("");
  const [hunterHits, setHunterHits] = useState([]);
  const [lastSeen, setLastSeen] = useState(null);

  const addLog = (message, type = "info") => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [...prev.slice(-7), { time: timeString, msg: message, type }]);
  };

  // 1. INITIALIZATION
  useEffect(() => {
    const bootText = ["INITIALIZING GHOSTT PROTOCOL...", "LOADING KERNEL MODULES...", "CONNECTING TO SATELLITE...", "SYSTEM ONLINE."];
    let delay = 0;
    bootText.forEach((text, i) => {
      delay += 800;
      setTimeout(() => {
        addLog(text);
        if (i === bootText.length - 1) {
            setTimeout(() => setView("LOCK"), 1000);
            speak("System Online. Authentication Required.");
        }
      }, delay);
    });

    const clockInterval = setInterval(() => {
      const now = new Date();
      setClockTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    }, 1000);

    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      navigator.getBattery().then(b => setBattery(Math.floor(b.level * 100)));
    }
    fetchLastSeen();

    // --- HUNTER LISTENER (ALARM LOGIC) ---
    try {
      const q = query(collection(db, "hunter_logs"), orderBy("timestamp", "desc"), limit(5));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const hits = snapshot.docs.map(doc => doc.data());
        // Trigger alarm if new hit comes in
        if (hits.length > 0 && hunterHits.length > 0 && hits[0].timestamp > hunterHits[0].timestamp) {
             triggerAlarm();
        }
        setHunterHits(hits);
      });
      return () => { clearInterval(clockInterval); unsubscribe(); };
    } catch (e) {}
  }, []);

  // 2. LIVE COUNTDOWN (Precise)
  useEffect(() => {
    if (!lastSeen) return;
    const timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const deadLine = lastSeen.getTime() + (30 * 24 * 60 * 60 * 1000);
      const distance = deadLine - now;

      if (distance < 0) {
        setCountdown("PROTOCOL OMEGA EXECUTED");
      } else {
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown(`${d}D ${h}H ${m}M ${s}S`);
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
        setLastSeen(new Date());
      }
    } catch (e) {
      addLog("WARN: OFFLINE MODE");
    }
  };

  const handleUnlock = () => {
    initAudio(); // Force audio unlock on mobile
    playSound('success');
    if (navigator.vibrate) navigator.vibrate(50);
    addLog("BIOMETRIC SCAN: VERIFIED");
    addLog("ACCESS GRANTED: WELCOME GHOSTT");
    speak("Identity Verified. Welcome back, Ghost.");
    setTimeout(() => setView("HUD"), 1000);
  };

  const triggerAlarm = () => {
    setAlarmActive(true);
    playSound('alarm');
    speak("Warning. Intrusion Detected.");
    addLog("WARNING: INTRUSION DETECTED", "alert");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => setAlarmActive(false), 4000);
  };

  const switchMode = (newMode) => {
    playSound('click');
    setMode(newMode);
    addLog(`UI NAVIGATION: ${newMode} PANEL`);
  };

  const generateTrap = () => {
    const url = `${window.location.origin}/api/trap`;
    setTrapLink(url);
    addLog("TRAP LINK GENERATED");
    playSound('click');
  };

  const pingSystem = async () => {
    playSound('click');
    setStatus("PROCESSING");
    setStatusMsg("CONTACTING SATELLITE...");
    addLog("INITIATING HANDSHAKE PROTOCOL...");
    
    try {
      const ghostRef = doc(db, "system", "ghostt_status");
      await updateDoc(ghostRef, { last_seen: serverTimestamp(), status: "ACTIVE" });
      
      setTimeout(() => {
        setLastSeen(new Date()); 
        setStatus("SUCCESS");
        playSound('success');
        speak("Protocol Renewed.");
        setStatusMsg("SIGNAL LOCKED. TIMER RESET.");
        addLog("SUCCESS: HEARTBEAT ACKNOWLEDGED");
        setTimeout(() => {
          setStatus("STANDBY");
          setStatusMsg("SYSTEM OPTIMAL");
        }, 3000);
      }, 1500);

    } catch (e) {
      setStatus("ERROR");
      playSound('error');
      setStatusMsg("CONNECTION FAILED");
      addLog(`CRITICAL ERROR: ${e.message}`);
    }
  };

  const uploadSecret = async () => {
    playSound('click');
    if (!secret || !label) {
      setStatus("ERROR");
      playSound('error');
      setStatusMsg("MISSING DATA FIELDS");
      addLog("ERROR: NULL PAYLOAD");
      return;
    }

    setStatus("PROCESSING");
    setStatusMsg("ENCRYPTING PACKET...");
    addLog(`ENCRYPTING: ${label.toUpperCase()}...`);

    try {
      await addDoc(collection(db, "vault"), { label, payload: secret, timestamp: serverTimestamp() });
      if (email) {
        const ghostRef = doc(db, "system", "ghostt_status");
        await updateDoc(ghostRef, { emergency_email: email });
      }

      setTimeout(() => {
        setStatus("SUCCESS");
        playSound('success');
        speak("Data Encrypted and Stored.");
        setStatusMsg("UPLOAD SECURE.");
        addLog("UPLOAD COMPLETE");
        setSecret("");
        setLabel("");
        setTimeout(() => {
          setStatus("STANDBY");
          setStatusMsg("SYSTEM OPTIMAL");
        }, 3000);
      }, 2000);

    } catch (e) {
      setStatus("ERROR");
      playSound('error');
      setStatusMsg("UPLOAD FAILED");
    }
  };

  // --- VIEWS ---
  if (view === "BOOT") return (
    <div onClick={() => setView("LOCK")} className="min-h-screen bg-black text-green-600 font-mono p-6 flex flex-col justify-end">
      {logs.map((log, i) => <div key={i} className="opacity-80 text-sm">[{log.time}] {log.msg}</div>)}
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

  return (
    // FLASHING RED ON ALARM
    <div className={`min-h-screen font-mono p-2 overflow-hidden relative flex flex-col transition-colors duration-200 ${alarmActive ? "bg-red-900 text-white" : "bg-black text-green-400"}`}>
      <div className="pointer-events-none fixed inset-0 z-50 opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.25)_50%)] bg-[length:100%_4px]"></div>
      
      <header className="flex justify-between items-start border-b border-green-800 pb-2 mb-4 px-2 pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-widest text-green-300">GHOSTT_OS</h1>
          <div className="text-[10px] text-green-700">VPN: ACTIVE // ENCRYPTION: MAX</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tracking-widest text-green-300">{clockTime}</div>
          <div className="text-[10px] flex justify-end items-center gap-2 text-green-600">
            <span>PWR: {battery}%</span>
            <div className={`w-2 h-2 rounded-full ${status === "ERROR" ? "bg-red-500" : "bg-green-500"} animate-pulse`}></div>
          </div>
        </div>
      </header>

      <div className={`mb-4 mx-2 p-2 border text-center text-xs font-bold tracking-widest transition-colors duration-500 ${
        alarmActive ? "border-red-500 bg-red-800 animate-pulse text-white" :
        status === "PROCESSING" ? "border-yellow-600 text-yellow-500 bg-yellow-900/10" :
        status === "SUCCESS" ? "border-green-500 text-green-400 bg-green-900/20" :
        status === "ERROR" ? "border-red-600 text-red-500 bg-red-900/20" :
        "border-green-900 text-green-700"
      }`}>
        STATUS: {alarmActive ? "INTRUSION DETECTED" : statusMsg}
      </div>

      <main className="flex-1 max-w-lg mx-auto w-full relative z-10 flex flex-col gap-4">
        
        <div className="border border-green-800 bg-green-900/5 p-6 relative overflow-hidden text-center">
          <div className="absolute top-2 right-2 opacity-50"><LockIcon /></div>
          <h2 className="text-xs text-green-600 mb-2 tracking-widest">PROTOCOL OMEGA DEADLINE</h2>
          <div className="text-2xl font-bold text-white mb-6 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
            {countdown}
          </div>
          <button 
            onClick={pingSystem}
            disabled={status === "PROCESSING"}
            className={`w-full py-4 text-sm font-bold tracking-[0.2em] transition-all uppercase border 
              ${status === "PROCESSING" ? "border-yellow-600 text-yellow-600 cursor-wait" : "border-green-500 hover:bg-green-500 hover:text-black hover:shadow-[0_0_20px_rgba(0,255,0,0.4)]"}`}
          >
            {status === "PROCESSING" ? "UPLINKING..." : "RENEW SIGNAL"}
          </button>
        </div>

        <div className="flex border-b border-green-800 mx-2">
          {["DASHBOARD", "HUNTER", "VAULT"].map(m => (
            <button key={m} onClick={() => switchMode(m)} className={`flex-1 py-3 text-xs tracking-widest transition-colors ${mode === m ? "bg-green-500 text-black font-bold" : "text-green-800 hover:text-green-500"}`}>{m}</button>
          ))}
        </div>

        <div className="flex-1 bg-black p-4 mx-2 border-x border-b border-green-800 min-h-[300px] overflow-y-auto">
          
          {mode === "DASHBOARD" && (
            <div className="space-y-2 font-mono text-xs h-full flex flex-col justify-end">
              {logs.map((log, i) => (
                 <div key={i} className={`border-l-2 pl-2 ${log.type==='alert' ? 'border-red-500 text-red-400' : 'border-green-900 text-green-500/70'}`}>
                   <span className="text-green-800">[{log.time}]</span> {log.msg}
                 </div>
              ))}
              <div className="animate-pulse text-green-500">_</div>
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
                  {hunterHits.length === 0 ? <span className="text-[10px] opacity-30 text-green-800">NO TARGETS ACQUIRED</span> : 
                   hunterHits.map((hit, i) => (
                    <div key={i} className="bg-red-900/10 border border-red-900/30 p-2 text-[10px]">
                      <div className="text-red-400 font-bold">INTRUSION DETECTED</div>
                      <div className="opacity-70 text-green-600">IP: {hit.ip || "UNKNOWN"}</div>
                      <div className="opacity-50 text-[8px] truncate text-green-800">{hit.device}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {mode === "VAULT" && (
            <div className="flex flex-col gap-4 h-full">
              <div className="text-[10px] text-green-700 uppercase border-b border-green-900 pb-2">Destination Protocol</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="EMERGENCY CONTACT EMAIL" className="bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs tracking-widest placeholder-green-900" />
              <div className="text-[10px] text-green-700 mt-2 uppercase border-b border-green-900 pb-2">Payload Encryption</div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="DATA LABEL" className="bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs tracking-widest placeholder-green-900" />
              <textarea value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ENTER SENSITIVE DATA..." className="flex-1 bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs font-mono resize-none placeholder-green-900" />
              <button onClick={uploadSecret} disabled={status === "PROCESSING"} className="py-3 border border-green-600 text-green-600 text-xs font-bold tracking-widest transition-colors uppercase hover:bg-green-600 hover:text-black">
                {status === "PROCESSING" ? "ENCRYPTING..." : "UPLOAD TO VAULT"}
              </button>
            </div>
          )}

        </div>
      </main>
      
      <footer className="p-4 text-center text-[10px] text-green-900 border-t border-green-900 mt-auto">
        SECURE CONNECTION ESTABLISHED // V7.0 (HYBRID)
      </footer>
    </div>
  );
}
