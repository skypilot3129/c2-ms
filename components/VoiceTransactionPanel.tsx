'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface VoiceTransactionPanelProps {
    onItemParsed: (item: {
        senderName: string;
        receiverName: string;
        tujuan: string;
        koli: number;
        berat: number;
        beratUnit: string;
        tipeTransaksi: string;
        harga: number;
        pembayaran: string;
        pelunasan: string;
        isiBarang: string;
        keterangan: string;
    }) => void;
    speechFeedbackText?: string; // Parents can supply custom TTS feedback (e.g. if client matching fails)
}

export default function VoiceTransactionPanel({ onItemParsed, speechFeedbackText }: VoiceTransactionPanelProps) {
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

    // Keep refs in sync to prevent React stale closures
    transcriptRef.current = transcript;
    statusRef.current = status;
    onItemParsedRef.current = onItemParsed;

    // Speak text dynamically if parent supplies feedback or internally
    useEffect(() => {
        if (speechFeedbackText) {
            speakText(speechFeedbackText);
        }
    }, [speechFeedbackText]);

    // Initialize Web Speech API
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

                    if (currentStatus === 'listening' && currentTranscript.trim() !== '') {
                        parseTransactionWithGemini(currentTranscript);
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
            utterance.rate = 1.05; // Slightly faster for snappier feedback
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error('TTS error:', e);
        }
    };

    // Call Gemini API to parse transaction details
    const parseTransactionWithGemini = async (rawText: string) => {
        setStatus('processing');
        try {
            const response = await fetch('/api/parse-voice-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: rawText }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Gagal memproses data suara');
            }

            // Fire callback to parent form
            onItemParsedRef.current({
                senderName: data.senderName || '',
                receiverName: data.receiverName || '',
                tujuan: data.tujuan || '',
                koli: Number(data.koli) || 1,
                berat: Number(data.berat) || 0,
                beratUnit: data.beratUnit || 'KG',
                tipeTransaksi: data.tipeTransaksi || 'regular',
                harga: Number(data.harga) || 0,
                pembayaran: data.pembayaran || 'Tunai',
                pelunasan: data.pelunasan || 'Belum Lunas',
                isiBarang: data.isiBarang || '',
                keterangan: data.keterangan || '',
            });

            setStatus('success');
            // Basic vocal feedback (parent can override with specific client match info)
            speakText(`Data suara berhasil diproses`);

            setTimeout(() => {
                setStatus('idle');
                setTranscript('');
            }, 3000);

        } catch (e: any) {
            console.error(e);
            setErrorMessage(e.message || 'Gagal mem-parsing data transaksi.');
            setStatus('error');
            speakText('Gagal memproses detail transaksi');
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
            {/* Header Trigger */}
            <div className="flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-4 shadow-md shadow-purple-500/10 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/10 rounded-xl">
                        <Sparkles className="text-yellow-300 animate-pulse" size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm sm:text-base">Input Transaksi Suara (AI Voice)</h4>
                        <p className="text-xs text-purple-100">Gunakan mic untuk auto-fill seluruh kolom resi</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-4 py-2 bg-white text-purple-600 rounded-xl text-xs font-bold shadow hover:bg-purple-50 transition-all"
                >
                    {isOpen ? 'Tutup Panel' : 'Buka Agent'}
                </button>
            </div>

            {/* Main Interface */}
            {isOpen && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xl shadow-gray-100/40 mb-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isListening ? 'bg-red-500' : 'bg-green-500'}`}></span>
                            </span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {isListening ? 'Status: Mendengarkan suara...' : 'AI Voice Transaction Ready'}
                            </span>
                        </div>

                        <button
                            onClick={() => setAudioFeedback(!audioFeedback)}
                            className="p-2 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-gray-50 transition-colors"
                            title={audioFeedback ? 'Matikan Suara Asisten' : 'Aktifkan Suara Asisten'}
                        >
                            {audioFeedback ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </button>
                    </div>

                    <div className="grid md:grid-cols-12 gap-6 items-center">
                        {/* Mic Control */}
                        <div className="md:col-span-4 flex flex-col items-center justify-center py-4 border-r border-gray-100">
                            <div className="relative flex items-center justify-center mb-3">
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
                                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20'
                                    }`}
                                >
                                    {isListening ? <MicOff size={28} /> : <Mic size={28} />}
                                </button>
                            </div>
                            <span className="text-xs font-bold text-gray-700">
                                {isListening ? 'Ketuk untuk Selesai' : status === 'processing' ? 'Menganalisa...' : 'Ketuk untuk Mulai Bicara'}
                            </span>
                        </div>

                        {/* Live Text Box */}
                        <div className="md:col-span-8 flex flex-col justify-center min-h-[120px] bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <div className="flex-1">
                                {transcript ? (
                                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                                        "{transcript}"
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">
                                        Sebutkan data pengiriman secara lengkap...
                                    </p>
                                )}
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                                {status === 'processing' && (
                                    <div className="flex items-center gap-2 text-xs text-amber-600 font-semibold">
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent" />
                                        Memproses dengan Gemini AI...
                                    </div>
                                )}
                                {status === 'success' && (
                                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                                        <CheckCircle2 size={16} />
                                        Formulir resi berhasil diisi!
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
                                        Nyalakan mic dan sebutkan data resi dalam satu kalimat.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Example Box */}
                    <div className="mt-5 bg-purple-50/50 border border-purple-100 rounded-xl p-4">
                        <h5 className="text-xs font-bold text-purple-900 mb-2 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-purple-700" />
                            Contoh Kalimat Transaksi yang Didukung:
                        </h5>
                        <ul className="text-xs text-purple-800 space-y-1.5 list-disc pl-4 leading-relaxed">
                            <li>
                                <strong>Kasus Lengkap:</strong> *"Tolong buat resi baru pengirim Budi, penerima Andi, tujuan Makassar, isi barang sepatu, jumlah lima koli dengan berat dua puluh kilo, tipe express, bayar tunai"*
                            </li>
                            <li>
                                <strong>Kasus Sedang:</strong> *"Buat transaksi baru pengirim toko berkarya ke penerima bapak doni tujuan surabaya, barang sparepart, 1 koli berat 50 kg harga 500 ribu"*
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
