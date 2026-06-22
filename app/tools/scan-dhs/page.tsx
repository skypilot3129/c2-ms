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
    Edit
} from 'lucide-react';

interface ManifestItem {
    id: string;
    code: string;
    status: 'pending' | 'scanned';
    scanTime?: string;
    jmlhPaket?: number;
    berat?: number;
    toType?: string;
    dgType?: string;
}

interface ExtraScan {
    id: string;
    code: string;
    scanTime: string;
}

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
}

export default function ScanDhsPage() {
    // Session state: 'import' | 'scan' | 'report'
    const [step, setStep] = useState<'import' | 'scan' | 'report'>('import');
    const [sessionType, setSessionType] = useState<'BONGKAR' | 'MUAT'>('BONGKAR');
    
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
    const [pendingRecovery, setPendingRecovery] = useState<any>(null);

    // Berita Acara states
    const [showBaForm, setShowBaForm] = useState<boolean>(false);
    const [baNo, setBaNo] = useState<string>('');
    const [baDate, setBaDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [baDescription, setBaDescription] = useState<string>('');
    const [baSelectedTOs, setBaSelectedTOs] = useState<string[]>([]);
    const [baImageBase64, setBaImageBase64] = useState<string>('');
    const [baCreated, setBaCreated] = useState<boolean>(false);

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

    // Audio Context generator for native sound beeps
    const playBeep = (freq: number, duration: number, double = false) => {
        if (!soundEnabled) return;
        try {
            const playSingle = (frequency: number, delay = 0) => {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime + delay);
                gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + delay + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + duration);
                
                oscillator.start(audioCtx.currentTime + delay);
                oscillator.stop(audioCtx.currentTime + delay + duration);
            };

            playSingle(freq);
            if (double) {
                setTimeout(() => playSingle(freq * 1.2), 150);
            }
        } catch (e) {
            console.error('Web Audio API error:', e);
        }
    };

    // Voice TTS helper using Web Speech API
    const speakText = (text: string) => {
        if (!soundEnabled) return;
        try {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'id-ID';
                utterance.rate = 1.25;
                window.speechSynthesis.speak(utterance);
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

    // Auto-focus the input during the scanning step (only if not editing any item)
    useEffect(() => {
        if (step === 'scan' && inputRef.current && !editingItemId) {
            inputRef.current.focus();
        }
    }, [step, scanAlert, editingItemId]);

    // Handle focus loss: automatically refocus to ensure continuous scanning
    const handleBlur = () => {
        if (step === 'scan' && !isCameraActive && !editingItemId) {
            setTimeout(() => {
                if (inputRef.current && !editingItemId) inputRef.current.focus();
            }, 100);
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

        if (step === 'scan') {
            const sessionData = {
                sessionType,
                driverName,
                noPolisi,
                manifest,
                extraScans,
                step
            };
            localStorage.setItem('cce_active_scan_session', JSON.stringify(sessionData));
        } else if (step === 'import') {
            // Clear active session when returned to import screen
            localStorage.removeItem('cce_active_scan_session');
        }
    }, [step, sessionType, driverName, noPolisi, manifest, extraScans]);

    // Handle recovering active session
    const handleConfirmRecovery = () => {
        if (pendingRecovery) {
            setSessionType(pendingRecovery.sessionType);
            setDriverName(pendingRecovery.driverName || '');
            setNoPolisi(pendingRecovery.noPolisi || '');
            setManifest(pendingRecovery.manifest);
            setExtraScans(pendingRecovery.extraScans || []);
            setStep(pendingRecovery.step);
            setShowRecoveryModal(false);
            setPendingRecovery(null);
            setScanAlert({ type: 'idle', message: 'Sesi scan berhasil dipulihkan. Silakan lanjutkan.' });
        }
    };

    // Discard recovery session
    const handleDiscardRecovery = () => {
        localStorage.removeItem('cce_active_scan_session');
        setPendingRecovery(null);
        setShowRecoveryModal(false);
    };

    // Parse pasted/input text for TO & SPXID resi numbers and additional columns
    const handleParseManifest = () => {
        if (!rawInput.trim()) {
            alert('Masukkan data manifest terlebih dahulu!');
            return;
        }

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
                    dgType: dgType || undefined
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
        setStep('scan');
        setScanAlert({ type: 'idle', message: 'Sesi scan siap. Mulailah memindai barcode.' });
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

    // Drag-and-drop file uploader parsing
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setRawInput(text);
        };
        reader.readAsText(file);
    };

    // Main scanning / matching logic
    const processBarcode = (scannedCode: string) => {
        const code = scannedCode.trim().toUpperCase();
        if (!code) return;

        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // 1. Check if the code is in the manifest and is still 'pending'
        const pendingItemIdx = manifest.findIndex(item => item.code === code && item.status === 'pending');

        if (pendingItemIdx !== -1) {
            // MATCH FOUND!
            const updated = [...manifest];
            updated[pendingItemIdx].status = 'scanned';
            updated[pendingItemIdx].scanTime = nowStr;
            setManifest(updated);

            // Get sequence number of this successfully scanned item
            const sequenceNumber = updated.filter(i => i.status === 'scanned').length;

            setScanAlert({
                type: 'success',
                message: `COCOK! Koli berhasil diverifikasi`,
                code
            });
            triggerFlash('green');
            playBeep(880, 0.12, true); // Double high beep
            triggerVibration(100);
            
            // Speak the sequence number in Indonesian
            speakText(sequenceNumber.toString());
            return;
        }

        // 2. Check if it's already scanned in manifest (duplicate scan)
        const alreadyScannedCount = manifest.filter(item => item.code === code && item.status === 'scanned').length;
        const totalInManifestCount = manifest.filter(item => item.code === code).length;

        if (totalInManifestCount > 0 && alreadyScannedCount === totalInManifestCount) {
            setScanAlert({
                type: 'duplicate',
                message: `DUPLIKAT! Kode ini sudah discan sebelumnya (${alreadyScannedCount}/${totalInManifestCount} Koli)`,
                code
            });
            triggerFlash('yellow');
            playBeep(440, 0.25); // Warning beep
            triggerVibration([80, 80]);
            speakText("T O tetap sama");
            return;
        }

        // 3. Check if it's already scanned as extra (duplicate extra scan)
        const isAlreadyExtra = extraScans.some(item => item.code === code);
        if (isAlreadyExtra) {
            setScanAlert({
                type: 'duplicate',
                message: `TO TETAP SAMA! Kode selisih lebih ini sudah discan sebelumnya.`,
                code
            });
            triggerFlash('yellow');
            playBeep(440, 0.25); // Warning beep
            triggerVibration([80, 80]);
            speakText("T O tetap sama");
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
        speakText("Salah");
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
            speakText(sequenceNumber.toString());
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
                    processBarcode(decodedText);
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
                        extraScans
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
                        extraScans
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
                    extraScans
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

        if (pendingCount > 0) {
            report += `\n*DAFTAR SELISIH KURANG (BELUM DI-SCAN) [${pendingCount}]:*\n`;
            const missingCodes = target.manifest.filter((i: any) => i.status === 'pending');
            missingCodes.forEach((missingItem: any, index: number) => {
                let detail = '';
                if (missingItem.jmlhPaket !== undefined) detail += ` [${missingItem.jmlhPaket} Pkt`;
                if (missingItem.berat !== undefined) detail += detail ? `, ${missingItem.berat} kg` : ` [${missingItem.berat} kg`;
                if (detail) detail += ']';
                report += `${index + 1}. ${missingItem.code}${detail}\n`;
            });
        }

        if (target.totalExtra > 0) {
            report += `\n*DAFTAR SELISIH LEBIH (TIDAK ADA DI MANIFEST) [${target.totalExtra}]:*\n`;
            target.extraScans.forEach((extraItem: any, index: number) => {
                report += `${index + 1}. ${extraItem.code} (${extraItem.scanTime})\n`;
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
        setStep('report');
    };

    // Edit/Resume session scanning from details view
    const handleEditSession = () => {
        setStep('scan');
        setScanAlert({ type: 'idle', message: 'Melanjutkan pemindaian sesi ini.' });
    };

    // Edit/Resume session scanning directly from history list
    const handleEditHistorySession = (item: HistoryItem) => {
        setCurrentSessionId(item.id);
        setSessionType(item.sessionType);
        setDriverName(item.driverName || '');
        setNoPolisi(item.noPolisi || '');
        setManifest(item.manifest);
        setExtraScans(item.extraScans || []);
        setStep('scan');
        setScanAlert({ type: 'idle', message: 'Melanjutkan pemindaian sesi ini.' });
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

    // Filter manifest items based on search term
    const filteredManifest = manifest.filter(item => 
        item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                        onClick={() => setSoundEnabled(!soundEnabled)}
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
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipe Sesi</label>
                                    <div className="grid grid-cols-2 bg-slate-800 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setSessionType('BONGKAR')}
                                            className={`py-2 text-xs font-bold rounded-lg transition-all ${sessionType === 'BONGKAR' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Bongkar
                                        </button>
                                        <button 
                                            onClick={() => setSessionType('MUAT')}
                                            className={`py-2 text-xs font-bold rounded-lg transition-all ${sessionType === 'MUAT' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
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

                            {/* Drag-and-drop / Select file */}
                            <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors relative group">
                                <input 
                                    type="file" 
                                    accept=".txt,.csv"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-400 transition-colors">
                                    <Upload size={32} />
                                    <p className="text-sm font-semibold">Tarik &amp; lepas file teks (.txt / .csv) di sini</p>
                                    <p className="text-xs text-slate-500">Atau klik untuk menelusuri file dari penyimpanan Anda</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                <button 
                                    onClick={handleParseManifest}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-blue-950/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    <Play size={18} />
                                    Mulai Sesi Pemindaian
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
                                                    <span>Target: <strong>{item.totalTarget} Koli</strong></span>
                                                    <span>Cocok: <strong className="text-emerald-400">{item.totalScanned} Koli</strong></span>
                                                    {item.totalTarget - item.totalScanned > 0 && (
                                                        <span className="text-red-400">Kurang: <strong>{item.totalTarget - item.totalScanned}</strong></span>
                                                    )}
                                                    {item.totalExtra > 0 && (
                                                        <span className="text-yellow-400">Lebih: <strong>{item.totalExtra}</strong></span>
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
                            
                            {/* Flash Alert Box */}
                            <div className={`border rounded-3xl p-6 shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col items-center text-center gap-4 ${
                                flashEffect === 'green' ? 'bg-emerald-950/90 border-emerald-500 scale-[1.01] shadow-emerald-950/30' :
                                flashEffect === 'yellow' ? 'bg-yellow-950/90 border-yellow-500 scale-[1.01] shadow-yellow-950/30' :
                                flashEffect === 'red' ? 'bg-red-950/90 border-red-500 scale-[1.01] shadow-red-950/30' :
                                'bg-slate-950 border-slate-800'
                            }`}>
                                {/* Icon display */}
                                {scanAlert.type === 'success' && <CheckCircle className="text-emerald-400 animate-bounce" size={48} />}
                                {scanAlert.type === 'duplicate' && <AlertTriangle className="text-yellow-400 animate-pulse" size={48} />}
                                {scanAlert.type === 'error' && <AlertCircle className="text-red-400 animate-shake" size={48} />}
                                {scanAlert.type === 'idle' && <Barcode className="text-blue-500" size={48} />}

                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-widest ${
                                        scanAlert.type === 'success' ? 'text-emerald-400' :
                                        scanAlert.type === 'duplicate' ? 'text-yellow-400' :
                                        scanAlert.type === 'error' ? 'text-red-400' :
                                        'text-blue-400'
                                    }`}>
                                        {scanAlert.type === 'success' ? 'COCOK' :
                                         scanAlert.type === 'duplicate' ? 'DUPLIKAT' :
                                         scanAlert.type === 'error' ? 'SELISIH LEBIH' :
                                         'STATUS'}
                                    </p>
                                    <h3 className="text-lg md:text-xl font-bold text-white mt-1">
                                        {scanAlert.message}
                                    </h3>
                                    {scanAlert.code && (
                                        <p className="mt-2 font-mono text-2xl font-black bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl inline-block text-white shadow-inner">
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
                                        onClick={() => setIsCameraActive(!isCameraActive)}
                                        className={`w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 border transition-all ${
                                            isCameraActive 
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
                            
                            {/* Target stats summary card */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Scanned</span>
                                    <span className="text-3xl font-black text-emerald-400 mt-1">{totalScanned} <span className="text-xs font-bold text-slate-500">/ {totalTarget}</span></span>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unlisted (Lebih)</span>
                                    <span className="text-3xl font-black text-red-400 mt-1">{totalExtra}</span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <span>Penyelesaian</span>
                                    <span>{scanPercentage}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                        style={{ width: `${scanPercentage}%` }}
                                    />
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

                            {/* Realtime Target List */}
                            <div className="flex-1 flex flex-col gap-2.5 overflow-hidden mt-1">
                                <h3 className="font-bold text-xs text-slate-300 flex justify-between items-center">
                                    <span>Daftar Manifest ({totalTarget} Koli)</span>
                                    {driverName && <span className="text-[10px] font-bold text-blue-400 bg-blue-950/20 px-2 py-0.5 rounded border border-blue-900/50 uppercase">{sessionType} - TRUK {noPolisi || ''}</span>}
                                </h3>
                                
                                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                                    {filteredManifest.length === 0 ? (
                                        <div className="text-center py-8 text-slate-600 text-xs italic">
                                            Tidak ada hasil pencocokan kode TO
                                        </div>
                                    ) : (
                                        filteredManifest.map((item, idx) => {
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
                                                        <div className="flex gap-2 justify-end pt-1 border-t border-slate-800/60 mt-1">
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
                                                );
                                            }

                                            return (
                                                <div 
                                                    key={item.id} 
                                                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                                                        item.status === 'scanned' 
                                                            ? 'bg-emerald-950/10 border-emerald-900/30 text-emerald-400' 
                                                            : 'bg-slate-900/40 border-slate-800/80 text-slate-400'
                                                    }`}
                                                >
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-650 font-mono w-4">{idx + 1}.</span>
                                                            <span className="font-mono font-bold text-xs tracking-wide">{item.code}</span>
                                                        </div>
                                                        {(item.jmlhPaket !== undefined || item.berat !== undefined || item.toType || item.dgType) && (
                                                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-slate-500 font-medium pl-6">
                                                                {item.jmlhPaket !== undefined && <span>{item.jmlhPaket} Pkt</span>}
                                                                {item.berat !== undefined && <span>{item.berat} kg</span>}
                                                                {item.toType && <span className="bg-slate-800/50 px-1 rounded text-[8px]">{item.toType}</span>}
                                                                {item.dgType && <span className="bg-slate-800/50 px-1 rounded text-[8px]">{item.dgType}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {item.status === 'scanned' ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[8px] bg-emerald-950 border border-emerald-900 px-2 py-0.5 rounded text-emerald-400 font-bold font-mono">{item.scanTime}</span>
                                                                <button 
                                                                    onClick={() => handleStartEditItem(item)}
                                                                    className="p-1 bg-slate-850 hover:bg-slate-750 border border-slate-750 text-slate-350 hover:text-white rounded-lg transition-all"
                                                                    title="Edit Data TO"
                                                                >
                                                                    <Edit size={10} />
                                                                </button>
                                                                <Check size={14} className="text-emerald-400" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[8px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-550 font-bold font-mono">PENDING</span>
                                                                <button 
                                                                    onClick={() => handleStartEditItem(item)}
                                                                    className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-all"
                                                                    title="Edit Data TO"
                                                                >
                                                                    <Edit size={10} />
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
                                            );
                                        })
                                    )}

                                    {/* Display extra scans if any and if it matches search term */}
                                    {extraScans
                                        .filter(item => item.code.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map((item, idx) => (
                                            <div 
                                                key={item.id || `extra-${idx}`}
                                                className="p-2.5 rounded-xl border bg-red-950/10 border-red-900/30 text-red-400 flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-red-700 font-mono w-4">+</span>
                                                    <span className="font-mono font-bold text-xs tracking-wide">{item.code}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[8px] bg-red-950 border border-red-900 px-2 py-0.5 rounded text-red-400 font-bold font-mono">{item.scanTime}</span>
                                                    <span className="text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded">LEBIH</span>
                                                    <button 
                                                        onClick={() => handleDeleteExtraScan(item.id, item.code)}
                                                        className="p-1 bg-red-950 hover:bg-red-900/60 border border-red-900/30 hover:border-red-800 text-red-450 hover:text-white rounded-lg transition-all"
                                                        title="Hapus Koli Lebih"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
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
                            
                            {/* Document Head */}
                            <div className="w-full flex justify-between items-start border-b-2 border-slate-800 pb-4">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-bold tracking-wide uppercase text-white font-serif">
                                        CV. CAHAYA CARGO EXPRESS
                                    </h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                        LAPORAN HASIL PEMINDAIAN BARCODE DHS
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Tanggal Sesi: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <span className="text-xs font-black bg-blue-600 px-3.5 py-1.5 rounded-lg border border-blue-500 uppercase tracking-wider">
                                    {sessionType}
                                </span>
                            </div>

                            {/* Session Information Details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
                                <div>
                                    <span className="text-slate-400 uppercase font-semibold">Tipe Operasi</span>
                                    <p className="font-bold text-sm text-white mt-0.5">{sessionType} KOLI</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-semibold">Nama Driver</span>
                                    <p className="font-bold text-sm text-white mt-0.5">{driverName.toUpperCase() || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-semibold">No. Polisi (Plat)</span>
                                    <p className="font-bold text-sm text-white mt-0.5">{noPolisi.toUpperCase() || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-semibold">Status Penyelesaian</span>
                                    <p className="font-bold text-sm text-white mt-0.5">{scanPercentage}% Selesai</p>
                                </div>
                            </div>

                            {/* Statistics Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Manifest</span>
                                    <span className="text-3xl font-black text-white mt-1">{totalTarget}</span>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cocok (Terverifikasi)</span>
                                    <span className="text-3xl font-black text-emerald-400 mt-1">{totalScanned}</span>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selisih Kurang</span>
                                    <span className={`text-3xl font-black mt-1 ${totalPending > 0 ? 'text-red-400' : 'text-slate-400'}`}>{totalPending}</span>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selisih Lebih</span>
                                    <span className={`text-3xl font-black mt-1 ${totalExtra > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>{totalExtra}</span>
                                </div>
                            </div>

                            {/* Table of Results */}
                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <h3 className="font-bold text-sm text-slate-300">Rincian Hasil Pengecekan Koli:</h3>
                                
                                <div className="border border-slate-800 rounded-2xl overflow-hidden text-xs">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[9px] md:text-[10px]">
                                                <th className="p-3 text-center w-[5%]">No</th>
                                                <th className="p-3 w-[25%]">Nomor TO</th>
                                                <th className="p-3 text-center w-[12%]">Jmlh Paket</th>
                                                <th className="p-3 text-center w-[12%]">Berat (kg)</th>
                                                <th className="p-3 text-center w-[12%]">TO Type</th>
                                                <th className="p-3 text-center w-[12%]">DG Type</th>
                                                <th className="p-3 w-[12%]">Waktu Scan</th>
                                                <th className="p-3 text-right w-[10%]">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {manifest.map((item, idx) => (
                                                <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                                                    <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}.</td>
                                                    <td className="p-3 font-mono font-bold text-white tracking-wide">{item.code}</td>
                                                    <td className="p-3 text-center font-mono text-slate-350">{item.jmlhPaket !== undefined ? item.jmlhPaket : '-'}</td>
                                                    <td className="p-3 text-center font-mono text-slate-350">{item.berat !== undefined ? item.berat.toFixed(3) : '-'}</td>
                                                    <td className="p-3 text-center text-slate-350">{item.toType || '-'}</td>
                                                    <td className="p-3 text-center text-slate-350">{item.dgType || '-'}</td>
                                                    <td className="p-3 font-mono text-slate-400">{item.scanTime || '-'}</td>
                                                    <td className="p-3 text-right">
                                                        {item.status === 'scanned' ? (
                                                            <span className="text-[9px] bg-emerald-950 border border-emerald-900 text-emerald-400 font-black px-2 py-0.5 rounded">COCOK</span>
                                                        ) : (
                                                            <span className="text-[9px] bg-red-950 border border-red-900 text-red-400 font-black px-2 py-0.5 rounded">KURANG</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {extraScans.map((item, idx) => (
                                                <tr key={`extra-report-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/30 bg-red-950/5">
                                                    <td className="p-3 text-center text-red-500 font-mono">+</td>
                                                    <td className="p-3 font-mono font-bold text-red-400 tracking-wide">{item.code}</td>
                                                    <td className="p-3 text-center font-mono text-slate-500">-</td>
                                                    <td className="p-3 text-center font-mono text-slate-500">-</td>
                                                    <td className="p-3 text-center text-slate-500">-</td>
                                                    <td className="p-3 text-center text-slate-500">-</td>
                                                    <td className="p-3 font-mono text-slate-400">{item.scanTime}</td>
                                                    <td className="p-3 text-right">
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

                            {/* Render Berita Acara Document inside Report (only if created) */}
                            {baCreated && (
                                <div className="page-break pt-8 mt-8 border-t-2 border-dashed border-slate-800 space-y-6">
                                    {/* BA Document Head */}
                                    <div className="text-center space-y-1">
                                        <h2 className="text-xl font-bold uppercase tracking-wider font-serif text-white">BERITA ACARA SELISIH BARANG</h2>
                                        <p className="text-xs font-mono font-semibold text-slate-400">Nomor: {baNo}</p>
                                        <p className="text-xs text-slate-400">Tanggal: {new Date(baDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                    </div>

                                    {/* BA Narration */}
                                    <div className="text-xs text-slate-300 leading-relaxed space-y-2.5">
                                        <p>
                                            Pada hari ini, <span className="font-bold text-white">{new Date(baDate).toLocaleDateString('id-ID', { weekday: 'long' })}</span> tanggal <span className="font-bold text-white">{new Date(baDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>, bertempat di Gudang CV. Cahaya Cargo Express, kami yang bertanda tangan di bawah ini telah melakukan pemeriksaan fisik kargo pada saat proses <span className="font-bold text-white">{sessionType}</span> koli dengan rincian operasional sebagai berikut:
                                        </p>
                                        <ul className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-1 font-semibold text-slate-200 pl-6 list-disc">
                                            <li>Nama Driver / Pengemudi: <span className="text-blue-400">{driverName.toUpperCase() || '-'}</span></li>
                                            <li>No. Polisi Armada Truk: <span className="text-blue-400">{noPolisi.toUpperCase() || '-'}</span></li>
                                            <li>Tipe Sesi Pemindaian: <span className="text-blue-400">{sessionType} DHS</span></li>
                                        </ul>
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
                                                    {baSelectedTOs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="p-4 text-center text-slate-500 italic">Tidak ada TO spesifik yang dilampirkan.</td>
                                                        </tr>
                                                    ) : (
                                                        baSelectedTOs.map((code, idx) => {
                                                            const isExtra = extraScans.some(item => item.code === code);
                                                            return (
                                                                <tr key={`ba-to-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                                                                    <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}.</td>
                                                                    <td className="p-3 font-mono font-bold text-white">{code}</td>
                                                                    <td className="p-3">
                                                                        {isExtra ? (
                                                                            <span className="text-[10px] text-yellow-500 font-bold">SELISIH LEBIH</span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-red-500 font-bold">SELISIH KURANG</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 text-right">
                                                                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-350 px-2 py-0.5 rounded font-black">
                                                                            {isExtra ? 'TIDAK ADA DI MANIFEST' : 'BELUM SCAN'}
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

                                    {/* Signatures block */}
                                    <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs text-slate-300">
                                        <div className="space-y-12">
                                            <p className="font-semibold text-slate-400 uppercase tracking-wider">PIHAK I (Pengemudi/Driver)</p>
                                            <div className="w-28 border-b border-slate-700 mx-auto"></div>
                                            <p className="font-bold text-white text-[10px] uppercase font-mono">{driverName || '( Arm Driver )'}</p>
                                        </div>
                                        <div className="space-y-12">
                                            <p className="font-semibold text-slate-400 uppercase tracking-wider">PIHAK II (Checker/Penerima)</p>
                                            <div className="w-28 border-b border-slate-700 mx-auto"></div>
                                            <p className="font-bold text-white text-[10px] uppercase font-mono">( Staff Warehouse )</p>
                                        </div>
                                        <div className="space-y-12">
                                            <p className="font-semibold text-slate-400 uppercase tracking-wider">MENGETAHUI (Warehouse Head)</p>
                                            <div className="w-28 border-b border-slate-700 mx-auto"></div>
                                            <p className="font-bold text-white text-[10px] uppercase font-mono">( Kepala Gudang )</p>
                                        </div>
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
                    body {
                        background: white !important;
                        color: black !important;
                        padding: 15mm !important;
                    }
                    #print-dhs-report {
                        background: white !important;
                        color: black !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    }
                    #print-dhs-report * {
                        color: black !important;
                        border-color: black !important;
                    }
                    #print-dhs-report .bg-slate-900, #print-dhs-report .bg-slate-50 {
                        background: #f1f5f9 !important;
                    }
                    #print-dhs-report .text-emerald-400, #print-dhs-report .text-emerald-500 {
                        color: #047857 !important;
                    }
                    #print-dhs-report .text-red-400, #print-dhs-report .text-red-500 {
                        color: #b91c1c !important;
                    }
                    .page-break {
                        page-break-before: always;
                        break-before: page;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
                    }
                }
                `
            }} />
        </div>
    );
}
