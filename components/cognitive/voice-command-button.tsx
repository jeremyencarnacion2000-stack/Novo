'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Sparkles, X, Volume2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VoiceCommandButton() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'es-ES'; // Default to Spanish to support the requested voice commands

        rec.onstart = () => {
          setIsListening(true);
          setTranscript('');
          setErrorMessage('');
          setResult(null);
        };

        rec.onerror = (event: any) => {
          console.error('[Voice] Recognition error', event);
          setErrorMessage('No te he podido escuchar. Inténtalo de nuevo.');
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        rec.onresult = async (event: any) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          await submitVoiceCommand(text);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setErrorMessage('Tu navegador no soporta el reconocimiento de voz.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const submitVoiceCommand = async (text: string) => {
    if (!text.trim()) return;
    setProcessing(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: [], webSearchEnabled: false }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      console.log('[Voice API Response]', data);
      
      // Look for cognitive execution result block
      const resultBlock = data.blocks?.find((b: any) => b.type === 'result');
      setResult({
        message: data.content || 'Calibración cognitiva realizada con éxito.',
        data: resultBlock?.metadata || null,
        success: resultBlock?.status === 'success',
      });
      
      // Dispatch custom event to let other components know the state has refreshed
      window.dispatchEvent(new CustomEvent('cognitive-state-updated'));
    } catch (e) {
      console.error(e);
      setErrorMessage('Error al procesar el comando cognitivo.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Premium pulsing glass activation button */}
      <motion.button
        onClick={toggleListening}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 relative z-40",
          isListening 
            ? "border-red-500/50 bg-red-950/20 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)]" 
            : "border-primary/30 bg-primary/5 text-primary-light hover:border-primary/60 hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]"
        )}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/10 via-transparent to-primary/10 opacity-30 animate-pulse pointer-events-none" />
        
        {isListening ? (
          <div className="relative">
            <Mic className="w-6 h-6 animate-bounce" />
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
          </div>
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </motion.button>

      {/* Interactive Soundwave indicator or Status */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-16 z-30 px-4 py-2 rounded-2xl border border-white/[0.08] bg-black/80 backdrop-blur-md flex items-center gap-3 w-64 shadow-2xl"
          >
            <div className="flex gap-1 items-center h-4">
              <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse [animation-delay:0.1s]" />
              <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse [animation-delay:0.2s]" />
              <span className="w-1 h-2 bg-red-400 rounded-full animate-pulse [animation-delay:0.3s]" />
              <span className="w-1 h-3 bg-red-500 rounded-full animate-pulse [animation-delay:0.4s]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400 animate-pulse">
              Escuchando tu estado...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Micro confirmation and suggestion cards */}
      <AnimatePresence>
        {(processing || transcript || result || errorMessage) && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className={cn(
              "fixed bottom-8 right-8 z-50 w-96 rounded-3xl p-5 border backdrop-blur-2xl shadow-3xl flex flex-col gap-3.5",
              "border-white/[0.08] bg-neutral-950/90 text-white"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black tracking-widest uppercase text-white/40">Cognitive Automation</span>
              </div>
              <button 
                onClick={() => {
                  setTranscript('');
                  setResult(null);
                  setErrorMessage('');
                }}
                className="p-1 rounded-full hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/40 hover:text-white" />
              </button>
            </div>

            {/* Transcript */}
            {transcript && (
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/20 tracking-wider">Tu voz:</p>
                <p className="text-xs italic text-white/70">"{transcript}"</p>
              </div>
            )}

            {/* Loading / Processing */}
            {processing && (
              <div className="flex items-center gap-3 py-3">
                <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <span className="text-xs text-white/40">Calibrando sistemas de Novo...</span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <p className="text-xs text-red-400 font-medium py-1">{errorMessage}</p>
            )}

            {/* Structured Results */}
            {result && (
              <div className="space-y-3 pt-1">
                <div className="flex gap-2 items-start bg-primary/10 border border-primary/20 rounded-2xl p-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-white/80 leading-relaxed">{result.message}</p>
                </div>

                {result.data && (
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {/* Music recommendation card */}
                    {result.data.musicRecommendation && (
                      <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Volume2 className="w-3 h-3" />
                          <span className="font-bold uppercase tracking-wider">Música</span>
                        </div>
                        <p className="text-white/80 font-bold leading-normal truncate">{result.data.musicRecommendation.mood}</p>
                        <p className="text-white/30 truncate">{result.data.musicRecommendation.searchQuery}</p>
                      </div>
                    )}

                    {/* Outfit recommendation card */}
                    {result.data.styleRecommendation && (
                      <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Sparkles className="w-3 h-3" />
                          <span className="font-bold uppercase tracking-wider">Outfit</span>
                        </div>
                        <p className="text-white/80 font-bold leading-normal truncate">{result.data.styleRecommendation.context}</p>
                        <p className="text-white/30 truncate">{result.data.styleRecommendation.suggestion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
