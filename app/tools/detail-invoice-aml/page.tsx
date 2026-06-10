'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
    Calculator, 
    ArrowLeft, 
    FileText, 
    Upload, 
    Printer, 
    Plus, 
    Trash2, 
    RefreshCw, 
    FileSpreadsheet, 
    Layers, 
    Settings, 
    AlertCircle, 
    Database,
    Check
} from 'lucide-react';
import { getVolumeSessions } from '@/lib/firestore-volume-sessions';
import type { VolumeSession } from '@/types/volume-calculation';

interface InvoiceRow {
    id: string;
    resiCCE: string;
    manifestLaki: string;
    stt: string;
    customer: string;
    colly: number;
    weight: number;
    harga: number;
    total: number;
}

// Helper to load PDF.js dynamically from CDN
const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') return;
        if ((window as any)['pdfjs-dist/build/pdf']) {
            resolve((window as any)['pdfjs-dist/build/pdf']);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = () => {
            const pdfjs = (window as any)['pdfjs-dist/build/pdf'];
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            resolve(pdfjs);
        };
        document.body.appendChild(script);
    });
};

// Heuristic STT/AWB matcher
const sttRegex = /\b(?:A\d{7}|\d{6,8})\b/i;

// Parse text output from Volume Calculator
const parseVolumeData = (text: string): { stt: string; colly: number; weight: number }[] => {
    const results: { stt: string; colly: number; weight: number }[] = [];
    const lines = text.split(/\r?\n/);
    
    // Heuristic A: Parse block format
    let currentStt = '';
    let currentColly = 1;
    let currentWeight = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (line.toLowerCase().includes('koli') || line.toLowerCase().includes('barcode:')) {
            if (currentStt) {
                results.push({ stt: currentStt, colly: currentColly, weight: currentWeight });
                currentStt = '';
                currentColly = 1;
                currentWeight = 0;
            }
            const match = line.match(sttRegex);
            if (match) {
                currentStt = match[0].toUpperCase();
            }
        } else if (line.toLowerCase().startsWith('jumlah:') || line.toLowerCase().includes('pcs')) {
            const qtyMatch = line.match(/(\d+)/);
            if (qtyMatch) {
                currentColly = parseInt(qtyMatch[1]);
            }
        } else if (line.toLowerCase().includes('tagihan') || line.toLowerCase().includes('chargeable')) {
            const weightMatch = line.match(/([\d.,]+)/);
            if (weightMatch) {
                currentWeight = parseFloat(weightMatch[1].replace(',', '.'));
            }
        }
    }
    if (currentStt) {
        results.push({ stt: currentStt, colly: currentColly, weight: currentWeight });
    }
    
    // Heuristic B: Parse tabular/row copy format (e.g. "1 A0037628 3 50")
    if (results.length === 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const tokens = line.split(/\s+/);
            const sttTokenIdx = tokens.findIndex(token => sttRegex.test(token));
            
            if (sttTokenIdx !== -1) {
                const stt = tokens[sttTokenIdx].match(sttRegex)![0].toUpperCase();
                const remainingTokens = tokens.slice(sttTokenIdx + 1);
                
                let colly = 1;
                let weight = 0;
                const numbers = remainingTokens
                    .map(t => t.replace(/[^\d.,]/g, '').trim())
                    .filter(t => t.length > 0 && !isNaN(parseFloat(t.replace(',', '.'))));
                
                if (numbers.length >= 2) {
                    colly = parseInt(numbers[0]);
                    weight = parseFloat(numbers[1].replace(',', '.'));
                } else if (numbers.length === 1) {
                    weight = parseFloat(numbers[0].replace(',', '.'));
                }
                
                results.push({ stt, colly, weight });
            }
        }
    }
    
    return results;
};

