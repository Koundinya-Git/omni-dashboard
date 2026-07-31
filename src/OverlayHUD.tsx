import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mic, Eye, BrainCircuit, X, Sparkles, Camera, Play } from 'lucide-react';

export default function OverlayHUD() {
  const [status, setStatus] = useState<'ready' | 'capturing' | 'listening' | 'thinking' | 'answering'>('ready');
  const [transcript, setTranscript] = useState('HUD online. Click start to analyze screen.');
  const [aiResponse, setAiResponse] = useState('');
  const [screenB64, setScreenB64] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const initHUD = async () => {
      try {
        const win = getCurrentWindow();
        const screenWidth = window.screen.availWidth || 1920;
        await win.setPosition(new LogicalPosition(screenWidth - 150, 10));
        await win.setSize(new LogicalSize(420, 140));
      } catch (e) {
        console.error("Window positioning error:", e);
      }
    };
    initHUD();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeHUD();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeHUD = async () => {
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
    } catch (e) {}

    try {
      const win = getCurrentWindow();
      await win.setSize(new LogicalSize(420, 140));
      await win.hide();
      setStatus('ready');
      setAiResponse('');
      setTranscript('HUD online. Click start to analyze screen.');
    } catch (e) {}
  };

  const startAnalysis = async () => {
    setStatus('capturing');
    setTranscript('Capturing desktop frame...');
    
    // Expand window for output
    try {
      const win = getCurrentWindow();
      await win.setSize(new LogicalSize(480, 480));
    } catch (e) {}

    let capturedB64 = null;
    try {
      capturedB64 = await invoke<string>('capture_screen');
      setScreenB64(capturedB64);
    } catch (e) {
      console.error("Screen capture error:", e);
    }

    // Try Speech Recognition, fallback safely if unavailable
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        setStatus('listening');
        setTranscript('Listening... Speak now (or wait 4s for auto-scan)');
        
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;

        let userSaid = '';
        let timer = setTimeout(() => {
          try { rec.stop(); } catch (err) {}
        }, 4000);

        rec.onresult = (e: any) => {
          userSaid = Array.from(e.results).map((r: any) => r[0].transcript).join('');
          setTranscript(userSaid);
          clearTimeout(timer);
          timer = setTimeout(() => { try { rec.stop(); } catch (err) {} }, 2000);
        };

        rec.onerror = () => { rec.stop(); };

        rec.onend = () => {
          const query = userSaid.trim() ? userSaid : "Analyze what is currently open on my screen and provide a summary.";
          processQuery(query, capturedB64);
        };

        rec.start();
        recognitionRef.current = rec;
        return;
      } catch (err) {
        console.error("Speech recognition failed to start:", err);
      }
    }

    // Fallback if speech API fails or is missing
    processQuery("Analyze what is currently open on my screen and provide a summary.", capturedB64);
  };

  const processQuery = async (queryText: string, imageB64: string | null) => {
    setStatus('thinking');
    setTranscript(queryText);

    try {
      const res = await invoke<string>('ask_ollama', {
        messages: [{ role: 'user', content: queryText }],
        persona: 'Victor',
        modelTier: 'Vision',
        searchWeb: false,
        attachedTextbook: null,
        imageB64: imageB64,
        currentDateStr: new Date().toLocaleString(),
        currentEpochMs: Date.now(),
        startOfTodayMs: new Date().setHours(0,0,0,0)
      });

      setAiResponse(res);
      setStatus('answering');
    } catch (e: any) {
      setAiResponse("Error communicating with Ollama: " + e);
      setStatus('answering');
    }
  };

  return (
    <div className="w-screen h-screen bg-[#121212]/95 backdrop-blur-3xl border border-emerald-500/40 rounded-3xl p-5 text-gray-100 flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.15)] overflow-hidden box-border">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider uppercase">Omni-Daemon HUD</span>
        </div>
        <div className="flex items-center gap-2">
          {screenB64 && <span className="text-[10px] font-mono text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded flex items-center gap-1"><Eye className="w-3 h-3 text-blue-400"/> Locked</span>}
          <button onClick={closeHUD} className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white"><X className="w-4 h-4"/></button>
        </div>
      </div>

      {/* State: Ready */}
      {status === 'ready' && (
        <div className="flex-1 flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5"/>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Ready</p>
              <p className="text-xs text-gray-400">Press start to scan screen & speak</p>
            </div>
          </div>
          <button 
            onClick={startAnalysis}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-900/40"
          >
            <Play className="w-3.5 h-3.5 fill-current"/> Scan Screen
          </button>
        </div>
      )}

      {/* State: Capturing / Listening */}
      {(status === 'capturing' || status === 'listening') && (
        <div className="flex-1 flex items-center gap-4 py-2">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 animate-pulse">
            {status === 'capturing' ? <Camera className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">{status === 'capturing' ? 'Optical Scan' : 'Listening'}</p>
            <p className="text-sm text-gray-300 italic truncate">{transcript}</p>
          </div>
        </div>
      )}

      {/* State: Thinking */}
      {status === 'thinking' && (
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-3 text-emerald-400">
          <BrainCircuit className="w-8 h-8 animate-spin"/>
          <span className="text-[10px] font-mono uppercase tracking-widest">Analyzing Screen via Qwen Vision...</span>
        </div>
      )}

      {/* State: Answering */}
      {status === 'answering' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="text-xs font-bold text-gray-400 mb-2 flex items-start gap-2 bg-gray-800/30 p-2 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0"/> 
            <span className="line-clamp-2">{transcript}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar markdown-body text-[13px] leading-relaxed text-gray-200 pr-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}