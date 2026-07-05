'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle, CheckCircle2, X, Info } from 'lucide-react';

interface VoiceAgentPanelProps {
    onItemParsed: (item: {
        itemName: string;
        length: number;
        width: number;
        height: number;
        actualWeight: number;
        quantity: number;
    }) => void;
}

export default function VoiceAgentPanel({ onItemParsed }: VoiceAgentPanelProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [audioFeedback, setAudioFeedback] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    const recognitionRef = useRef<any>(null);
    const transcriptRef = useRef('');
    const statusRef = useRef<'idle' | 'listening' | 'processing' | 'success' | 'error'>('idle');
    const onItemParsedRef = useRef(onItemParsed);

    // Sync refs on every render
    transcriptRef.current = transcript;
    statusRef.current = status;
    onItemParsedRef.current = onItemParsed;

    // Initialize Web Speech API once
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition =
                (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                recognition.lang = 'id-ID';

                recognition.onstart = () => {
                    setIsListening(true);
                    setStatus('listening');
                    setTranscript('');
                    setErrorMessage('');
                };

                recognition.onresult = (event: any) => {
                    const current = event.resultIndex;
                    const resultText = event.results[current][0].transcript;
                    setTranscript(resultText);
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    if (event.error === 'not-allowed') {
                        setErrorMessage('Izin mikrofon ditolak. Aktifkan izin mic di browser Anda.');
                    } else {
                        setErrorMessage('Gagal merekam suara. Silakan coba lagi.');
                    }
                    setStatus('error');
                    setIsListening(false);
                    speakText('Gagal merekam suara');
                };

                recognition.onend = () => {
                    setIsListening(false);
                    const currentTranscript = transcriptRef.current;
                    const currentStatus = statusRef.current;
                    
                    // Trigger parsing if transcript is not empty
                    if (currentStatus === 'listening' && currentTranscript.trim() !== '') {
                        parseTextWithGemini(currentTranscript);
                    } else if (currentTranscript.trim() === '') {
                        setStatus('idle');
                    }
                };

                recognitionRef.current = recognition;
            }
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {}
            }
        };
    }, []);

    // Text to Speech Helper
    const speakText = (text: string) => {
        if (!audioFeedback || typeof window === 'undefined') return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error('TTS error:', e);
        }
    };

    // Call Gemini API to parse text
    const parseTextWithGemini = async (rawText: string) => {
        setStatus('processing');
        try {
            const response = await fetch('/api/parse-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: rawText }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Gagal memproses suara');
            }

            // Successfully parsed! Add it
            onItemParsedRef.current({
                itemName: data.itemName || 'Paket',
                length: Number(data.length) || 0,
                width: Number(data.width) || 0,
                height: Number(data.height) || 0,
                actualWeight: Number(data.actualWeight) || 0,
                quantity: Number(data.quantity) || 1,
            });

            setStatus('success');
            speakText(`${data.itemName || 'Paket'} berhasil ditambahkan`);

            // Reset back to idle after 3 seconds
            setTimeout(() => {
                setStatus('idle');
                setTranscript('');
            }, 3000);

        } catch (e: any) {
            console.error(e);
            setErrorMessage(e.message || 'Gagal mengenali perintah dimensi.');
            setStatus('error');
            speakText('Gagal mengenali dimensi barang');
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('Speech Recognition tidak didukung di browser ini. Gunakan Chrome, Edge, atau Safari.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error('Start recognition error:', e);
            }
        }
    };

    return (
        <div className="w-full">
            {/* Action Trigger Button */}
            <div className="flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-4 shadow-md shadow-blue-500/10 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/10 rounded-xl">
                        <Sparkles className="text-yellow-300 animate-pulse" size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm sm:text-base">Input Otomatis Suara (AI Voice)</h4>
                        <p className="text-xs text-blue-100">Gunakan mic untuk mengisi dimensi & berat otomatis</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-bold shadow hover:bg-blue-50 transition-all"
                >
                    {isOpen ? 'Tutup Panel' : 'Buka Agent'}
                </button>
            </div>

            {/* Main Panel */}
            {isOpen && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xl shadow-gray-100/40 mb-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isListening ? 'bg-red-500' : 'bg-green-500'}`}></span>
                            </span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {isListening ? 'Status: Mendengarkan...' : 'AI Voice Agent Ready'}
                            </span>
                        </div>

                        {/* Audio Feedback Toggle */}
                        <button
                            onClick={() => setAudioFeedback(!audioFeedback)}
                            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50 transition-colors"
                            title={audioFeedback ? 'Matikan Suara Asisten' : 'Aktifkan Suara Asisten'}
                        >
                            {audioFeedback ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </button>
                    </div>

                    <div className="grid md:grid-cols-12 gap-6 items-center">
                        {/* Mic Button & Wave Animation (Col Span 4) */}
                        <div className="md:col-span-4 flex flex-col items-center justify-center py-4 border-r border-gray-100">
                            <div className="relative flex items-center justify-center mb-3">
                                {/* Ring Animations for visual feedback */}
                                {isListening && (
                                    <>
                                        <span className="absolute animate-ping inline-flex h-24 w-24 rounded-full bg-red-400 opacity-20"></span>
                                        <span className="absolute animate-pulse inline-flex h-20 w-20 rounded-full bg-red-400 opacity-30"></span>
                                    </>
                                )}
                                <button
                                    onClick={toggleListening}
                                    className={`h-16 w-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                                        isListening
                                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                                            : status === 'processing'
                                            ? 'bg-amber-500 text-white animate-pulse'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                    }`}
                                >
                                    {isListening ? <MicOff size={28} /> : <Mic size={28} />}
                                </button>
                            </div>
                            <span className="text-xs font-bold text-gray-700">
                                {isListening ? 'Ketuk untuk Selesai' : status === 'processing' ? 'Memproses...' : 'Ketuk untuk Mulai Bicara'}
                            </span>
                        </div>

                        {/* Real-time Transcription Feedback (Col Span 8) */}
                        <div className="md:col-span-8 flex flex-col justify-center min-h-[120px] bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            {/* Live transcription text */}
                            <div className="flex-1">
                                {transcript ? (
                                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                                        "{transcript}"
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">
                                        Suara Anda akan muncul di sini secara real-time...
                                    </p>
                                )}
                            </div>

                            {/* Status notifications */}
                            <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                                {status === 'processing' && (
                                    <div className="flex items-center gap-2 text-xs text-amber-600 font-semibold">
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent" />
                                        Menganalisa dengan Gemini AI...
                                    </div>
                                )}
                                {status === 'success' && (
                                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                                        <CheckCircle2 size={16} />
                                        Barang berhasil dimasukkan!
                                    </div>
                                )}
                                {status === 'error' && (
                                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold leading-tight">
                                        <AlertCircle size={16} className="shrink-0" />
                                        <span>{errorMessage}</span>
                                    </div>
                                )}
                                {status === 'idle' && !transcript && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Info size={14} />
                                        Gunakan mic di lingkungan yang tenang.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Example commands box */}
                    <div className="mt-5 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                        <h5 className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-blue-700" />
                            Contoh Kalimat Perintah yang Didukung:
                        </h5>
                        <ul className="text-xs text-blue-800 space-y-1.5 list-disc pl-4 leading-relaxed">
                            <li>
                                <strong>Kalimat Kasual:</strong> *"Kardus mie instan ukuran 40 kali 30 kali 20 cm beratnya 8 kg jumlah ada 5 koli"*
                            </li>
                            <li>
                                <strong>Kalimat Singkat:</strong> *"Box kayu 60x50x40 berat 20 kg"* (akan otomatis mengisi Qty: 1)
                            </li>
                            <li>
                                <strong>Konversi Otomatis:</strong> *"Paket besar panjang 1 meter lebar 50 tinggi 50 berat 15 kilo"* (Gemini akan mengonversi 1 meter menjadi 100 cm)
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
