import { useState } from 'react';

export default function GhosttCommand() {
  const [status, setStatus] = useState("SYSTEM STANDBY");

  const pingSystem = async () => {
    setStatus("CONTACTING SERVER...");
    // We call our own internal API route
    const res = await fetch('/api/heartbeat', { method: 'POST' });
    const data = await res.json();
    
    if (data.success) {
      setStatus("PROTOCOL RENEWED: 30 DAYS");
    } else {
      setStatus("ERROR: CONNECTION FAILED");
    }
  };

  return (
    <div style={{ backgroundColor: 'black', height: '100vh', color: '#00ff00', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: '2rem', borderBottom: '1px solid #00ff00', paddingBottom: '10px' }}>PROTOCOL GHOSTT</h1>
      <p style={{ marginTop: '20px', fontSize: '1.5rem', color: 'red' }}>{status}</p>
      
      <button 
        onClick={pingSystem}
        style={{ marginTop: '40px', padding: '20px 40px', fontSize: '1.2rem', backgroundColor: 'transparent', border: '2px solid #00ff00', color: '#00ff00', cursor: 'pointer' }}
      >
        RENEW TIMER
      </button>
    </div>
  );
}