// Parse AML Packing List to extract STT -> Customer mapping
const parsePackingListData = (text: string): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const lines = text.split(/\r?\n/);
    
    const ignoreWords = new Set([
        'no', 'stt', 'awb', 'colly', 'colli', 'kg', 'vlm', 'harga', 'total', 
        'ppn', 'subtotal', 'manifest', 'laki', 'cce', 'resi', 'customer', 
        'packing', 'list', 'aml', 'cahaya', 'cargo', 'express', 'tanggal',
        'surabaya', 'bandung', 'makassar'
    ]);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const match = line.match(sttRegex);
        if (match) {
            const stt = match[0].toUpperCase();
            const tokens = line.split(/[\s,;|]+/);
            
            // Search for customer name/code in the line
            for (let j = 0; j < tokens.length; j++) {
                const token = tokens[j].trim().replace(/[():]/g, '');
                if (
                    token &&
                    token.length >= 2 &&
                    token.length <= 8 &&
                    /^[A-Z]{2,8}$/.test(token) &&
                    !ignoreWords.has(token.toLowerCase()) &&
                    token !== stt
                ) {
                    mapping[stt] = token;
                    break;
                }
            }
            
            // Fallback for mixed case words
            if (!mapping[stt]) {
                for (let j = 0; j < tokens.length; j++) {
                    const token = tokens[j].trim().replace(/[():]/g, '');
                    if (
                        token && 
                        token.length >= 2 &&
                        token.length <= 10 &&
                        /^[A-Za-z]+$/.test(token) &&
                        !ignoreWords.has(token.toLowerCase()) &&
                        token !== stt
                    ) {
                        mapping[stt] = token.toUpperCase();
                        break;
                    }
                }
            }
        }
    }
    return mapping;
};

// Rowspan calculation helper
const calculateRowSpans = <T extends Record<string, any>>(items: T[], key: keyof T) => {
    const rowSpans = new Array(items.length).fill(1);
    let i = 0;
    while (i < items.length) {
        const val = items[i][key];
        if (!val) {
            i++;
            continue;
        }
        let count = 1;
        while (i + count < items.length && items[i + count][key] === val) {
            count++;
        }
        rowSpans[i] = count;
        for (let j = 1; j < count; j++) {
            rowSpans[i + j] = 0;
        }
        i += count;
    }
    return rowSpans;
};

