import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function BurnerMessage() {
  const router = useRouter();
  const { id } = router.query;
  const [msg, setMsg] = useState("DECRYPTING...");
  const [status, setStatus] = useState("LOCKED");

  useEffect(() => {
    if (!id) return;
    
    // Fetch and auto-destroy
    fetch(`/api/burner?id=${id}`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("DATA CORRUPTED");
      })
      .then(data => {
        setMsg(data.message);
        setStatus("DECRYPTED");
      })
      .catch(() => {
        setMsg("ERROR: MESSAGE DOES NOT EXIST OR HAS BEEN INCINERATED.");
        setStatus("TERMINATED");
      });
  }, [id]);

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center justify-center p-4 text-center">
      <div className="border border-green-700 p-8 max-w-md w-full relative overflow-hidden">
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.25)_50%)] bg-[length:100%_4px]"></div>
        
        <h1 className="text-xl mb-6 border-b border-green-900 pb-2 tracking-widest">{status}</h1>
        <p className={`text-lg ${status === 'TERMINATED' ? 'text-red-500' : 'text-white'} typewriter`}>
          {msg}
        </p>
        {status === "DECRYPTED" && (
          <div className="mt-8 text-xs text-red-500 animate-pulse">
            WARNING: DATA HAS BEEN DELETED FROM SERVER. DO NOT REFRESH.
          </div>
        )}
      </div>
    </div>
  );
}
