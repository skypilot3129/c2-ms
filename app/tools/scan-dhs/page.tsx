'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { COMPANY_INFO } from '@/lib/company-config';
import {
    Barcode,
    ArrowLeft,
    Upload,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Camera,
    Play,
    RefreshCcw,
    Copy,
    Printer,
    Info,
    Check,
    Volume2,
    VolumeX,
    Trash2,
    Search,
    Edit,
    MessageSquare,
    Headphones
} from 'lucide-react';
import { translateVoiceAlerts, generateAllVoiceClips } from '@/app/actions/chat';

interface ManifestItem {
    id: string;
    code: string;
    status: 'pending' | 'scanned';
    scanTime?: string;
    jmlhPaket?: number;
    berat?: number;
    toType?: string;
    dgType?: string;
    tujuan?: string;
    note?: string;
    originalIndex?: number;
}

interface ExtraScan {
    id: string;
    code: string;
    scanTime: string;
    tujuan?: string;
    note?: string;
}

type SoundProfileKey = 'gudang' | 'kantor' | 'headphone' | 'custom';

interface SoundProfile {
    label: string;
    icon: string;
    speechRate: number;
    beepVolume: number;
    description: string;
}

const SOUND_PROFILES: Record<Exclude<SoundProfileKey, 'custom'>, SoundProfile> = {
    gudang: {
        label: 'Gudang Bising',
        icon: '🔊',
        speechRate: 1.6,
        beepVolume: 0.2,
        description: 'Suara cepat & keras untuk lingkungan bising',
    },
    kantor: {
        label: 'Kantor Tenang',
        icon: '🔉',
        speechRate: 1.0,
        beepVolume: 0.05,
        description: 'Suara pelan & lambat untuk ruang kantor',
    },
    headphone: {
        label: 'Headphone',
        icon: '🎧',
        speechRate: 1.25,
        beepVolume: 0.08,
        description: 'Optimasi untuk earphone/headset',
    },
};

const NOTE_PRESETS = ['Karung Sobek', 'Basah', 'Barcode Rusak', 'Packing Ulang', 'Tertinggal'];

interface HistoryItem {
    id: string;
    date: string;
    sessionType: 'BONGKAR' | 'MUAT';
    driverName: string;
    noPolisi: string;
    totalTarget: number;
    totalScanned: number;
    totalExtra: number;
    scanPercentage: number;
    manifest: ManifestItem[];
    extraScans: ExtraScan[];
    isNoManifestMode?: boolean;
}