export default function DetailInvoiceAmlPage() {
    const { user } = useAuth();
    const router = useRouter();
    
    // Global parameters
    const [resiCCE, setResiCCE] = useState('018419');
    const [manifestLaki, setManifestLaki] = useState('MFT-005750');
    const [hargaPerKg, setHargaPerKg] = useState(2000);
    const [ppnRate, setPpnRate] = useState(1.1);
    
    // Input methods
    const [volumeTab, setVolumeTab] = useState<'db' | 'upload' | 'text'>('db');
    const [packingListTab, setPackingListTab] = useState<'upload' | 'text'>('upload');
    
    // Database source
    const [volumeSessions, setVolumeSessions] = useState<VolumeSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [dbLoading, setDbLoading] = useState(false);
    
    // Raw texts
    const [volumeText, setVolumeText] = useState('');
    const [packingListText, setPackingListText] = useState('');
    
    // Main data table
    const [rows, setRows] = useState<InvoiceRow[]>([]);
    
    // UI Helpers
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Load saved volume calculator sessions
    useEffect(() => {
        if (!user) return;
        setDbLoading(true);
        getVolumeSessions()
            .then(sessions => {
                // Filter sessions to show all or prioritize ones that look like AML
                setVolumeSessions(sessions);
                setDbLoading(false);
            })
            .catch(err => {
                console.error(err);
                setDbLoading(false);
            });
    }, [user]);

    // Keep resiCCE synced on rows when updated globally
    useEffect(() => {
        setRows(prev => prev.map(row => ({ ...row, resiCCE })));
    }, [resiCCE]);

    // Update row total when weight or rate changes
    const updateRowTotal = (rowId: string, updatedFields: Partial<InvoiceRow>) => {
        setRows(prev => prev.map(row => {
            if (row.id === rowId) {
                const newRow = { ...row, ...updatedFields };
                newRow.total = newRow.weight * newRow.harga;
                return newRow;
            }
            return row;
        }));
    };

    // Client-side PDF file text extraction
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'volume' | 'packing') => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setLoading(true);
        setErrorMessage('');
        try {
            const extracted = await extractTextFromPDF(file);
            if (target === 'volume') {
                setVolumeText(extracted);
                setVolumeTab('text');
                setSuccessMessage('Berhasil mengekstrak teks dari PDF Kalkulator Volume!');
            } else {
                setPackingListText(extracted);
                setPackingListTab('text');
                setSuccessMessage('Berhasil mengekstrak teks dari PDF Packing List AML!');
            }
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            console.error(err);
            setErrorMessage(`Gagal memproses file PDF: ${err}`);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    // Read client-side array buffer helper
    const extractTextFromPDF = async (file: File): Promise<string> => {
        const pdfjs = await loadPdfJs();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
                    const pdf = await loadingTask.promise;
                    let fullText = '';
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((item: any) => item.str).join('\n');
                        fullText += pageText + '\n';
                    }
                    resolve(fullText);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject('Gagal membaca berkas.');
            reader.readAsArrayBuffer(file);
        });
    };

    // Merge and process data
    const handleProcessData = () => {
        setErrorMessage('');
        setSuccessMessage('');
        
        let parsedVolumeItems: { stt: string; colly: number; weight: number }[] = [];
        
        // 1. Gather Volume calculator data
        if (volumeTab === 'db') {
            if (!selectedSessionId) {
                setErrorMessage('Silakan pilih sesi kalkulator volume dari database terlebih dahulu!');
                return;
            }
            const session = volumeSessions.find(s => s.id === selectedSessionId);
            if (session) {
                parsedVolumeItems = session.koliList.map(item => {
                    // Item name or barcode is the STT
                    const sttCandidate = item.barcode || item.itemName;
                    const sttMatch = sttCandidate.match(sttRegex);
                    const stt = sttMatch ? sttMatch[0].toUpperCase() : sttCandidate.toUpperCase();
                    return {
                        stt,
                        colly: item.quantity || 1,
                        weight: item.chargeableWeight
                    };
                });
            }
        } else {
            if (!volumeText.trim()) {
                setErrorMessage('Data teks/PDF Kalkulator Volume kosong!');
                return;
            }
            parsedVolumeItems = parseVolumeData(volumeText);
        }
        
        if (parsedVolumeItems.length === 0) {
            setErrorMessage('Tidak ditemukan data koli/STT yang valid pada input Kalkulator Volume! Cek format input Anda.');
            return;
        }

        // 2. Gather Packing List AML mapping
        const packingListMap = parsePackingListData(packingListText);

        // 3. Merge and build rows
        const mergedRows: InvoiceRow[] = parsedVolumeItems.map((vItem, idx) => {
            // Find customer from packing list
            const customer = packingListMap[vItem.stt] || '';
            
            // Only fill Manifest Laki for the first two items by default (similar to sample)
            // or let the user decide. Let's prefill with the global Manifest Laki for rows 1 & 2
            // and leave other rows empty as shown in the Excel image example!
            const rowManifest = idx < 2 ? manifestLaki : '';
            
            return {
                id: `row-${idx}-${Date.now()}`,
                resiCCE,
                manifestLaki: rowManifest,
                stt: vItem.stt,
                customer,
                colly: vItem.colly,
                weight: vItem.weight,
                harga: hargaPerKg,
                total: vItem.weight * hargaPerKg
            };
        });

        setRows(mergedRows);
        setSuccessMessage(`Berhasil memproses & mencocokkan ${mergedRows.length} data STT!`);
        setTimeout(() => setSuccessMessage(''), 4000);
    };

    // Table operations
    const handleAddRow = () => {
        const newRow: InvoiceRow = {
            id: `row-manual-${Date.now()}-${Math.random()}`,
            resiCCE,
            manifestLaki: '',
            stt: '',
            customer: '',
            colly: 1,
            weight: 0,
            harga: hargaPerKg,
            total: 0
        };
        setRows(prev => [...prev, newRow]);
    };

    const handleDeleteRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const handleClearRows = () => {
        if (confirm('Hapus seluruh baris data invoice saat ini?')) {
            setRows([]);
        }
    };

    // Bulk apply actions
    const handleBulkApplyManifest = () => {
        if (rows.length === 0) return;
        if (confirm(`Terapkan kode manifest "${manifestLaki}" ke seluruh baris?`)) {
            setRows(prev => prev.map(r => ({ ...r, manifestLaki })));
        }
    };

    const handleBulkApplyHarga = () => {
        if (rows.length === 0) return;
        if (confirm(`Terapkan harga "Rp ${hargaPerKg.toLocaleString('id-ID')}" ke seluruh baris?`)) {
            setRows(prev => prev.map(r => {
                const updated = { ...r, harga: hargaPerKg };
                updated.total = updated.weight * updated.harga;
                return updated;
            }));
        }
    };

    // Calculations
    const totalColly = useMemo(() => rows.reduce((sum, r) => sum + r.colly, 0), [rows]);
    const totalWeight = useMemo(() => rows.reduce((sum, r) => sum + r.weight, 0), [rows]);
    const sumTotal = useMemo(() => rows.reduce((sum, r) => sum + r.total, 0), [rows]);
    const ppnAmount = useMemo(() => Math.round(sumTotal * (ppnRate / 100)), [sumTotal, ppnRate]);
    const subtotal = useMemo(() => sumTotal + ppnAmount, [sumTotal, ppnAmount]);

    // Rowspan lists
    const resiCCESpans = useMemo(() => calculateRowSpans(rows, 'resiCCE'), [rows]);
    const manifestLakiSpans = useMemo(() => calculateRowSpans(rows, 'manifestLaki'), [rows]);

    const formatIDR = (num: number, decimals = 0) => {
        return num.toLocaleString('id-ID', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    return (
        <ProtectedRoute>
            {/* dynamic print landscape stylesheets */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-invoice-wrapper {
                        width: 100% !important;
                        color: black !important;
                        font-family: 'Courier New', Courier, monospace;
                    }
                    .print-invoice-title {
                        font-family: sans-serif;
                        font-weight: 900;
                        font-size: 14pt;
                        text-align: center;
                        margin-bottom: 20px;
                        text-transform: uppercase;
                    }
                    table.print-table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                        margin-top: 10px;
                    }
                    table.print-table th, table.print-table td {
                        border: 1.5px solid #000000 !important;
                        padding: 6px 8px !important;
                        font-size: 9.5pt !important;
                        color: black !important;
                        font-weight: bold;
                    }
                    table.print-table th {
                        background-color: #f2f2f2 !important;
                        text-align: center !important;
                        text-transform: uppercase;
                    }
                    .text-center {
                        text-align: center !important;
                    }
                    .text-right {
                        text-align: right !important;
                    }
                }
            ` }} />

            <div className="min-h-screen bg-gray-50 pb-16 no-print">
                {/* Header Navigation */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto px-4 py-4 max-w-6xl">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div>
                                <Link href="/" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                                    ← Kembali ke Home
                                </Link>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <FileSpreadsheet className="text-blue-600" />
                                    Cetak Detail Invoice AML
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">
                                    Integrasikan data Volume Calculator &amp; Packing List AML untuk mencetak laporan rincian invoice
                                </p>
                            </div>
                            {rows.length > 0 && (
                                <button
                                    onClick={() => window.print()}
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Printer size={18} />
                                    Cetak Invoice (A4 Landscape)
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
                    {/* Error & Success Messages */}
                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-2 text-sm font-semibold animate-shake">
                            <AlertCircle size={20} className="text-red-600 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}
                    {successMessage && (
                        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center gap-2 text-sm font-semibold animate-fade-in">
                            <Check size={20} className="text-green-600 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* STEP 1: GLOBAL PARAMETERS & IMPORT DATA */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        {/* LEFT COLUMN: GLOBAL INPUT PARAMETERS */}
                        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2 border-b pb-2">
                                <Settings size={18} className="text-blue-600" />
                                Parameter Global
                            </h3>
                            
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nomor Resi CCE</label>
                                <input 
                                    type="text" 
                                    value={resiCCE}
                                    onChange={(e) => setResiCCE(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                    placeholder="Contoh: 018419"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Default Manifest Laki</label>
                                <input 
                                    type="text" 
                                    value={manifestLaki}
                                    onChange={(e) => setManifestLaki(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                    placeholder="Contoh: MFT-005750"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Harga per Kg/VLM</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={hargaPerKg}
                                            onChange={(e) => setHargaPerKg(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-4 pr-10 py-2.5 text-sm text-gray-800 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            placeholder="2000"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">/Kg</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">PPN Rate (%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={ppnRate}
                                            onChange={(e) => setPpnRate(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-4 pr-8 py-2.5 text-sm text-gray-800 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            placeholder="1.1"
                                            step="0.1"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                                <button
                                    onClick={handleBulkApplyManifest}
                                    disabled={rows.length === 0}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 font-bold py-2 px-3 rounded-lg text-xs border border-gray-300 transition-colors"
                                >
                                    Terapkan Manifest
                                </button>
                                <button
                                    onClick={handleBulkApplyHarga}
                                    disabled={rows.length === 0}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 font-bold py-2 px-3 rounded-lg text-xs border border-gray-300 transition-colors"
                                >
                                    Terapkan Harga
                                </button>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: IMPORT PANELS */}
                        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2 border-b pb-2">
                                <Layers size={18} className="text-blue-600" />
                                Sumber Integrasi Data
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* DATA CALC VOL */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-gray-700">1. Data Kalkulator Volume</label>
                                    </div>
                                    
                                    {/* Tabs */}
                                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[10px] font-bold">
                                        <button
                                            onClick={() => setVolumeTab('db')}
                                            className={`flex-1 py-1.5 rounded-md transition-all ${volumeTab === 'db' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Database Sesi
                                        </button>
                                        <button
                                            onClick={() => setVolumeTab('upload')}
                                            className={`flex-1 py-1.5 rounded-md transition-all ${volumeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Unggah PDF
                                        </button>
                                        <button
                                            onClick={() => setVolumeTab('text')}
                                            className={`flex-1 py-1.5 rounded-md transition-all ${volumeTab === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Paste Teks
                                        </button>
                                    </div>

                                    {volumeTab === 'db' && (
                                        <div className="space-y-2">
                                            {dbLoading ? (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 py-3">
                                                    <RefreshCw className="animate-spin text-blue-600" size={14} /> Memuat sesi database...
                                                </div>
                                            ) : (
                                                <select
                                                    value={selectedSessionId}
                                                    onChange={(e) => setSelectedSessionId(e.target.value)}
                                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500"
                                                >
                                                    <option value="">-- Pilih Sesi Kalkulator --</option>
                                                    {volumeSessions.map(session => (
                                                        <option key={session.id} value={session.id}>
                                                            {session.senderName} ({session.koliList.length} Koli) - {new Date(session.updatedAt).toLocaleDateString('id-ID')}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    )}

                                    {volumeTab === 'upload' && (
                                        <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-500 cursor-pointer relative transition-colors">
                                            <input 
                                                type="file" 
                                                accept=".pdf"
                                                onChange={(e) => handlePdfUpload(e, 'volume')}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <Upload className="mx-auto text-gray-400 mb-1" size={24} />
                                            <span className="text-xs font-bold text-gray-650 text-gray-600 block">Pilih PDF Kalkulator</span>
                                            <span className="text-[9px] text-gray-400">PDF hasil cetakan kalkulator volume</span>
                                        </div>
                                    )}

                                    {volumeTab === 'text' && (
                                        <textarea
                                            rows={4}
                                            value={volumeText}
                                            onChange={(e) => setVolumeText(e.target.value)}
                                            placeholder="Tempelkan hasil teks rincian volume di sini..."
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs font-mono text-gray-700 placeholder-gray-400 focus:bg-white outline-none focus:border-blue-500 transition-colors"
                                        />
                                    )}
                                </div>

                                {/* DATA PACKING LIST AML */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700 block">2. Data Packing List AML</label>
                                    
                                    {/* Tabs */}
                                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[10px] font-bold">
                                        <button
                                            onClick={() => setPackingListTab('upload')}
                                            className={`flex-1 py-1.5 rounded-md transition-all ${packingListTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Unggah PDF
                                        </button>
                                        <button
                                            onClick={() => setPackingListTab('text')}
                                            className={`flex-1 py-1.5 rounded-md transition-all ${packingListTab === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Paste Teks
                                        </button>
                                    </div>

                                    {packingListTab === 'upload' && (
                                        <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-500 cursor-pointer relative transition-colors">
                                            <input 
                                                type="file" 
                                                accept=".pdf"
                                                onChange={(e) => handlePdfUpload(e, 'packing')}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <Upload className="mx-auto text-gray-400 mb-1" size={24} />
                                            <span className="text-xs font-bold text-gray-650 text-gray-600 block">Pilih PDF Packing List</span>
                                            <span className="text-[9px] text-gray-400">PDF manifests packing list dari AML</span>
                                        </div>
                                    )}

                                    {packingListTab === 'text' && (
                                        <textarea
                                            rows={4}
                                            value={packingListText}
                                            onChange={(e) => setPackingListText(e.target.value)}
                                            placeholder="Tempelkan data STT &amp; Customer packing list di sini..."
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs font-mono text-gray-700 placeholder-gray-400 focus:bg-white outline-none focus:border-blue-500 transition-colors"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t flex justify-end">
                                <button
                                    onClick={handleProcessData}
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={16} /> Memproses...
                                        </>
                                    ) : (
                                        <>
                                            <Layers size={16} /> Integrasikan &amp; Muat Data
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* STEP 2: INTERACTIVE EDITABLE INVOICE DATA TABLE */}
                    {rows.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-2">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                        <FileText size={18} className="text-blue-600" />
                                        Review Detail Invoice AML ({rows.length} Baris)
                                    </h3>
                                    <p className="text-[11px] text-gray-400">Anda dapat langsung mengedit nilai di setiap sel di bawah ini sebelum dicetak</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAddRow}
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold py-2 px-3 rounded-lg border border-blue-250 flex items-center gap-1.5 transition-colors"
                                    >
                                        <Plus size={14} /> Tambah Baris
                                    </button>
                                    <button
                                        onClick={handleClearRows}
                                        className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 px-3 rounded-lg border border-red-250 flex items-center gap-1.5 transition-colors"
                                    >
                                        <Trash2 size={14} /> Kosongkan
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50/50">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-gray-200 font-bold uppercase text-[10px] text-gray-700">
                                            <th className="p-3 text-center w-[4%]">No</th>
                                            <th className="p-3 w-[12%]">RESI CCE</th>
                                            <th className="p-3 w-[15%]">MANIFEST LAKI</th>
                                            <th className="p-3 w-[15%]">No STT/AWB</th>
                                            <th className="p-3 w-[12%]">CUSTOMER</th>
                                            <th className="p-3 text-center w-[8%]">COLLY</th>
                                            <th className="p-3 text-right w-[10%]">Kg/VLM</th>
                                            <th className="p-3 text-right w-[10%]">HARGA</th>
                                            <th className="p-3 text-right w-[12%]">TOTAL</th>
                                            <th className="p-3 text-center w-[5%] no-print"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {rows.map((row, idx) => (
                                            <tr key={row.id} className="hover:bg-gray-50/50">
                                                {/* No */}
                                                <td className="p-2 text-center text-gray-500 font-mono">{idx + 1}</td>
                                                
                                                {/* RESI CCE */}
                                                <td className="p-2">
                                                    <input 
                                                        type="text"
                                                        value={row.resiCCE}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setRows(prev => prev.map(r => r.id === row.id ? { ...r, resiCCE: val } : r));
                                                        }}
                                                        className="w-full border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none font-bold"
                                                    />
                                                </td>

                                                {/* MANIFEST LAKI */}
                                                <td className="p-2">
                                                    <input 
                                                        type="text"
                                                        value={row.manifestLaki}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setRows(prev => prev.map(r => r.id === row.id ? { ...r, manifestLaki: val } : r));
                                                        }}
                                                        className="w-full border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none font-bold text-slate-800"
                                                    />
                                                </td>

                                                {/* STT/AWB */}
                                                <td className="p-2">
                                                    <input 
                                                        type="text"
                                                        value={row.stt}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setRows(prev => prev.map(r => r.id === row.id ? { ...r, stt: val } : r));
                                                        }}
                                                        className="w-full border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none font-mono font-bold text-gray-800"
                                                    />
                                                </td>

                                                {/* CUSTOMER */}
                                                <td className="p-2">
                                                    <input 
                                                        type="text"
                                                        value={row.customer}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setRows(prev => prev.map(r => r.id === row.id ? { ...r, customer: val } : r));
                                                        }}
                                                        className="w-full border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none font-bold text-gray-800 uppercase"
                                                    />
                                                </td>

                                                {/* COLLY */}
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        value={row.colly}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            updateRowTotal(row.id, { colly: val });
                                                        }}
                                                        className="w-full border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none text-center font-semibold"
                                                    />
                                                </td>

                                                {/* Kg/VLM */}
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        value={row.weight}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            updateRowTotal(row.id, { weight: val });
                                                        }}
                                                        className="w-full border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none text-right font-bold"
                                                        step="0.01"
                                                    />
                                                </td>

                                                {/* HARGA */}
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        value={row.harga}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            updateRowTotal(row.id, { harga: val });
                                                        }}
                                                        className="w-full border border-gray-200 hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none text-right font-semibold"
                                                    />
                                                </td>

                                                {/* TOTAL */}
                                                <td className="p-2 text-right font-bold font-mono text-gray-800 bg-gray-50/50">
                                                    {formatIDR(row.total)}
                                                </td>

                                                {/* Action */}
                                                <td className="p-2 text-center no-print">
                                                    <button
                                                        onClick={() => handleDeleteRow(row.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-all"
                                                        title="Hapus baris"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* PRINT PREVIEW COMPONENT ON SCREEN */}
                    {rows.length > 0 && (
                        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                            <h3 className="font-bold text-gray-850 border-b pb-2 text-gray-800 text-base">
                                Preview Cetak Invoice Detail (A4 Landscape)
                            </h3>
                            
                            <div className="bg-gray-100 p-8 rounded-xl border border-gray-200 overflow-x-auto flex justify-center">
                                {/* The Paper Layout */}
                                <div className="bg-white w-[297mm] p-[10mm] shadow-lg border border-gray-350 print-invoice-wrapper">
                                    <div className="print-invoice-title font-sans">
                                        DETAIL INVOICE AML
                                    </div>

                                    <table className="print-table w-full">
                                        <thead>
                                            <tr>
                                                <th className="text-center" style={{ width: '4%' }}>No.</th>
                                                <th style={{ width: '12%' }}>RESI CCE</th>
                                                <th style={{ width: '15%' }}>MANIFEST LAKI</th>
                                                <th style={{ width: '16%' }}>No STT/AWB</th>
                                                <th style={{ width: '13%' }}>CUSTOMER</th>
                                                <th className="text-center" style={{ width: '8%' }}>COLLY</th>
                                                <th className="text-right" style={{ width: '10%' }}>Kg/VLM</th>
                                                <th className="text-right" style={{ width: '10%' }}>HARGA</th>
                                                <th className="text-right" style={{ width: '12%' }}>TOTAL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row, idx) => {
                                                const resiSpan = resiCCESpans[idx];
                                                const manifestSpan = manifestLakiSpans[idx];
                                                
                                                return (
                                                    <tr key={`print-${row.id}`}>
                                                        <td className="text-center font-mono">{idx + 1}</td>
                                                        
                                                        {/* Span RESI CCE */}
                                                        {resiSpan > 0 && (
                                                            <td rowSpan={resiSpan} className="text-center font-bold align-middle">
                                                                {row.resiCCE}
                                                            </td>
                                                        )}

                                                        {/* Span MANIFEST LAKI */}
                                                        {manifestSpan > 0 ? (
                                                            <td rowSpan={manifestSpan} className="text-center font-bold align-middle">
                                                                {row.manifestLaki}
                                                            </td>
                                                        ) : manifestSpan === 0 ? null : (
                                                            <td className="text-center font-bold"></td>
                                                        )}

                                                        <td className="font-mono">{row.stt}</td>
                                                        <td className="uppercase">{row.customer}</td>
                                                        <td className="text-center font-mono">{row.colly}</td>
                                                        <td className="text-right font-mono">
                                                            {formatIDR(Math.round(row.weight))}
                                                        </td>
                                                        <td className="text-right font-mono">
                                                            {formatIDR(row.harga)}
                                                        </td>
                                                        <td className="text-right font-mono">
                                                            {formatIDR(row.total)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* TOTAL ROW */}
                                            <tr>
                                                <td colSpan={5} className="text-center font-bold">TOTAL</td>
                                                <td className="text-center font-mono font-bold">{totalColly}</td>
                                                <td className="text-right font-mono font-bold">
                                                    {formatIDR(Math.round(totalWeight))}
                                                </td>
                                                <td></td>
                                                <td className="text-right font-mono font-bold">
                                                    {formatIDR(sumTotal)}
                                                </td>
                                            </tr>

                                            {/* PPN ROW */}
                                            <tr>
                                                <td colSpan={8} className="text-right font-bold">PPN {ppnRate}%</td>
                                                <td className="text-right font-mono font-bold">
                                                    {formatIDR(ppnAmount)}
                                                </td>
                                            </tr>

                                            {/* SUBTOTAL ROW */}
                                            <tr>
                                                <td colSpan={8} className="text-right font-bold">SUBTOTAL</td>
                                                <td className="text-right font-mono font-bold">
                                                    {formatIDR(subtotal)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PRINT COMPONENT (ONLY SHOWN IN WINDOW.PRINT()) */}
            {rows.length > 0 && (
                <div className="hidden print-only print-invoice-wrapper">
                    <div className="print-invoice-title">
                        DETAIL INVOICE AML
                    </div>

                    <table className="print-table w-full">
                        <thead>
                            <tr>
                                <th className="text-center" style={{ width: '4%' }}>No.</th>
                                <th style={{ width: '12%' }}>RESI CCE</th>
                                <th style={{ width: '15%' }}>MANIFEST LAKI</th>
                                <th style={{ width: '16%' }}>No STT/AWB</th>
                                <th style={{ width: '13%' }}>CUSTOMER</th>
                                <th className="text-center" style={{ width: '8%' }}>COLLY</th>
                                <th className="text-right" style={{ width: '10%' }}>Kg/VLM</th>
                                <th className="text-right" style={{ width: '10%' }}>HARGA</th>
                                <th className="text-right" style={{ width: '12%' }}>TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => {
                                const resiSpan = resiCCESpans[idx];
                                const manifestSpan = manifestLakiSpans[idx];
                                
                                return (
                                    <tr key={`print-only-${row.id}`}>
                                        <td className="text-center font-mono">{idx + 1}</td>
                                        
                                        {/* Span RESI CCE */}
                                        {resiSpan > 0 && (
                                            <td rowSpan={resiSpan} className="text-center font-bold align-middle">
                                                {row.resiCCE}
                                            </td>
                                        )}

                                        {/* Span MANIFEST LAKI */}
                                        {manifestSpan > 0 ? (
                                            <td rowSpan={manifestSpan} className="text-center font-bold align-middle">
                                                {row.manifestLaki}
                                            </td>
                                        ) : manifestSpan === 0 ? null : (
                                            <td className="text-center font-bold"></td>
                                        )}

                                        <td className="font-mono">{row.stt}</td>
                                        <td className="uppercase">{row.customer}</td>
                                        <td className="text-center font-mono">{row.colly}</td>
                                        <td className="text-right font-mono">
                                            {formatIDR(Math.round(row.weight))}
                                        </td>
                                        <td className="text-right font-mono">
                                            {formatIDR(row.harga)}
                                        </td>
                                        <td className="text-right font-mono">
                                            {formatIDR(row.total)}
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* TOTAL ROW */}
                            <tr>
                                <td colSpan={5} className="text-center font-bold">TOTAL</td>
                                <td className="text-center font-mono font-bold">{totalColly}</td>
                                <td className="text-right font-mono font-bold">
                                    {formatIDR(Math.round(totalWeight))}
                                </td>
                                <td></td>
                                <td className="text-right font-mono font-bold">
                                    {formatIDR(sumTotal)}
                                </td>
                            </tr>

                            {/* PPN ROW */}
                            <tr>
                                <td colSpan={8} className="text-right font-bold">PPN {ppnRate}%</td>
                                <td className="text-right font-mono font-bold">
                                    {formatIDR(ppnAmount)}
                                </td>
                            </tr>

                            {/* SUBTOTAL ROW */}
                            <tr>
                                <td colSpan={8} className="text-right font-bold">SUBTOTAL</td>
                                <td className="text-right font-mono font-bold">
                                    {formatIDR(subtotal)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </ProtectedRoute>
    );
}
