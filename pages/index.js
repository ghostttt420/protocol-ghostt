import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase'; 
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, getDoc } from "firebase/firestore";

// --- STYLES ---
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
    .scanline::before { content: " "; display: block; position: absolute; top: 0; left: 0; bottom: 0; right: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); z-index: 2; background-size: 100% 2px, 3px 100%; pointer-events: none; }
    .moving-line { position: absolute; top: 0; left: 0; width: 100%; height: 5px; background-color: rgba(0, 255, 0, 0.2); animation: scanline 6s linear infinite; pointer-events: none; z-index: 10; }
  `}</style>
);

// --- ICONS ---
const FingerprintIcon = () => ( <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 text-green-500 animate-pulse cursor-pointer hover:text-green-400 transition-colors filter drop-shadow-[0_0_8px_rgba(0,255,0,0.8)]"><path d="M12 2a10 10 0 0 0-7.07 17.07l1.41-1.41A8 8 0 1 1 12 4v0zm0 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="currentColor"/><path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8H2c0 5.52 4.48 10 10 10z" fill="currentColor" opacity="0.5"/></svg> );
const LockIcon = () => ( <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> );

// --- AUDIO & VOICE ---
let audioCtx = null;
const initAudio = () => { if (typeof window !== 'undefined' && !audioCtx) { try { const AC = window.AudioContext || window.webkitAudioContext; if(AC) audioCtx = new AC(); } catch(e){} } if(audioCtx?.state === 'suspended') audioCtx.resume(); };
const playSound = (type) => { if (!audioCtx) initAudio(); if (!audioCtx) return; try { const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.connect(gain); gain.connect(audioCtx.destination); const now = audioCtx.currentTime; if (type === 'click') { osc.type='square'; osc.frequency.setValueAtTime(600, now); gain.gain.setValueAtTime(0.05, now); osc.stop(now+0.1); } else if (type === 'success') { osc.type='sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now+0.2); gain.gain.setValueAtTime(0.1, now); osc.stop(now+0.4); } else if (type === 'alarm') { osc.type='sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(400, now+0.3); gain.gain.setValueAtTime(0.3, now); osc.stop(now+0.3); } if (type !== 'alarm') osc.start(now); else osc.start(now); } catch(e){} };
const speak = (text) => { if (typeof window !== 'undefined' && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.pitch=0.8; u.rate=1.1; const v = window.speechSynthesis.getVoices().find(v=>v.name.includes('Google US English')||v.name.includes('Samantha')); if(v) u.voice=v; window.speechSynthesis.speak(u); } };

export default function ProtocolGhostt() {
  // STATES
  const [view, setView] = useState("CALCULATOR"); 
  const [logs, setLogs] = useState([]); 
  const [clockTime, setClockTime] = useState("--:--"); 
  const [battery, setBattery] = useState(100);
  const [alarmActive, setAlarmActive] = useState(false);
  const [status, setStatus] = useState("STANDBY"); 
  const [statusMsg, setStatusMsg] = useState("SYSTEM OPTIMAL");
  const [countdown, setCountdown] = useState("CALCULATING...");
  const [mode, setMode] = useState("DASHBOARD");
  
  // DATA STATES
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState(""); 
  const [trapLink, setTrapLink] = useState("");
  const [burnerMsg, setBurnerMsg] = useState("");
  const [burnerLink, setBurnerLink] = useState("");
  const [hunterHits, setHunterHits] = useState([]);
  const [lastSeen, setLastSeen] = useState(null);
  const [calcDisplay, setCalcDisplay] = useState("0");

  // SHADOW CAM STATES
  const [stegoMsg, setStegoMsg] = useState("");
  const [stegoImage, setStegoImage] = useState(null);
  const [decodedMsg, setDecodedMsg] = useState("");

  const addLog = (msg, type="info") => { const d = new Date(); setLogs(p => [...p.slice(-7), { time: `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`, msg, type }]); };

  // --- STEGANOGRAPHY LOGIC ---
  const handleImageUpload = (e, action) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (action === 'encode') encodeMessage(img);
        else decodeMessage(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const encodeMessage = (img) => {
    if (!stegoMsg) { setStatus("ERROR"); addLog("NO MESSAGE TO HIDE"); return; }
    setStatus("ENCODING...");
    addLog("REWRITING PIXELS...");
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const binaryMsg = stegoMsg.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('') + '00000000'; // Null terminator

    if (binaryMsg.length > data.length / 4) { setStatus("ERROR"); addLog("IMAGE TOO SMALL"); return; }

    for (let i = 0; i < binaryMsg.length; i++) {
      // Modify the Red channel (every 4th value starting at 0)
      const pixelIndex = i * 4;
      // Clear last bit and set to our message bit
      data[pixelIndex] = (data[pixelIndex] & 0xFE) | parseInt(binaryMsg[i]);
    }

    ctx.putImageData(imgData, 0, 0);
    setStegoImage(canvas.toDataURL('image/png'));
    setStatus("SUCCESS");
    playSound('success');
    addLog("DATA HIDDEN IN IMAGE");
    setStegoMsg("");
  };

  const decodeMessage = (img) => {
    setStatus("DECODING...");
    addLog("SCANNING PIXELS...");
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    
    let binary = "";
    let charCode = 0;
    let decoded = "";

    for (let i = 0; i < data.length; i += 4) {
      // Extract last bit of Red channel
      const bit = data[i] & 1;
      binary += bit;
      
      if (binary.length === 8) {
        charCode = parseInt(binary, 2);
        if (charCode === 0) break; // Null terminator found
        decoded += String.fromCharCode(charCode);
        binary = "";
      }
    }
    
    setDecodedMsg(decoded);
    setStatus("SUCCESS");
    playSound('success');
    addLog("HIDDEN MESSAGE FOUND");
  };

  // --- INIT ---
  useEffect(() => {
    const timer = setInterval(() => { const d = new Date(); setClockTime(`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`); }, 1000);
    if (typeof navigator !== 'undefined' && navigator.getBattery) navigator.getBattery().then(b => setBattery(Math.floor(b.level * 100)));
    fetchLastSeen();
    try {
      const q = query(collection(db, "hunter_logs"), orderBy("timestamp", "desc"), limit(5));
      const unsubscribe = onSnapshot(q, (snap) => {
        const hits = snap.docs.map(d => d.data());
        if (hits.length > 0 && hunterHits.length > 0 && hits[0].timestamp > hunterHits[0].timestamp) triggerAlarm();
        setHunterHits(hits);
      });
      return () => { clearInterval(timer); unsubscribe(); };
    } catch(e){}
  }, []);

  useEffect(() => {
    if (!lastSeen) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const deadLine = lastSeen.getTime() + (30 * 24 * 60 * 60 * 1000);
      const distance = deadLine - now;
      if (distance < 0) setCountdown("EXECUTED");
      else setCountdown(`${Math.floor(distance / (1000 * 60 * 60 * 24))}D ${Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}H ${Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))}M ${Math.floor((distance % (1000 * 60)) / 1000)}S`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  // --- ACTIONS ---
  const fetchLastSeen = async () => { try { const snap = await getDoc(doc(db, "system", "ghostt_status")); if (snap.exists()) { setLastSeen(snap.data().last_seen.toDate()); setEmail(snap.data().emergency_email || ""); } } catch(e) {} };
  const triggerAlarm = () => { setAlarmActive(true); playSound('alarm'); speak("Intrusion Detected."); addLog("INTRUSION DETECTED", "alert"); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); setTimeout(() => setAlarmActive(false), 4000); };
  const handleCalcTap = (val) => { if (val === 'C') { setCalcDisplay("0"); return; } if (val === '=') { if (calcDisplay === "999") { setView("BOOT"); initAudio(); runBootSequence(); } else { try { setCalcDisplay(eval(calcDisplay).toString()); } catch { setCalcDisplay("Error"); } } return; } setCalcDisplay(prev => prev === "0" ? val : prev + val); };
  const runBootSequence = () => { const text = ["INITIALIZING...", "LOADING KERNEL...", "CONNECTING...", "ONLINE"]; let delay = 0; text.forEach((t, i) => { delay += 800; setTimeout(() => { addLog(t); if (i === text.length - 1) { setView("LOCK"); speak("System Online."); } }, delay); }); };
  const handleUnlock = () => { setView("HUD"); playSound('success'); addLog("IDENTITY VERIFIED"); };
  const switchMode = (m) => { playSound('click'); setMode(m); addLog(`NAV: ${m}`); };
  const generateTrap = () => { setTrapLink(`${window.location.origin}/api/trap`); addLog("TRAP GENERATED"); playSound('click'); };
  const createBurner = async () => { if(!burnerMsg) return; setStatus("PROCESSING"); playSound('click'); try { const res = await fetch('/api/burner', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({message: burnerMsg}) }); const d = await res.json(); setBurnerLink(`${window.location.origin}/burner/${d.id}`); setBurnerMsg(""); setStatus("SUCCESS"); playSound('success'); addLog("BURNER ACTIVE"); setTimeout(()=>setStatus("STANDBY"),2000); } catch(e){ setStatus("ERROR"); } };
  const pingSystem = async () => { playSound('click'); setStatus("PROCESSING"); addLog("HANDSHAKE INIT..."); try { await updateDoc(doc(db, "system", "ghostt_status"), { last_seen: serverTimestamp(), status: "ACTIVE" }); setTimeout(() => { setLastSeen(new Date()); setStatus("SUCCESS"); playSound('success'); speak("Protocol Renewed."); setStatusMsg("SIGNAL LOCKED"); addLog("HEARTBEAT OK"); setTimeout(()=>{setStatus("STANDBY");setStatusMsg("OPTIMAL");},3000); }, 1500); } catch(e) { setStatus("ERROR"); playSound('error'); } };
  const uploadSecret = async () => { playSound('click'); if(!secret||!label){ setStatus("ERROR"); return;} setStatus("PROCESSING"); try { await addDoc(collection(db, "vault"), { label, payload: secret, timestamp: serverTimestamp() }); if(email) await updateDoc(doc(db, "system", "ghostt_status"), { emergency_email: email }); setTimeout(()=>{setStatus("SUCCESS");playSound('success');addLog("UPLOAD SECURE");setSecret("");setLabel("");setTimeout(()=>setStatus("STANDBY"),2000);},1500); } catch(e){ setStatus("ERROR"); playSound('error'); } };

  // --- VIEWS ---
  if (view === "CALCULATOR") return ( <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-end pb-10"><div className="w-full max-w-xs bg-black rounded-3xl p-5 shadow-2xl border border-gray-800"><div className="h-24 flex items-end justify-end text-white text-5xl font-light mb-4 px-2 truncate">{calcDisplay}</div><div className="grid grid-cols-4 gap-3">{['C','/','*','-'].map(b=><button key={b} onClick={()=>handleCalcTap(b)} className="h-16 w-16 rounded-full bg-gray-400 text-black text-xl font-bold active:bg-white">{b}</button>)}{['7','8','9','+'].map(b=><button key={b} onClick={()=>handleCalcTap(b)} className={`h-16 w-16 rounded-full text-white text-xl font-bold active:bg-gray-600 ${['+'].includes(b)?'bg-orange-500':'bg-gray-700'}`}>{b}</button>)}{['4','5','6','='].map(b=><button key={b} onClick={()=>handleCalcTap(b)} className={`h-16 w-16 rounded-full text-white text-xl font-bold active:bg-gray-600 ${['='].includes(b)?'bg-orange-500':'bg-gray-700'}`}>{b}</button>)}{['1','2','3','0'].map(b=><button key={b} onClick={()=>handleCalcTap(b)} className="h-16 w-16 rounded-full bg-gray-700 text-white text-xl font-bold active:bg-gray-600">{b}</button>)}</div></div><p className="text-gray-600 mt-8 text-xs">Calculator V1.0</p></div> );
  if (view === "BOOT") return ( <div onClick={() => setView("LOCK")} className="min-h-screen bg-black text-green-600 font-mono p-6 flex flex-col justify-end text-xs scanline"><GlobalStyles />{logs.map((log, i) => <div key={i}>[{log.time}] {log.msg}</div>)}<div className="animate-pulse mt-2">_</div></div> );
  if (view === "LOCK") return ( <div onClick={handleUnlock} className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center justify-center cursor-pointer scanline"><GlobalStyles /><div className="border-2 border-green-500 rounded-full p-8 animate-pulse shadow-[0_0_20px_rgba(0,255,0,0.4)]"><FingerprintIcon /></div><p className="mt-8 tracking-[0.3em] text-xs">TAP TO AUTHENTICATE</p></div> );

  return (
    <div className={`min-h-screen font-mono p-2 overflow-hidden relative flex flex-col transition-colors duration-200 ${alarmActive ? "bg-red-900 text-white" : "bg-black text-green-400"} scanline`}>
      <GlobalStyles /> <div className="moving-line"></div>
      <header className="flex justify-between items-start border-b border-green-800 pb-2 mb-4 px-2 pt-2"><div onClick={() => setView("CALCULATOR")} className="cursor-pointer"><h1 className="text-xl font-bold tracking-widest text-green-300 drop-shadow-[0_0_5px_rgba(0,255,0,0.8)]">GHOSTT_OS</h1><div className="text-[10px] text-green-700">VPN: ACTIVE // ENCRYPTION: MAX</div></div><div className="text-right"><div className="text-sm font-bold tracking-widest text-green-300">{clockTime}</div><div className="text-[10px] flex justify-end items-center gap-2 text-green-600"><span>PWR: {battery}%</span><div className={`w-2 h-2 rounded-full ${status==="ERROR"?"bg-red-500":"bg-green-500"} animate-pulse`}></div></div></div></header>
      <div className={`mb-4 mx-2 p-2 border text-center text-xs font-bold tracking-widest transition-colors duration-500 ${alarmActive?"border-red-500 bg-red-800 animate-pulse text-white":status==="PROCESSING"?"border-yellow-600 text-yellow-500 bg-yellow-900/10":status==="SUCCESS"?"border-green-500 text-green-400 bg-green-900/20":status==="ERROR"?"border-red-600 text-red-500 bg-red-900/20":"border-green-900 text-green-700"}`}>STATUS: {alarmActive ? "INTRUSION DETECTED" : statusMsg}</div>

      <main className="flex-1 max-w-lg mx-auto w-full relative z-10 flex flex-col gap-4">
        <div className="border border-green-800 bg-green-900/5 p-6 relative overflow-hidden text-center backdrop-blur-sm"><div className="absolute top-2 right-2 opacity-50"><LockIcon /></div><h2 className="text-xs text-green-600 mb-2 tracking-widest">PROTOCOL OMEGA DEADLINE</h2><div className="text-2xl font-bold text-white mb-6 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">{countdown}</div><button onClick={pingSystem} disabled={status==="PROCESSING"} className={`w-full py-4 text-sm font-bold tracking-[0.2em] transition-all uppercase border ${status==="PROCESSING"?"border-yellow-600 text-yellow-600":"border-green-500 hover:bg-green-500 hover:text-black hover:shadow-[0_0_20px_rgba(0,255,0,0.4)]"}`}>{status==="PROCESSING" ? "UPLINKING..." : "RENEW SIGNAL"}</button></div>
        <div className="flex border-b border-green-800 mx-2 overflow-x-auto whitespace-nowrap scrollbar-hide">{["DASHBOARD", "HUNTER", "VAULT", "BURNER", "SHADOW"].map(m => (<button key={m} onClick={()=>switchMode(m)} className={`px-4 py-3 text-[10px] tracking-widest transition-colors ${mode===m?"bg-green-500 text-black font-bold":"text-green-800 hover:text-green-500"}`}>{m}</button>))}</div>

        <div className="flex-1 bg-black p-4 mx-2 border-x border-b border-green-800 min-h-[300px] overflow-y-auto backdrop-blur-md bg-opacity-80">
          {mode === "DASHBOARD" && (<div className="space-y-2 font-mono text-xs h-full flex flex-col justify-end">{logs.map((log, i) => (<div key={i} className={`border-l-2 pl-2 ${log.type==='alert'?'border-red-500 text-red-400':'border-green-900 text-green-500/70'}`}><span className="text-green-800">[{log.time}]</span> {log.msg}</div>))}<div className="animate-pulse text-green-500">_</div></div>)}
          
          {mode === "HUNTER" && (<div className="flex flex-col h-full"><div className="text-center mb-4"><button onClick={generateTrap} className="border border-red-500 text-red-500 px-4 py-2 text-xs hover:bg-red-500 hover:text-black transition-colors uppercase shadow-[0_0_10px_rgba(255,0,0,0.3)]">GENERATE TRAP LINK</button>{trapLink && <div className="mt-2 text-[10px] break-all bg-red-900/20 p-2 border border-red-900 text-red-400 select-all">{trapLink}</div>}</div><div className="space-y-2 mt-2">{hunterHits.length === 0 ? <span className="text-[10px] opacity-30 text-green-800">NO TARGETS ACQUIRED</span> : hunterHits.map((hit, i) => (<div key={i} className="bg-red-900/10 border border-red-900/30 p-2 text-[10px]"><div className="text-red-400 font-bold">INTRUSION DETECTED</div><div className="opacity-70 text-green-600">IP: {hit.ip || "UNKNOWN"}</div><div className="opacity-50 text-[8px] truncate text-green-800">{hit.device}</div></div>))}</div></div>)}
          
          {mode === "BURNER" && (<div className="flex flex-col h-full"><div className="text-[10px] text-green-700 uppercase border-b border-green-900 pb-2 mb-2">Self-Destruct Message</div><textarea value={burnerMsg} onChange={(e)=>setBurnerMsg(e.target.value)} placeholder="TYPE MESSAGE..." className="flex-1 bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs font-mono resize-none placeholder-green-900 mb-2" /><button onClick={createBurner} disabled={status==="PROCESSING"} className="py-2 border border-green-600 text-green-600 text-xs font-bold tracking-widest transition-colors uppercase hover:bg-green-600 hover:text-black mb-4">{status==="PROCESSING"?"ENCRYPTING...":"CREATE BURNER LINK"}</button>{burnerLink && <div className="text-[10px] break-all bg-green-900/20 p-2 border border-green-500 text-green-300 select-all">{burnerLink}</div>}</div>)}
          
          {mode === "VAULT" && (<div className="flex flex-col gap-4 h-full"><div className="text-[10px] text-green-700 uppercase border-b border-green-900 pb-2">Destination</div><input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="EMAIL" className="bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs tracking-widest placeholder-green-900" /><div className="text-[10px] text-green-700 mt-2 uppercase border-b border-green-900 pb-2">Payload</div><input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="LABEL" className="bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs tracking-widest placeholder-green-900" /><textarea value={secret} onChange={(e)=>setSecret(e.target.value)} placeholder="DATA..." className="flex-1 bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-400 text-xs font-mono resize-none placeholder-green-900" /><button onClick={uploadSecret} disabled={status==="PROCESSING"} className="py-3 border border-green-600 text-green-600 text-xs font-bold tracking-widest transition-colors uppercase hover:bg-green-600 hover:text-black">{status==="PROCESSING"?"ENCRYPTING...":"UPLOAD"}</button></div>)}
          
          {mode === "SHADOW" && (
            <div className="flex flex-col gap-4 h-full overflow-y-auto">
              <div className="text-[10px] text-green-700 uppercase border-b border-green-900 pb-2">ENCODE (HIDE)</div>
              <input value={stegoMsg} onChange={(e)=>setStegoMsg(e.target.value)} placeholder="SECRET MESSAGE TO HIDE..." className="bg-green-900/10 border border-green-800 p-2 text-green-400 text-xs" />
              <label className="border border-green-600 text-green-600 text-xs text-center py-2 cursor-pointer hover:bg-green-600 hover:text-black">
                SELECT IMAGE TO HIDE DATA
                <input type="file" accept="image/*" onChange={(e)=>handleImageUpload(e,'encode')} className="hidden" />
              </label>
              {stegoImage && <div className="text-center"><img src={stegoImage} alt="Encoded" className="max-h-32 mx-auto border border-green-800" /><a href={stegoImage} download="shadow_file.png" className="block mt-2 text-[10px] text-green-400 underline">DOWNLOAD SHADOW FILE</a></div>}
              
              <div className="text-[10px] text-green-700 uppercase border-b border-green-900 pb-2 mt-4">DECODE (REVEAL)</div>
              <label className="border border-green-800 text-green-800 text-xs text-center py-2 cursor-pointer hover:bg-green-800 hover:text-black">
                UPLOAD SHADOW FILE
                <input type="file" accept="image/*" onChange={(e)=>handleImageUpload(e,'decode')} className="hidden" />
              </label>
              {decodedMsg && <div className="bg-green-900/20 p-2 border border-green-500 text-green-300 text-xs break-all mt-2">REVEALED: {decodedMsg}</div>}
            </div>
          )}

        </div>
      </main>
      <footer className="p-4 text-center text-[10px] text-green-900 border-t border-green-900 mt-auto">SECURE CONNECTION // V10.0 (SHADOW_OPS)</footer>
    </div>
  );
}
