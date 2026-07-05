'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Calculator, Package, Copy, RotateCcw, Info, Plus, Trash2, DollarSign, Printer, User, ArrowRight, Box, Pencil, X, Save, History, CheckCircle, CopyPlus, Upload, Barcode, Scan, Camera } from 'lucide-react';
import {
    calculateDimensions,
    formatWeight,
    formatVolume,
    validateDimensions
} from '@/lib/volume-calculator';
import { saveVolumeSession, updateVolumeSession, getVolumeSessionById } from '@/lib/firestore-volume-sessions';
import type { VolumeCalculatorFormData, VolumeCalculation, KoliItem } from '@/types/volume-calculation';
import { VOLUMETRIC_DIVISOR } from '@/types/volume-calculation';
import VoiceAgentPanel from './VoiceAgentPanel';

function parseImportedTxt(text: string): { senderName: string; koliList: KoliItem[] } | null {
    const lines = text.split(/\r?\n/);
    let senderName = '';
    const koliList: KoliItem[] = [];
    
    let currentKoliNum: number | null = null;
    let currentKoliName = '';
    let currentQty = 1;
    let currentLength = 0;
    let currentWidth = 0;
    let currentHeight = 0;
    let currentActualWeight = 0;
    let inKoliBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('Pengirim:')) {
            senderName = line.replace('Pengirim:', '').trim();
            continue;
        }
        
        const koliMatch = line.match(/^Koli\s+(\d+)\s*-\s*(.+):$/i);
        if (koliMatch) {
            if (inKoliBlock && currentKoliNum !== null) {
                const calc = calculateDimensions({
                    length: currentLength,
                    width: currentWidth,
                    height: currentHeight,
                    actualWeight: currentActualWeight,
                    quantity: currentQty,
                    itemName: currentKoliName
                });
                koliList.push({
                    ...calc,
                    koliNumber: currentKoliNum
                });
            }
            
            currentKoliNum = parseInt(koliMatch[1]);
            currentKoliName = koliMatch[2].trim();
            currentQty = 1;
            currentLength = 0;
            currentWidth = 0;
            currentHeight = 0;
            currentActualWeight = 0;
            inKoliBlock = true;
            continue;
        }
        
        if (inKoliBlock) {
            if (line.startsWith('Jumlah:')) {
                const qtyMatch = line.match(/Jumlah:\s*(\d+)/i);
                if (qtyMatch) currentQty = parseInt(qtyMatch[1]);
            } else if (line.startsWith('Dimensi:')) {
                const dimMatch = line.replace('Dimensi:', '').match(/(\d+(?:\.\d+)?)\s*[\u00d7xX*]\s*(\d+(?:\.\d+)?)\s*[\u00d7xX*]\s*(\d+(?:\.\d+)?)/);
                if (dimMatch) {
                    currentLength = parseFloat(dimMatch[1]);
                    currentWidth = parseFloat(dimMatch[2]);
                    currentHeight = parseFloat(dimMatch[3]);
                }
            } else if (line.startsWith('Berat Aktual (Satuan):')) {
                const weightMatch = line.match(/Berat Aktual \(Satuan\):\s*(\d+(?:\.\d+)?)/i);
                if (weightMatch) currentActualWeight = parseFloat(weightMatch[1]);
            } else if (line.startsWith('==================================================') || line.startsWith('Total Koli:')) {
                if (currentKoliNum !== null) {
                    const calc = calculateDimensions({
                        length: currentLength,
                        width: currentWidth,
                        height: currentHeight,
                        actualWeight: currentActualWeight,
                        quantity: currentQty,
                        itemName: currentKoliName
                    });
                    koliList.push({
                        ...calc,
                        koliNumber: currentKoliNum
                    });
                    currentKoliNum = null;
                }
                inKoliBlock = false;
            }
        }
    }
    
    if (inKoliBlock && currentKoliNum !== null) {
        const calc = calculateDimensions({
            length: currentLength,
            width: currentWidth,
            height: currentHeight,
            actualWeight: currentActualWeight,
            quantity: currentQty,
            itemName: currentKoliName
        });
        koliList.push({
            ...calc,
            koliNumber: currentKoliNum
        });
    }
    
    return koliList.length > 0 ? { senderName, koliList } : null;
}