export default function ScanDhsPage() {
    // Session state: 'import' | 'scan' | 'report'
    const [step, setStep] = useState<'import' | 'scan' | 'report'>('import');
    const [sessionType, setSessionType] = useState<'BONGKAR' | 'MUAT'>('BONGKAR');
    const [isNoManifestMode, setIsNoManifestMode] = useState<boolean>(false);

    // Manifest details
    const [driverName, setDriverName] = useState<string>('');
    const [noPolisi, setNoPolisi] = useState<string>('');
    const [rawInput, setRawInput] = useState<string>('');

    // Parsed Items
    const [manifest, setManifest] = useState<ManifestItem[]>([]);
    const [extraScans, setExtraScans] = useState<ExtraScan[]>([]);

    // Scanner input
    const [manualInput, setManualInput] = useState<string>('');
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [scannerError, setScannerError] = useState<string>('');

    // Sound options
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
    const [audioSystemError, setAudioSystemError] = useState<string>('');

    // Search & History states
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // Inline item edit states
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editCode, setEditCode] = useState<string>('');
    const [editJmlh, setEditJmlh] = useState<string>('');
    const [editBerat, setEditBerat] = useState<string>('');
    const [editToType, setEditToType] = useState<string>('');
    const [editDgType, setEditDgType] = useState<string>('');

    const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);

    // Custom filter tabs & audio settings states
    const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'pending' | 'scanned' | 'liquid' | 'dg' | 'extra'>('all');
    const [wrongScanText, setWrongScanText] = useState<string>('Salah');
    const [duplicateText, setDuplicateText] = useState<string>('Duplikat');
    const [doubleScanText, setDoubleScanText] = useState<string>('T O tetap sama');
    const [speechRate, setSpeechRate] = useState<number>(1.25);
    const [showAudioSettings, setShowAudioSettings] = useState<boolean>(false);
    const [pendingRecovery, setPendingRecovery] = useState<any>(null);

    // Sound profile states
    const [soundProfile, setSoundProfile] = useState<SoundProfileKey>('gudang');
    const [beepVolume, setBeepVolume] = useState<number>(0.2);
    
    // Translation with Gemini states
    const [selectedLanguage, setSelectedLanguage] = useState<string>('id');
    const [translatedSpeech, setTranslatedSpeech] = useState<{ numbers: Record<string, string>; warnings: Record<string, string> } | null>(null);
    const [isTranslating, setIsTranslating] = useState<boolean>(false);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

    // Gemini TTS Audio Cache states
    const [geminiAudioCache, setGeminiAudioCache] = useState<Record<string, { data: string; mimeType: string }>>({});
    const [geminiVoiceName, setGeminiVoiceName] = useState<string>('');
    const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
    const [audioGenProgress, setAudioGenProgress] = useState<string>('');

    // Per-item notes states
    const [noteEditingItemId, setNoteEditingItemId] = useState<string | null>(null);
    const [noteText, setNoteText] = useState<string>('');
    const [tujuanText, setTujuanText] = useState<string>('');

    // Berita Acara states
    const [showBaForm, setShowBaForm] = useState<boolean>(false);
    const [baNo, setBaNo] = useState<string>('');
    const [baDate, setBaDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [baDescription, setBaDescription] = useState<string>('');
    const [baSelectedTOs, setBaSelectedTOs] = useState<string[]>([]);
    const [baImageBase64, setBaImageBase64] = useState<string>('');
    const [baCreated, setBaCreated] = useState<boolean>(false);

    // New states for manual TO addition
    const [baManualTOs, setBaManualTOs] = useState<{ code: string; type: 'KURANG' | 'LEBIH' | 'DOUBLE' }[]>([]);
    const [manualToCode, setManualToCode] = useState('');
    const [manualToType, setManualToType] = useState<'KURANG' | 'LEBIH' | 'DOUBLE'>('KURANG');

    // State for printing only BA
    const [isPrintingOnlyBa, setIsPrintingOnlyBa] = useState(false);

    // Dynamic generation of Berita Acara number
    useEffect(() => {
        if (step === 'report' && !baNo) {
            const year = new Date().getFullYear();
            const rand = Math.floor(1000 + Math.random() * 9000);
            setBaNo(`BA/DHS/${year}/${rand}`);
        }
    }, [step, baNo]);

    const handleBaImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setBaImageBase64(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const discrepantTOOptions = useMemo(() => {
        const pending = manifest.filter(item => item.status === 'pending').map(item => ({ code: item.code, type: 'KURANG' }));
        const extra = extraScans.map(item => ({ code: item.code, type: 'LEBIH' }));
        return [...pending, ...extra];
    }, [manifest, extraScans]);

    const handleAddManualTO = (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault();
        const code = manualToCode.trim().toUpperCase();
        if (!code) return;

        const existsManual = baManualTOs.some(item => item.code === code);
        const existsChecklist = baSelectedTOs.includes(code);

        if (existsManual || existsChecklist) {
            alert('Nomor TO ini sudah ada dalam daftar Berita Acara!');
            return;
        }

        setBaManualTOs([...baManualTOs, { code, type: manualToType }]);
        setManualToCode('');
    };

    const handleRemoveManualTO = (code: string) => {
        setBaManualTOs(baManualTOs.filter(item => item.code !== code));
    };

    const allBaTOs = useMemo(() => {
        const checked = baSelectedTOs.map(code => {
            const isExtra = extraScans.some(item => item.code === code);
            return { code, type: isExtra ? 'LEBIH' : 'KURANG' };
        });
        const manual = baManualTOs.map(item => ({ code: item.code.toUpperCase(), type: item.type }));

        const combined: { code: string; type: string }[] = [];
        const seen = new Set<string>();
        [...checked, ...manual].forEach(item => {
            if (!seen.has(item.code)) {
                seen.add(item.code);
                combined.push(item);
            }
        });
        return combined;
    }, [baSelectedTOs, baManualTOs, extraScans]);

    // Group manifest items and extra scans by destination (tujuan) for printing
    const groupedData = useMemo(() => {
        const groups: Record<string, { manifestItems: ManifestItem[]; extraItems: ExtraScan[] }> = {};
        
        manifest.forEach(item => {
            const defaultDest = isNoManifestMode ? 'OPERASIONAL BEBAS' : 'LAINNYA';
            const dest = (item.tujuan || defaultDest).trim().toUpperCase();
            if (!groups[dest]) {
                groups[dest] = { manifestItems: [], extraItems: [] };
            }
            groups[dest].manifestItems.push(item);
        });

        extraScans.forEach(item => {
            const defaultDest = isNoManifestMode ? 'OPERASIONAL BEBAS' : 'LAINNYA';
            const dest = (item.tujuan || defaultDest).trim().toUpperCase();
            if (!groups[dest]) {
                groups[dest] = { manifestItems: [], extraItems: [] };
            }
            groups[dest].extraItems.push(item);
        });

        return groups;
    }, [manifest, extraScans, isNoManifestMode]);

    const handlePrintOnlyBa = () => {
        setIsPrintingOnlyBa(true);
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                setIsPrintingOnlyBa(false);
            }, 1000);
        }, 150);
    };

    // Scanning statuses (visual feedback)
    const [scanAlert, setScanAlert] = useState<{
        type: 'success' | 'duplicate' | 'error' | 'idle';
        message: string;
        code?: string;
    }>({ type: 'idle', message: 'Silakan scan barcode atau masukkan kode TO' });

    // Flash background effect state
    const [flashEffect, setFlashEffect] = useState<'green' | 'yellow' | 'red' | 'none'>('none');

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const html5QrCodeRef = useRef<any>(null);
    const isInitialLoad = useRef<boolean>(true);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Stale closure prevention refs
    const processBarcodeRef = useRef<(scannedCode: string) => void>(() => {});
    const geminiAudioCacheRef = useRef<Record<string, { data: string; mimeType: string }>>({});
    const soundEnabledRef = useRef<boolean>(false);
    const speechRateRef = useRef<number>(1);
    const selectedVoiceNameRef = useRef<string>('');
    const selectedLanguageRef = useRef<string>('');
    const isNoManifestModeRef = useRef<boolean>(false);

    // Warm up/Resume AudioContext and speech synthesis helper
    const warmupAudio = () => {
        try {
            if (typeof window !== 'undefined') {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    if (!audioCtxRef.current) {
                        audioCtxRef.current = new AudioContextClass();
                        
                        audioCtxRef.current.onstatechange = () => {
                            if (audioCtxRef.current && audioCtxRef.current.state === 'closed') {
                                setAudioSystemError('Sistem Audio terputus secara tidak terduga. Silakan segarkan halaman.');
                            }
                        };
                    }
                    if (audioCtxRef.current.state === 'suspended') {
                        audioCtxRef.current.resume().catch((err) => {
                            console.error('AudioContext resume failed:', err);
                            setAudioSystemError('Aplikasi diblokir dari memutar audio oleh browser. Silakan klik tombol "Tes Suara" atau layani interaksi manual.');
                        });
                    }
                }
                if (window.speechSynthesis) {
                    // Speak dummy space to prime iOS/Chrome Speech Synthesis engines
                    const utterance = new SpeechSynthesisUtterance(" ");
                    window.speechSynthesis.speak(utterance);
                }
            }
        } catch (e) {
            console.error('Warmup audio error:', e);
            setAudioSystemError('Perangkat output suara Anda terputus atau tidak didukung di browser ini.');
        }
    };

    // Auto-unlock AudioContext and SpeechSynthesis on first user interaction
    useEffect(() => {
        // Pre-warm Web Speech API voices list as they load asynchronously
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = () => {
                    window.speechSynthesis.getVoices();
                };
            }
        }

        const handleInteraction = () => {
            warmupAudio();
            cleanup();
        };

        const cleanup = () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('keydown', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);

        return cleanup;
    }, []);

    // Audio Context generator for native sound beeps
    const playBeep = (freq: number, duration: number, double = false) => {
        if (!soundEnabled) return;
        try {
            if (typeof window === 'undefined') return;

            // Lazy initialize AudioContext as a singleton
            if (!audioCtxRef.current) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    audioCtxRef.current = new AudioContextClass();
                    
                    audioCtxRef.current.onstatechange = () => {
                        if (audioCtxRef.current && audioCtxRef.current.state === 'closed') {
                            setAudioSystemError('Sistem Audio terputus secara tidak terduga. Silakan segarkan halaman.');
                        }
                    };
                }
            }

            const audioCtx = audioCtxRef.current;
            if (!audioCtx) return;

            const playSingle = (frequency: number, delay = 0) => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';

                // Use simple linear values to avoid exponential to/from 0 errors
                gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime + delay);
                gainNode.gain.linearRampToValueAtTime(beepVolume, audioCtx.currentTime + delay + 0.02);
                gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);

                oscillator.start(audioCtx.currentTime + delay);
                oscillator.stop(audioCtx.currentTime + delay + duration);
            };

            const runPlay = () => {
                playSingle(freq);
                if (double) {
                    setTimeout(() => {
                        playSingle(freq * 1.2);
                    }, 150);
                }
            };

            // Wait for AudioContext to be resumed before starting sound
            if (audioCtx.state === 'suspended') {
                audioCtx.resume()
                    .then(runPlay)
                    .catch((err) => {
                        console.error('AudioContext resume failed:', err);
                        setAudioSystemError('Aplikasi diblokir dari memutar audio oleh browser. Silakan klik tombol "Tes Suara" untuk mengaktifkan.');
                        runPlay(); // Try to play anyway
                    });
            } else {
                runPlay();
            }
        } catch (e) {
            console.error('Web Audio API error:', e);
            setAudioSystemError('Perangkat output suara Anda terputus atau tidak didukung di browser ini.');
        }
    };

    // Helper function to translate numbers to Indonesian spoken words
    const numberToIndonesianWords = (n: number): string => {
        const convert = (num: number): string => {
            const units = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
            if (num < 12) return units[num];
            if (num < 20) return convert(num - 10) + ' belas';
            if (num < 100) return convert(Math.floor(num / 10)) + ' puluh ' + convert(num % 10);
            if (num < 200) return 'seratus ' + convert(num - 100);
            if (num < 1000) return convert(Math.floor(num / 100)) + ' ratus ' + convert(num % 100);
            if (num < 2000) return 'seribu ' + convert(num - 1000);
            if (num < 1000000) return convert(Math.floor(num / 1000)) + ' ribu ' + convert(num % 1000);
            return num.toString();
        };
        return convert(n).replace(/\s+/g, ' ').trim();
    };

    // Helper to check if an item is a Liquid item
    const isLiquidItem = (item: { toType?: string }) => {
        return !!item.toType?.toLowerCase().includes('liquid');
    };

    // Helper to check if an item is a Dangerous Goods (DG) item
    const isDgItem = (item: { dgType?: string }) => {
        if (!item.dgType) return false;
        const cleanDg = item.dgType.toLowerCase().trim();
        if (cleanDg.includes('non-dg') || cleanDg.includes('non dg')) return false;
        return cleanDg !== '' && cleanDg !== '-' && (
            cleanDg.includes('dg') ||
            cleanDg.includes('ype') ||
            cleanDg.includes('danger') ||
            cleanDg.includes('type')
        );
    };

    // Helper to check if an item is a Special item (Liquid or DG)
    const isSpecialItem = (item: { toType?: string; dgType?: string }) => {
        return isLiquidItem(item) || isDgItem(item);
    };

    const getSpokenWarningText = (sequenceNumber: number, isLiquid: boolean, isDangerous: boolean) => {
        if (translatedSpeech && translatedSpeech.warnings) {
            const numStr = translatedSpeech.numbers[String(sequenceNumber)] || String(sequenceNumber);
            let warn = '';
            if (isLiquid && isDangerous) {
                warn = translatedSpeech.warnings.cairan_dg || 'cairan berbahaya';
            } else if (isLiquid) {
                warn = translatedSpeech.warnings.cairan || 'cairan';
            } else {
                warn = translatedSpeech.warnings.dg || 'barang berbahaya';
            }
            return `${numStr}. ${warn}`;
        } else {
            let warn = '';
            if (isLiquid && isDangerous) {
                warn = 'cairan berbahaya';
            } else if (isLiquid) {
                warn = 'cairan';
            } else {
                warn = 'barang berbahaya';
            }
            return `${numberToIndonesianWords(sequenceNumber)}. Awas, ${warn}!`;
        }
    };

    // Voice TTS helper using Gemini AI Audio (primary) or Web Speech API (fallback)
    const speakText = (text: string) => {
        if (!soundEnabledRef.current) return;
        try {
            // --- Gemini TTS Audio Cache Playback (PRIORITY) ---
            if (geminiAudioCacheRef.current[text]) {
                const cached = geminiAudioCacheRef.current[text];
                try {
                    const mime = cached.mimeType;
                    // Check if it's raw PCM (L16) format — need to convert to playable WAV
                    if (mime.includes('L16') || mime.includes('pcm')) {
                        const sampleRateMatch = mime.match(/rate=(\d+)/);
                        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1]) : 24000;
                        const rawBytes = Uint8Array.from(atob(cached.data), c => c.charCodeAt(0));
                        
                        // Create WAV header for 16-bit mono PCM
                        const wavHeader = new ArrayBuffer(44);
                        const view = new DataView(wavHeader);
                        const writeStr = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
                        writeStr(0, 'RIFF');
                        view.setUint32(4, 36 + rawBytes.length, true);
                        writeStr(8, 'WAVE');
                        writeStr(12, 'fmt ');
                        view.setUint32(16, 16, true);
                        view.setUint16(20, 1, true); // PCM
                        view.setUint16(22, 1, true); // mono
                        view.setUint32(24, sampleRate, true);
                        view.setUint32(28, sampleRate * 2, true); // byte rate
                        view.setUint16(32, 2, true); // block align
                        view.setUint16(34, 16, true); // bits per sample
                        writeStr(36, 'data');
                        view.setUint32(40, rawBytes.length, true);
                        
                        const wavBlob = new Blob([wavHeader, rawBytes], { type: 'audio/wav' });
                        const wavUrl = URL.createObjectURL(wavBlob);
                        const audio = new Audio(wavUrl);
                        audio.playbackRate = speechRateRef.current;
                        audio.onended = () => URL.revokeObjectURL(wavUrl);
                        audio.onerror = () => URL.revokeObjectURL(wavUrl);
                        audio.play().catch(() => {});
                    } else {
                        // Direct playback for other audio formats (mp3, ogg, wav, etc.)
                        const audioUrl = `data:${mime};base64,${cached.data}`;
                        const audio = new Audio(audioUrl);
                        audio.playbackRate = speechRateRef.current;
                        audio.play().catch(() => {});
                    }
                    return; // Successfully played Gemini audio, skip Web Speech API
                } catch (e) {
                    console.warn('Gemini audio playback failed, falling back to Web Speech API:', e);
                }
            }

            // --- Web Speech API Fallback ---
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                // Cancel any ongoing speaking to prioritize the new scan result
                window.speechSynthesis.cancel();

                // Chrome SpeechSynthesis bug workaround: add delay after cancel()
                setTimeout(() => {
                    const utterance = new SpeechSynthesisUtterance(text);
                    
                    const voices = window.speechSynthesis.getVoices();
                    let chosenVoice: SpeechSynthesisVoice | undefined;

                    // 1. Check if user explicitly selected a voice
                    if (selectedVoiceNameRef.current) {
                        chosenVoice = voices.find(v => v.name === selectedVoiceNameRef.current);
                    }

                    // 2. If not selected, try to match the active selectedLanguage prefix
                    if (!chosenVoice && selectedLanguageRef.current !== 'id') {
                        const langMap: Record<string, string> = {
                            en: 'en',
                            jp: 'ja',
                            cn: 'zh',
                            ar: 'ar'
                        };
                        const targetPrefix = langMap[selectedLanguageRef.current];
                        if (targetPrefix) {
                            chosenVoice = voices.find(v => v.lang.toLowerCase().startsWith(targetPrefix));
                        }
                    }

                    // 3. Fallback to Indonesian if Javanese, Sundanese, Makassar, Bugis, Madura, or fallback is needed
                    if (!chosenVoice) {
                        chosenVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('ID'));
                    }

                    if (chosenVoice) {
                        utterance.voice = chosenVoice;
                        utterance.lang = chosenVoice.lang;
                    } else {
                        utterance.lang = 'id-ID';
                    }
                    
                    utterance.rate = speechRateRef.current;

                    // Keep a reference to prevent garbage collection mid-speech
                    utteranceRef.current = utterance;
                    utterance.onend = () => {
                        if (utteranceRef.current === utterance) {
                            utteranceRef.current = null;
                        }
                    };
                    utterance.onerror = (e) => {
                        // Log real errors but skip normal canceled/interrupted states
                        if (e.error !== 'interrupted' && e.error !== 'canceled') {
                            console.error('SpeechSynthesisUtterance error:', e.error || e);
                            if (e.error === 'audio-hardware' || e.error === 'audio-busy') {
                                setAudioSystemError('Perangkat audio/speaker terputus atau sedang digunakan oleh aplikasi lain.');
                            }
                        }
                        if (utteranceRef.current === utterance) {
                            utteranceRef.current = null;
                        }
                    };

                    window.speechSynthesis.speak(utterance);
                }, 100);
            }
        } catch (e) {
            console.error('SpeechSynthesis error:', e);
        }
    };

    // Vibrate haptic helper
    const triggerVibration = (pattern: number | number[]) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    };

    // Trigger visual flash
    const triggerFlash = (color: 'green' | 'yellow' | 'red') => {
        setFlashEffect(color);
        const timer = setTimeout(() => setFlashEffect('none'), 600);
        return () => clearTimeout(timer);
    };

    // Apply a sound profile preset
    const applySoundProfile = (profile: Exclude<SoundProfileKey, 'custom'>) => {
        const p = SOUND_PROFILES[profile];
        setSpeechRate(p.speechRate);
        setBeepVolume(p.beepVolume);
        setSoundProfile(profile);
    };

    // Save note and destination to a manifest item
    const handleSaveNote = (itemId: string, text: string, tujuanVal?: string) => {
        const inManifest = manifest.findIndex(i => i.id === itemId);
        if (inManifest !== -1) {
            const updated = [...manifest];
            updated[inManifest].note = text || undefined;
            updated[inManifest].tujuan = tujuanVal || undefined;
            setManifest(updated);
        } else {
            const inExtra = extraScans.findIndex(i => i.id === itemId);
            if (inExtra !== -1) {
                const updated = [...extraScans];
                updated[inExtra].note = text || undefined;
                updated[inExtra].tujuan = tujuanVal || undefined;
                setExtraScans(updated);
            }
        }
        setNoteEditingItemId(null);
        setNoteText('');
        setTujuanText('');
    };

    // Start editing note and destination for an item
    const handleStartNote = (itemId: string, currentNote?: string) => {
        setNoteEditingItemId(itemId);
        setNoteText(currentNote || '');
        
        const inManifest = manifest.find(i => i.id === itemId);
        if (inManifest) {
            setTujuanText(inManifest.tujuan || '');
        } else {
            const inExtra = extraScans.find(i => i.id === itemId);
            setTujuanText(inExtra?.tujuan || '');
        }
    };

    // Auto-focus the input during the scanning step (only if not editing any item and not focusing other inputs)
    useEffect(() => {
        if (step === 'scan' && inputRef.current && !editingItemId) {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                return;
            }
            inputRef.current.focus();
        }
    }, [step, scanAlert, editingItemId]);

    // Handle focus loss: automatically refocus to ensure continuous scanning unless another input is targeted
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const target = e.relatedTarget as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) {
            return;
        }

        if (step === 'scan' && !isCameraActive && !editingItemId) {
            setTimeout(() => {
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'BUTTON')) {
                    return;
                }
                if (inputRef.current && !editingItemId) inputRef.current.focus();
            }, 150);
        }
    };

    // Initial load: fetch history and check for active autosaved session
    useEffect(() => {
        // Load history log
        const savedHistory = localStorage.getItem('cce_scan_history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error('Failed to load scan history:', e);
            }
        }

        // Load audio settings
        const rate = localStorage.getItem('cce_audio_speech_rate');
        if (rate) setSpeechRate(parseFloat(rate));

        const vol = localStorage.getItem('cce_audio_beep_volume');
        if (vol) setBeepVolume(parseFloat(vol));

        const profile = localStorage.getItem('cce_audio_sound_profile');
        if (profile) setSoundProfile(profile as SoundProfileKey);

        const savedLang = localStorage.getItem('cce_audio_selected_language');
        if (savedLang) setSelectedLanguage(savedLang);

        const savedTranslation = localStorage.getItem('cce_audio_translated_speech');
        if (savedTranslation) {
            try {
                setTranslatedSpeech(JSON.parse(savedTranslation));
            } catch (e) {
                console.error('Failed to load saved translation:', e);
            }
        }

        const savedWrong = localStorage.getItem('cce_audio_wrong_scan_text');
        if (savedWrong) setWrongScanText(savedWrong);

        const savedDup = localStorage.getItem('cce_audio_duplicate_text');
        if (savedDup) setDuplicateText(savedDup);

        const savedDouble = localStorage.getItem('cce_audio_double_scan_text');
        if (savedDouble) setDoubleScanText(savedDouble);

        const savedVoice = localStorage.getItem('cce_audio_selected_voice');
        if (savedVoice) setSelectedVoiceName(savedVoice);

        // Restore Gemini TTS voice name and cached audio
        const savedGeminiVoice = localStorage.getItem('dhs_gemini_voice_name');
        if (savedGeminiVoice) setGeminiVoiceName(savedGeminiVoice);
        
        try {
            const savedGeminiCache = localStorage.getItem('dhs_gemini_audio_cache');
            const savedGeminiCacheVoice = localStorage.getItem('dhs_gemini_audio_cache_voice');
            if (savedGeminiCache && savedGeminiCacheVoice) {
                setGeminiAudioCache(JSON.parse(savedGeminiCache));
                setAudioGenProgress(`✅ ${Object.keys(JSON.parse(savedGeminiCache)).length} audio clips dimuat dari cache (${savedGeminiCacheVoice}).`);
            }
        } catch (e) {
            console.error('Failed to load Gemini audio cache:', e);
        }

        // Check for active unsaved session
        const savedActive = localStorage.getItem('cce_active_scan_session');
        if (savedActive) {
            try {
                const parsed = JSON.parse(savedActive);
                if (parsed.manifest && parsed.manifest.length > 0) {
                    setPendingRecovery(parsed);
                    setShowRecoveryModal(true);
                }
            } catch (e) {
                console.error('Failed to parse autosave session:', e);
            }
        }
        isInitialLoad.current = false;
    }, []);

    // Autosave active session states to LocalStorage on changes during scanning
    useEffect(() => {
        if (isInitialLoad.current) return;

        if (step === 'import') {
            localStorage.removeItem('cce_active_scan_session');
            return;
        }

        // Debounce saving active session to localStorage by 1000ms to prevent blocking the main thread during rapid scans
        const timer = setTimeout(() => {
            const sessionData = {
                sessionType,
                driverName,
                noPolisi,
                manifest,
                extraScans,
                step,
                isNoManifestMode
            };
            localStorage.setItem('cce_active_scan_session', JSON.stringify(sessionData));
        }, 1000);

        return () => clearTimeout(timer);
    }, [step, sessionType, driverName, noPolisi, manifest, extraScans, isNoManifestMode]);

    // Save audio config on change
    useEffect(() => {
        if (isInitialLoad.current) return;
        localStorage.setItem('cce_audio_speech_rate', speechRate.toString());
        localStorage.setItem('cce_audio_beep_volume', beepVolume.toString());
        localStorage.setItem('cce_audio_sound_profile', soundProfile);
        localStorage.setItem('cce_audio_selected_language', selectedLanguage);
        if (translatedSpeech) {
            localStorage.setItem('cce_audio_translated_speech', JSON.stringify(translatedSpeech));
        } else {
            localStorage.removeItem('cce_audio_translated_speech');
        }
        localStorage.setItem('cce_audio_wrong_scan_text', wrongScanText);
        localStorage.setItem('cce_audio_duplicate_text', duplicateText);
        localStorage.setItem('cce_audio_double_scan_text', doubleScanText);
        localStorage.setItem('cce_audio_selected_voice', selectedVoiceName);
    }, [speechRate, beepVolume, soundProfile, selectedLanguage, translatedSpeech, wrongScanText, duplicateText, doubleScanText, selectedVoiceName]);

    // Handle recovering active session
    const handleConfirmRecovery = () => {
        if (pendingRecovery) {
            setSessionType(pendingRecovery.sessionType);
            setDriverName(pendingRecovery.driverName || '');
            setNoPolisi(pendingRecovery.noPolisi || '');
            setManifest(pendingRecovery.manifest);
            setExtraScans(pendingRecovery.extraScans || []);
            setIsNoManifestMode(!!pendingRecovery.isNoManifestMode);
            setStep(pendingRecovery.step);
            setShowRecoveryModal(false);
            setPendingRecovery(null);
            setScanAlert({ type: 'idle', message: 'Sesi scan berhasil dipulihkan. Silakan lanjutkan.' });
            warmupAudio();
        }
    };

    // Discard recovery session
    const handleDiscardRecovery = () => {
        localStorage.removeItem('cce_active_scan_session');
        setPendingRecovery(null);
        setShowRecoveryModal(false);
    };

    // Load available voice models from system/browser text-to-speech engine
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const updateVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                // Filter duplicates and sort
                const uniqueVoices = Array.from(new Map(voices.map(v => [v.name, v])).values())
                    .sort((a, b) => a.name.localeCompare(b.name));
                setAvailableVoices(uniqueVoices);
            };
            updateVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = updateVoices;
            }
        }
    }, []);

    // Helper function to parse CSV text into a 2D array of strings, supporting commas, semicolons, and tabs
    const parseCSVText = (text: string): string[][] => {
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        if (rows.length === 0) return [];
        
        // Auto-detect delimiter based on frequency
        let delimiter = ',';
        const sample = rows.slice(0, 10).join('\n');
        const commaCount = (sample.match(/,/g) || []).length;
        const semiCount = (sample.match(/;/g) || []).length;
        const tabCount = (sample.match(/\t/g) || []).length;
        
        if (semiCount > commaCount && semiCount > tabCount) {
            delimiter = ';';
        } else if (tabCount > commaCount && tabCount > semiCount) {
            delimiter = '\t';
        }

        const lines: string[][] = [];
        for (const row of rows) {
            const cells: string[] = [];
            let inQuotes = false;
            let currentCell = '';
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === delimiter && !inQuotes) {
                    cells.push(currentCell.trim());
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            cells.push(currentCell.trim());
            lines.push(cells);
        }
        return lines;
    };

    // Helper: Parse weight supporting both Indonesian and US decimal notations
    const parseCSVWeight = (val: string): number => {
        if (!val) return 0.0;
        let s = String(val).trim().replace(/\s/g, '');
        
        // If both dots and commas exist
        if (s.includes('.') && s.includes(',')) {
            const dotIdx = s.indexOf('.');
            const commaIdx = s.indexOf(',');
            if (dotIdx < commaIdx) {
                // Indonesian format (e.g. 5.166,847) -> strip dot, convert comma to dot
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                // US format (e.g. 5,166.847) -> strip comma
                s = s.replace(/,/g, '');
            }
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        }
        
        return parseFloat(s) || 0.0;
    };

    // Helper: Parse koli/package quantities
    const parseCSVPackages = (val: string): number => {
        if (!val) return 0;
        let s = String(val).trim().replace(/\s/g, '');
        s = s.replace(/[,.]/g, ''); // strip thousands
        return parseInt(s, 10) || 0;
    };

    // Helper: Extract items and metadata from CSV structure
    const processCSVData = (rows: string[][]) => {
        let extractedDriver = '';
        let extractedNopol = '';
        let extractedSessionType: 'BONGKAR' | 'MUAT' = 'BONGKAR';
        
        // 1. Scan for trip metadata from header rows (first 35 rows)
        for (let r = 0; r < Math.min(rows.length, 35); r++) {
            const rowStr = rows[r].join(" ");
            
            if (rowStr.toLowerCase().includes("bongkar")) {
                extractedSessionType = 'BONGKAR';
            } else if (rowStr.toLowerCase().includes("muat")) {
                extractedSessionType = 'MUAT';
            }

            for (let c = 0; c < rows[r].length; c++) {
                const cellVal = String(rows[r][c]).trim();
                const nextCellVal = rows[r][c+1] ? String(rows[r][c+1]).trim() : "";
                const cleanedVal = cellVal.toLowerCase();

                if (cleanedVal.includes("nomor polisi") || cleanedVal.includes("no polisi") || cleanedVal === "plat" || cleanedVal === "nopol") {
                    extractedNopol = nextCellVal.replace(/^[\s:]+/, '').trim();
                }
                if (cleanedVal.includes("nama driver") || cleanedVal === "driver" || cleanedVal === "sopir") {
                    extractedDriver = nextCellVal.replace(/^[\s:]+/, '').trim();
                }
            }
        }

        // 2. Discover dynamic column indices by scanning the CSV header row
        let headerMap = { toIdx: -1, paketIdx: -1, beratIdx: -1, tujuanIdx: -1, typeIdx: -1, dgIdx: -1 };
        for (let r = 0; r < Math.min(rows.length, 45); r++) {
            const row = rows[r];
            let foundTOHeader = false;
            let tempMap = { toIdx: -1, paketIdx: -1, beratIdx: -1, tujuanIdx: -1, typeIdx: -1, dgIdx: -1 };
            
            for (let c = 0; c < row.length; c++) {
                const val = String(row[c]).trim().toLowerCase();
                if (val === 'nomor to' || val === 'to number' || val === 'to no' || val === 'to_number' || val === 'no to' || val === 'resi') {
                    tempMap.toIdx = c;
                    foundTOHeader = true;
                } else if (val.includes('jmlh') || val === 'jumlah' || val === 'qty' || val === 'paket' || val === 'jml' || val.includes('koli') || val === 'pcs') {
                    tempMap.paketIdx = c;
                } else if (val.includes('berat') || val.includes('weight')) {
                    tempMap.beratIdx = c;
                } else if (val === 'destination' || val === 'tujuan' || val === 'dest') {
                    tempMap.tujuanIdx = c;
                } else if (val.includes('to type') || val === 'to_type' || val === 'type' || val === 'tipe') {
                    tempMap.typeIdx = c;
                } else if (val.includes('dg') || val.includes('danger') || val.includes('ype') || val.includes('hazardous') || val.includes('berbahaya')) {
                    if (!val.includes('to type') && val !== 'type') {
                        tempMap.dgIdx = c;
                    }
                }
            }
            if (foundTOHeader) {
                headerMap = tempMap;
                break;
            }
        }

        const items: ManifestItem[] = [];
        let itemIndex = 0;

        // 3. Process each row and parse TOs
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            
            let toColIdx = -1;
            let toVal = "";
            for (let c = 0; c < row.length; c++) {
                const cellVal = String(row[c]).trim();
                if (/^(?:TO|SPXID)[0-9]{8}[A-Z0-9]+$/i.test(cellVal)) {
                    toColIdx = c;
                    toVal = cellVal.toUpperCase();
                    break;
                }
            }

            if (toColIdx !== -1) {
                let paket = undefined;
                let berat = undefined;
                let tujuan = undefined;
                let type = "-";
                let dg = "-";

                if (headerMap.toIdx !== -1) {
                    // Standardized Header Mapping
                    if (headerMap.paketIdx !== -1 && row[headerMap.paketIdx]) {
                        paket = parseCSVPackages(row[headerMap.paketIdx]);
                    }
                    if (headerMap.beratIdx !== -1 && row[headerMap.beratIdx]) {
                        berat = parseCSVWeight(row[headerMap.beratIdx]);
                    }
                    if (headerMap.tujuanIdx !== -1 && row[headerMap.tujuanIdx]) {
                        tujuan = String(row[headerMap.tujuanIdx]).trim();
                    }
                    if (headerMap.typeIdx !== -1 && row[headerMap.typeIdx]) {
                        type = String(row[headerMap.typeIdx]).trim();
                    }
                    if (headerMap.dgIdx !== -1 && row[headerMap.dgIdx]) {
                        const rawDg = String(row[headerMap.dgIdx]).trim();
                        dg = (rawDg === "" || rawDg === "-") ? "-" : rawDg;
                    }
                } else {
                    // Fail-safe scanning relative to TO column index
                    let foundNumerics: { index: number; value: number; raw: string }[] = [];
                    for (let c = toColIdx + 1; c < row.length; c++) {
                        const val = String(row[c]).trim();
                        if (val === "") continue;

                        const cleanNum = val.replace(/,/g, '.');
                        if (!isNaN(Number(cleanNum)) && cleanNum !== "") {
                            foundNumerics.push({ index: c, value: parseFloat(cleanNum), raw: val });
                        }
                        if (val.toLowerCase().includes('dc') || val.toLowerCase().includes('hub')) {
                            tujuan = val;
                        }
                        if (['bag', 'bulky', 'liquid', 'karung', 'box'].includes(val.toLowerCase())) {
                            type = val;
                        }
                        const lowerVal = val.toLowerCase();
                        const isProbablyDg = lowerVal.includes('dg') || lowerVal.includes('ype') || lowerVal.includes('danger') || lowerVal.includes('type');
                        const isNonDg = lowerVal.includes('non-dg') || lowerVal.includes('non dg');
                        
                        if (isProbablyDg && !isNonDg) {
                            dg = val;
                        } else if (isNonDg) {
                            dg = 'Non-DG';
                        }
                    }

                    if (foundNumerics.length >= 2) {
                        paket = parseCSVPackages(foundNumerics[0].raw);
                        berat = parseCSVWeight(foundNumerics[1].raw);
                    } else if (foundNumerics.length === 1) {
                        berat = parseCSVWeight(foundNumerics[0].raw);
                    }
                }

                if (type === "" || type === "-") {
                    for (let c = 0; c < row.length; c++) {
                        const val = String(row[c]).trim().toLowerCase();
                        if (['bag', 'bulky', 'liquid', 'karung', 'box'].includes(val)) {
                            type = row[c].trim();
                        }
                    }
                }

                items.push({
                    id: `item-${itemIndex++}-${Date.now()}`,
                    code: toVal,
                    status: 'pending',
                    jmlhPaket: (paket !== undefined && !isNaN(paket)) ? paket : undefined,
                    berat: (berat !== undefined && !isNaN(berat)) ? berat : undefined,
                    toType: (type === "" || type === "-") ? undefined : type,
                    dgType: (dg === "" || dg === "-" || dg.toLowerCase().includes("non-dg") || dg.toLowerCase().includes("non dg")) ? undefined : dg,
                    tujuan: (tujuan === "" || tujuan === "-") ? undefined : tujuan
                });
            }
        }

        return {
            items,
            driver: extractedDriver,
            nopol: extractedNopol,
            sessionType: extractedSessionType
        };
    };

    const handleStartNoManifestSession = () => {
        setManifest([]);
        setExtraScans([]);
        setCurrentSessionId(null);
        setSearchTerm('');
        setIsNoManifestMode(true);
        setStep('scan');
        setScanAlert({
            type: 'idle',
            message: 'Sesi scan bebas tanpa manifes dimulai! Silakan scan barcode barang.'
        });
        warmupAudio();
    };

    // Parse pasted/input text for TO & SPXID resi numbers and additional columns
    const handleParseManifest = () => {
        if (!rawInput.trim()) {
            alert('Masukkan data manifest terlebih dahulu!');
            return;
        }

        // Try structured CSV parsing first
        try {
            const rows = parseCSVText(rawInput);
            const csvResult = processCSVData(rows);
            
            if (csvResult && csvResult.items.length > 0) {
                setManifest(csvResult.items);
                setExtraScans([]);
                setCurrentSessionId(null);
                setSearchTerm('');
                
                if (csvResult.driver) setDriverName(csvResult.driver);
                if (csvResult.nopol) setNoPolisi(csvResult.nopol);
                setSessionType(csvResult.sessionType);
                setIsNoManifestMode(false);

                setStep('scan');
                setScanAlert({ 
                    type: 'idle', 
                    message: `Manifest CSV berhasil diimpor! Terdeteksi ${csvResult.items.length} TO.` 
                });
                warmupAudio();
                return;
            }
        } catch (e) {
            console.warn('CSV parsing fell back to plain text parser:', e);
        }

        // Fallback: plain text parser (line by line extraction)
        const lines = rawInput.split(/\r?\n/);
        const items: ManifestItem[] = [];
        let itemIndex = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Split by tab first, if no tabs then by multiple spaces (2 or more)
            let cols = trimmed.split('\t');
            if (cols.length <= 1) {
                cols = trimmed.split(/\s{2,}/);
            }

            // Find index of column matching TO or SPXID pattern
            const codePattern = /^(?:TO|SPXID)[A-Z0-9]+$/i;
            const codeIdx = cols.findIndex(col => codePattern.test(col.trim()));

            if (codeIdx !== -1) {
                const code = cols[codeIdx].trim().toUpperCase();

                // Parse optional columns relative to the matched TO code column
                const jmlhPaketStr = cols[codeIdx + 1]?.trim() || '';
                const beratStr = cols[codeIdx + 2]?.trim() || '';
                const toType = cols[codeIdx + 3]?.trim() || '';
                const dgType = cols[codeIdx + 4]?.trim() || '';

                const jmlhPaket = jmlhPaketStr ? parseInt(jmlhPaketStr.replace(/[,.]/g, ''), 10) : undefined;
                // Replace comma with dot for standard decimal parseFloat conversion (e.g. 18,330 -> 18.330)
                const berat = beratStr ? parseFloat(beratStr.replace(/,/g, '.')) : undefined;

                items.push({
                    id: `item-${itemIndex++}-${Date.now()}`,
                    code,
                    status: 'pending',
                    jmlhPaket: (jmlhPaket !== undefined && !isNaN(jmlhPaket)) ? jmlhPaket : undefined,
                    berat: (berat !== undefined && !isNaN(berat)) ? berat : undefined,
                    toType: toType || undefined,
                    dgType: (dgType === "" || dgType === "-" || dgType.toLowerCase().includes("non-dg") || dgType.toLowerCase().includes("non dg")) ? undefined : dgType
                });
            } else {
                // Fallback: search the whole line for TO or SPXID pattern just in case it's not tabular
                const linePattern = /\b(?:TO|SPXID)[A-Z0-9]+\b/gi;
                const lineMatches = trimmed.match(linePattern);
                if (lineMatches) {
                    for (const code of lineMatches) {
                        if (!items.some(item => item.code === code.toUpperCase())) {
                            items.push({
                                id: `item-${itemIndex++}-${Date.now()}`,
                                code: code.toUpperCase(),
                                status: 'pending'
                            });
                        }
                    }
                }
            }
        }

        if (items.length === 0) {
            alert('Tidak ditemukan kode resi/TO yang valid pada data input! Pastikan kode diawali dengan TO atau SPXID.');
            return;
        }

        setManifest(items);
        setExtraScans([]);
        setCurrentSessionId(null);
        setSearchTerm('');
        setIsNoManifestMode(false);
        setStep('scan');
        setScanAlert({ type: 'idle', message: 'Sesi scan siap. Mulailah memindai barcode.' });
        warmupAudio();
    };

    // Preload sample data from the user request
    const handleLoadSample = () => {
        const sample = `DHS BONGKARAN - SURABAYA 29 MEI 2026
#\tNomor TO\tJmlh Paket\tBerat (kg)\tTO Type\tDG Type
1\tTO20260619A17BR\t30\t18.330\tBag\t-
2\tTO20260620BXW06\t45\t19.570\tBag\t-
3\tTO20260621CGC9Z\t12\t17.560\tBulky\tNon-DG
4\tTO20260611RJ52T\t16\t6.030\tBag\t-
5\tTO202606176X6G8\t30\t7.880\tBag\t-`;
        setRawInput(sample);
        setDriverName('Riswan');
        setNoPolisi('DD 8250 LQ');
    };

    // Drag-and-drop file uploader parsing (supports multiple files at once)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        const readPromises = fileList.map(file => {
            return new Promise<{ text: string; name: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve({
                        text: event.target?.result as string,
                        name: file.name
                    });
                };
                reader.onerror = (err) => reject(err);
                reader.readAsText(file);
            });
        });

        Promise.all(readPromises).then(results => {
            const combinedText = results.map(r => r.text).join('\n\n');
            setRawInput(combinedText);

            const allItems: ManifestItem[] = [];
            const seenCodes = new Set<string>();
            let driver = '';
            let nopol = '';
            let sessionTypeVal: 'BONGKAR' | 'MUAT' | '' = '';

            results.forEach(res => {
                try {
                    const rows = parseCSVText(res.text);
                    const csvResult = processCSVData(rows);
                    if (csvResult && csvResult.items.length > 0) {
                        csvResult.items.forEach(item => {
                            if (!seenCodes.has(item.code)) {
                                seenCodes.add(item.code);
                                allItems.push(item);
                            }
                        });
                        if (csvResult.driver && !driver) driver = csvResult.driver;
                        if (csvResult.nopol && !nopol) nopol = csvResult.nopol;
                        if (csvResult.sessionType && !sessionTypeVal) sessionTypeVal = csvResult.sessionType;
                    }
                } catch (err) {
                    console.warn(`Failed parsing file ${res.name}:`, err);
                }
            });

            if (allItems.length > 0) {
                setManifest(allItems);
                setExtraScans([]);
                setCurrentSessionId(null);
                setSearchTerm('');
                if (driver) setDriverName(driver);
                if (nopol) setNoPolisi(nopol);
                if (sessionTypeVal) setSessionType(sessionTypeVal);

                setScanAlert({
                    type: 'success',
                    message: `Berhasil menggabungkan ${allItems.length} TO dari ${fileList.length} berkas manifest!`
                });
            } else {
                alert('Tidak berhasil mengekstrak data TO yang valid dari file-file tersebut.');
            }
        }).catch(err => {
            console.error('Error reading multiple files:', err);
            alert('Terjadi kesalahan saat membaca file-file tersebut.');
        });
    };

    // Add additional files to an active scanning session
    const handleAdditionalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            
            try {
                const rows = parseCSVText(text);
                const csvResult = processCSVData(rows);
                if (csvResult && csvResult.items.length > 0) {
                    const currentCodes = new Set(manifest.map(item => item.code));
                    const newItems: ManifestItem[] = [];

                    csvResult.items.forEach(item => {
                        if (!currentCodes.has(item.code)) {
                            newItems.push(item);
                        }
                    });

                    if (newItems.length > 0) {
                        setManifest(prev => [...prev, ...newItems]);
                        setScanAlert({
                            type: 'success',
                            message: `Berhasil menambahkan ${newItems.length} TO baru ke dalam manifest aktif!`
                        });
                        speakText(`Berhasil menambahkan ${newItems.length} resi baru`);
                    } else {
                        alert('Semua TO dalam file tambahan ini sudah terdaftar di manifest aktif.');
                    }
                } else {
                    alert('Tidak berhasil mengekstrak data TO yang valid dari file tambahan.');
                }
            } catch (err) {
                console.error('Error parsing additional file:', err);
                alert('Gagal membaca file tambahan. Pastikan formatnya valid.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Main scanning / matching logic
    const processBarcode = (scannedCode: string) => {
        const code = scannedCode.trim().toUpperCase();
        if (!code) return;

        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // --- NO-MANIFEST MODE (FREE SCAN MODE) ---
        if (isNoManifestModeRef.current) {
            const existingIdx = manifest.findIndex(item => item.code === code);
            
            if (existingIdx !== -1) {
                // Duplicate scan in No-Manifest Mode
                const updated = [...manifest];
                const currentScanTime = updated[existingIdx].scanTime || '';
                updated[existingIdx].scanTime = currentScanTime ? `${currentScanTime}, ${nowStr} (Dup)` : `${nowStr} (Dup)`;
                setManifest(updated);

                setScanAlert({
                    type: 'duplicate',
                    message: `DUPLIKAT! Kode ini sudah discan sebelumnya (Koli #${existingIdx + 1})`,
                    code
                });
                triggerFlash('yellow');
                playBeep(440, 0.2); // Normal warning beep
                triggerVibration([80, 80]);
                speakText(duplicateText);
            } else {
                // New scan in No-Manifest Mode - append dynamically to manifest list
                const sequenceNumber = manifest.length + 1;
                const newItem: ManifestItem = {
                    id: `scanned-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    code,
                    status: 'scanned',
                    scanTime: nowStr,
                    originalIndex: manifest.length,
                    jmlhPaket: 1,
                    berat: 0,
                    toType: 'REGULER',
                    dgType: '',
                    tujuan: '',
                    note: ''
                };
                setManifest(prev => [...prev, newItem]);

                setScanAlert({
                    type: 'success',
                    message: `BERHASIL! Koli #${sequenceNumber} ditambahkan`,
                    code
                });
                triggerFlash('green');
                playBeep(880, 0.12, true); // Double high beep
                triggerVibration(100);
                speakText(translatedSpeech?.numbers[String(sequenceNumber)] || numberToIndonesianWords(sequenceNumber));
            }
            return;
        }

        // 1. Check if the code is in the manifest and is still 'pending'
        const pendingItemIdx = manifest.findIndex(item => item.code === code && item.status === 'pending');

        if (pendingItemIdx !== -1) {
            // MATCH FOUND!
            const updated = [...manifest];
            updated[pendingItemIdx].status = 'scanned';
            updated[pendingItemIdx].scanTime = nowStr;
            setManifest(updated);

            const item = updated[pendingItemIdx];
            const isLiquid = isLiquidItem(item);
            const isDangerous = isDgItem(item);

            // Get sequence number of this successfully scanned item
            const sequenceNumber = updated.filter(i => i.status === 'scanned').length;

            if (isLiquid || isDangerous) {
                // Special item handling
                let warningLabel = '';
                if (isLiquid && isDangerous) {
                    warningLabel = ' [CAIRAN BERBAHAYA]';
                } else if (isLiquid) {
                    warningLabel = ' [CAIRAN]';
                } else {
                    warningLabel = ` [BERBAHAYA: ${item.dgType}]`;
                }

                setScanAlert({
                    type: 'success',
                    message: `COCOK! Koli berhasil diverifikasi${warningLabel}`,
                    code
                });
                triggerFlash('yellow');
                playBeep(660, 0.25, true); // Distinct alarm beep sequence
                triggerVibration([100, 100, 100]);

                const warnTxt = getSpokenWarningText(sequenceNumber, isLiquid, isDangerous);
                speakText(warnTxt);
            } else {
                // Normal item handling
                setScanAlert({
                    type: 'success',
                    message: `COCOK! Koli berhasil diverifikasi`,
                    code
                });
                triggerFlash('green');
                playBeep(880, 0.12, true); // Double high beep
                triggerVibration(100);
                speakText(translatedSpeech?.numbers[String(sequenceNumber)] || numberToIndonesianWords(sequenceNumber));
            }
            return;
        }

        // 2. Check if it's already scanned in manifest (duplicate scan)
        const alreadyScannedCount = manifest.filter(item => item.code === code && item.status === 'scanned').length;
        const totalInManifestCount = manifest.filter(item => item.code === code).length;

        if (totalInManifestCount > 0 && alreadyScannedCount === totalInManifestCount) {
            // Update the scanTime of the matching item in the manifest to include the duplicate scan time
            const updated = [...manifest];
            const matchedIdx = updated.findIndex(item => item.code === code && item.status === 'scanned');
            if (matchedIdx !== -1) {
                const currentScanTime = updated[matchedIdx].scanTime || '';
                updated[matchedIdx].scanTime = currentScanTime ? `${currentScanTime}, ${nowStr} (Dup)` : `${nowStr} (Dup)`;
                setManifest(updated);
            }

            setScanAlert({
                type: 'duplicate',
                message: `DUPLIKAT! Kode ini sudah discan sebelumnya (${alreadyScannedCount}/${totalInManifestCount} Koli)`,
                code
            });
            triggerFlash('yellow');
            playBeep(440, 0.2); // Normal warning beep
            triggerVibration([80, 80]);
            speakText(duplicateText);
            return;
        }

        // 3. Check if it's already scanned as extra (duplicate extra scan)
        const isAlreadyExtra = extraScans.some(item => item.code === code);
        if (isAlreadyExtra) {
            // Update the scanTime of the matching item in extraScans to include the duplicate scan time
            const updatedExtras = [...extraScans];
            const matchedIdx = updatedExtras.findIndex(item => item.code === code);
            if (matchedIdx !== -1) {
                const currentScanTime = updatedExtras[matchedIdx].scanTime || '';
                updatedExtras[matchedIdx].scanTime = currentScanTime ? `${currentScanTime}, ${nowStr} (Dup)` : `${nowStr} (Dup)`;
                setExtraScans(updatedExtras);
            }

            setScanAlert({
                type: 'duplicate',
                message: `TO TETAP SAMA! Kode selisih lebih ini sudah discan sebelumnya.`,
                code
            });
            triggerFlash('yellow');
            playBeep(330, 0.35); // Lower frequency warning beep for excess/extra duplicate
            triggerVibration([100, 50, 100]);
            speakText(doubleScanText);
            return;
        }

        // 4. Unlisted item (extra scan/salah)
        const extraItem: ExtraScan = {
            id: `extra-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            code,
            scanTime: nowStr
        };
        setExtraScans([extraItem, ...extraScans]);

        setScanAlert({
            type: 'error',
            message: `TIDAK TERDAFTAR! Barang tidak ada dalam manifest!`,
            code
        });
        triggerFlash('red');
        playBeep(220, 0.4); // Buzz alert sound
        triggerVibration([200, 100, 200]);
        speakText(wrongScanText);
    };

    // Manual Bypass Override
    const handleManualBypass = (itemId: string) => {
        const itemIdx = manifest.findIndex(item => item.id === itemId);
        if (itemIdx === -1) return;
        const item = manifest[itemIdx];

        if (confirm(`Verifikasi secara manual kode: ${item.code}? \nTindakan ini akan menandai koli sebagai cocok.`)) {
            const updated = [...manifest];
            const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            updated[itemIdx].status = 'scanned';
            updated[itemIdx].scanTime = `${nowStr} (MANUAL)`;
            setManifest(updated);

            // Get sequence number of this successfully scanned item
            const sequenceNumber = updated.filter(i => i.status === 'scanned').length;

            setScanAlert({
                type: 'success',
                message: `COCOK (MANUAL)! Koli diverifikasi manual`,
                code: item.code
            });
            triggerFlash('green');
            playBeep(880, 0.12, true);
            triggerVibration(100);

            // Speak the sequence number
            speakText(translatedSpeech?.numbers[String(sequenceNumber)] || numberToIndonesianWords(sequenceNumber));
        }
    };

    // Submit manual text field scan handler
    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualInput.trim()) return;
        processBarcode(manualInput);
        setManualInput('');
    };

    // Dynamically load camera scanner (html5-qrcode)
    useEffect(() => {
        if (!isCameraActive) {
            if (html5QrCodeRef.current) {
                if (html5QrCodeRef.current.isScanning) {
                    html5QrCodeRef.current.stop().then(() => {
                        html5QrCodeRef.current.clear();
                    }).catch((err: any) => console.error(err));
                }
            }
            return;
        }

        setScannerError('');
        let qrCodeScanner: any = null;

        import('html5-qrcode').then((module) => {
            const Html5QrcodeClass = module.Html5Qrcode;
            qrCodeScanner = new Html5QrcodeClass("dhs-camera-reader");
            html5QrCodeRef.current = qrCodeScanner;

            const config = {
                fps: 10,
                qrbox: (width: number, height: number) => {
                    const size = Math.min(width, height) * 0.7;
                    return { width: size, height: size };
                }
            };

            qrCodeScanner.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    processBarcodeRef.current(decodedText);
                },
                () => {
                    // Ignore verbose scanner noise
                }
            ).catch((err: any) => {
                console.error(err);
                setScannerError("Gagal menyalakan kamera. Pastikan izin kamera aktif.");
                setIsCameraActive(false);
            });
        }).catch(err => {
            console.error(err);
            setScannerError("Gagal memuat modul kamera.");
            setIsCameraActive(false);
        });

        return () => {
            if (qrCodeScanner && qrCodeScanner.isScanning) {
                qrCodeScanner.stop().catch((e: any) => console.error(e));
            }
        };
    }, [isCameraActive]);

    // Calculate progress stats
    const totalTarget = manifest.length;
    const totalScanned = manifest.filter(i => i.status === 'scanned').length;
    const totalPending = manifest.filter(i => i.status === 'pending').length;
    const totalExtra = extraScans.length;
    const scanPercentage = totalTarget > 0 ? Math.round((totalScanned / totalTarget) * 100) : 0;

    // Complete session, save to history, and clear active session
    const handleFinishSession = () => {
        if (confirm("Selesaikan sesi pemindaian dan buat laporan?")) {
            setIsCameraActive(false);

            // Create history item
            const dateObj = new Date();
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            let updatedHistory = [...history];

            if (currentSessionId) {
                // Edit existing session
                const existingIdx = history.findIndex(item => item.id === currentSessionId);
                if (existingIdx !== -1) {
                    updatedHistory[existingIdx] = {
                        ...history[existingIdx],
                        sessionType,
                        driverName,
                        noPolisi,
                        totalTarget,
                        totalScanned,
                        totalExtra,
                        scanPercentage,
                        manifest,
                        extraScans,
                        isNoManifestMode
                    };
                } else {
                    // Fallback
                    const newHistoryItem: HistoryItem = {
                        id: currentSessionId,
                        date: `${dateStr} ${timeStr}`,
                        sessionType,
                        driverName,
                        noPolisi,
                        totalTarget,
                        totalScanned,
                        totalExtra,
                        scanPercentage,
                        manifest,
                        extraScans,
                        isNoManifestMode
                    };
                    updatedHistory = [newHistoryItem, ...updatedHistory];
                }
            } else {
                // Create new history item
                const newHistoryItem: HistoryItem = {
                    id: `history-${Date.now()}`,
                    date: `${dateStr} ${timeStr}`,
                    sessionType,
                    driverName,
                    noPolisi,
                    totalTarget,
                    totalScanned,
                    totalExtra,
                    scanPercentage,
                    manifest,
                    extraScans,
                    isNoManifestMode
                };
                updatedHistory = [newHistoryItem, ...updatedHistory];
            }

            setHistory(updatedHistory);
            localStorage.setItem('cce_scan_history', JSON.stringify(updatedHistory));

            // Clear active session
            localStorage.removeItem('cce_active_scan_session');

            setStep('report');
        }
    };

    // Reset everything and start new session
    const handleNewSession = () => {
        if (confirm("Mulai sesi baru? Semua data scan saat ini akan di-reset.")) {
            setStep('import');
            setRawInput('');
            setManifest([]);
            setExtraScans([]);
            setDriverName('');
            setNoPolisi('');
            setManualInput('');
            setSearchTerm('');
            setIsCameraActive(false);
            setCurrentSessionId(null);
            setScanAlert({ type: 'idle', message: 'Masukkan data manifest baru' });
        }
    };

    // Generate formatted text for WhatsApp sharing
    const generateWhatsAppReport = (item?: any): string => {
        const target = item || {
            sessionType,
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' - Pukul ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            driverName,
            noPolisi,
            totalTarget,
            totalScanned,
            totalExtra,
            scanPercentage,
            manifest,
            extraScans
        };

        const pendingCount = target.totalTarget - target.totalScanned;

        let report = `*LAPORAN SCAN ${target.sessionType} DHS*\n`;
        report += `*CV. CAHAYA CARGO EXPRESS*\n`;
        report += `Tanggal: ${target.date} WIB\n`;
        if (target.driverName) report += `Driver: ${target.driverName.toUpperCase()}\n`;
        if (target.noPolisi) report += `No. Polisi (Plat): ${target.noPolisi.toUpperCase()}\n`;
        report += `-------------------------------------------\n`;
        report += `*RINGKASAN HASIL SCAN*\n`;
        report += `• Total Target (Manifest): *${target.totalTarget} Koli*\n`;
        report += `• Cocok Terverifikasi: *${target.totalScanned} Koli*\n`;
        report += `• Kurang (Belum Scan): *${pendingCount} Koli* ${pendingCount > 0 ? '⚠️' : '✅'}\n`;
        report += `• Lebih (Tidak Terdaftar): *${target.totalExtra} Koli* ${target.totalExtra > 0 ? '⚠️' : '✅'}\n`;
        report += `• Status Selesai: *${target.scanPercentage}%*\n`;
        report += `-------------------------------------------\n`;

        // Special handling kolis stats (Liquid & DG)
        const targetManifest = target.manifest || [];
        const totalLiquid = targetManifest.filter(isLiquidItem).length;
        const scannedLiquid = targetManifest.filter((i: any) => isLiquidItem(i) && i.status === 'scanned').length;
        const totalDg = targetManifest.filter((i: any) => isDgItem(i) && !isLiquidItem(i)).length;
        const scannedDg = targetManifest.filter((i: any) => isDgItem(i) && !isLiquidItem(i) && i.status === 'scanned').length;

        if (totalLiquid > 0 || totalDg > 0) {
            report += `*INFO PENANGANAN KHUSUS*\n`;
            if (totalLiquid > 0) {
                report += `• 💧 Kargo Cairan (Liquid): *${scannedLiquid} / ${totalLiquid} Koli ter-scan*\n`;
            }
            if (totalDg > 0) {
                report += `• ⚠️ Kargo Berbahaya (DG Non-Cair): *${scannedDg} / ${totalDg} Koli ter-scan*\n`;
            }
            report += `-------------------------------------------\n`;
        }

        if (pendingCount > 0) {
            report += `\n*DAFTAR SELISIH KURANG (BELUM DI-SCAN) [${pendingCount}]:*\n`;
            const missingCodes = target.manifest.filter((i: any) => i.status === 'pending');
            missingCodes.forEach((missingItem: any, index: number) => {
                let detail = '';
                if (missingItem.jmlhPaket !== undefined) detail += ` [${missingItem.jmlhPaket} Pkt`;
                if (missingItem.berat !== undefined) detail += detail ? `, ${missingItem.berat} kg` : ` [${missingItem.berat} kg`;
                if (detail) detail += ']';
                const noteStr = missingItem.note ? ` *Catatan: ${missingItem.note}*` : '';
                report += `${index + 1}. ${missingItem.code}${detail}${noteStr}\n`;
            });
        }

        if (target.totalExtra > 0) {
            report += `\n*DAFTAR SELISIH LEBIH (TIDAK ADA DI MANIFEST) [${target.totalExtra}]:*\n`;
            target.extraScans.forEach((extraItem: any, index: number) => {
                const noteStr = extraItem.note ? ` *Catatan: ${extraItem.note}*` : '';
                report += `${index + 1}. ${extraItem.code} (${extraItem.scanTime})${noteStr}\n`;
            });
        }

        const scannedWithNotes = target.manifest.filter((i: any) => i.status === 'scanned' && i.note);
        if (scannedWithNotes.length > 0) {
            report += `\n*CATATAN KOLI COCOK [${scannedWithNotes.length}]:*\n`;
            scannedWithNotes.forEach((scannedItem: any, index: number) => {
                report += `${index + 1}. ${scannedItem.code} - 📝 *${scannedItem.note}*\n`;
            });
        }

        if (pendingCount === 0 && target.totalExtra === 0) {
            report += `\n*STATUS OPERASIONAL: 100% AMAN (TIDAK ADA SELISIH BARANG) ACC.* 💯\n`;
        }

        return report;
    };

    const handleCopyWhatsApp = () => {
        const text = generateWhatsAppReport();
        navigator.clipboard.writeText(text)
            .then(() => alert('Laporan WhatsApp berhasil disalin ke clipboard!'))
            .catch(() => alert('Gagal menyalin laporan.'));
    };

    // Copy WA report directly from history card
    const handleCopyHistoryWA = (item: HistoryItem) => {
        const text = generateWhatsAppReport(item);
        navigator.clipboard.writeText(text)
            .then(() => alert('Laporan riwayat WhatsApp berhasil disalin!'))
            .catch(() => alert('Gagal menyalin laporan.'));
    };

    // Load a completed history session for details viewing / printing
    const handleViewHistoryReport = (item: HistoryItem) => {
        setCurrentSessionId(item.id);
        setSessionType(item.sessionType);
        setDriverName(item.driverName || '');
        setNoPolisi(item.noPolisi || '');
        setManifest(item.manifest);
        setExtraScans(item.extraScans || []);
        setIsNoManifestMode(!!item.isNoManifestMode);
        setStep('report');
    };

    // Edit/Resume session scanning from details view
    const handleEditSession = () => {
        setStep('scan');
        setScanAlert({ type: 'idle', message: 'Melanjutkan pemindaian sesi ini.' });
        warmupAudio();
    };

    // Edit/Resume session scanning directly from history list
    const handleEditHistorySession = (item: HistoryItem) => {
        setCurrentSessionId(item.id);
        setSessionType(item.sessionType);
        setDriverName(item.driverName || '');
        setNoPolisi(item.noPolisi || '');
        setManifest(item.manifest);
        setExtraScans(item.extraScans || []);
        setIsNoManifestMode(!!item.isNoManifestMode);
        setStep('scan');
        setScanAlert({ type: 'idle', message: 'Melanjutkan pemindaian sesi ini.' });
        warmupAudio();
    };

    // Inline item editing helper functions
    const handleStartEditItem = (item: ManifestItem) => {
        setEditingItemId(item.id);
        setEditCode(item.code);
        setEditJmlh(item.jmlhPaket !== undefined ? item.jmlhPaket.toString() : '');
        setEditBerat(item.berat !== undefined ? item.berat.toString() : '');
        setEditToType(item.toType || '');
        setEditDgType(item.dgType || '');
    };

    const handleCancelEditItem = () => {
        setEditingItemId(null);
    };

    const handleSaveEditItem = (itemId: string) => {
        if (!editCode.trim()) {
            alert('Nomor TO tidak boleh kosong!');
            return;
        }

        const updated = manifest.map(item => {
            if (item.id === itemId) {
                const jmlh = editJmlh.trim() ? parseInt(editJmlh, 10) : undefined;
                const berat = editBerat.trim() ? parseFloat(editBerat.replace(/,/g, '.')) : undefined;
                return {
                    ...item,
                    code: editCode.trim().toUpperCase(),
                    jmlhPaket: (jmlh !== undefined && !isNaN(jmlh)) ? jmlh : undefined,
                    berat: (berat !== undefined && !isNaN(berat)) ? berat : undefined,
                    toType: editToType.trim() || undefined,
                    dgType: editDgType.trim() || undefined
                };
            }
            return item;
        });

        setManifest(updated);
        setEditingItemId(null);
        setScanAlert({
            type: 'success',
            message: `Data TO berhasil diperbarui: ${editCode.trim().toUpperCase()}`
        });
    };

    const handleDeleteExtraScan = (id: string, code: string) => {
        if (confirm(`Hapus koli selisih lebih: ${code} dari daftar?`)) {
            const updated = extraScans.filter(item => item.id !== id);
            setExtraScans(updated);
            setScanAlert({
                type: 'success',
                message: `Berhasil menghapus koli selisih lebih: ${code}`
            });
        }
    };

    const handleDeleteManifestItem = (id: string, code: string) => {
        if (confirm(`Hapus koli manifest: ${code} dari daftar manifest? Tindakan ini tidak dapat dibatalkan.`)) {
            const updated = manifest.filter(item => item.id !== id);
            setManifest(updated);
            if (editingItemId === id) {
                setEditingItemId(null);
            }
            setScanAlert({
                type: 'success',
                message: `Berhasil menghapus koli manifest: ${code}`
            });
        }
    };

    const handleDeleteAllPending = () => {
        const pendingCount = manifest.filter(item => item.status === 'pending').length;
        if (pendingCount === 0) return;

        if (confirm(`Apakah Anda yakin ingin menghapus SEMUA koli pending (${pendingCount} koli) dari manifest? Tindakan ini tidak dapat dibatalkan.`)) {
            const updated = manifest.filter(item => item.status !== 'pending');
            setManifest(updated);
            setEditingItemId(null);
            setScanAlert({
                type: 'success',
                message: `Berhasil menghapus seluruh koli pending (${pendingCount} koli)`
            });
        }
    };

    const handleTranslateSpeech = async (langName: string, langCode: string) => {
        if (langCode === 'id') {
            setTranslatedSpeech(null);
            setSelectedLanguage('id');
            return;
        }

        setIsTranslating(true);
        try {
            const res = await translateVoiceAlerts(langName);
            if (res.error) {
                alert(`Gagal menerjemahkan: ${res.error}`);
            } else if (res.success && res.data) {
                setTranslatedSpeech(res.data);
                setSelectedLanguage(langCode);
                
                // Override default texts if translated warnings exist
                if (res.data.warnings) {
                    if (res.data.warnings.salah) setWrongScanText(res.data.warnings.salah);
                    if (res.data.warnings.duplikat) setDuplicateText(res.data.warnings.duplikat);
                    if (res.data.warnings.dobel) setDoubleScanText(res.data.warnings.dobel);
                }
                
                alert(`Teks suara berhasil diterjemahkan ke ${langName} menggunakan Gemini!`);
            }
        } catch (e: any) {
            console.error('Translation error:', e);
            alert(`Terjadi kesalahan saat menghubungi Gemini: ${e?.message || e}`);
        } finally {
            setIsTranslating(false);
        }
    };

    // Delete a specific history log item
    const handleDeleteHistoryItem = (id: string) => {
        if (confirm("Hapus item riwayat ini?")) {
            const updated = history.filter(item => item.id !== id);
            setHistory(updated);
            localStorage.setItem('cce_scan_history', JSON.stringify(updated));
        }
    };

    // Clear all history log items
    const handleClearAllHistory = () => {
        if (confirm("Hapus semua riwayat sesi pemindaian? Tindakan ini tidak dapat dibatalkan.")) {
            setHistory([]);
            localStorage.removeItem('cce_scan_history');
        }
    };

    // Helper to extract the last scan time from the scanTime string
    const getLastScanTime = (scanTimeStr?: string): string => {
        if (!scanTimeStr) return '';
        const parts = scanTimeStr.split(',');
        const lastPart = parts[parts.length - 1].trim();
        const match = lastPart.match(/\d{2}:\d{2}:\d{2}/);
        return match ? match[0] : lastPart;
    };

    // Filter and sort items to display in the realtime manifest panel
    const getFilteredAndSortedItems = () => {
        const search = searchTerm.toLowerCase().trim();

        // 1. Get manifest items matching search
        const filteredManifest = manifest.map((item, idx) => ({
            ...item,
            originalIndex: idx
        })).filter(item => 
            item.code.toLowerCase().includes(search)
        );

        // 2. Get extra scans matching search
        const filteredExtras = extraScans.map(item => ({
            id: item.id,
            code: item.code,
            status: 'extra' as const,
            scanTime: item.scanTime,
            note: item.note,
            originalIndex: -1
        })).filter(item => 
            item.code.toLowerCase().includes(search)
        );

        if (activeFilterTab === 'liquid') {
            return filteredManifest.filter(isLiquidItem).sort((a, b) => {
                if (a.status === 'scanned' && b.status === 'pending') return -1;
                if (a.status === 'pending' && b.status === 'scanned') return 1;
                if (a.status === 'scanned' && b.status === 'scanned') {
                    const timeA = getLastScanTime(a.scanTime);
                    const timeB = getLastScanTime(b.scanTime);
                    return timeB.localeCompare(timeA);
                }
                return 0;
            });
        } else if (activeFilterTab === 'dg') {
            return filteredManifest.filter(item => isDgItem(item) && !isLiquidItem(item)).sort((a, b) => {
                if (a.status === 'scanned' && b.status === 'pending') return -1;
                if (a.status === 'pending' && b.status === 'scanned') return 1;
                if (a.status === 'scanned' && b.status === 'scanned') {
                    const timeA = getLastScanTime(a.scanTime);
                    const timeB = getLastScanTime(b.scanTime);
                    return timeB.localeCompare(timeA);
                }
                return 0;
            });
        } else if (activeFilterTab === 'pending') {
            return filteredManifest.filter(item => item.status === 'pending');
        } else if (activeFilterTab === 'scanned') {
            return filteredManifest.filter(item => item.status === 'scanned').sort((a, b) => {
                const timeA = getLastScanTime(a.scanTime);
                const timeB = getLastScanTime(b.scanTime);
                return timeB.localeCompare(timeA);
            });
        } else if (activeFilterTab === 'extra') {
            return filteredExtras.sort((a, b) => {
                const timeA = getLastScanTime(a.scanTime);
                const timeB = getLastScanTime(b.scanTime);
                return timeB.localeCompare(timeA);
            });
        }

        // 'all' tab: Scanned on top (newest first), then Pending, then Extra scans at the bottom
        const scannedItems = filteredManifest.filter(item => item.status === 'scanned').sort((a, b) => {
            const timeA = getLastScanTime(a.scanTime);
            const timeB = getLastScanTime(b.scanTime);
            return timeB.localeCompare(timeA);
        });

        const pendingItems = filteredManifest.filter(item => item.status === 'pending');

        return [...scannedItems, ...pendingItems, ...filteredExtras];
    };

    const displayItems = getFilteredAndSortedItems() as {
        id: string;
        code: string;
        status: 'pending' | 'scanned' | 'extra';
        scanTime?: string;
        jmlhPaket?: number;
        berat?: number;
        toType?: string;
        dgType?: string;
        tujuan?: string;
        note?: string;
        originalIndex: number;
    }[];

    // Sync refs on every render to prevent stale closures in camera/event callbacks
    processBarcodeRef.current = processBarcode;
    geminiAudioCacheRef.current = geminiAudioCache;
    soundEnabledRef.current = soundEnabled;
    speechRateRef.current = speechRate;
    selectedVoiceNameRef.current = selectedVoiceName;
    selectedLanguageRef.current = selectedLanguage;
    isNoManifestModeRef.current = isNoManifestMode;

    const displayItemsToRender = displayItems.slice(0, 50);

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">

            {/* Active Session Recovery Modal popup */}
            {showRecoveryModal && pendingRecovery && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm no-print">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-blue-400">
                            <Barcode size={32} />
                            <h3 className="text-lg font-bold">Sesi Pemindaian Ditemukan</h3>
                        </div>
                        <div className="text-sm text-slate-300 space-y-2">
                            <p>Sistem mendeteksi adanya sesi pemindaian yang belum selesai di browser ini:</p>
                            <ul className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-semibold text-xs font-mono">
                                <li>Tipe Sesi: <span className="text-white">{pendingRecovery.sessionType}</span></li>
                                <li>Driver: <span className="text-white">{pendingRecovery.driverName || '-'}</span></li>
                                <li>Plat Truk: <span className="text-white">{pendingRecovery.noPolisi || '-'}</span></li>
                                <li>Progress: <span className="text-emerald-400">{pendingRecovery.manifest.filter((i: any) => i.status === 'scanned').length} / {pendingRecovery.manifest.length} Koli</span></li>
                            </ul>
                            <p className="text-xs text-slate-400">Apakah Anda ingin melanjutkan sesi ini atau memulai sesi baru?</p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleConfirmRecovery}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
                            >
                                Lanjutkan Sesi
                            </button>
                            <button
                                onClick={handleDiscardRecovery}
                                className="flex-1 bg-slate-800 hover:bg-red-950/40 border border-slate-700 hover:border-red-900/40 text-slate-300 hover:text-red-400 font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
                            >
                                Mulai Baru
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Nav Header */}
            <header className="bg-slate-950 border-b border-slate-800 py-4 px-6 flex justify-between items-center shadow-lg sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <Barcode size={24} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Scan Barcode DHS</h1>
                        <p className="text-xs text-slate-400">CV. Cahaya Cargo Express • v1.1</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            warmupAudio();
                            setTimeout(() => {
                                playBeep(880, 0.12, true);
                                speakText(translatedSpeech?.numbers["1"] || "Satu");
                            }, 100);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-blue-500"
                        title="Tes Suara Bip & TTS"
                    >
                        <Volume2 size={18} />
                        <span className="text-sm font-semibold">Tes Suara</span>
                    </button>
                    <button
                        onClick={() => {
                            const newSoundEnabled = !soundEnabled;
                            setSoundEnabled(newSoundEnabled);
                            if (newSoundEnabled) {
                                warmupAudio();
                            }
                        }}
                        className={`p-2.5 rounded-xl border transition-all ${soundEnabled ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-red-950/20 text-red-400 border-red-900/30'}`}
                        title={soundEnabled ? 'Matikan Suara Bip' : 'Aktifkan Suara Bip'}
                    >
                        {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>
                    <Link href="/">
                        <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 p-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                            <ArrowLeft size={18} />
                            <span className="hidden md:inline text-sm font-semibold">Beranda</span>
                        </button>
                    </Link>
                </div>
            </header>

            {/* Step Wizard Container */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">

                {/* 1. IMPORT DATA MANIFEST STEP */}
                {step === 'import' && (
                    <>
                        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-blue-400">
                                    1. Input Manifest DHS
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Tempelkan (paste) data manifes TO atau unggah file text laporan dari DHS untuk memuat daftar target scan.
                                </p>
                            </div>

                            {/* Session details */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mode Pemindaian</label>
                                    <div className="grid grid-cols-2 bg-slate-800 p-1 rounded-xl">
                                        <button
                                            onClick={() => setIsNoManifestMode(false)}
                                            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${!isNoManifestMode ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Manifes
                                        </button>
                                        <button
                                            onClick={() => setIsNoManifestMode(true)}
                                            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${isNoManifestMode ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Bebas (DG)
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipe Sesi</label>
                                    <div className="grid grid-cols-2 bg-slate-800 p-1 rounded-xl">
                                        <button
                                            onClick={() => setSessionType('BONGKAR')}
                                            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${sessionType === 'BONGKAR' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Bongkar
                                        </button>
                                        <button
                                            onClick={() => setSessionType('MUAT')}
                                            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${sessionType === 'MUAT' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Muat
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Driver</label>
                                    <input
                                        type="text"
                                        placeholder="Nama Driver (Opsional)"
                                        value={driverName}
                                        onChange={(e) => setDriverName(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">No. Polisi / Plat Kendaraan</label>
                                    <input
                                        type="text"
                                        placeholder="Plat Nomor Truk (Opsional)"
                                        value={noPolisi}
                                        onChange={(e) => setNoPolisi(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {!isNoManifestMode ? (
                                <>
                                    {/* File Upload / Paste Box */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-semibold text-slate-300">Tempelkan Data Manifes TO:</label>
                                            <button
                                                onClick={handleLoadSample}
                                                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 bg-blue-950/30 px-3 py-1.5 rounded-lg border border-blue-900/50 hover:border-blue-800 transition-all"
                                            >
                                                <RefreshCcw size={12} /> Gunakan Contoh Data TO
                                            </button>
                                        </div>
                                        <textarea
                                            rows={8}
                                            placeholder="Tempelkan data TO/resi di sini (sistem akan otomatis membaca kode seperti TO202605293D9ZG dari baris mana pun)..."
                                            value={rawInput}
                                            onChange={(e) => setRawInput(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-600 rounded-2xl p-4 text-sm font-mono text-white placeholder-slate-600 outline-none transition-all"
                                        />
                                    </div>

                                    <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors relative group">
                                        <input
                                            type="file"
                                            multiple={true}
                                            accept=".txt,.csv"
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-400 transition-colors">
                                            <Upload size={32} />
                                            <p className="text-sm font-semibold">Tarik &amp; lepas satu atau beberapa file teks (.txt / .csv) di sini</p>
                                            <p className="text-xs text-slate-500">Atau klik untuk memilih file-file dari penyimpanan Anda</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-purple-950/20 border border-purple-900/30 rounded-2xl p-8 text-center space-y-3">
                                    <div className="inline-flex p-3 bg-purple-900/30 text-purple-400 rounded-2xl">
                                        <Volume2 size={32} className="animate-pulse" />
                                    </div>
                                    <h3 className="font-bold text-lg text-purple-300">Mode Scan Bebas Aktif</h3>
                                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                                        Anda tidak perlu mengimpor data manifest. Semua kode resi yang di-scan akan langsung dicatat sebagai barang masuk dan dihitung urutan suaranya.
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                <button
                                    onClick={isNoManifestMode ? handleStartNoManifestSession : handleParseManifest}
                                    className={`font-bold py-3.5 px-8 rounded-xl shadow-lg flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all text-white ${
                                        isNoManifestMode
                                            ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/20'
                                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20'
                                    }`}
                                >
                                    <Play size={18} />
                                    {isNoManifestMode ? 'Mulai Sesi Scan Bebas' : 'Mulai Sesi Pemindaian'}
                                </button>
                            </div>
                        </div>

                        {/* 1b. SESSION HISTORY ARCHIVE */}
                        {history.length > 0 && (
                            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                                <h3 className="font-bold text-base text-slate-300 flex justify-between items-center">
                                    <span>Riwayat Sesi Pemindaian ({history.length})</span>
                                    <button
                                        onClick={handleClearAllHistory}
                                        className="text-xs text-red-400 hover:text-red-350 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Hapus Semua Riwayat
                                    </button>
                                </h3>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {history.map((item) => (
                                        <div
                                            key={item.id}
                                            className="bg-slate-900/40 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.sessionType === 'BONGKAR' ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40' : 'bg-purple-900/40 text-purple-400 border border-purple-800/40'}`}>
                                                        {item.sessionType}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">{item.date}</span>
                                                </div>
                                                <p className="text-sm font-bold text-white leading-none mt-1">
                                                    Truk {item.noPolisi || '-'} • Driver: {item.driverName || '-'}
                                                </p>
                                                <div className="flex gap-4 text-xs text-slate-400 pt-0.5">
                                                    {item.isNoManifestMode ? (
                                                        <>
                                                            <span className="text-purple-400 font-semibold font-sans">Scan Bebas (Tanpa Manifes)</span>
                                                            <span>Total Scan: <strong className="text-emerald-400">{item.totalScanned} Koli</strong></span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Target: <strong>{item.totalTarget} Koli</strong></span>
                                                            <span>Cocok: <strong className="text-emerald-400">{item.totalScanned} Koli</strong></span>
                                                            {item.totalTarget - item.totalScanned > 0 && (
                                                                <span className="text-red-400">Kurang: <strong>{item.totalTarget - item.totalScanned}</strong></span>
                                                            )}
                                                            {item.totalExtra > 0 && (
                                                                <span className="text-yellow-400">Lebih: <strong>{item.totalExtra}</strong></span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 self-start md:self-center">
                                                <button
                                                    onClick={() => handleViewHistoryReport(item)}
                                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-3 rounded-lg border border-slate-700 transition-colors"
                                                >
                                                    Lihat Laporan
                                                </button>
                                                <button
                                                    onClick={() => handleEditHistorySession(item)}
                                                    className="bg-yellow-650/20 hover:bg-yellow-650/30 text-yellow-400 text-xs font-bold py-2 px-3 rounded-lg border border-yellow-800/30 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleCopyHistoryWA(item)}
                                                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold py-2 px-3 rounded-lg border border-emerald-800/30 transition-colors"
                                                >
                                                    Salin WA
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteHistoryItem(item.id)}
                                                    className="text-red-400 hover:text-red-300 p-2 hover:bg-red-950/20 rounded-lg border border-transparent hover:border-red-900/20 transition-all"
                                                    title="Hapus Riwayat"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* 2. SCANNING & MATCHING IN PROGRESS STEP */}
                {step === 'scan' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                        {/* LEFT PANEL: SCAN INPUTS & NOTIFICATIONS */}
                        <div className="lg:col-span-7 space-y-6">

                            {/* Audio Error Alert Box */}
                            {audioSystemError && (
                                <div className="border border-red-950 border-red-900/50 bg-red-950/20 text-red-400 rounded-2xl p-4 flex items-start gap-3 shadow-lg">
                                    <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-semibold">Masalah Audio Terdeteksi</p>
                                        <p className="text-xs text-red-300/80 leading-relaxed">
                                            {audioSystemError}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAudioSystemError('');
                                                warmupAudio();
                                            }}
                                            className="text-xs font-bold underline hover:text-red-200 block pt-1"
                                        >
                                            Coba Aktifkan Kembali Audio
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Flash Alert Box */}
                            <div className={`border rounded-3xl p-6 shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col items-center text-center gap-3 ${flashEffect === 'green' ? 'bg-emerald-950/90 border-emerald-500 scale-[1.01] shadow-emerald-950/30' :
                                    flashEffect === 'yellow' ? 'bg-yellow-950/90 border-yellow-500 scale-[1.01] shadow-yellow-950/30' :
                                        flashEffect === 'red' ? 'bg-red-950/90 border-red-500 scale-[1.01] shadow-red-950/30' :
                                            'bg-slate-950 border-slate-800'
                                }`}>
                                {/* Icon display — larger */}
                                {scanAlert.type === 'success' && <CheckCircle className="text-emerald-400 animate-bounce" size={64} />}
                                {scanAlert.type === 'duplicate' && <AlertTriangle className="text-yellow-400 animate-pulse" size={64} />}
                                {scanAlert.type === 'error' && <AlertCircle className="text-red-400 animate-shake" size={64} />}
                                {scanAlert.type === 'idle' && <Barcode className="text-blue-500" size={56} />}

                                <div>
                                    <p className={`text-sm font-extrabold uppercase tracking-[4px] ${scanAlert.type === 'success' ? 'text-emerald-400' :
                                            scanAlert.type === 'duplicate' ? 'text-yellow-400' :
                                                scanAlert.type === 'error' ? 'text-red-400' :
                                                    'text-blue-400'
                                        }`}>
                                        {scanAlert.type === 'success' ? '✅ COCOK' :
                                            scanAlert.type === 'duplicate' ? '⚠️ DUPLIKAT' :
                                                scanAlert.type === 'error' ? '❌ SELISIH LEBIH' :
                                                    'STATUS'}
                                    </p>
                                    <h3 className="text-lg md:text-xl font-bold text-white mt-1">
                                        {scanAlert.message}
                                    </h3>
                                    {scanAlert.code && (
                                        <p className="mt-2 font-mono text-3xl font-black bg-slate-900 border border-slate-800 px-5 py-2 rounded-xl inline-block text-white shadow-inner tracking-wider">
                                            {scanAlert.code}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Scanning options */}
                            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                                <h3 className="font-bold text-sm text-slate-300">Metode Pemindaian</h3>

                                {/* Form for hardware scan input (types text and hits Enter) */}
                                <form onSubmit={handleManualSubmit} className="space-y-3">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scanner Laser / Input Kode</span>
                                        <div className="relative">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                placeholder="Arahkan laser scanner ke barcode..."
                                                value={manualInput}
                                                onChange={(e) => setManualInput(e.target.value)}
                                                onBlur={handleBlur}
                                                className="w-full bg-slate-900 border-2 border-slate-800 focus:border-blue-600 rounded-2xl pl-4 pr-24 py-3.5 text-base font-mono outline-none text-white transition-all shadow-inner"
                                            />
                                            <button
                                                type="submit"
                                                className="absolute right-2.5 top-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs transition-colors"
                                            >
                                                Submit
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                        <Info size={12} /> Laser scanner secara otomatis men-submit input saat barcode terbaca. Pastikan kolom di atas tetap terfokus.
                                    </p>
                                </form>

                                {/* Camera Scanner toggle */}
                                <div className="pt-2">
                                    <button
                                        onClick={() => {
                                            const newCameraActive = !isCameraActive;
                                            setIsCameraActive(newCameraActive);
                                            if (newCameraActive) {
                                                warmupAudio();
                                            }
                                        }}
                                        className={`w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 border transition-all ${isCameraActive
                                                ? 'bg-red-950/20 border-red-900/30 text-red-400 hover:bg-red-950/40'
                                                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                            }`}
                                    >
                                        <Camera size={18} />
                                        {isCameraActive ? 'Matikan Kamera Scanner' : 'Nyalakan Kamera Scanner'}
                                    </button>

                                    {/* Camera Stream Container */}
                                    {isCameraActive && (
                                        <div className="mt-4 border border-slate-800 bg-black rounded-2xl overflow-hidden relative aspect-video flex items-center justify-center">
                                            <div id="dhs-camera-reader" className="w-full h-full max-w-sm"></div>
                                            {scannerError && (
                                                <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center p-4 text-center text-red-300 gap-2">
                                                    <AlertCircle size={32} />
                                                    <p className="text-sm font-semibold">{scannerError}</p>
                                                    <button onClick={() => setIsCameraActive(false)} className="bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold text-white">Tutup</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* COLLAPSIBLE AUDIO SETTINGS PANEL */}
                            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAudioSettings(!showAudioSettings)}
                                    className="w-full flex items-center justify-between text-sm font-bold text-slate-350 hover:text-white transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Volume2 size={16} className="text-blue-400" />
                                        <span>Pengaturan Audio &amp; Suara</span>
                                    </div>
                                    <span className="text-xs text-slate-500 font-normal">
                                        {showAudioSettings ? 'Sembunyikan' : 'Tampilkan'}
                                    </span>
                                </button>

                                {showAudioSettings && (
                                    <div className="pt-3 border-t border-slate-800 space-y-4 text-xs">
                                        {/* Sound Profile Selector */}
                                        <div className="space-y-2">
                                            <span className="font-semibold text-slate-400 block">Profil Suara</span>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(Object.keys(SOUND_PROFILES) as Exclude<SoundProfileKey, 'custom'>[]).map((key) => {
                                                    const p = SOUND_PROFILES[key];
                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => applySoundProfile(key)}
                                                            className={`p-2 rounded-xl border text-center transition-all ${soundProfile === key
                                                                ? 'bg-blue-950/40 border-blue-600 text-blue-400 ring-1 ring-blue-600/30'
                                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                                            }`}
                                                        >
                                                            <span className="text-lg block">{p.icon}</span>
                                                            <span className="text-[10px] font-bold block mt-0.5">{p.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {soundProfile === 'custom' && (
                                                <p className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                                                    ⚙️ Profil Custom — Anda mengatur setting secara manual
                                                </p>
                                            )}
                                        </div>

                                        {/* Speech Rate Control */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between font-semibold text-slate-400">
                                                <span>Kecepatan Suara (TTS Rate)</span>
                                                <span className="text-blue-400 font-mono font-bold">{speechRate.toFixed(2)}x</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="2.0"
                                                step="0.1"
                                                value={speechRate}
                                                onChange={(e) => { setSpeechRate(parseFloat(e.target.value)); setSoundProfile('custom'); }}
                                                className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>

                                        {/* Beep Volume Control */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between font-semibold text-slate-400">
                                                <span>Volume Beep</span>
                                                <span className="text-blue-400 font-mono font-bold">{Math.round(beepVolume * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.01"
                                                max="0.3"
                                                step="0.01"
                                                value={beepVolume}
                                                onChange={(e) => { setBeepVolume(parseFloat(e.target.value)); setSoundProfile('custom'); }}
                                                className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>

                                        {/* Gemini Translation Selector */}
                                        <div className="space-y-2 pt-2 border-t border-slate-800">
                                            <div className="flex items-center gap-1.5 font-semibold text-slate-400">
                                                <Headphones size={14} className="text-amber-400" />
                                                <span>Bahasa Suara (Gemini AI)</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[
                                                    { code: 'id', name: 'Bahasa Indonesia', label: '🇮🇩 Indonesia' },
                                                    { code: 'en', name: 'English (US)', label: '🇺🇸 English' },
                                                    { code: 'jv', name: 'Jawa', label: '🇮🇩 Jawa' },
                                                    { code: 'bug', name: 'Bugis', label: '🇮🇩 Bugis' },
                                                    { code: 'mk', name: 'Makassar', label: '🇮🇩 Makassar' },
                                                    { code: 'su', name: 'Sunda', label: '🇮🇩 Sunda' },
                                                    { code: 'mad', name: 'Madura', label: '🇮🇩 Madura' },
                                                    { code: 'jp', name: 'Japanese', label: '🇯🇵 Japanese' },
                                                    { code: 'cn', name: 'Mandarin Chinese', label: '🇨🇳 Mandarin' },
                                                    { code: 'ar', name: 'Arabic', label: '🇸🇦 Arabic' }
                                                ].map((lang) => (
                                                    <button
                                                        key={lang.code}
                                                        type="button"
                                                        disabled={isTranslating}
                                                        onClick={() => handleTranslateSpeech(lang.name, lang.code)}
                                                        className={`py-1.5 rounded-lg border text-center transition-all text-[10px] font-bold ${
                                                            selectedLanguage === lang.code
                                                                ? 'bg-amber-950/40 border-amber-500 text-amber-400 ring-1 ring-amber-500/30'
                                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                                        } ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {lang.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {isTranslating && (
                                                <p className="text-[10px] text-amber-400 animate-pulse font-medium">
                                                    ⏳ Menghubungi Gemini AI untuk menerjemahkan prompts suara...
                                                </p>
                                            )}
                                            {selectedLanguage !== 'id' && !isTranslating && (
                                                <p className="text-[10px] text-emerald-400 font-medium">
                                                    ✨ Terjemahan Aktif: Prompts suara telah dialihkan ke {selectedLanguage.toUpperCase()}!
                                                </p>
                                            )}
                                        </div>

                                        {/* Device Voice Model Selector */}
                                        {availableVoices.length > 0 && (
                                            <div className="space-y-1.5 pt-2 border-t border-slate-800">
                                                <label className="font-semibold text-slate-400 block">Model Suara Perangkat (Device TTS Voice)</label>
                                                <select
                                                    value={selectedVoiceName}
                                                    onChange={(e) => setSelectedVoiceName(e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-2.5 py-2 text-[10px] font-bold outline-none focus:border-blue-600 transition-all cursor-pointer"
                                                >
                                                    <option value="">-- Suara Default Sistem / Otomatis --</option>
                                                    {availableVoices.map((voice) => (
                                                        <option key={voice.name} value={voice.name}>
                                                            {voice.name} ({voice.lang}) {voice.localService ? '• Lokal' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-[9px] text-slate-500 leading-normal">
                                                    💡 Pilih model suara berkualitas tinggi (seperti <strong>Google Bahasa Indonesia</strong> atau <strong>Microsoft Natural Voice</strong>) untuk pelafalan yang tidak terdengar seperti robot.
                                                </p>
                                            </div>
                                        )}

                                        {/* Gemini AI Premium Voice */}
                                        <div className="space-y-2 pt-3 border-t border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <label className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 block">
                                                    ✨ Gemini AI TTS Voice (Premium)
                                                </label>
                                                {Object.keys(geminiAudioCache).length > 0 && (
                                                    <span className="text-[9px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                                        {Object.keys(geminiAudioCache).length} clips cached
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-slate-500 leading-normal">
                                                🎙️ Suara AI premium dari Gemini — terdengar seperti manusia, bukan robot. Pilih model suara, lalu klik Generate.
                                            </p>
                                            <select
                                                value={geminiVoiceName}
                                                onChange={(e) => {
                                                    setGeminiVoiceName(e.target.value);
                                                    if (typeof window !== 'undefined') {
                                                        localStorage.setItem('dhs_gemini_voice_name', e.target.value);
                                                    }
                                                }}
                                                className="w-full bg-slate-900 border border-purple-800/50 text-white rounded-xl px-2.5 py-2 text-[10px] font-bold outline-none focus:border-purple-500 transition-all cursor-pointer"
                                            >
                                                <option value="">-- Pilih Model Suara Gemini --</option>
                                                {[
                                                    { name: 'Kore', desc: 'Tegas' }, { name: 'Puck', desc: 'Ceria' },
                                                    { name: 'Zephyr', desc: 'Cerah' }, { name: 'Aoede', desc: 'Santai' },
                                                    { name: 'Charon', desc: 'Informatif' }, { name: 'Achernar', desc: 'Lembut' },
                                                    { name: 'Achird', desc: 'Ramah' }, { name: 'Algenib', desc: 'Berat' },
                                                    { name: 'Algieba', desc: 'Halus' }, { name: 'Alnilam', desc: 'Tegas' },
                                                    { name: 'Autonoe', desc: 'Cerah' }, { name: 'Callirrhoe', desc: 'Santai' },
                                                    { name: 'Despina', desc: 'Halus' }, { name: 'Enceladus', desc: 'Berbisik' },
                                                    { name: 'Erinome', desc: 'Jernih' }, { name: 'Fenrir', desc: 'Bersemangat' },
                                                    { name: 'Gacrux', desc: 'Dewasa' }, { name: 'Iapetus', desc: 'Jernih' },
                                                    { name: 'Laomedeia', desc: 'Ceria' }, { name: 'Leda', desc: 'Muda' },
                                                    { name: 'Orus', desc: 'Tegas' }, { name: 'Pulcherrima', desc: 'Maju' },
                                                    { name: 'Rasalgethi', desc: 'Informatif' }, { name: 'Sadachbia', desc: 'Hidup' },
                                                    { name: 'Sadaltager', desc: 'Berpengalaman' }, { name: 'Schedar', desc: 'Rata' },
                                                    { name: 'Sulafat', desc: 'Hangat' }, { name: 'Umbriel', desc: 'Santai' },
                                                    { name: 'Vindemiatrix', desc: 'Lembut' }, { name: 'Zubenelgenubi', desc: 'Kasual' }
                                                ].map(v => (
                                                    <option key={v.name} value={v.name}>
                                                        {v.name} — {v.desc}
                                                    </option>
                                                ))}
                                            </select>

                                            {/* Generate Button */}
                                            <button
                                                disabled={!geminiVoiceName || isGeneratingAudio}
                                                onClick={async () => {
                                                    if (!geminiVoiceName) return;
                                                    setIsGeneratingAudio(true);
                                                    setAudioGenProgress('Mempersiapkan teks...');
                                                    try {
                                                        // Collect all texts to generate: numbers 1-50 + warning texts
                                                        const allTexts: string[] = [];
                                                        
                                                        // Get translated numbers if available, else generate Indonesian
                                                        if (translatedSpeech && translatedSpeech.numbers) {
                                                            for (let i = 1; i <= 50; i++) {
                                                                allTexts.push(translatedSpeech.numbers[String(i)] || String(i));
                                                            }
                                                        } else {
                                                            for (let i = 1; i <= 50; i++) {
                                                                allTexts.push(String(i));
                                                            }
                                                        }

                                                        // Add warning texts
                                                        const warningTexts = [wrongScanText, duplicateText, doubleScanText].filter(Boolean);
                                                        if (translatedSpeech && translatedSpeech.warnings) {
                                                            Object.values(translatedSpeech.warnings).forEach(w => {
                                                                if (w && !allTexts.includes(w)) allTexts.push(w);
                                                            });
                                                        }
                                                        warningTexts.forEach(w => {
                                                            if (!allTexts.includes(w)) allTexts.push(w);
                                                        });

                                                        // Also add DHS warning texts
                                                        const dhsWarnings = ['Barang Berbahaya', 'Dangerous Goods', 'B3', 'HATI-HATI BARANG BERBAHAYA'];
                                                        dhsWarnings.forEach(w => {
                                                            if (!allTexts.includes(w)) allTexts.push(w);
                                                        });

                                                        setAudioGenProgress(`Generating 0/${allTexts.length} audio clips...`);

                                                        // Process in small batches for progress updates
                                                        const BATCH = 5;
                                                        const newCache: Record<string, { data: string; mimeType: string }> = {};
                                                        let doneCount = 0;
                                                        
                                                        for (let i = 0; i < allTexts.length; i += BATCH) {
                                                            const batch = allTexts.slice(i, i + BATCH);
                                                            const result = await generateAllVoiceClips(batch, geminiVoiceName);
                                                            Object.assign(newCache, result.clips);
                                                            doneCount += batch.length;
                                                            setAudioGenProgress(`Generating ${doneCount}/${allTexts.length} audio clips...`);
                                                        }
                                                        
                                                        setGeminiAudioCache(newCache);
                                                        setAudioGenProgress(`✅ Selesai! ${Object.keys(newCache).length} audio clips tersedia.`);
                                                        
                                                        // Save to localStorage (only voice name, cache is too large)
                                                        if (typeof window !== 'undefined') {
                                                            try {
                                                                // Try to save cache to localStorage (may fail if too large)
                                                                const cacheStr = JSON.stringify(newCache);
                                                                if (cacheStr.length < 4_000_000) { // ~4MB limit
                                                                    localStorage.setItem('dhs_gemini_audio_cache', cacheStr);
                                                                    localStorage.setItem('dhs_gemini_audio_cache_voice', geminiVoiceName);
                                                                }
                                                            } catch { /* cache too large for localStorage, that's ok */ }
                                                        }
                                                    } catch (error: any) {
                                                        setAudioGenProgress(`❌ Error: ${error?.message || error}`);
                                                    } finally {
                                                        setIsGeneratingAudio(false);
                                                    }
                                                }}
                                                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                                                    !geminiVoiceName || isGeneratingAudio
                                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-900/30 active:scale-[0.98]'
                                                }`}
                                            >
                                                {isGeneratingAudio ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                        Generating...
                                                    </span>
                                                ) : (
                                                    `🎙️ Generate Suara AI (Angka 1-50 + Peringatan)`
                                                )}
                                            </button>

                                            {/* Progress */}
                                            {audioGenProgress && (
                                                <p className={`text-[10px] font-medium leading-normal px-1 ${
                                                    audioGenProgress.startsWith('✅') ? 'text-emerald-400' :
                                                    audioGenProgress.startsWith('❌') ? 'text-red-400' :
                                                    'text-purple-400'
                                                }`}>
                                                    {audioGenProgress}
                                                </p>
                                            )}

                                            {/* Clear cache button */}
                                            {Object.keys(geminiAudioCache).length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        setGeminiAudioCache({});
                                                        setAudioGenProgress('');
                                                        if (typeof window !== 'undefined') {
                                                            localStorage.removeItem('dhs_gemini_audio_cache');
                                                            localStorage.removeItem('dhs_gemini_audio_cache_voice');
                                                        }
                                                    }}
                                                    className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 text-[10px] font-bold transition-all"
                                                >
                                                    🗑️ Hapus Cache Audio Gemini
                                                </button>
                                            )}
                                        </div>

                                        {/* Custom Warning Voice Inputs */}
                                        <div className="space-y-3 pt-2 border-t border-slate-800">
                                            <span className="font-semibold text-slate-400 block mb-1">Kustomisasi Teks Peringatan TTS</span>
                                            
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Suara Kode Salah / Lebih</label>
                                                <input
                                                    type="text"
                                                    value={wrongScanText}
                                                    onChange={(e) => setWrongScanText(e.target.value)}
                                                    placeholder="Salah"
                                                    className="bg-slate-900 border border-slate-800 focus:border-blue-600 rounded-xl px-3 py-2 text-white outline-none transition-all font-medium"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Suara Duplikat (Normal)</label>
                                                <input
                                                    type="text"
                                                    value={duplicateText}
                                                    onChange={(e) => setDuplicateText(e.target.value)}
                                                    placeholder="Duplikat"
                                                    className="bg-slate-900 border border-slate-800 focus:border-blue-600 rounded-xl px-3 py-2 text-white outline-none transition-all font-medium"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Suara Duplikat Selisih Lebih</label>
                                                <input
                                                    type="text"
                                                    value={doubleScanText}
                                                    onChange={(e) => setDoubleScanText(e.target.value)}
                                                    placeholder="T O tetap sama"
                                                    className="bg-slate-900 border border-slate-800 focus:border-blue-600 rounded-xl px-3 py-2 text-white outline-none transition-all font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Upload File Tambahan */}
                            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-350">
                                    <Upload size={14} className="text-blue-400" />
                                    <span>Tambahkan File Manifest (.txt / .csv)</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-snug">
                                    Unggah file manifest tambahan untuk digabungkan ke sesi aktif tanpa menghapus data scan saat ini.
                                </p>
                                <div className="relative border border-dashed border-slate-800 hover:border-blue-500/50 rounded-xl p-3 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/80 group">
                                    <input
                                        type="file"
                                        accept=".txt,.csv"
                                        onChange={handleAdditionalFileUpload}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-bold text-slate-450 group-hover:text-blue-450 transition-colors">
                                        Pilih Berkas Manifest Tambahan
                                    </span>
                                </div>
                            </div>

                            {/* Session control buttons */}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleNewSession}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
                                >
                                    <RefreshCcw size={16} />
                                    Reset Sesi
                                </button>
                                <button
                                    onClick={handleFinishSession}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                                >
                                    <CheckCircle size={16} />
                                    Selesaikan Sesi
                                </button>
                            </div>
                        </div>

                        {/* RIGHT PANEL: REALTIME MANIFEST LIST */}
                        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] sticky top-28">

                            {/* Target stats with SVG progress ring */}
                            <div className="flex items-center gap-4">
                                {/* SVG Progress Ring */}
                                <div className="relative flex-shrink-0">
                                    {isNoManifestMode ? (
                                        <div className="w-[80px] h-[80px] bg-purple-950/20 border-4 border-purple-500 rounded-full flex flex-col items-center justify-center">
                                            <span className="text-xl font-black text-purple-400">{totalScanned}</span>
                                            <span className="text-[8px] font-bold text-purple-500 uppercase tracking-wider">Koli</span>
                                        </div>
                                    ) : (
                                        <>
                                            <svg width="80" height="80" viewBox="0 0 80 80" className="transform -rotate-90">
                                                <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="8" />
                                                <circle
                                                    cx="40" cy="40" r="34" fill="none"
                                                    stroke={scanPercentage >= 80 ? '#10b981' : scanPercentage >= 40 ? '#eab308' : '#ef4444'}
                                                    strokeWidth="8"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${2 * Math.PI * 34}`}
                                                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - scanPercentage / 100)}`}
                                                    className="transition-all duration-500"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-lg font-black text-white">{scanPercentage}%</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {/* Stats cards */}
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    {isNoManifestMode ? (
                                        <>
                                            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Cairan (Liquid)</span>
                                                <span className="text-xl font-black text-amber-400">
                                                    {manifest.filter(isLiquidItem).length}
                                                </span>
                                            </div>
                                            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">DG Non-Cair</span>
                                                <span className="text-xl font-black text-red-400">
                                                    {manifest.filter(item => isDgItem(item) && !isLiquidItem(item)).length}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Scanned</span>
                                                <span className="text-xl font-black text-emerald-400">{totalScanned} <span className="text-[10px] font-bold text-slate-500">/ {totalTarget}</span></span>
                                            </div>
                                            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Lebih</span>
                                                <span className={`text-xl font-black ${totalExtra > 0 ? 'text-red-400' : 'text-slate-500'}`}>{totalExtra}</span>
                                            </div>
                                        </>
                                    )}
                                    
                                    {!isNoManifestMode && (
                                        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Pending</span>
                                            <span className={`text-xl font-black ${totalPending > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{totalPending}</span>
                                        </div>
                                    )}
                                    <div className={`bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col ${isNoManifestMode ? 'col-span-2' : ''}`}>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase font-sans">Profil</span>
                                        <span className="text-sm font-bold text-blue-400 mt-0.5">{soundProfile === 'custom' ? '⚙️' : SOUND_PROFILES[soundProfile as Exclude<SoundProfileKey, 'custom'>]?.icon} {soundProfile === 'custom' ? 'Custom' : SOUND_PROFILES[soundProfile as Exclude<SoundProfileKey, 'custom'>]?.label}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Search bar inside the manifest checklist */}
                            <div className="relative mt-2">
                                <span className="absolute left-3.5 top-2.5 text-slate-500">
                                    <Search size={16} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Cari Kode TO / Resi..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-850 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-slate-700 transition-all"
                                />
                            </div>

                            {/* Filter Tabs */}
                            {isNoManifestMode ? (
                                <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-[9px] font-bold mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('all')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        Semua ({manifest.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('liquid')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'liquid' ? 'bg-amber-950/40 text-amber-455 border border-amber-900/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        Liquid ({manifest.filter(isLiquidItem).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('dg')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'dg' ? 'bg-red-950/40 text-red-455 border border-red-900/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                        DG Non-Cair ({manifest.filter(item => isDgItem(item) && !isLiquidItem(item)).length})
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-6 gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-[9px] font-bold mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('all')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        Semua ({manifest.length + extraScans.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('pending')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'pending' ? 'bg-yellow-950/40 text-yellow-455 border border-yellow-900/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                        Pending ({manifest.filter(i => i.status === 'pending').length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('scanned')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'scanned' ? 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        Cocok ({manifest.filter(i => i.status === 'scanned').length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('liquid')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'liquid' ? 'bg-amber-950/40 text-amber-455 border border-amber-900/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        Liquid ({manifest.filter(isLiquidItem).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('dg')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'dg' ? 'bg-red-950/40 text-red-455 border border-red-900/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                        DG Non-Cair ({manifest.filter(item => isDgItem(item) && !isLiquidItem(item)).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilterTab('extra')}
                                        className={`py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${activeFilterTab === 'extra' ? 'bg-slate-800/40 text-slate-300 border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                        Lebih ({extraScans.length})
                                    </button>
                                </div>
                            )}

                            {/* Realtime Target List */}
                            <div className="flex-1 flex flex-col gap-2.5 overflow-hidden mt-1">
                                <h3 className="font-bold text-xs text-slate-300 flex justify-between items-center">
                                    <span>
                                        {activeFilterTab === 'all' && (isNoManifestMode ? `Daftar Hasil Scan (${manifest.length} Koli)` : `Daftar Manifest (${totalTarget} Koli)`)}
                                        {activeFilterTab === 'pending' && `Barang Belum Scan (${manifest.filter(i => i.status === 'pending').length} Koli)`}
                                        {activeFilterTab === 'scanned' && `Barang Sudah Cocok (${manifest.filter(i => i.status === 'scanned').length} Koli)`}
                                        {activeFilterTab === 'liquid' && `Barang Cairan (${manifest.filter(isLiquidItem).length} Koli)`}
                                        {activeFilterTab === 'dg' && `Barang Berbahaya Non-Cair (${manifest.filter(item => isDgItem(item) && !isLiquidItem(item)).length} Koli)`}
                                        {activeFilterTab === 'extra' && `Barang Selisih Lebih (${extraScans.length} Koli)`}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {manifest.filter(i => i.status === 'pending').length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleDeleteAllPending}
                                                className="text-[9px] font-bold bg-red-950/40 text-red-400 border border-red-900/35 hover:bg-red-900 hover:text-white px-2 py-0.5 rounded transition-all shadow-sm"
                                            >
                                                🗑️ Hapus Semua Pending
                                            </button>
                                        )}
                                        {driverName && <span className="text-[10px] font-bold text-blue-400 bg-blue-950/20 px-2 py-0.5 rounded border border-blue-900/50 uppercase">{sessionType} - TRUK {noPolisi || ''}</span>}
                                    </div>
                                </h3>

                                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                                    {displayItems.length === 0 ? (
                                        <div className="text-center py-10 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                                            {activeFilterTab === 'pending' ? (
                                                <>
                                                    <span className="text-2xl animate-bounce">🎉</span>
                                                    <span className="font-bold text-emerald-400">Semua koli sudah ter-scan!</span>
                                                    <span className="text-[10px] text-slate-600">Manifest telah selesai diproses.</span>
                                                </>
                                            ) : activeFilterTab === 'liquid' ? (
                                                <>
                                                    <span className="text-2xl">💧</span>
                                                    <span className="font-semibold text-slate-400">Tidak ada koli Liquid</span>
                                                    <span className="text-[10px] text-slate-600">Sesi pemindaian tidak memiliki kargo cairan.</span>
                                                </>
                                            ) : activeFilterTab === 'dg' ? (
                                                <>
                                                    <span className="text-2xl">⚠️</span>
                                                    <span className="font-semibold text-slate-400">Tidak ada koli Berbahaya (Non-Cair)</span>
                                                    <span className="text-[10px] text-slate-600">Sesi pemindaian tidak memiliki kargo berbahaya non-cair.</span>
                                                </>
                                            ) : activeFilterTab === 'extra' ? (
                                                <>
                                                    <span className="text-2xl">✅</span>
                                                    <span className="font-semibold text-slate-400">Tidak ada koli selisih lebih</span>
                                                </>
                                            ) : activeFilterTab === 'scanned' ? (
                                                <>
                                                    <span className="text-2xl">📦</span>
                                                    <span>Belum ada koli yang di-scan cocok.</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-2xl">🔍</span>
                                                    <span>Tidak ada hasil pencocokan kode TO</span>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {displayItemsToRender.map((item, idx) => {
                                            // Inline Note Editor
                                            if (noteEditingItemId === item.id) {
                                                return (
                                                    <div key={item.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col shadow-xl animate-fade-in">
                                                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                                            <span>CATATAN KOLI:</span>
                                                            <span className="font-mono text-blue-400 font-bold">{item.code}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1 flex-1">
                                                                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Catatan Koli</label>
                                                                <input
                                                                    type="text"
                                                                    value={noteText}
                                                                    onChange={(e) => setNoteText(e.target.value)}
                                                                    placeholder="Tulis catatan..."
                                                                    className="bg-slate-950 border border-slate-850 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-white outline-none w-full transition-all"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div className="space-y-1 w-full">
                                                                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Tujuan / Rute</label>
                                                                <input
                                                                    type="text"
                                                                    value={tujuanText}
                                                                    onChange={(e) => setTujuanText(e.target.value)}
                                                                    placeholder="Misal: TAMALANREA..."
                                                                    className="bg-slate-950 border border-slate-850 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-white outline-none w-full transition-all uppercase"
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Presets */}
                                                        <div className="flex flex-wrap gap-1">
                                                            {NOTE_PRESETS.map((preset) => (
                                                                <button
                                                                    key={preset}
                                                                    type="button"
                                                                    onClick={() => setNoteText(preset)}
                                                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-semibold rounded-lg transition-colors"
                                                                >
                                                                    {preset}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="flex justify-end gap-2 pt-1.5 border-t border-slate-800/60 mt-1">
                                                            <button
                                                                onClick={() => { setNoteEditingItemId(null); setNoteText(''); setTujuanText(''); }}
                                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                                                            >
                                                                Batal
                                                            </button>
                                                            <button
                                                                onClick={() => handleSaveNote(item.id, noteText, tujuanText)}
                                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                                                            >
                                                                Simpan
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (item.status === 'extra') {
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="p-2.5 rounded-xl border bg-red-950/10 border-red-900/30 text-red-400 flex flex-col gap-1.5"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-red-700 font-mono w-4">+</span>
                                                                <span className="font-mono font-bold text-xs tracking-wide">{item.code}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[8px] bg-red-950 border border-red-900 px-2 py-0.5 rounded text-red-400 font-bold font-mono">{item.scanTime}</span>
                                                                <span className="text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded">LEBIH</span>
                                                                <button
                                                                    onClick={() => handleStartNote(item.id, item.note)}
                                                                    className="p-1 bg-red-950 hover:bg-red-900/60 border border-red-900/30 hover:border-red-800 text-red-450 hover:text-white rounded-lg transition-all"
                                                                    title="Tambah Catatan"
                                                                >
                                                                    <MessageSquare size={10} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteExtraScan(item.id, item.code)}
                                                                    className="p-1 bg-red-950 hover:bg-red-900/60 border border-red-900/30 hover:border-red-800 text-red-450 hover:text-white rounded-lg transition-all"
                                                                    title="Hapus Koli Lebih"
                                                                >
                                                                    <Trash2 size={10} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {item.note && (
                                                            <div className="text-[9px] bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded font-medium self-start">
                                                                📝 {item.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            if (item.id === editingItemId) {
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="p-3.5 bg-slate-900 border-2 border-yellow-600/70 rounded-2xl flex flex-col gap-2.5 shadow-xl transition-all"
                                                    >
                                                        <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest flex justify-between items-center">
                                                            <span>Edit Data TO #{idx + 1}</span>
                                                            <span className="font-mono text-slate-500">{item.code}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div className="flex flex-col gap-1 col-span-2">
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase">Nomor TO</label>
                                                                <input
                                                                    type="text"
                                                                    value={editCode}
                                                                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                                                    className="bg-slate-950 border border-slate-800 focus:border-yellow-600 rounded-lg px-2.5 py-1.5 font-mono text-white outline-none transition-all"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase">Jmlh Paket</label>
                                                                <input
                                                                    type="number"
                                                                    value={editJmlh}
                                                                    onChange={(e) => setEditJmlh(e.target.value)}
                                                                    className="bg-slate-950 border border-slate-800 focus:border-yellow-600 rounded-lg px-2.5 py-1.5 text-white outline-none transition-all"
                                                                    placeholder="30"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase">Berat (kg)</label>
                                                                <input
                                                                    type="text"
                                                                    value={editBerat}
                                                                    onChange={(e) => setEditBerat(e.target.value)}
                                                                    className="bg-slate-950 border border-slate-800 focus:border-yellow-600 rounded-lg px-2.5 py-1.5 text-white outline-none transition-all"
                                                                    placeholder="18.330"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase">TO Type</label>
                                                                <input
                                                                    type="text"
                                                                    value={editToType}
                                                                    onChange={(e) => setEditToType(e.target.value)}
                                                                    className="bg-slate-950 border border-slate-800 focus:border-yellow-600 rounded-lg px-2.5 py-1.5 text-white outline-none transition-all"
                                                                    placeholder="Bag"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase">DG Type</label>
                                                                <input
                                                                    type="text"
                                                                    value={editDgType}
                                                                    onChange={(e) => setEditDgType(e.target.value)}
                                                                    className="bg-slate-950 border border-slate-800 focus:border-yellow-600 rounded-lg px-2.5 py-1.5 text-white outline-none transition-all"
                                                                    placeholder="Non-DG"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 justify-between pt-1 border-t border-slate-800/60 mt-1">
                                                            <button
                                                                onClick={() => handleDeleteManifestItem(item.id, item.code)}
                                                                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900 border border-red-900/30 text-red-400 hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                                            >
                                                                <Trash2 size={12} /> Hapus
                                                            </button>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={handleCancelEditItem}
                                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                                                                >
                                                                    Batal
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSaveEditItem(item.id)}
                                                                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded-lg transition-colors"
                                                                >
                                                                    Simpan
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${item.status === 'scanned'
                                                            ? 'bg-emerald-950/10 border-emerald-900/30 text-emerald-400 animate-fade-in'
                                                            : 'bg-slate-900/40 border-slate-800/80 text-slate-400'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-slate-650 font-mono w-4">
                                                                    {item.originalIndex !== -1 ? `${item.originalIndex + 1}.` : `${idx + 1}.`}
                                                                </span>
                                                                <span className="font-mono font-bold text-xs tracking-wide">{item.code}</span>
                                                            </div>
                                                            {(item.jmlhPaket !== undefined || item.berat !== undefined || item.toType || item.dgType || item.tujuan) && (
                                                                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-slate-500 font-medium pl-6 items-center">
                                                                    {item.jmlhPaket !== undefined && <span>{item.jmlhPaket} Pkt</span>}
                                                                    {item.berat !== undefined && <span>{item.berat} kg</span>}
                                                                    {item.tujuan && <span className="bg-blue-950/40 text-blue-455 border border-blue-900/30 px-1.5 py-0.5 rounded text-[8px]">{item.tujuan}</span>}
                                                                    {item.toType && <span className="bg-slate-800/50 px-1.5 py-0.5 rounded text-[8px]">{item.toType}</span>}
                                                                    {item.dgType && <span className="bg-slate-800/50 px-1.5 py-0.5 rounded text-[8px]">{item.dgType}</span>}
                                                                    {isSpecialItem(item) && (
                                                                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5">
                                                                            ⚠️ KHUSUS: {isLiquidItem(item) && 'CAIRAN'} {isLiquidItem(item) && isDgItem(item) && '&'} {isDgItem(item) && `DG (${item.dgType})`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {item.status === 'scanned' ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[8px] bg-emerald-950 border border-emerald-900 px-2 py-0.5 rounded text-emerald-400 font-bold font-mono">{item.scanTime}</span>
                                                                    <button
                                                                        onClick={() => handleStartNote(item.id, item.note)}
                                                                        className="p-1 bg-slate-850 hover:bg-slate-750 border border-slate-750 text-slate-350 hover:text-white rounded-lg transition-all"
                                                                        title="Tambah/Edit Catatan"
                                                                    >
                                                                        <MessageSquare size={10} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStartEditItem(item as any as ManifestItem)}
                                                                        className="p-1 bg-slate-850 hover:bg-slate-750 border border-slate-750 text-slate-350 hover:text-white rounded-lg transition-all"
                                                                        title="Edit Data TO"
                                                                    >
                                                                        <Edit size={10} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteManifestItem(item.id, item.code)}
                                                                        className="p-1 bg-slate-850 hover:bg-red-900 border border-slate-750 hover:border-red-800 text-slate-350 hover:text-white rounded-lg transition-all"
                                                                        title="Hapus Koli Manifest"
                                                                    >
                                                                        <Trash2 size={10} />
                                                                    </button>
                                                                    <Check size={14} className="text-emerald-400" />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[8px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-550 font-bold font-mono">PENDING</span>
                                                                    <button
                                                                        onClick={() => handleStartNote(item.id, item.note)}
                                                                        className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-all"
                                                                        title="Tambah/Edit Catatan"
                                                                    >
                                                                        <MessageSquare size={10} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStartEditItem(item as any as ManifestItem)}
                                                                        className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-all"
                                                                        title="Edit Data TO"
                                                                    >
                                                                        <Edit size={10} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteManifestItem(item.id, item.code)}
                                                                        className="p-1 bg-slate-800 hover:bg-red-900 border border-slate-700 hover:border-red-800 text-slate-300 hover:text-white rounded-lg transition-all"
                                                                        title="Hapus Koli Manifest"
                                                                    >
                                                                        <Trash2 size={10} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleManualBypass(item.id)}
                                                                        className="p-1 bg-blue-600/20 hover:bg-blue-650 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white rounded-lg transition-all"
                                                                        title="Verifikasi Manual (Bypass)"
                                                                    >
                                                                        <Check size={10} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {item.note && (
                                                        <div className="text-[9px] bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded font-medium self-start ml-6">
                                                            📝 {item.note}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {displayItems.length > 50 && (
                                            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-[10px] text-slate-500 font-semibold tracking-wide">
                                                Menampilkan 50 dari {displayItems.length} koli teratas. Gunakan kotak pencarian untuk melihat koli lainnya.
                                            </div>
                                        )}
                                    </>
                                )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. REPORT / SUMMARY STEP */}
                {step === 'report' && (
                    <div className="space-y-6">

                        {/* Printable Report Panel */}
                        <div id="print-dhs-report" className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-white max-w-4xl mx-auto">
                            <div className={isPrintingOnlyBa ? 'print-ba-only-hide space-y-8' : 'space-y-8'}>
                                {Object.entries(groupedData).map(([tujuanName, data], groupIdx) => {
                                    // Calculate stats for this specific destination
                                    const groupTotalTarget = data.manifestItems.length;
                                    const groupTotalScanned = data.manifestItems.filter(i => i.status === 'scanned').length;
                                    const groupTotalPending = data.manifestItems.filter(i => i.status === 'pending').length;
                                    const groupTotalExtra = data.extraItems.length;
                                    
                                    // Sum weights and packages
                                    const targetPaket = data.manifestItems.reduce((sum, i) => sum + (i.jmlhPaket || 0), 0);
                                    const scannedPaket = data.manifestItems.filter(i => i.status === 'scanned').reduce((sum, i) => sum + (i.jmlhPaket || 0), 0);
                                    
                                    const targetBerat = data.manifestItems.reduce((sum, i) => sum + (i.berat || 0), 0);
                                    const scannedBerat = data.manifestItems.filter(i => i.status === 'scanned').reduce((sum, i) => sum + (i.berat || 0), 0);
                                    
                                    const groupPercentage = groupTotalTarget > 0 ? Math.round((groupTotalScanned / groupTotalTarget) * 100) : 100;
                                    const destinationGroups = Object.entries(groupedData);

                                    return (
                                        <div key={tujuanName} className={`space-y-5 ${groupIdx > 0 ? 'page-break pt-8 border-t border-dashed border-slate-800/40 print:border-none print:pt-0' : ''}`}>
                                            {/* Kop Surat (Printed on every page/destination sheet) */}
                                            <div className="w-full flex items-center gap-4 border-b-[3px] border-double border-slate-700 pb-4 mb-2">
                                                <img src="/logo.png" alt="Logo" className="w-[20mm] h-[20mm] object-contain flex-shrink-0" />
                                                <div className="flex-1">
                                                    <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wider font-serif">CV. CAHAYA CARGO EXPRESS</h1>
                                                    <p className="text-[7.5pt] font-semibold tracking-wider text-slate-400 uppercase -mt-0.5">
                                                        Jasa Pengiriman Barang - Spesialis &amp; Jawa ke Sulawesi
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-3 mt-2 text-[6.5pt] text-slate-400 leading-tight">
                                                        <div>
                                                            <strong className="text-slate-300">SURABAYA (Pusat):</strong>
                                                            <p>Jl. Kemudi No. 4, Surabaya</p>
                                                            <p>Telp: 081 337 878 138</p>
                                                        </div>
                                                        <div>
                                                            <strong className="text-slate-300">MAKASSAR:</strong>
                                                            <p>Jl. Irian No. 245 B, Makassar</p>
                                                            <p>Telp: 0852 4228 0396</p>
                                                        </div>
                                                        <div>
                                                            <strong className="text-slate-300">BANDUNG:</strong>
                                                            <p>Jl. Gandasari (PS Sentra Bisnis Warlob) G 1, Bandung</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Document Title */}
                                            <div className="text-center mb-2">
                                                <h2 className="text-sm font-extrabold tracking-[2px] uppercase text-white underline underline-offset-4 decoration-slate-700">
                                                    LAPORAN PEMINDAIAN BARCODE DHS - TUJUAN: {tujuanName}
                                                </h2>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Tanggal: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                </p>
                                            </div>

                                            {/* Session Information Details */}
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[10px]">
                                                <div>
                                                    <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider">Tipe Operasi</span>
                                                    <p className="font-bold text-xs text-white mt-0.5">{sessionType} KOLI</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider">Nama Driver</span>
                                                    <p className="font-bold text-xs text-white mt-0.5">{driverName.toUpperCase() || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider">No. Polisi (Plat)</span>
                                                    <p className="font-bold text-xs text-white mt-0.5">{noPolisi.toUpperCase() || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider">Kota Tujuan</span>
                                                    <p className="font-bold text-xs text-blue-400 mt-0.5">{tujuanName}</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 uppercase font-bold text-[8px] tracking-wider">Penyelesaian Rute</span>
                                                    <p className="font-bold text-xs text-white mt-0.5">{groupPercentage}% Selesai</p>
                                                </div>
                                            </div>

                                            {/* Calculations & Summary stats */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 border border-slate-800 rounded-2xl overflow-hidden divide-x divide-slate-800 text-center bg-slate-900/60 no-print">
                                                <div className="p-2.5 flex flex-col items-center justify-center">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Target Manifest</span>
                                                    <span className="text-lg font-black text-white mt-0.5">{groupTotalTarget} TO</span>
                                                </div>
                                                <div className="p-2.5 flex flex-col items-center justify-center">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Cocok</span>
                                                    <span className="text-lg font-black text-emerald-400 mt-0.5">{groupTotalScanned} TO</span>
                                                </div>
                                                <div className="p-2.5 flex flex-col items-center justify-center">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Kurang</span>
                                                    <span className={`text-lg font-black mt-0.5 ${groupTotalPending > 0 ? 'text-red-400' : 'text-slate-500'}`}>{groupTotalPending} TO</span>
                                                </div>
                                                <div className="p-2.5 flex flex-col items-center justify-center">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Lebih</span>
                                                    <span className={`text-lg font-black mt-0.5 ${groupTotalExtra > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{groupTotalExtra} TO</span>
                                                </div>
                                            </div>

                                            {/* Calculations of Weight and Packages (CRITICAL STATS DISPLAY) */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5 bg-blue-950/20 border border-blue-900/30 rounded-2xl">
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-wider block">Laporan Perhitungan Jumlah Paket (Koli)</span>
                                                    <div className="flex justify-between items-baseline text-xs text-slate-350">
                                                        <span>Target Manifest Paket:</span>
                                                        <span className="font-mono font-bold text-white">{targetPaket} Koli</span>
                                                    </div>
                                                    <div className="flex justify-between items-baseline text-xs text-slate-350">
                                                        <span>Cocok Terverifikasi:</span>
                                                        <span className="font-mono font-bold text-emerald-400">{scannedPaket} Koli</span>
                                                    </div>
                                                    {groupTotalExtra > 0 && (
                                                        <div className="flex justify-between items-baseline text-xs text-slate-350">
                                                            <span>Selisih Lebih (Extra):</span>
                                                            <span className="font-mono font-bold text-yellow-400">+{groupTotalExtra} Koli</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-baseline border-t border-slate-800/80 pt-1 text-xs font-bold text-slate-200">
                                                        <span>Total Fisik Koli Ter-scan:</span>
                                                        <span className="font-mono text-white">{scannedPaket + groupTotalExtra} Koli</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-wider block">Laporan Perhitungan Berat Kargo (kg)</span>
                                                    <div className="flex justify-between items-baseline text-xs text-slate-350">
                                                        <span>Target Manifest Berat:</span>
                                                        <span className="font-mono font-bold text-white">{targetBerat.toFixed(3)} kg</span>
                                                    </div>
                                                    <div className="flex justify-between items-baseline text-xs text-slate-350">
                                                        <span>Cocok Terverifikasi:</span>
                                                        <span className="font-mono font-bold text-emerald-400">{scannedBerat.toFixed(3)} kg</span>
                                                    </div>
                                                    <div className="flex justify-between items-baseline border-t border-slate-800/80 pt-1 text-xs font-bold text-slate-200">
                                                        <span>Total Berat Fisik Ter-scan:</span>
                                                        <span className="font-mono text-white">{scannedBerat.toFixed(3)} kg</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-extrabold text-amber-400 uppercase tracking-wider block">Laporan Koli Khusus (Cairan &amp; DG)</span>
                                                    <div className="flex justify-between items-baseline text-xs text-slate-350">
                                                        <span>Kargo Cairan (Liquid):</span>
                                                        <span className="font-mono font-bold text-amber-400">
                                                            {data.manifestItems.filter(isLiquidItem).filter(i => i.status === 'scanned').length} / {data.manifestItems.filter(isLiquidItem).length} Koli
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-baseline text-xs text-slate-350">
                                                        <span>Kargo Berbahaya (DG Non-Cair):</span>
                                                        <span className="font-mono font-bold text-red-400">
                                                            {data.manifestItems.filter(i => isDgItem(i) && !isLiquidItem(i)).filter(i => i.status === 'scanned').length} / {data.manifestItems.filter(i => isDgItem(i) && !isLiquidItem(i)).length} Koli
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-baseline border-t border-slate-800/80 pt-1 text-xs font-bold text-slate-200">
                                                        <span>Total Ter-scan Khusus:</span>
                                                        <span className="font-mono text-white">
                                                            {data.manifestItems.filter(i => isSpecialItem(i) && i.status === 'scanned').length} / {data.manifestItems.filter(isSpecialItem).length} Koli
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Printable Compact Summary Row (For paper/print only) */}
                                            <div className="hidden print:block p-3 border border-slate-300 bg-slate-50 rounded text-center text-xs font-bold text-slate-800">
                                                Tujuan: {tujuanName} | Target: {groupTotalTarget} TO ({targetPaket} Koli, {targetBerat.toFixed(3)} kg) | Cocok: {groupTotalScanned} TO ({scannedPaket} Koli, {scannedBerat.toFixed(3)} kg) | Kurang: {groupTotalPending} TO | Lebih: {groupTotalExtra} TO
                                            </div>

                                            {/* Table of Results */}
                                            <div className="space-y-3 pt-2 border-t border-slate-800/80">
                                                <h3 className="font-bold text-xs text-slate-350">Rincian Hasil Pengecekan Koli ({tujuanName}):</h3>

                                                <div className="border border-slate-800 rounded-2xl overflow-hidden text-xs">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[9px] md:text-[10px]">
                                                                <th className="p-2.5 text-center w-[4%] font-bold">No</th>
                                                                <th className="p-2.5 w-[18%] font-bold">Nomor TO</th>
                                                                <th className="p-2.5 text-center w-[8%] font-bold">Paket</th>
                                                                <th className="p-2.5 text-center w-[10%] font-bold">Berat (kg)</th>
                                                                <th className="p-2.5 w-[14%] font-bold">Tujuan</th>
                                                                <th className="p-2.5 text-center w-[8%] font-bold">TO Type</th>
                                                                <th className="p-2.5 text-center w-[8%] font-bold">DG Type</th>
                                                                <th className="p-2.5 w-[10%] font-bold">Scan Time</th>
                                                                <th className="p-2.5 w-[13%] font-bold">Catatan</th>
                                                                <th className="p-2.5 text-right w-[7%] font-bold">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {data.manifestItems.map((item, idx) => (
                                                                <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-900/30 odd:bg-slate-950/20 even:bg-slate-900/10">
                                                                    <td className="p-2.5 text-center text-slate-500 font-mono">{idx + 1}.</td>
                                                                    <td className="p-2.5 font-mono font-bold text-white tracking-wide">{item.code}</td>
                                                                    <td className="p-2.5 text-center font-mono text-slate-350">{item.jmlhPaket !== undefined ? item.jmlhPaket : '-'}</td>
                                                                    <td className="p-2.5 text-center font-mono text-slate-350">{item.berat !== undefined ? item.berat.toFixed(3) : '-'}</td>
                                                                    <td className="p-2.5 text-slate-300 font-medium">{item.tujuan || '-'}</td>
                                                                    <td className="p-2.5 text-center">
                                                                        {isLiquidItem(item) ? (
                                                                            <span className="text-amber-400 font-bold flex items-center justify-center gap-0.5">
                                                                                💧 {item.toType}
                                                                            </span>
                                                                        ) : (
                                                                            item.toType || '-'
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2.5 text-center">
                                                                        {isDgItem(item) ? (
                                                                            <span className="text-red-400 font-black flex items-center justify-center gap-0.5">
                                                                                ⚠️ {item.dgType}
                                                                            </span>
                                                                        ) : (
                                                                            item.dgType || '-'
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2.5 font-mono text-slate-400">{item.scanTime || '-'}</td>
                                                                    <td className="p-2.5 text-amber-400 font-medium italic text-[10px]" title={item.note}>{item.note || '-'}</td>
                                                                    <td className="p-2.5 text-right">
                                                                        {item.status === 'scanned' ? (
                                                                            <span className="text-[9px] bg-emerald-950 border border-emerald-900 text-emerald-400 font-black px-2 py-0.5 rounded">COCOK</span>
                                                                        ) : (
                                                                            <span className="text-[9px] bg-red-950 border border-red-900 text-red-400 font-black px-2 py-0.5 rounded">KURANG</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {data.extraItems.map((item, idx) => (
                                                                <tr key={`extra-report-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/30 bg-red-950/5 odd:bg-red-950/5 even:bg-red-950/10">
                                                                    <td className="p-2.5 text-center text-red-500 font-mono">+</td>
                                                                    <td className="p-2.5 font-mono font-bold text-red-400 tracking-wide">{item.code}</td>
                                                                    <td className="p-2.5 text-center font-mono text-slate-500">-</td>
                                                                    <td className="p-2.5 text-center font-mono text-slate-500">-</td>
                                                                    <td className="p-2.5 text-slate-300 font-medium">{item.tujuan || '-'}</td>
                                                                    <td className="p-2.5 text-center text-slate-500">-</td>
                                                                    <td className="p-2.5 text-center text-slate-500">-</td>
                                                                    <td className="p-2.5 font-mono text-slate-400">{item.scanTime}</td>
                                                                    <td className="p-2.5 text-amber-400 font-medium italic text-[10px]" title={item.note}>{item.note || '-'}</td>
                                                                    <td className="p-2.5 text-right">
                                                                        <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded">LEBIH</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Document Footer Note */}
                                            <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 italic leading-snug">
                                                Laporan ini dihasilkan secara otomatis oleh sistem C2-MS CV. Cahaya Cargo Express pada saat penyelesaian sesi pemindaian real-time. Penilaian selisih didasarkan pada kecocokan manifes resmi yang diunggah.
                                            </div>
                                            <div className="hidden print:flex justify-between items-center pt-2 text-[8px] text-slate-400 border-t border-slate-200 mt-2 font-mono">
                                                <span>Dicetak pada: {new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'medium' })} WIB</span>
                                                <span>Halaman {groupIdx + 1} dari {destinationGroups.length}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Render Berita Acara Document inside Report (only if created) */}
                            {baCreated && (
                                <div className={isPrintingOnlyBa ? 'space-y-6' : 'page-break pt-8 mt-8 border-t-2 border-dashed border-slate-800 space-y-6'}>
                                    {/* Kop Surat */}
                                    <div className="w-full flex items-center gap-4 border-b-[3px] border-double border-slate-700 pb-4 mb-2">
                                        <img src="/logo.png" alt="Logo" className="w-[20mm] h-[20mm] object-contain flex-shrink-0" />
                                        <div className="flex-1">
                                            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wider font-serif">CV. CAHAYA CARGO EXPRESS</h1>
                                            <p className="text-[7.5pt] font-semibold tracking-wider text-slate-400 uppercase -mt-0.5">
                                                Jasa Pengiriman Barang - Domestik &amp; Internasional
                                            </p>
                                            <div className="grid grid-cols-3 gap-3 mt-2 text-[6.5pt] text-slate-400 leading-tight">
                                                <div>
                                                    <strong className="text-slate-300">SURABAYA (Pusat):</strong>
                                                    <p>Jl. Kemudi No. 4, Surabaya</p>
                                                    <p>Telp: 081 337 878 138</p>
                                                </div>
                                                <div>
                                                    <strong className="text-slate-300">MAKASSAR:</strong>
                                                    <p>Jl. Irian No. 245 B, Makassar</p>
                                                    <p>Telp: 0852 4228 0396</p>
                                                </div>
                                                <div>
                                                    <strong className="text-slate-300">BANDUNG:</strong>
                                                    <p>Jl. Gandasari (PS Sentra Bisnis Warlob) G 1, Bandung</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BA Document Head */}
                                    <div className="text-center mb-4">
                                        <h2 className="text-sm font-extrabold uppercase tracking-[3px] text-white underline underline-offset-4 decoration-slate-700">BERITA ACARA SELISIH BARANG</h2>
                                        <p className="text-[10px] font-mono font-semibold text-slate-400 mt-1.5">Nomor: {baNo}</p>
                                        <p className="text-[10px] text-slate-500">Tanggal: {new Date(baDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                    </div>

                                    {/* BA Narration */}
                                    <div className="text-xs text-slate-300 leading-relaxed space-y-2.5">
                                        <p>
                                            Pada hari ini, <span className="font-bold text-white">{new Date(baDate).toLocaleDateString('id-ID', { weekday: 'long' })}</span> tanggal <span className="font-bold text-white">{new Date(baDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>, bertempat di Gudang CV. Cahaya Cargo Express, kami yang bertanda tangan di bawah ini telah melakukan pemeriksaan fisik kargo pada saat proses <span className="font-bold text-white">{sessionType}</span> koli dengan rincian operasional sebagai berikut:
                                        </p>
                                        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl space-y-1.5 text-[11px]">
                                            <div className="grid grid-cols-12 gap-1">
                                                <span className="col-span-4 font-semibold text-slate-400">Nama Driver</span>
                                                <span className="col-span-8 font-bold text-white">: {driverName.toUpperCase() || '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-12 gap-1">
                                                <span className="col-span-4 font-semibold text-slate-400">No. Polisi Armada</span>
                                                <span className="col-span-8 font-bold text-white">: {noPolisi.toUpperCase() || '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-12 gap-1">
                                                <span className="col-span-4 font-semibold text-slate-400">Tipe Sesi</span>
                                                <span className="col-span-8 font-bold text-white">: {sessionType} DHS</span>
                                            </div>
                                            {manifest.filter(isSpecialItem).length > 0 && (
                                                <>
                                                    <div className="grid grid-cols-12 gap-1 border-t border-slate-800/80 pt-1.5 mt-1">
                                                        <span className="col-span-4 font-semibold text-slate-400">Koli Cairan (Liquid)</span>
                                                        <span className="col-span-8 font-bold text-amber-400">: {manifest.filter(isLiquidItem).filter(i => i.status === 'scanned').length} / {manifest.filter(isLiquidItem).length} Koli Ter-scan</span>
                                                    </div>
                                                    <div className="grid grid-cols-12 gap-1">
                                                        <span className="col-span-4 font-semibold text-slate-400">Koli Berbahaya (DG Non-Cair)</span>
                                                        <span className="col-span-8 font-bold text-red-400">: {manifest.filter(i => isDgItem(i) && !isLiquidItem(i)).filter(i => i.status === 'scanned').length} / {manifest.filter(i => isDgItem(i) && !isLiquidItem(i)).length} Koli Ter-scan</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* BA Selected TO Table */}
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-xs text-slate-350">Daftar Nomor TO yang Bermasalah/Selisih:</h4>
                                        <div className="border border-slate-800 rounded-2xl overflow-hidden text-xs">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[9px]">
                                                        <th className="p-3 text-center w-[10%]">No</th>
                                                        <th className="p-3 w-[45%]">Nomor TO</th>
                                                        <th className="p-3 w-[25%]">Jenis Selisih</th>
                                                        <th className="p-3 text-right w-[20%]">Status Barang</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {allBaTOs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="p-4 text-center text-slate-500 italic">Tidak ada TO spesifik yang dilampirkan.</td>
                                                        </tr>
                                                    ) : (
                                                        allBaTOs.map((item, idx) => {
                                                            return (
                                                                <tr key={`ba-to-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                                                                    <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}.</td>
                                                                    <td className="p-3 font-mono font-bold text-white">{item.code}</td>
                                                                    <td className="p-3">
                                                                        {item.type === 'LEBIH' ? (
                                                                            <span className="text-[10px] text-yellow-500 font-bold">SELISIH LEBIH</span>
                                                                        ) : item.type === 'DOUBLE' ? (
                                                                            <span className="text-[10px] text-blue-400 font-bold">TO SAMA / DOBEL</span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-red-500 font-bold">SELISIH KURANG</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 text-right">
                                                                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-350 px-2 py-0.5 rounded font-black">
                                                                            {item.type === 'LEBIH' ? 'TIDAK ADA DI MANIFEST' : item.type === 'DOUBLE' ? 'KEDOBELAN / DOUBLE' : 'BELUM SCAN'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* BA Description Card */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                                        <h4 className="font-bold text-xs text-slate-350">Deskripsi / Keterangan Kejadian:</h4>
                                        <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed italic">{baDescription || 'Tidak ada keterangan tambahan.'}</p>
                                    </div>

                                    {/* BA Image Proof */}
                                    {baImageBase64 && (
                                        <div className="space-y-2 text-center">
                                            <h4 className="font-bold text-xs text-slate-350 text-left">Foto Bukti Lapangan (Lampiran):</h4>
                                            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/50 p-4 inline-block max-w-full">
                                                <img src={baImageBase64} alt="Bukti Lapangan" className="max-w-md max-h-[12cm] rounded-xl mx-auto object-contain shadow-md" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Signatures block (2 columns) */}
                                    <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t border-dashed border-slate-800 text-center text-xs text-slate-300">
                                        <div className="flex flex-col items-center">
                                            <p className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">PIHAK I (Pengawas DHS)</p>
                                            <div className="h-[22mm] flex items-end justify-center">
                                                <div className="w-40 border-b border-slate-600"></div>
                                            </div>
                                            <p className="font-bold text-white text-[10px] uppercase font-mono mt-1">( Pengawas DHS )</p>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <p className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">PIHAK II (Checker CCE)</p>
                                            <div className="h-[22mm] flex items-end justify-center">
                                                <div className="w-40 border-b border-slate-600"></div>
                                            </div>
                                            <p className="font-bold text-white text-[10px] uppercase font-mono mt-1">( Checker CCE )</p>
                                        </div>
                                    </div>

                                    {/* BA Footer */}
                                    <div className="pt-3 border-t border-slate-800 text-[9px] text-slate-500 italic leading-snug text-center">
                                        Dokumen ini bersifat rahasia dan internal untuk lingkungan CV. Cahaya Cargo Express beserta mitra pengawas terkait.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Berita Acara Creator Panel (no-print) */}
                        <div className="no-print bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-4xl mx-auto space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <span>📝 Berita Acara Selisih Barang</span>
                                        {baCreated && <span className="text-xs bg-emerald-950 border border-emerald-900 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Dibuat</span>}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">Buat dokumen resmi berita acara jika terdapat selisih koli.</p>
                                </div>
                                <button
                                    onClick={() => setShowBaForm(!showBaForm)}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 px-4 rounded-xl border border-slate-700 transition-all active:scale-95"
                                >
                                    {showBaForm ? 'Tutup Form' : baCreated ? 'Edit Berita Acara' : 'Buat Berita Acara'}
                                </button>
                            </div>

                            {showBaForm && (
                                <form onSubmit={(e) => { e.preventDefault(); setBaCreated(true); setShowBaForm(false); }} className="space-y-4 pt-4 border-t border-slate-900 text-xs">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-slate-400 font-semibold mb-1">Nomor Berita Acara:</label>
                                            <input
                                                type="text"
                                                required
                                                value={baNo}
                                                onChange={(e) => setBaNo(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:border-blue-500 font-mono font-semibold text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 font-semibold mb-1">Tanggal Berita Acara:</label>
                                            <input
                                                type="date"
                                                required
                                                value={baDate}
                                                onChange={(e) => setBaDate(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:border-blue-500 text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-400 font-semibold mb-1.5">Pilih TO yang Selisih (Manifest / Lebih):</label>
                                        {discrepantTOOptions.length === 0 ? (
                                            <p className="text-slate-500 italic">Tidak ada selisih barang (100% cocok).</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-slate-900 p-4 rounded-2xl border border-slate-800 max-h-48 overflow-y-auto">
                                                {discrepantTOOptions.map((opt: { code: string; type: string }) => {
                                                    const isChecked = baSelectedTOs.includes(opt.code);
                                                    return (
                                                        <label key={opt.code} className="flex items-center gap-2.5 p-2 bg-slate-950/50 rounded-lg hover:bg-slate-950 border border-slate-800/60 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setBaSelectedTOs([...baSelectedTOs, opt.code]);
                                                                    } else {
                                                                        setBaSelectedTOs(baSelectedTOs.filter(c => c !== opt.code));
                                                                    }
                                                                }}
                                                                className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-800"
                                                            />
                                                            <span className="font-mono text-xs font-semibold text-slate-200">{opt.code}</span>
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded leading-none ${opt.type === 'KURANG' ? 'bg-red-950 text-red-400 border border-red-900/35' : 'bg-yellow-950 text-yellow-400 border border-yellow-900/35'}`}>{opt.type}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Manual TO Input Section */}
                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                                        <span className="block text-slate-400 font-semibold mb-1 text-xs">Tambah Nomor TO Secara Manual (Jika salah atau lebih yang tidak ada di daftar):</span>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="text"
                                                placeholder="Contoh: TO2026..."
                                                value={manualToCode}
                                                onChange={(e) => setManualToCode(e.target.value)}
                                                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 outline-none focus:border-blue-500 font-mono text-white text-xs uppercase"
                                            />
                                            <select
                                                value={manualToType}
                                                onChange={(e) => setManualToType(e.target.value as 'KURANG' | 'LEBIH' | 'DOUBLE')}
                                                className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 outline-none focus:border-blue-500 text-white text-xs"
                                            >
                                                <option value="KURANG">KURANG (BELUM SCAN)</option>
                                                <option value="LEBIH">LEBIH (TIDAK ADA DI MANIFEST)</option>
                                                <option value="DOUBLE">KARUNG (TO SAMA / KEDOBELAN)</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleAddManualTO}
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95"
                                            >
                                                + Tambah TO
                                            </button>
                                        </div>

                                        {/* Display manually added TOs */}
                                        {baManualTOs.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {baManualTOs.map((item) => (
                                                    <span
                                                        key={item.code}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/50 border border-slate-800/60 text-slate-200 font-mono text-xs font-semibold"
                                                    >
                                                        <span>{item.code}</span>
                                                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded leading-none ${item.type === 'KURANG' ? 'bg-red-950 text-red-400 border border-red-900/35' : item.type === 'LEBIH' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900/35' : 'bg-blue-950 text-blue-400 border border-blue-900/35'}`}>
                                                            {item.type === 'DOUBLE' ? 'DOBEL' : item.type}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveManualTO(item.code)}
                                                            className="text-red-400 hover:text-red-300 font-bold ml-1 focus:outline-none"
                                                            title="Hapus"
                                                        >
                                                            ✕
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-slate-400 font-semibold mb-1">Upload Foto Bukti (Gambar):</label>
                                            <div className="space-y-3">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleBaImageUpload}
                                                    className="w-full text-slate-350 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                                                />
                                                {baImageBase64 && (
                                                    <div className="relative w-32 h-24 border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                                                        <img src={baImageBase64} alt="Preview" className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setBaImageBase64('')}
                                                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-750 transition-colors"
                                                            title="Hapus foto"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 font-semibold mb-1">Keterangan Kejadian / Catatan:</label>
                                            <textarea
                                                required
                                                rows={4}
                                                placeholder="Contoh: Ditemukan 2 koli TO2026... dalam keadaan basah/sobek di bagian bawah karung. Driver mengonfirmasi terjadi benturan saat pemuatan."
                                                value={baDescription}
                                                onChange={(e) => setBaDescription(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:border-blue-500 text-white resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-900">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBaCreated(false);
                                                setBaSelectedTOs([]);
                                                setBaManualTOs([]);
                                                setManualToCode('');
                                                setManualToType('KURANG');
                                                setBaDescription('');
                                                setBaImageBase64('');
                                                setShowBaForm(false);
                                            }}
                                            className="bg-red-950 hover:bg-red-900/65 border border-red-900 text-red-400 font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                                        >
                                            Reset & Hapus
                                        </button>
                                        <button
                                            type="submit"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all active:scale-95 cursor-pointer"
                                        >
                                            Simpan Berita Acara
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Export Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto">
                            <button
                                onClick={handleCopyWhatsApp}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-emerald-950/20"
                            >
                                <Copy size={18} />
                                Salin Laporan WhatsApp (WA)
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <Printer size={18} />
                                Cetak Laporan (A4)
                            </button>
                            {baCreated && (
                                <button
                                    onClick={handlePrintOnlyBa}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                                >
                                    <Printer size={18} />
                                    Cetak Berita Acara Saja (A4)
                                </button>
                            )}
                            <button
                                onClick={handleEditSession}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                            >
                                <Edit size={18} />
                                Edit / Lanjutkan Scan
                            </button>
                            <button
                                onClick={handleNewSession}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                            >
                                <RefreshCcw size={18} />
                                Sesi Baru
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Custom Print Styling specifically for the report page */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    header, .no-print, button, Link {
                        display: none !important;
                    }
                    .print-ba-only-hide {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    #print-dhs-report {
                        background: white !important;
                        color: black !important;
                        border: none !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        padding: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        font-size: 10pt !important;
                    }
                    #print-dhs-report * {
                        color: black !important;
                        border-color: #d1d5db !important;
                    }
                    /* Kop Surat print overrides */
                    #print-dhs-report .border-double {
                        border-color: black !important;
                        border-bottom-width: 3px !important;
                    }
                    #print-dhs-report .font-serif {
                        font-family: 'Georgia', 'Times New Roman', serif !important;
                    }
                    #print-dhs-report .text-slate-400,
                    #print-dhs-report .text-slate-500 {
                        color: #475569 !important;
                    }
                    #print-dhs-report .text-slate-300 {
                        color: #1e293b !important;
                    }
                    #print-dhs-report .text-slate-200 {
                        color: black !important;
                    }
                    /* Background overrides for print */
                    #print-dhs-report .bg-slate-900,
                    #print-dhs-report .bg-slate-900\\/80,
                    #print-dhs-report .bg-slate-50 {
                        background: #f8fafc !important;
                    }
                    #print-dhs-report .rounded-3xl,
                    #print-dhs-report .rounded-2xl,
                    #print-dhs-report .rounded-xl {
                        border-radius: 4px !important;
                    }
                    /* Color overrides for print */
                    #print-dhs-report .text-emerald-400,
                    #print-dhs-report .text-emerald-500 {
                        color: #047857 !important;
                    }
                    #print-dhs-report .text-red-400,
                    #print-dhs-report .text-red-500 {
                        color: #b91c1c !important;
                    }
                    #print-dhs-report .text-blue-400 {
                        color: #2563eb !important;
                    }
                    #print-dhs-report .text-amber-400,
                    #print-dhs-report .text-amber-500 {
                        color: #b45309 !important;
                    }
                    /* Underline decoration for print */
                    #print-dhs-report .decoration-slate-700 {
                        text-decoration-color: #1e293b !important;
                    }
                    /* Page break handling */
                    .page-break {
                        page-break-before: always;
                        break-before: page;
                        margin-top: 0 !important;
                        padding-top: 0 !important;
                        border-top: none !important;
                    }
                    /* Table print tweaks */
                    #print-dhs-report table {
                        font-size: 8pt !important;
                        border-collapse: collapse !important;
                        width: 100% !important;
                    }
                    #print-dhs-report table th {
                        background: #f1f5f9 !important;
                        font-weight: 700 !important;
                        border-bottom: 2px solid #cbd5e1 !important;
                    }
                    #print-dhs-report table td,
                    #print-dhs-report table th {
                        border: 1px solid #cbd5e1 !important;
                        padding: 6px 8px !important;
                    }
                    #print-dhs-report table tr:nth-child(even) {
                        background: #f8fafc !important;
                    }
                    #print-dhs-report table tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 12mm 15mm;
                    }
                }
                `
            }} />
        </div>
    );
}
