'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { addTransaction } from '@/lib/firestore-transactions';
import { subscribeToClients } from '@/lib/firestore';
import type { Client } from '@/types/client';
import type { Branch } from '@/types/branch';
import { getAllBranches, getActiveBranch } from '@/types/branch';
import type { TipeTransaksi, MetodePembayaran, CaraPelunasan, BeratUnit, StatusTransaksi } from '@/types/transaction';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Upload, FileText, Check, AlertTriangle, Play, Settings, Clipboard, RefreshCcw, Trash2, Edit2 } from 'lucide-react';

interface ParsedRow {
    id: string; // Temporary unique key
    noSTT: string;
    koli: number;
    berat: number;
    pengirimName: string;
    pengirimId: string; // Resolved or empty string
    penerimaName: string;
    penerimaAddress: string;
    penerimaCity: string;
    tujuan: string;
    isiBarang: string;
    isValid: boolean;
    errorMsg?: string;
    selected: boolean;
}

export default function ImportTransactionsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);

    // Form settings
    const [branch, setBranch] = useState<Branch>(getActiveBranch());
    const [tipeTransaksi, setTipeTransaksi] = useState<TipeTransaksi>('regular');
    const [pembayaran, setPembayaran] = useState<MetodePembayaran>('Kredit');
    const [pelunasan, setPelunasan] = useState<CaraPelunasan>('Pending');
    const [defaultIsiBarang, setDefaultIsiBarang] = useState('GARMEN');
    const [beratUnit, setBeratUnit] = useState<BeratUnit>('KG');

    // Input States
    const [copyPasteText, setCopyPasteText] = useState('');
    const [fileName, setFileName] = useState('');
    const [sheetJSLoaded, setSheetJSLoaded] = useState(false);
    const [parsing, setParsing] = useState(false);

    // Parsed Data State
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch existing clients to match sender names
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToClients((loaded) => {
            setClients(loaded);
            setLoadingClients(false);
        }, user.uid);

        return () => unsubscribe();
    }, [user]);

    // Load SheetJS dynamically from CDN
    const loadSheetJS = () => {
        return new Promise<void>((resolve, reject) => {
            if ((window as any).XLSX) {
                setSheetJSLoaded(true);
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onload = () => {
                setSheetJSLoaded(true);
                resolve();
            };
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
        });
    };

    // Clean name string for comparison (case-insensitive, remove double spaces)
    const cleanName = (name: string): string => {
        return name.trim().toLowerCase().replace(/\s+/g, ' ');
    };

    // Helper: Find client by name (case-insensitive)
    const findClientByName = (name: string): Client | undefined => {
        if (!name) return undefined;
        const targetName = cleanName(name);
        return clients.find(c => cleanName(c.name) === targetName);
    };

    // Parse Excel / CSV File
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setParsing(true);
        try {
            await loadSheetJS();
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = event.target?.result;
                    const XLSX = (window as any).XLSX;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[firstSheetName];
                    const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                    processImportedData(jsonRows);
                } catch (error) {
                    console.error('File reading error:', error);
                    alert('Gagal membaca isi file. Pastikan format file Excel/CSV valid.');
                } finally {
                    setParsing(false);
                }
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            console.error('Error loading Excel library:', err);
            alert('Gagal menginisialisasi modul pembaca Excel.');
            setParsing(false);
        }
    };

    // Parse pasted spreadsheet rows (tab-delimited or comma-delimited)
    const handlePasteProcess = () => {
        if (!copyPasteText.trim()) {
            alert('Teks copy-paste kosong!');
            return;
        }

        setParsing(true);
        // Split by lines
        const lines = copyPasteText.split(/\r?\n/);
        const parsedGrid: string[][] = lines.map(line => {
            // Split by tab first (standard spreadsheet copy)
            if (line.includes('\t')) {
                return line.split('\t');
            }
            // Or fallback to comma-separated
            return line.split(',');
        }).filter(row => row.some(cell => cell.trim() !== ''));

        processImportedData(parsedGrid);
        setParsing(false);
    };

    // Normalize imported rows grid
    const processImportedData = (grid: any[][]) => {
        if (grid.length === 0) {
            alert('Data kosong!');
            return;
        }

        // Detect header index (skip empty or indicator rows)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(10, grid.length); i++) {
            const hasSTTHeader = grid[i].some(cell => {
                const s = String(cell).toUpperCase();
                return s.includes('STT') || s.includes('RESI') || s.includes('AWB');
            });
            if (hasSTTHeader) {
                headerRowIdx = i;
                break;
            }
        }

        const headers = grid[headerRowIdx].map(h => String(h || '').trim().toUpperCase());
        const dataRows = grid.slice(headerRowIdx + 1);

        // Find index of expected columns
        const idxSTT = headers.findIndex(h => h.includes('STT') || h.includes('RESI') || h.includes('AWB'));
        const idxKoli = headers.findIndex(h => h.includes('KOLI') || h.includes('JML') || h.includes('QTY'));
        const idxBerat = headers.findIndex(h => h.includes('BERAT') || h.includes('BRT') || h.includes('WEIGHT') || h.includes('KG'));
        const idxPengirim = headers.findIndex(h => h.includes('PENGIRIM') || h.includes('SENDER') || h.includes('ASAL'));
        const idxPenerima = headers.findIndex(h => h.includes('PENERIMA') || h.includes('RECEIVER') || h.includes('CONSIGNEE'));
        const idxIsiBarang = headers.findIndex(h => h.includes('ISI') || h.includes('BARANG') || h.includes('DESKRIPSI') || h.includes('ITEMS'));
        const idxAlamat = headers.findIndex(h => h.includes('ALAMAT') || h.includes('ADDR'));
        const idxTujuan = headers.findIndex(h => h.includes('TUJUAN') || h.includes('DESTINATION') || h.includes('KOTA'));

        // If headers are missing, use standard order index fallbacks
        const findColIdx = (foundIdx: number, fallbackIdx: number) => foundIdx !== -1 ? foundIdx : fallbackIdx;

        const colSTT = findColIdx(idxSTT, 1);
        const colKoli = findColIdx(idxKoli, 2);
        const colBerat = findColIdx(idxBerat, 3);
        const colPengirim = findColIdx(idxPengirim, 4);
        const colPenerima = findColIdx(idxPenerima, 5);
        const colIsiBarang = findColIdx(idxIsiBarang, 6);
        const colAlamat = findColIdx(idxAlamat, 7);
        const colTujuan = findColIdx(idxTujuan, 8);

        const mappedRows: ParsedRow[] = dataRows.map((row, idx) => {
            const rawSTT = String(row[colSTT] || '').trim();
            const rawKoli = String(row[colKoli] || '').trim();
            const rawBerat = String(row[colBerat] || '').trim();
            const pengirimVal = String(row[colPengirim] || '').trim();
            const penerimaVal = String(row[colPenerima] || '').trim();
            const isiBarangVal = String(row[colIsiBarang] || '').trim();
            const alamatVal = String(row[colAlamat] || '').trim();
            const tujuanVal = String(row[colTujuan] || '').trim();

            // Clean values
            // STT: Clean digits or empty
            let noSTTStr = rawSTT;
            if (/^\d+$/.test(rawSTT) && rawSTT.length < 6) {
                noSTTStr = `STT${rawSTT.padStart(6, '0')}`;
            } else if (/^\d+$/.test(rawSTT)) {
                noSTTStr = `STT${rawSTT}`;
            }

            // Koli & Berat
            const koliNum = parseInt(rawKoli, 10) || 1;
            // Parse decimal with comma formatting support (e.g. 178,4 -> 178.4)
            const beratNum = parseFloat(rawBerat.replace(/,/g, '.')) || 0;

            // Resolve Sender (Pengirim) Client
            const matchedClient = findClientByName(pengirimVal);
            // User requested: if no match, leave pengirimId empty ("")
            const pengirimId = matchedClient ? matchedClient.id : '';

            // Split address if city exists in alamat
            let penerimaAddress = alamatVal;
            let penerimaCity = tujuanVal;

            if (!penerimaCity && alamatVal.includes('-')) {
                const parts = alamatVal.split('-');
                penerimaCity = parts[parts.length - 1].trim();
            }

            // Validation
            let isValid = true;
            let errorMsg = '';
            if (beratNum <= 0 && tipeTransaksi === 'regular') {
                isValid = false;
                errorMsg = 'Berat/kg harus lebih dari 0.';
            }

            return {
                id: `parsed-${idx}-${Date.now()}`,
                noSTT: noSTTStr,
                koli: koliNum,
                berat: beratNum,
                pengirimName: pengirimVal || 'TANPA NAMA PENGIRIM',
                pengirimId,
                penerimaName: penerimaVal || 'UMUM',
                penerimaAddress: penerimaAddress || '',
                penerimaCity: penerimaCity || tujuanVal || 'MAKASSAR',
                tujuan: tujuanVal || penerimaCity || 'MAKASSAR',
                isiBarang: isiBarangVal || defaultIsiBarang,
                isValid,
                errorMsg,
                selected: isValid,
            };
        }).filter(r => r.pengirimName !== 'TANPA NAMA PENGIRIM' || r.noSTT !== '');

        setRows(mappedRows);
        setImportSuccessCount(null);
    };

    // Toggle single row selection
    const toggleRowSelect = (id: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
    };

    // Toggle all row selections
    const toggleAllSelect = () => {
        const allSelected = rows.every(r => r.selected);
        setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
    };

    // Update row value inline
    const updateRowCell = (id: string, field: keyof ParsedRow, value: any) => {
        setRows(prev => prev.map(r => {
            if (r.id === id) {
                const updated = { ...r, [field]: value };
                // Re-validate
                let isValid = true;
                let errorMsg = '';
                if (updated.berat <= 0 && tipeTransaksi === 'regular') {
                    isValid = false;
                    errorMsg = 'Berat/kg harus lebih dari 0.';
                }
                updated.isValid = isValid;
                updated.errorMsg = errorMsg;
                return updated;
            }
            return r;
        }));
    };

    // Remove row from import list
    const removeRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    // Submit import batch to database
    const handleImportSubmit = async () => {
        const importableRows = rows.filter(r => r.selected && r.isValid);
        if (importableRows.length === 0) {
            alert('Tidak ada baris valid terpilih untuk di-import.');
            return;
        }

        if (!user) {
            alert('User tidak terautentikasi.');
            return;
        }

        if (!confirm(`Apakah Anda yakin ingin meng-import ${importableRows.length} transaksi ini ke Cabang ${branch.toUpperCase()}?`)) {
            return;
        }

        setImporting(true);
        setImportSuccessCount(null);
        setProgress({ current: 0, total: importableRows.length });

        let success = 0;
        try {
            for (let i = 0; i < importableRows.length; i++) {
                const row = importableRows[i];
                
                // Formulate TransactionFormData for upload
                const dataToSubmit = {
                    branch,
                    tanggal: new Date().toISOString().split('T')[0],
                    tujuan: row.tujuan,
                    pengirimId: row.pengirimId, // Could be empty string "" if not matched
                    penerimaId: '',
                    koli: row.koli,
                    berat: row.berat,
                    beratUnit: beratUnit,
                    tipeTransaksi: tipeTransaksi,
                    harga: 0, // Default to 0, since spreadsheet has no prices
                    noInvoice: '', // Will be generated
                    pembayaran: pembayaran,
                    pelunasan: pelunasan,
                    keterangan: 'Imported via CSV/Excel',
                    isiBarang: row.isiBarang || defaultIsiBarang,
                    status: 'pending' as StatusTransaksi,
                    isTaxable: false,
                    ppnRate: 0,
                };

                // Save to Firestore
                await addTransaction(
                    dataToSubmit,
                    user.uid,
                    {
                        name: row.pengirimName,
                        phone: '',
                        address: '',
                        city: '',
                    },
                    {
                        name: row.penerimaName,
                        phone: '',
                        address: row.penerimaAddress,
                        city: row.penerimaCity,
                    },
                    0, // Jumlah = 0 by default
                    row.noSTT // Try manual STT from spreadsheet
                );

                success++;
                setProgress(p => ({ ...p, current: success }));
            }

            setImportSuccessCount(success);
            setRows([]); // Clear imported
            setCopyPasteText('');
            setFileName('');
        } catch (error) {
            console.error('Error importing batch:', error);
            alert(`Terjadi error saat meng-import. Berhasil masuk: ${success} baris.`);
        } finally {
            setImporting(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
                    <div className="container mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/transactions" className="text-gray-500 hover:text-blue-600 transition-colors p-2 hover:bg-gray-150 rounded-lg">
                                <ArrowLeft size={20} />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-800">Import Transaksi</h1>
                                <p className="text-xs text-gray-500">Unggah data manifest STT dari Bandung/Surabaya dalam sekali klik</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto max-w-7xl px-4 mt-6">
                    {/* Setup Settings & File Input */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Settings Left Card */}
                        <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4 h-fit">
                            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                                <Settings size={16} className="text-blue-600" />
                                Pengaturan Default Import
                            </h2>

                            {/* Branch Selector */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase">Cabang Tujuan</label>
                                <select
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value as Branch)}
                                    className="w-full bg-gray-50 border rounded-xl px-3.5 py-2 text-sm focus:border-blue-500 outline-none text-gray-700 font-medium"
                                >
                                    {getAllBranches().map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.displayName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Tipe Transaksi */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase">Tipe Transaksi</label>
                                <select
                                    value={tipeTransaksi}
                                    onChange={(e) => setTipeTransaksi(e.target.value as TipeTransaksi)}
                                    className="w-full bg-gray-50 border rounded-xl px-3.5 py-2 text-sm focus:border-blue-500 outline-none text-gray-700 font-medium"
                                >
                                    <option value="regular">Regular (Per KG / M3)</option>
                                    <option value="borongan">Borongan (Manual Ongkos)</option>
                                </select>
                            </div>

                            {/* Satuan Berat */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase">Satuan Ukuran</label>
                                <select
                                    value={beratUnit}
                                    onChange={(e) => setBeratUnit(e.target.value as BeratUnit)}
                                    className="w-full bg-gray-50 border rounded-xl px-3.5 py-2 text-sm focus:border-blue-500 outline-none text-gray-700 font-medium"
                                >
                                    <option value="KG">Kilogram (KG)</option>
                                    <option value="KG/VOLUME">KG/Volume</option>
                                    <option value="M3">Kubikasi (M3)</option>
                                </select>
                            </div>

                            {/* Pembayaran & Pelunasan */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Pembayaran</label>
                                    <select
                                        value={pembayaran}
                                        onChange={(e) => setPembayaran(e.target.value as MetodePembayaran)}
                                        className="w-full bg-gray-50 border rounded-xl px-3.5 py-2 text-sm focus:border-blue-500 outline-none text-gray-700"
                                    >
                                        <option value="Tunai">Tunai</option>
                                        <option value="Kredit">Kredit</option>
                                        <option value="DP">DP</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600 uppercase">Pelunasan</label>
                                    <select
                                        value={pelunasan}
                                        onChange={(e) => setPelunasan(e.target.value as CaraPelunasan)}
                                        className="w-full bg-gray-50 border rounded-xl px-3.5 py-2 text-sm focus:border-blue-500 outline-none text-gray-700"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Cash">Cash</option>
                                        <option value="TF">TF</option>
                                    </select>
                                </div>
                            </div>

                            {/* default isi barang */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600 uppercase">Isi Barang Default</label>
                                <input
                                    type="text"
                                    value={defaultIsiBarang}
                                    onChange={(e) => setDefaultIsiBarang(e.target.value)}
                                    placeholder="GARMEN"
                                    className="w-full bg-gray-50 border rounded-xl px-3.5 py-2 text-sm focus:border-blue-500 outline-none text-gray-700 uppercase"
                                />
                            </div>
                        </div>

                        {/* Input Area (File Upload & Copy Paste) */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* File upload box */}
                            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
                                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <Upload size={16} className="text-blue-600" />
                                    Pilih File Excel / CSV
                                </h2>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-200 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-blue-50/20"
                                >
                                    <Upload size={32} className="text-gray-400" />
                                    <span className="text-sm font-semibold text-gray-600">Klik untuk upload file manifest</span>
                                    <span className="text-xs text-gray-400">Mendukung format file .xlsx, .xls, .csv</span>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                    />
                                </div>
                                {fileName && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-xs text-blue-700">
                                        <div className="flex items-center gap-2 font-medium">
                                            <FileText size={16} />
                                            {fileName}
                                        </div>
                                        {parsing && <span className="animate-pulse font-semibold">Memproses data...</span>}
                                    </div>
                                )}
                            </div>

                            {/* Copy paste box */}
                            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
                                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <Clipboard size={16} className="text-blue-600" />
                                    Copy-Paste Baris spreadsheet
                                </h2>
                                <textarea
                                    rows={5}
                                    value={copyPasteText}
                                    onChange={(e) => setCopyPasteText(e.target.value)}
                                    placeholder="Salin baris-baris dari Excel (blok kolom NO STT, Koli, Berat, Pengirim, Penerima, Alamat, Tujuan) lalu tempelkan di sini..."
                                    className="w-full bg-gray-50 border rounded-2xl p-3 text-xs outline-none focus:border-blue-500 font-mono text-gray-700"
                                />
                                <button
                                    onClick={handlePasteProcess}
                                    disabled={!copyPasteText.trim() || parsing}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2 px-5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Play size={12} />
                                    Proses Salinan
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Progress Loader */}
                    {importing && (
                        <div className="bg-white border rounded-2xl p-6 mt-6 shadow-md max-w-xl mx-auto space-y-4">
                            <h3 className="font-bold text-gray-800 text-sm text-center">Sedang Meng-import Transaksi ke Firestore...</h3>
                            <div className="w-full bg-gray-150 h-3 rounded-full overflow-hidden">
                                <div
                                    className="bg-emerald-500 h-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                            <p className="text-xs font-mono font-bold text-center text-emerald-600">
                                Berhasil menyimpan: {progress.current} / {progress.total} Resi
                            </p>
                        </div>
                    )}

                    {/* Success Message Banner */}
                    {importSuccessCount !== null && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 mt-6 text-sm flex items-center gap-3">
                            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                                <Check size={20} />
                            </div>
                            <div>
                                <span className="font-bold block">Import Berhasil Selesai!</span>
                                <span className="text-xs">Berhasil menyimpan total {importSuccessCount} data resi baru ke cabang {branch.toUpperCase()}.</span>
                            </div>
                        </div>
                    )}

                    {/* Preview Table */}
                    {rows.length > 0 && (
                        <div className="bg-white rounded-2xl border shadow-sm mt-6 overflow-hidden">
                            <div className="p-4 border-b flex items-center justify-between bg-gray-50 flex-wrap gap-3">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">Preview Transaksi ({rows.length} Baris Terbaca)</h3>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Edit atau hapus baris langsung sebelum melakukan penyimpanan.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={toggleAllSelect}
                                        className="border border-gray-200 text-gray-600 hover:bg-gray-100 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={handleImportSubmit}
                                        disabled={importing}
                                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
                                    >
                                        <Check size={14} />
                                        Mulai Simpan ke Database
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 bg-white border-b z-10 text-[10px] uppercase font-bold text-gray-500">
                                        <tr className="bg-gray-50 border-b">
                                            <th className="p-3 text-center w-8">
                                                <input
                                                    type="checkbox"
                                                    checked={rows.every(r => r.selected)}
                                                    onChange={toggleAllSelect}
                                                    className="w-4 h-4 rounded text-blue-600 border-gray-300 cursor-pointer"
                                                />
                                            </th>
                                            <th className="p-3 w-16">No</th>
                                            <th className="p-3 w-28">No STT</th>
                                            <th className="p-3 w-40">Pengirim</th>
                                            <th className="p-3 w-40">Penerima</th>
                                            <th className="p-3 w-16 text-center">Koli</th>
                                            <th className="p-3 w-20 text-center">Berat ({beratUnit})</th>
                                            <th className="p-3 w-32">Tujuan</th>
                                            <th className="p-3 w-40">Isi Barang</th>
                                            <th className="p-3 text-center w-12">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-gray-700">
                                        {rows.map((row, idx) => (
                                            <tr
                                                key={row.id}
                                                className={`hover:bg-gray-50/50 ${!row.selected ? 'opacity-40' : ''} ${!row.isValid ? 'bg-red-50/40' : ''}`}
                                            >
                                                {/* Checkbox select */}
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.selected}
                                                        onChange={() => toggleRowSelect(row.id)}
                                                        className="w-4 h-4 rounded text-blue-600 border-gray-300 cursor-pointer"
                                                    />
                                                </td>

                                                {/* Index indicator */}
                                                <td className="p-3 text-gray-400 font-medium font-mono">{idx + 1}.</td>

                                                {/* No STT */}
                                                <td className="p-2 font-mono">
                                                    <input
                                                        type="text"
                                                        value={row.noSTT}
                                                        onChange={(e) => updateRowCell(row.id, 'noSTT', e.target.value.toUpperCase())}
                                                        className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-xs font-bold text-gray-800"
                                                    />
                                                </td>

                                                {/* Pengirim */}
                                                <td className="p-2">
                                                    <div className="space-y-1">
                                                        <input
                                                            type="text"
                                                            value={row.pengirimName}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const matched = findClientByName(val);
                                                                updateRowCell(row.id, 'pengirimName', val);
                                                                updateRowCell(row.id, 'pengirimId', matched ? matched.id : '');
                                                            }}
                                                            className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-xs text-gray-800 font-medium"
                                                        />
                                                        {row.pengirimId ? (
                                                            <span className="inline-block text-[8px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                                                ✓ Terdaftar
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block text-[8px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded" title="Akan dikosongkan pengirimId-nya (custom name saja)">
                                                                Custom Name (Kosong)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Penerima */}
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        value={row.penerimaName}
                                                        onChange={(e) => updateRowCell(row.id, 'penerimaName', e.target.value)}
                                                        className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-xs"
                                                    />
                                                </td>

                                                {/* Koli */}
                                                <td className="p-2 text-center">
                                                    <input
                                                        type="number"
                                                        value={row.koli}
                                                        onChange={(e) => updateRowCell(row.id, 'koli', parseInt(e.target.value, 10) || 1)}
                                                        className="w-16 bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-center text-xs font-bold text-gray-800"
                                                    />
                                                </td>

                                                {/* Berat */}
                                                <td className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={row.berat}
                                                        onChange={(e) => updateRowCell(row.id, 'berat', parseFloat(e.target.value.replace(/,/g, '.')) || 0)}
                                                        className="w-20 bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-center text-xs font-bold text-gray-800"
                                                    />
                                                </td>

                                                {/* Tujuan & Alamat */}
                                                <td className="p-2">
                                                    <div className="space-y-1">
                                                        <input
                                                            type="text"
                                                            value={row.tujuan}
                                                            onChange={(e) => updateRowCell(row.id, 'tujuan', e.target.value)}
                                                            placeholder="Tujuan"
                                                            className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-xs font-semibold"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={row.penerimaAddress}
                                                            onChange={(e) => updateRowCell(row.id, 'penerimaAddress', e.target.value)}
                                                            placeholder="Alamat"
                                                            className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-[10px] text-gray-500"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Isi Barang */}
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        value={row.isiBarang}
                                                        onChange={(e) => updateRowCell(row.id, 'isiBarang', e.target.value.toUpperCase())}
                                                        className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-1 outline-none text-xs uppercase"
                                                    />
                                                </td>

                                                {/* Action / Delete */}
                                                <td className="p-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {!row.isValid && (
                                                            <span className="text-red-500" title={row.errorMsg}>
                                                                <AlertTriangle size={14} />
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => removeRow(row.id)}
                                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                            title="Hapus baris"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