export default function VolumeCalculator() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);
 
    const handleImportTxt = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const result = parseImportedTxt(text);
            if (result) {
                if (result.senderName) {
                    setSenderName(result.senderName);
                }
                setKoliList(result.koliList);
                setIsSessionActive(true);
                setSavedSessionId(null);
                setErrors([]);
                alert(`Berhasil mengimport ${result.koliList.length} koli untuk pengirim "${result.senderName || senderName}"!`);
            } else {
                alert('Format file TXT tidak dikenali. Pastikan file sesuai dengan format perhitungan volume Cahaya Cargo Express.');
            }
        };
        reader.onerror = () => {
            alert('Gagal membaca file.');
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Session State
    const [senderName, setSenderName] = useState<string>('');
    const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
    const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState<VolumeCalculatorFormData>({
        length: 0,
        width: 0,
        height: 0,
        actualWeight: 0,
        quantity: 1,
        itemName: '',
        barcode: ''
    });

    // Barcode Scanner States
    const [scanInputVal, setScanInputVal] = useState<string>('');
    const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
    const [barcodeSuccess, setBarcodeSuccess] = useState<string | null>(null);
    const [scannerError, setScannerError] = useState<string | null>(null);

    const [koliList, setKoliList] = useState<KoliItem[]>([]);
    const [pricePerKg, setPricePerKg] = useState<number>(0);
    const [errors, setErrors] = useState<string[]>([]);
    const [showInfo, setShowInfo] = useState(false);
    const [editingKoliNumber, setEditingKoliNumber] = useState<number | null>(null);

    // Live Calculation
    const liveCalculation = useMemo(() => {
        if (formData.length > 0 && formData.width > 0 && formData.height > 0) {
            return calculateDimensions(formData);
        }
        return null;
    }, [formData]);

    // Focus ref for itemName
    const itemNameInputRef = useRef<HTMLInputElement>(null);

    // Sound Feedback using Web Audio API
    const playBeep = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime); // 800Hz beep sound
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {
            console.error('Audio play failed:', e);
        }
    };

    const handleBarcodeScan = (scannedCode: string) => {
        if (!scannedCode || scannedCode.trim() === '') return;
        const code = scannedCode.trim();
        playBeep();

        // Check if there is an item in the koliList with this barcode
        const match = koliList.find(k => k.barcode === code);

        if (match) {
            setFormData({
                length: match.length,
                width: match.width,
                height: match.height,
                actualWeight: match.actualWeight,
                quantity: match.quantity || 1,
                itemName: match.itemName,
                barcode: code
            });
            setBarcodeSuccess(`Barcode dikenali! Menyalin data dari koli #${match.koliNumber} (${match.itemName}).`);
            setTimeout(() => setBarcodeSuccess(null), 4000);
        } else {
            setFormData(prev => ({
                ...prev,
                barcode: code
            }));
            setBarcodeSuccess(`Barcode "${code}" terbaca! Silakan lengkapi nama barang & dimensinya.`);
            setTimeout(() => setBarcodeSuccess(null), 4000);
            if (itemNameInputRef.current) {
                setTimeout(() => itemNameInputRef.current?.focus(), 100);
            }
        }
        setScanInputVal('');
    };

    useEffect(() => {
        if (!isScannerOpen) return;
        let html5QrCode: any = null;
        let isMounted = true;

        import('html5-qrcode').then((module) => {
            if (!isMounted) return;
            const Html5QrcodeClass = module.Html5Qrcode;
            html5QrCode = new Html5QrcodeClass("camera-scanner-reader");

            const config = {
                fps: 10,
                qrbox: (width: number, height: number) => {
                    const size = Math.min(width, height) * 0.7;
                    return { width: size, height: size };
                }
            };

            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    handleBarcodeScan(decodedText);
                    setIsScannerOpen(false);
                },
                (errorMessage: string) => {
                    // Ignore verbose scanning noise logs
                }
            ).catch((err: any) => {
                console.error("Camera scanner start failed:", err);
                setScannerError("Gagal mengakses kamera. Berikan izin akses kamera.");
            });
        }).catch(err => {
            console.error("Failed to load html5-qrcode module:", err);
            setScannerError("Modul scanner gagal dimuat.");
        });

        return () => {
            isMounted = false;
            if (html5QrCode) {
                if (html5QrCode.isScanning) {
                    html5QrCode.stop().then(() => {
                        html5QrCode.clear();
                    }).catch((err: any) => {
                        console.error("Failed to stop scanner on clean:", err);
                    });
                }
            }
        };
    }, [isScannerOpen, koliList]);

    const handleStartSession = (e: React.FormEvent) => {
        e.preventDefault();
        if (senderName.trim() === '') {
            setErrors(['Nama pengirim tidak boleh kosong']);
            return;
        }
        setErrors([]);
        setIsSessionActive(true);
    };

    const handleInputChange = (field: keyof VolumeCalculatorFormData, value: number | string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors([]);
    };

    const handleAddKoli = () => {
        const validation = validateDimensions(
            formData.length,
            formData.width,
            formData.height,
            formData.actualWeight
        );

        const newErrors = [...validation.errors];
        if (!formData.itemName || formData.itemName.trim() === '') {
            newErrors.push('Nama/Tipe barang harus diisi');
        }

        if (newErrors.length > 0) {
            setErrors(newErrors);
            return;
        }

        const calculation = calculateDimensions(formData);
        const newKoli: KoliItem = {
            ...calculation,
            koliNumber: koliList.length > 0 ? Math.max(...koliList.map(k => k.koliNumber)) + 1 : 1
        };

        setKoliList(prev => [...prev, newKoli]);

        setFormData(prev => ({ length: 0, width: 0, height: 0, actualWeight: 0, quantity: 1, itemName: prev.itemName, barcode: '' })); // Keep item name, clear barcode
        setErrors([]);
        if (itemNameInputRef.current) itemNameInputRef.current.focus();
    };

    const handleVoiceItemParsed = (item: {
        itemName: string;
        length: number;
        width: number;
        height: number;
        actualWeight: number;
        quantity: number;
    }) => {
        const calculation = calculateDimensions({
            length: item.length,
            width: item.width,
            height: item.height,
            actualWeight: item.actualWeight,
            quantity: item.quantity,
            itemName: item.itemName.toUpperCase(),
            barcode: ''
        });

        setKoliList(prev => {
            const nextKoliNumber = prev.length > 0 ? Math.max(...prev.map(k => k.koliNumber)) + 1 : 1;
            const newKoli: KoliItem = {
                ...calculation,
                koliNumber: nextKoliNumber
            };
            return [...prev, newKoli];
        });
        setErrors([]);
    };

    const handleCopyPreviousDimensions = () => {
        if (koliList.length === 0) return;
        const lastKoli = koliList[koliList.length - 1];
        setFormData(prev => ({
            ...prev,
            length: lastKoli.length,
            width: lastKoli.width,
            height: lastKoli.height,
            itemName: lastKoli.itemName, // Copy item name too
            barcode: '' // Reset barcode for new item
        }));
        setErrors([]);
    };

    const handleEditKoli = (koliNumber: number) => {
        const koli = koliList.find(k => k.koliNumber === koliNumber);
        if (!koli) return;
        setEditingKoliNumber(koliNumber);
        setFormData({
            length: koli.length,
            width: koli.width,
            height: koli.height,
            actualWeight: koli.actualWeight,
            quantity: koli.quantity,
            itemName: koli.itemName,
            barcode: koli.barcode || ''
        });
        setErrors([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleUpdateKoli = () => {
        if (editingKoliNumber === null) return;
        const validation = validateDimensions(formData.length, formData.width, formData.height, formData.actualWeight);
        const newErrors = [...validation.errors];
        if (!formData.itemName || formData.itemName.trim() === '') newErrors.push('Nama/Tipe barang harus diisi');
        if (newErrors.length > 0) { setErrors(newErrors); return; }

        const calculation = calculateDimensions(formData);
        setKoliList(prev => prev.map(k =>
            k.koliNumber === editingKoliNumber ? { ...calculation, koliNumber: editingKoliNumber } : k
        ));
        setEditingKoliNumber(null);
        setFormData({ length: 0, width: 0, height: 0, actualWeight: 0, quantity: 1, itemName: '', barcode: '' });
        setErrors([]);
    };

    const handleCancelEdit = () => {
        setEditingKoliNumber(null);
        setFormData({ length: 0, width: 0, height: 0, actualWeight: 0, quantity: 1, itemName: '', barcode: '' });
        setErrors([]);
    };

    const handleRemoveKoli = (koliNumber: number) => {
        setKoliList(prev => {
            const filtered = prev.filter(k => k.koliNumber !== koliNumber);
            return filtered.map((k, index) => ({ ...k, koliNumber: index + 1 }));
        });
    };

    const handleReset = () => {
        if (confirm('Apakah Anda yakin ingin mereset seluruh halaman ini?')) {
            setSenderName('');
            setIsSessionActive(false);
            setFormData({
                length: 0,
                width: 0,
                height: 0,
                actualWeight: 0,
                quantity: 1,
                itemName: '',
                barcode: ''
            });
            setKoliList([]);
            setPricePerKg(0);
            setErrors([]);
        }
    };

    const handleCopyResult = () => {
        if (koliList.length === 0) return;

        let text = `Hasil Perhitungan Volume - Cahaya Cargo Express\n`;
        text += `Pengirim: ${senderName}\n`;
        text += `${'='.repeat(50)}\n\n`;

        koliList.forEach(koli => {
            text += `Koli ${koli.koliNumber} - ${koli.itemName}${koli.barcode ? ` (Barcode: ${koli.barcode})` : ''}:\n`;
            text += `  Jumlah: ${koli.quantity} pcs\n`;
            text += `  Dimensi: ${koli.length} × ${koli.width} × ${koli.height} cm\n`;
            text += `  Total Volume: ${formatVolume(koli.volume)} cm³\n`;
            text += `  Berat Aktual (Satuan): ${formatWeight(koli.actualWeight)} kg\n`;
            text += `  Total Berat Volume: ${formatWeight(koli.volumetricWeight)} kg\n`;
            text += `  Berat Tagihan: ${formatWeight(koli.chargeableWeight)} kg (${koli.weightType === 'actual' ? 'Actual' : 'Volumetric'})\n\n`;
        });

        text += `${'='.repeat(50)}\n`;
        text += `Total Koli: ${koliList.length}\n`;
        text += `Total Berat Tagihan: ${formatWeight(totalWeight)} kg\n`;

        if (pricePerKg > 0) {
            text += `Harga per kg: Rp ${pricePerKg.toLocaleString('id-ID')}\n`;
            text += `TOTAL BIAYA: Rp ${totalPrice.toLocaleString('id-ID')}\n`;
        }

        navigator.clipboard.writeText(text);
        alert('Hasil berhasil disalin ke clipboard!');
    };

    const handlePrint = () => {
        if (koliList.length === 0) return;
        try {
            sessionStorage.setItem('cce_print_koliList', JSON.stringify(koliList));
            sessionStorage.setItem('cce_print_pricePerKg', pricePerKg.toString());
            sessionStorage.setItem('cce_print_senderName', senderName);
        } catch (e) {
            console.error('Failed to save print session to sessionStorage:', e);
        }
        router.push('/tools/volume-calculator/print?source=session');
    };

    const handleSaveSession = async () => {
        if (koliList.length === 0 || !user) return;
        setIsSaving(true);
        try {
            const sessionData = {
                senderName,
                pricePerKg,
                koliList,
                totalWeight,
                totalPrice,
                createdBy: user.uid,
                createdByName: user.displayName || user.email || '',
            };
            if (savedSessionId) {
                await updateVolumeSession(savedSessionId, sessionData);
            } else {
                const newId = await saveVolumeSession(user.uid, sessionData);
                setSavedSessionId(newId);
            }
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            console.error(e);
            alert('Gagal menyimpan sesi. Coba lagi.');
        } finally {
            setIsSaving(false);
        }
    };

    // Load session from URL param ?session=<id>
    useEffect(() => {
        const sessionId = searchParams.get('session');
        if (!sessionId || !isClient) return;
        getVolumeSessionById(sessionId).then(session => {
            if (!session) return;
            setSenderName(session.senderName);
            setPricePerKg(session.pricePerKg);
            setKoliList(session.koliList);
            setSavedSessionId(session.id);
            setIsSessionActive(true);
        }).catch(console.error);
    }, [isClient, searchParams]);

    const groupedKoliList = useMemo(() => {
        const groups: Record<string, KoliItem[]> = {};
        koliList.forEach(koli => {
            const key = koli.itemName.toUpperCase(); // Group case-insensitively
            if (!groups[key]) groups[key] = [];
            groups[key].push({ ...koli, itemName: key }); // Ensure display is consistent
        });
        return Object.keys(groups).sort().map(itemName => ({
            itemName,
            items: groups[itemName].sort((a, b) => a.koliNumber - b.koliNumber),
            totalChargeableWeight: groups[itemName].reduce((sum, item) => sum + item.chargeableWeight, 0)
        }));
    }, [koliList]);

    const totalWeight = koliList.reduce((sum, koli) => sum + koli.chargeableWeight, 0);
    const totalPrice = totalWeight * pricePerKg;

    if (!isClient) return null;

    // --- Modal / Start Session View ---
    if (!isSessionActive) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full mx-auto transform transition-all duration-500 hover:scale-[1.02]">
                <div className="text-center mb-6">
                        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Box className="text-blue-600" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Kalkulator Volume</h2>
                        <p className="text-gray-500 mt-2 text-sm">Hitung akurat berat tagihan untuk Cahaya Cargo Express</p>
                    </div>

                    <form onSubmit={handleStartSession} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Pengirim</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="text-gray-400" size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={(e) => {
                                        setSenderName(e.target.value);
                                        setErrors([]);
                                    }}
                                    className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium"
                                    placeholder="Masukkan nama pengirim / perusahaan"
                                    autoFocus
                                />
                            </div>
                            {errors.length > 0 && <p className="text-red-500 text-sm mt-2 font-medium animate-pulse">{errors[0]}</p>}
                        </div>

                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all shadow-lg hover:shadow-blue-500/30"
                        >
                            Mulai Perhitungan <ArrowRight size={20} />
                        </button>

                        <div className="relative flex items-center justify-center py-2">
                            <div className="border-t border-gray-200 w-full absolute"></div>
                            <span className="bg-white px-3 text-xs text-gray-400 uppercase font-semibold relative z-10">Atau</span>
                        </div>

                        <label className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-base active:scale-[0.98] transition-all cursor-pointer shadow-sm">
                            <Upload size={20} className="text-gray-500" />
                            Import File Txt Perhitungan
                            <input
                                type="file"
                                accept=".txt"
                                onChange={handleImportTxt}
                                className="hidden"
                            />
                        </label>
                    </form>

                    {/* Link ke riwayat */}
                    <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                        <button
                            onClick={() => router.push('/tools/volume-calculator/history')}
                            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors"
                        >
                            <History size={16} /> Lihat Riwayat Perhitungan
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Main Calculator View ---
    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in zoom-in duration-500">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        <User size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-blue-200 text-sm font-medium">Session Aktif</p>
                        <h2 className="text-2xl font-bold tracking-tight">Pengirim: {senderName}</h2>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    <label className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-all backdrop-blur-sm cursor-pointer">
                        <Upload size={16} /> Import TXT
                        <input
                            type="file"
                            accept=".txt"
                            onChange={handleImportTxt}
                            className="hidden"
                        />
                    </label>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-red-500/80 text-white rounded-lg text-sm font-medium transition-all backdrop-blur-sm"
                    >
                        <RotateCcw size={16} /> Ganti Pengirim
                    </button>
                </div>
            </div>

            {/* Input Form Card */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-50 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className={`p-2 rounded-lg ${editingKoliNumber !== null ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {editingKoliNumber !== null ? <Pencil size={24} /> : <Package size={24} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                            {editingKoliNumber !== null ? `Edit Koli #${editingKoliNumber}` : `Input Data Koli ${koliList.length > 0 ? `#${koliList.length + 1}` : 'Pertama'}`}
                        </h3>
                        {editingKoliNumber !== null && <p className="text-xs text-amber-600 font-medium mt-0.5">Mode edit aktif — ubah data lalu simpan</p>}
                    </div>
                </div>

                {/* AI Voice Input Panel */}
                <div className="relative z-10">
                    <VoiceAgentPanel onItemParsed={handleVoiceItemParsed} />
                </div>

                {/* Barcode Scanner Section */}
                <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 relative z-10">
                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                        <div className="p-2 bg-blue-600 text-white rounded-lg">
                            <Scan size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">Scan Barcode Barang</h4>
                            <p className="text-[11px] text-gray-500">Scan kode untuk auto-fill jika ada koli yang sama</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Barcode size={18} />
                            </div>
                            <input
                                type="text"
                                value={scanInputVal}
                                onChange={(e) => setScanInputVal(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleBarcodeScan(scanInputVal);
                                    }
                                }}
                                className="pl-10 pr-24 w-full px-4 py-2.5 border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all text-sm bg-white"
                                placeholder="Fokuskan & scan barcode / ketik manual..."
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleBarcodeScan(scanInputVal)}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors"
                                >
                                    Cari
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setScannerError(null);
                                setIsScannerOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shrink-0 shadow-sm"
                        >
                            <Camera size={16} />
                            <span className="hidden sm:inline">Kamera</span>
                        </button>
                    </div>
                </div>

                {/* Barcode Success Notification */}
                {barcodeSuccess && (
                    <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-2 relative z-10">
                        <CheckCircle className="text-green-600 shrink-0" size={18} />
                        <span>{barcodeSuccess}</span>
                    </div>
                )}

                {/* Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                    
                    {/* Row 1: Item Info & Weight */}
                    <div className="md:col-span-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nama / Tipe Barang *</label>
                        <input
                            ref={itemNameInputRef}
                            type="text"
                            value={formData.itemName}
                            onChange={(e) => handleInputChange('itemName', e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                            placeholder="Contoh: Sepatu, Buku, Mesin"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Barcode</label>
                        <input
                            type="text"
                            value={formData.barcode || ''}
                            onChange={(e) => handleInputChange('barcode', e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all bg-gray-50 text-gray-600"
                            placeholder="Belum di-scan"
                            readOnly
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Berat Aktual (kg) *</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={formData.actualWeight || ''}
                                onChange={(e) => handleInputChange('actualWeight', parseFloat(e.target.value) || 0)}
                                className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                                placeholder="0"
                                min="0"
                                step="0.1"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">kg</span>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-sm font-bold text-gray-700 mb-0.5">Jumlah Koli *</label>
                        <p className="text-[10px] text-gray-500 mb-1.5 leading-tight">1 Koli = 1 paket dng dimensi sama</p>
                        <div className="relative">
                            <input
                                type="number"
                                value={formData.quantity || ''}
                                onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                                className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                                placeholder="1"
                                min="1"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">pcs</span>
                        </div>
                    </div>

                    {/* Row 2: Dimensions */}
                    <div className="md:col-span-12">
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 md:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                                <label className="block text-sm font-bold text-gray-700">Dimensi (P x L x T) *</label>
                                {koliList.length > 0 && editingKoliNumber === null && (
                                    <button
                                        type="button"
                                        onClick={handleCopyPreviousDimensions}
                                        className="text-xs font-semibold flex items-center gap-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors self-start sm:self-auto"
                                    >
                                        <CopyPlus size={14} /> Salin dari koli sebelumnya
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-3 md:gap-6">
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.length || ''}
                                        onChange={(e) => handleInputChange('length', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-center bg-white"
                                        placeholder="Panjang"
                                        min="0"
                                    />
                                    <span className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold hidden sm:block">×</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.width || ''}
                                        onChange={(e) => handleInputChange('width', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-center bg-white"
                                        placeholder="Lebar"
                                        min="0"
                                    />
                                    <span className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold hidden sm:block">×</span>
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        value={formData.height || ''}
                                        onChange={(e) => handleInputChange('height', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-center bg-white"
                                        placeholder="Tinggi (cm)"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Messages */}
                {errors.length > 0 && (
                    <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3 relative z-10 animate-in slide-in-from-top-2">
                        <Info size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold mb-1">Terjadi Kesalahan</p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                {errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Live Preview Panel */}
                {liveCalculation && (
                    <div className="mt-6 border border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-xl p-4 md:p-5 relative z-10 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                            <div className="flex-1 w-full">
                                <p className="text-xs font-bold text-blue-600/70 uppercase tracking-wider mb-1">Preview Perhitungan</p>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500">Berat Aktual</span>
                                        <span className="font-bold text-gray-900">{formatWeight(liveCalculation.actualWeight * liveCalculation.quantity)} kg</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-500">Berat Volume <span className="text-gray-400 text-xs">(/4000)</span></span>
                                        <span className="font-bold text-gray-900">{formatWeight(liveCalculation.volumetricWeight)} kg</span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full sm:w-auto bg-white rounded-lg p-3 sm:px-6 sm:py-3 shadow-sm border border-blue-100 flex flex-col items-center justify-center min-w-[140px]">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-0.5">Berat Tagihan</span>
                                <div className="flex items-end gap-1 leading-none">
                                    <span className="text-2xl font-black text-blue-600">{formatWeight(liveCalculation.chargeableWeight)}</span>
                                    <span className="text-sm font-bold text-blue-600/60 mb-0.5">kg</span>
                                </div>
                                <span className={`mt-1.5 text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase ${liveCalculation.weightType === 'actual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                    Base: {liveCalculation.weightType}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Action */}
                <div className="mt-8 relative z-10 flex flex-col md:flex-row items-center justify-end gap-4">
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="text-sm text-gray-500 hover:text-blue-600 font-medium flex items-center gap-1 md:mr-auto transition-colors"
                    >
                        <Info size={16} /> Lihat Rumus Perhitungan
                    </button>

                    {editingKoliNumber !== null ? (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                className="w-full md:w-auto px-6 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                <X size={18} /> Batal Edit
                            </button>
                            <button
                                onClick={handleUpdateKoli}
                                className="w-full md:w-auto px-8 py-3.5 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                <Pencil size={18} /> Simpan Perubahan
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleAddKoli}
                            className="w-full md:w-auto px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} strokeWidth={3} /> Masukkan ke Daftar Koli
                        </button>
                    )}
                </div>

                {/* Formula Info Expandable */}
                {showInfo && (
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm relative z-10 animate-in fade-in">
                        <p className="mb-2"><strong>Berat Volume (kg)</strong> = (P × L × T) / {VOLUMETRIC_DIVISOR}</p>
                        <p><strong>Berat Tagihan</strong> = Nilai TERTINGGI antara Berat Aktual vs Berat Volume</p>
                    </div>
                )}
            </div>

            {/* Render Koli List if Exists */}
            {koliList.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header Bar */}
                    <div className="bg-gray-50 p-4 md:p-6 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Calculator size={20} className="text-green-600" /> Daftar Koli ({koliList.length})
                            </h3>
                            {savedSessionId && (
                                <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                                    <CheckCircle size={12} /> Tersimpan — ID: {savedSessionId.slice(-6)}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                            {saveSuccess && (
                                <span className="flex items-center gap-1 text-sm font-bold text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                                    <CheckCircle size={15} /> Tersimpan!
                                </span>
                            )}
                            <button
                                onClick={handleSaveSession}
                                disabled={isSaving || koliList.length === 0}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                                <Save size={16} /> {isSaving ? 'Menyimpan...' : (savedSessionId ? 'Update Sesi' : 'Simpan Sesi')}
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                            >
                                <Printer size={16} /> Print
                            </button>
                            <button
                                onClick={handleCopyResult}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                            >
                                <Copy size={16} /> Salin
                            </button>
                            <button
                                onClick={() => router.push('/tools/volume-calculator/history')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                                title="Lihat riwayat"
                            >
                                <History size={16} /> Riwayat
                            </button>
                        </div>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto p-0">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b-2 border-gray-200">
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Koli</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider max-w-[150px]">Barang</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Qty</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Dimensi</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actual W.</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Volume W.</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Charge W.</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {groupedKoliList.map((group) => (
                                    <React.Fragment key={group.itemName}>
                                        {/* Group Header */}
                                        <tr className="bg-gray-100/80 border-y border-gray-200/60">
                                            <td colSpan={6} className="py-2.5 px-4 text-sm font-bold text-gray-800 uppercase tracking-wide">
                                                {group.itemName} <span className="text-gray-400 font-medium text-xs ml-2">({group.items.length} item)</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-sm font-black text-blue-700 text-right">
                                                {formatWeight(group.totalChargeableWeight)} kg
                                            </td>
                                            <td></td>
                                        </tr>
                                        {/* Group Items */}
                                        {group.items.map((koli) => (
                                            <tr key={koli.koliNumber} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="py-3 px-4 text-sm font-black text-gray-500 pl-6">#{koli.koliNumber}</td>
                                                <td className="py-3 px-4 text-sm font-medium text-gray-500">
                                                    {koli.barcode ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 whitespace-nowrap">
                                                            <Barcode size={12} className="shrink-0" />
                                                            {koli.barcode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-center font-medium bg-gray-50/50">{koli.quantity}</td>
                                                <td className="py-3 px-4 text-sm text-right text-gray-600 whitespace-nowrap">
                                                    {koli.length}×{koli.width}×{koli.height} <span className="text-xs text-gray-400">cm</span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right font-medium">
                                                    {formatWeight(koli.actualWeight * koli.quantity)}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right font-medium">
                                                    {formatWeight(koli.volumetricWeight)}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-green-700 text-base">{formatWeight(koli.chargeableWeight)} kg</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold uppercase mt-1 ${koli.weightType === 'actual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {koli.weightType}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => handleEditKoli(koli.koliNumber)}
                                                            className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Edit Koli"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveKoli(koli.koliNumber)}
                                                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Hapus Koli"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden">
                        {groupedKoliList.map((group) => (
                            <div key={group.itemName} className="mb-4">
                                {/* Group Header Mobile */}
                                <div className="bg-gray-100 px-4 py-2 flex items-center justify-between sticky top-0 z-10 border-y border-gray-200">
                                    <span className="font-bold text-gray-800 uppercase text-sm">{group.itemName}</span>
                                    <span className="font-black text-blue-700 text-sm">{formatWeight(group.totalChargeableWeight)} kg</span>
                                </div>
                                
                                <div className="divide-y divide-gray-100">
                                    {group.items.map((koli) => (
                                        <div key={koli.koliNumber} className="p-4 bg-white relative">
                                            <div className="flex items-start justify-between mb-3">
                                                 <div className="flex flex-wrap gap-1.5 items-center">
                                                     <span className="inline-block bg-gray-900 text-white text-xs font-black px-2 py-1 rounded">KOLI #{koli.koliNumber}</span>
                                                     {koli.barcode && (
                                                         <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 whitespace-nowrap">
                                                             <Barcode size={12} className="shrink-0" />
                                                             {koli.barcode}
                                                         </span>
                                                     )}
                                                 </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditKoli(koli.koliNumber)}
                                                        className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                                                        title="Edit Koli"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveKoli(koli.koliNumber)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm bg-gray-50 p-3 rounded-lg mb-3">
                                                <div>
                                                    <p className="text-gray-500 text-xs">Jumlah</p>
                                                    <p className="font-bold text-gray-800">{koli.quantity} pcs</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs">Dimensi (cm)</p>
                                                    <p className="font-bold text-gray-800">{koli.length}×{koli.width}×{koli.height}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs border-t border-gray-200 mt-2 pt-2">Actual Weight</p>
                                                    <p className="font-medium">{formatWeight(koli.actualWeight * koli.quantity)} kg</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs border-t border-gray-200 mt-2 pt-2">Volume Weight</p>
                                                    <p className="font-medium">{formatWeight(koli.volumetricWeight)} kg</p>
                                                </div>
                                            </div>

                                            <div className="flex items-end justify-between px-1">
                                                <div>
                                                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${koli.weightType === 'actual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        Base: {koli.weightType}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500 font-bold mb-0.5">Berat Tagihan</p>
                                                    <p className="text-xl font-black text-green-600 leading-none">{formatWeight(koli.chargeableWeight)} <span className="text-sm">kg</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Bottom Bar */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-100 p-4 md:p-6 border-t border-green-200">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                            
                            {/* Summary Left */}
                            <div className="flex flex-row items-center justify-around md:justify-start gap-8 bg-white/60 p-4 rounded-xl backdrop-blur-sm border border-white">
                                <div className="text-center md:text-left">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Koli</p>
                                    <p className="text-3xl font-black text-gray-900">{koliList.length}</p>
                                </div>
                                <div className="w-px h-12 bg-gray-300"></div>
                                <div className="text-center md:text-left">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Berat Tagihan</p>
                                    <p className="text-3xl font-black text-green-700">{formatWeight(totalWeight)} <span className="text-base font-bold text-green-600/60">kg</span></p>
                                </div>
                            </div>

                            {/* Summary Right (Pricing Box) */}
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col md:flex-row">
                                <div className="p-4 md:w-1/2 md:border-r border-gray-100 bg-gray-50/50">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Estimasi Tarif (per kg)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                                        <input
                                            type="number"
                                            value={pricePerKg || ''}
                                            onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-bold text-lg text-gray-900 transition-all"
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="p-6 md:w-1/2 bg-gradient-to-br from-green-600 to-emerald-600 text-white flex flex-col justify-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <DollarSign size={80} />
                                    </div>
                                    <p className="text-xs font-bold text-green-100 uppercase tracking-wider mb-1 relative z-10">Total Biaya</p>
                                    <div className="relative z-10 flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-green-200">Rp</span>
                                        <span className="text-3xl sm:text-4xl font-black tracking-tight">{totalPrice.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Scan Keyframe animation stylesheet */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes scan {
                    0%, 100% { top: 0%; }
                    50% { top: 100%; }
                }
            ` }} />

            {/* Camera Barcode Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-gray-800 text-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-950">
                            <div className="flex items-center gap-2">
                                <Camera className="text-blue-500 animate-pulse" size={20} />
                                <span className="font-bold text-sm">Camera Barcode Scanner</span>
                            </div>
                            <button
                                onClick={() => setIsScannerOpen(false)}
                                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Camera Scanner View */}
                        <div className="p-6 flex flex-col items-center justify-center relative min-h-[300px] bg-black">
                            {scannerError ? (
                                <div className="text-center p-4">
                                    <p className="text-red-500 text-sm font-bold mb-2">Terjadi Kesalahan</p>
                                    <p className="text-xs text-gray-400">{scannerError}</p>
                                </div>
                            ) : (
                                <>
                                    {/* Scanning window frame */}
                                    <div className="relative w-full max-w-[280px] aspect-square rounded-xl overflow-hidden border-2 border-blue-500/50 shadow-inner bg-gray-950">
                                        {/* Scan laser line animation */}
                                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent top-0 animate-[scan_2s_ease-in-out_infinite] z-10 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                                        
                                        {/* Container for html5-qrcode reader */}
                                        <div id="camera-scanner-reader" className="w-full h-full object-cover"></div>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-4 text-center">
                                        Posisikan barcode atau QR code di dalam kotak pemindaian
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-800 flex items-center justify-center bg-gray-950">
                            <button
                                onClick={() => {
                                    setIsScannerOpen(false);
                                    setScannerError(null);
                                }}
                                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-sm transition-colors"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
