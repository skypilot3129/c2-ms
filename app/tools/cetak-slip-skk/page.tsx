'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { COMPANY_INFO } from '@/lib/company-config';
import { 
    Printer, 
    ArrowLeft, 
    Eye, 
    EyeOff, 
    Plus, 
    Trash2, 
    FileText, 
    Sparkles, 
    User, 
    Briefcase,
    Calendar,
    DollarSign,
    Check
} from 'lucide-react';

// Payslip row definition
interface SlipRow {
    id: string;
    description: string;
    amount: number;
}

// Terbilang helper for Indonesian numbers
const terbilang = (nilai: number): string => {
    const bilangan = [
        '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 
        'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
    ];
    let temp = '';
    const n = Math.floor(nilai);
    
    if (n < 12) {
        temp = ' ' + bilangan[n];
    } else if (n < 20) {
        temp = terbilang(n - 10) + ' Belas';
    } else if (n < 100) {
        temp = terbilang(Math.floor(n / 10)) + ' Puluh' + terbilang(n % 10);
    } else if (n < 200) {
        temp = ' Seratus' + terbilang(n - 100);
    } else if (n < 1000) {
        temp = terbilang(Math.floor(n / 100)) + ' Ratus' + terbilang(n % 100);
    } else if (n < 2000) {
        temp = ' Seribu' + terbilang(n - 1000);
    } else if (n < 1000000) {
        temp = terbilang(Math.floor(n / 1000)) + ' Ribu' + terbilang(n % 1000);
    } else if (n < 1000000000) {
        temp = terbilang(Math.floor(n / 1000000)) + ' Juta' + terbilang(n % 1000000);
    } else if (n < 1000000000000) {
        temp = terbilang(Math.floor(n / 1000000000)) + ' Milyar' + terbilang(n % 1000000000);
    } else if (n < 1000000000000000) {
        temp = terbilang(Math.floor(n / 1000000000000)) + ' Trilyun' + terbilang(n % 1000000000000);
    }
    
    return temp.trim();
};

const formatTerbilang = (nilai: number): string => {
    if (nilai === 0) return 'Nol Rupiah';
    const text = terbilang(nilai);
    return `(${text.charAt(0).toUpperCase() + text.slice(1)} Rupiah)`;
};

export default function CetakSlipSkkPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'slip' | 'skk'>('slip');
    const [showTtd, setShowTtd] = useState<boolean>(true);

    // Dynamic date calculations
    const today = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentMonthYear = `${months[today.getMonth()]} ${today.getFullYear()}`;
    const formattedDateToday = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    // ==========================================
    // STATE: SLIP GAJI
    // ==========================================
    const [slipPeriode, setSlipPeriode] = useState<string>('Maret 2026');
    const [slipNama, setSlipNama] = useState<string>('Alvian');
    const [slipId, setSlipId] = useState<string>('CCE-2024-092');
    const [slipJabatan, setSlipJabatan] = useState<string>('Driver (Sopir Operasional)');
    const [slipStatus, setSlipStatus] = useState<string>('Karyawan Tetap');
    const [slipTanggalBayar, setSlipTanggalBayar] = useState<string>('25 Maret 2026');
    const [slipBankText, setSlipBankText] = useState<string>('Gaji telah ditransfer langsung ke rekening bank terdaftar milik karyawan. Slip ini adalah bukti pembayaran sah dari perusahaan.');
    const [slipPersetujuanTitle, setSlipPersetujuanTitle] = useState<string>('HRD Manager');
    const [slipPersetujuanNama, setSlipPersetujuanNama] = useState<string>('HILAL BAFAGIH');
    
    const [earnings, setEarnings] = useState<SlipRow[]>([
        { id: '1', description: 'Gaji Pokok', amount: 5000000 },
        { id: '2', description: 'Tunjangan Perjalanan & Operasional', amount: 600000 },
        { id: '3', description: 'Tunjangan Makan', amount: 400000 }
    ]);
    const [deductions, setDeductions] = useState<SlipRow[]>([
        { id: '1', description: 'Potongan / Iuran', amount: 0 }
    ]);

    // Autosync received by name
    const [slipDiterimaNama, setSlipDiterimaNama] = useState<string>('Alvian');
    useEffect(() => {
        setSlipDiterimaNama(slipNama);
    }, [slipNama]);

    // Financial calculations
    const totalEarnings = useMemo(() => earnings.reduce((sum, r) => sum + r.amount, 0), [earnings]);
    const totalDeductions = useMemo(() => deductions.reduce((sum, r) => sum + r.amount, 0), [deductions]);
    const takeHomePay = useMemo(() => Math.max(0, totalEarnings - totalDeductions), [totalEarnings, totalDeductions]);
    const autoTerbilang = useMemo(() => formatTerbilang(takeHomePay), [takeHomePay]);
    
    // Explicit state for terbilang if user wants to override
    const [customTerbilang, setCustomTerbilang] = useState<string>('');
    const displayTerbilang = customTerbilang || autoTerbilang;

    useEffect(() => {
        setCustomTerbilang(''); // Reset to auto whenever takeHomePay changes
    }, [takeHomePay]);

    // Slip rows modifiers
    const addEarning = () => {
        setEarnings([...earnings, { id: Date.now().toString(), description: 'Tunjangan Baru', amount: 0 }]);
    };
    const deleteEarning = (id: string) => {
        setEarnings(earnings.filter(r => r.id !== id));
    };
    const updateEarning = (id: string, field: keyof SlipRow, value: any) => {
        setEarnings(earnings.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const addDeduction = () => {
        setDeductions([...deductions, { id: Date.now().toString(), description: 'Potongan Baru', amount: 0 }]);
    };
    const deleteDeduction = (id: string) => {
        setDeductions(deductions.filter(r => r.id !== id));
    };
    const updateDeduction = (id: string, field: keyof SlipRow, value: any) => {
        setDeductions(deductions.map(r => r.id === id ? { ...r, [field]: value } : r));
    };


    // ==========================================
    // STATE: SURAT KETERANGAN KERJA (SKK)
    // ==========================================
    const [skkNoSurat, setSkkNoSurat] = useState<string>('CCE/HRD-SKK/VI/2026');
    const [skkTanggalSurat, setSkkTanggalSurat] = useState<string>(formattedDateToday);
    const [skkNama, setSkkNama] = useState<string>('Alvian');
    const [skkId, setSkkId] = useState<string>('CCE-2024-092');
    const [skkJabatan, setSkkJabatan] = useState<string>('Driver (Sopir Operasional)');
    const [skkStatus, setSkkStatus] = useState<string>('Karyawan Tetap');
    const [skkMulaiBekerja, setSkkMulaiBekerja] = useState<string>('01 September 2023');
    const [skkPenandatanganNama, setSkkPenandatanganNama] = useState<string>('HILAL BAFAGIH');
    const [skkPenandatanganRole, setSkkPenandatanganRole] = useState<string>('HRD Manager');
    const [skkKotaSurat, setSkkKotaSurat] = useState<string>('Surabaya');

    const formatIDR = (num: number) => {
        return num.toLocaleString('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    };

    return (
        <ProtectedRoute>
            {/* dynamic print landscape stylesheets */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
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
                    .print-page-wrapper {
                        width: 100% !important;
                        background: white !important;
                        color: black !important;
                        padding: 0 !important;
                    }
                }
            ` }} />

            <div className="min-h-screen bg-gray-50 pb-16 no-print">
                {/* Header Navigation */}
                <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
                    <div className="container mx-auto px-4 py-4 max-w-7xl">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <Link href="/" className="text-xs text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                                    ← Kembali ke Home
                                </Link>
                                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <FileText className="text-blue-600" />
                                    Cetak Slip &amp; SKK Karyawan
                                </h1>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Buat, sesuaikan, dan cetak slip gaji custom atau surat keterangan kerja resmi untuk karyawan
                                </p>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => setShowTtd(!showTtd)}
                                    className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl font-semibold text-xs border flex items-center justify-center gap-2 transition-all ${
                                        showTtd 
                                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {showTtd ? <Eye size={15} /> : <EyeOff size={15} />}
                                    Tanda Tangan: {showTtd ? 'ON' : 'OFF'}
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    className="flex-1 md:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Printer size={15} />
                                    Cetak Dokumen (A4 Portrait)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-6 max-w-7xl">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-gray-200 mb-6 bg-white p-1 rounded-xl shadow-sm max-w-md">
                        <button
                            onClick={() => setActiveTab('slip')}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'slip' 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                            }`}
                        >
                            Slip Gaji Kustom
                        </button>
                        <button
                            onClick={() => setActiveTab('skk')}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'skk' 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                            }`}
                        >
                            Surat Keterangan Kerja (SKK)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* ========================================================
                            LEFT COLUMN: EDITOR FORMS
                           ======================================================== */}
                        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-250 shadow-sm space-y-6">
                            
                            {activeTab === 'slip' ? (
                                // FORM: SLIP GAJI
                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b pb-2">
                                        <Sparkles size={16} className="text-blue-600" />
                                        Data &amp; Pengaturan Slip Gaji
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nama Karyawan</label>
                                            <input 
                                                type="text" 
                                                value={slipNama}
                                                onChange={(e) => setSlipNama(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ID Karyawan</label>
                                            <input 
                                                type="text" 
                                                value={slipId}
                                                onChange={(e) => setSlipId(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Jabatan</label>
                                            <input 
                                                type="text" 
                                                value={slipJabatan}
                                                onChange={(e) => setSlipJabatan(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status Karyawan</label>
                                            <input 
                                                type="text" 
                                                value={slipStatus}
                                                onChange={(e) => setSlipStatus(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Periode Gaji</label>
                                            <input 
                                                type="text" 
                                                value={slipPeriode}
                                                onChange={(e) => setSlipPeriode(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tanggal Pembayaran</label>
                                            <input 
                                                type="text" 
                                                value={slipTanggalBayar}
                                                onChange={(e) => setSlipTanggalBayar(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* EARNINGS GRID */}
                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between items-center border-b pb-1">
                                            <label className="text-xs font-bold text-gray-700">Rincian Penghasilan (Earnings)</label>
                                            <button 
                                                onClick={addEarning}
                                                className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                                            >
                                                <Plus size={12} /> Tambah
                                            </button>
                                        </div>
                                        {earnings.map((earning) => (
                                            <div key={earning.id} className="flex gap-2 items-center">
                                                <input 
                                                    type="text" 
                                                    value={earning.description}
                                                    onChange={(e) => updateEarning(earning.id, 'description', e.target.value)}
                                                    className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-blue-500"
                                                    placeholder="Nama Penghasilan"
                                                />
                                                <input 
                                                    type="number" 
                                                    value={earning.amount}
                                                    onChange={(e) => updateEarning(earning.id, 'amount', parseInt(e.target.value) || 0)}
                                                    className="w-28 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-blue-500 text-right font-semibold"
                                                    placeholder="Jumlah"
                                                />
                                                <button 
                                                    onClick={() => deleteEarning(earning.id)}
                                                    className="text-red-500 hover:text-red-600 p-1"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* DEDUCTIONS GRID */}
                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between items-center border-b pb-1">
                                            <label className="text-xs font-bold text-gray-700">Rincian Potongan (Deductions)</label>
                                            <button 
                                                onClick={addDeduction}
                                                className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                                            >
                                                <Plus size={12} /> Tambah
                                            </button>
                                        </div>
                                        {deductions.map((deduction) => (
                                            <div key={deduction.id} className="flex gap-2 items-center">
                                                <input 
                                                    type="text" 
                                                    value={deduction.description}
                                                    onChange={(e) => updateDeduction(deduction.id, 'description', e.target.value)}
                                                    className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-blue-500"
                                                    placeholder="Nama Potongan"
                                                />
                                                <input 
                                                    type="number" 
                                                    value={deduction.amount}
                                                    onChange={(e) => updateDeduction(deduction.id, 'amount', parseInt(e.target.value) || 0)}
                                                    className="w-28 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-blue-500 text-right font-semibold"
                                                    placeholder="Jumlah"
                                                />
                                                <button 
                                                    onClick={() => deleteDeduction(deduction.id)}
                                                    className="text-red-500 hover:text-red-600 p-1"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col gap-1 pt-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Teks Terbilang (Custom)</label>
                                        <input 
                                            type="text" 
                                            value={displayTerbilang}
                                            onChange={(e) => setCustomTerbilang(e.target.value)}
                                            placeholder={autoTerbilang}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                        />
                                        <span className="text-[9px] text-gray-400">Kosongkan untuk menghitung otomatis</span>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Keterangan Bank</label>
                                        <textarea 
                                            rows={2}
                                            value={slipBankText}
                                            onChange={(e) => setSlipBankText(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Disetujui Oleh (Jabatan)</label>
                                            <input 
                                                type="text" 
                                                value={slipPersetujuanTitle}
                                                onChange={(e) => setSlipPersetujuanTitle(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Disetujui Oleh (Nama)</label>
                                            <input 
                                                type="text" 
                                                value={slipPersetujuanNama}
                                                onChange={(e) => setSlipPersetujuanNama(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // FORM: SURAT KETERANGAN KERJA (SKK)
                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b pb-2">
                                        <Sparkles size={16} className="text-blue-600" />
                                        Data &amp; Pengaturan SKK
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nomor Surat</label>
                                            <input 
                                                type="text" 
                                                value={skkNoSurat}
                                                onChange={(e) => setSkkNoSurat(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tanggal Surat</label>
                                            <input 
                                                type="text" 
                                                value={skkTanggalSurat}
                                                onChange={(e) => setSkkTanggalSurat(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nama Karyawan</label>
                                            <input 
                                                type="text" 
                                                value={skkNama}
                                                onChange={(e) => setSkkNama(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ID Karyawan</label>
                                            <input 
                                                type="text" 
                                                value={skkId}
                                                onChange={(e) => setSkkId(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Jabatan</label>
                                            <input 
                                                type="text" 
                                                value={skkJabatan}
                                                onChange={(e) => setSkkJabatan(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status Karyawan</label>
                                            <input 
                                                type="text" 
                                                value={skkStatus}
                                                onChange={(e) => setSkkStatus(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Mulai Bekerja Sejak</label>
                                            <input 
                                                type="text" 
                                                value={skkMulaiBekerja}
                                                onChange={(e) => setSkkMulaiBekerja(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kota Penerbit Surat</label>
                                            <input 
                                                type="text" 
                                                value={skkKotaSurat}
                                                onChange={(e) => setSkkKotaSurat(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Penandatangan (Nama)</label>
                                            <input 
                                                type="text" 
                                                value={skkPenandatanganNama}
                                                onChange={(e) => setSkkPenandatanganNama(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Penandatangan (Jabatan)</label>
                                            <input 
                                                type="text" 
                                                value={skkPenandatanganRole}
                                                onChange={(e) => setSkkPenandatanganRole(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ========================================================
                            RIGHT COLUMN: LIVE PREVIEW CONTAINER
                           ======================================================== */}
                        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl shadow-sm p-8 overflow-x-auto min-h-[842px] relative flex justify-center items-start">
                            
                            {activeTab === 'slip' ? (
                                // PREVIEW: SLIP GAJI
                                <div className="print-page-wrapper w-full max-w-[210mm] text-black bg-white p-4 select-text">
                                    <div className="border-[1.5px] border-black p-6 font-mono text-[9pt] leading-normal flex flex-col justify-between min-h-[140mm]">
                                        
                                        {/* Company Header */}
                                        <div className="flex justify-between items-start border-b border-black pb-3 mb-4">
                                            <div>
                                                <h3 className="font-black text-xs uppercase tracking-tight">{COMPANY_INFO.name}</h3>
                                                <p className="text-[7pt] text-gray-600 mt-0.5">{COMPANY_INFO.address}, {COMPANY_INFO.city} - Tlp: {COMPANY_INFO.phone}</p>
                                            </div>
                                            <div className="text-right">
                                                <h2 className="font-black text-sm tracking-wide border border-black px-2 py-0.5 uppercase bg-gray-50">SLIP GAJI KARYAWAN</h2>
                                                <p className="text-[8.5pt] font-bold mt-1">Periode: {slipPeriode}</p>
                                            </div>
                                        </div>

                                        {/* Employee Details Grid */}
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4 text-[8.5pt] border border-black p-3 bg-gray-50/50">
                                            <div className="flex">
                                                <span className="w-24 shrink-0 font-bold">Nama Karyawan</span>
                                                <span className="mr-2">:</span>
                                                <span className="font-black">{slipNama}</span>
                                            </div>
                                            <div className="flex">
                                                <span className="w-24 shrink-0 font-bold">Status Kerja</span>
                                                <span className="mr-2">:</span>
                                                <span>{slipStatus}</span>
                                            </div>
                                            <div className="flex">
                                                <span className="w-24 shrink-0 font-bold">ID Karyawan</span>
                                                <span className="mr-2">:</span>
                                                <span className="font-bold">{slipId}</span>
                                            </div>
                                            <div className="flex">
                                                <span className="w-24 shrink-0 font-bold">Tgl Transfer</span>
                                                <span className="mr-2">:</span>
                                                <span>{slipTanggalBayar}</span>
                                            </div>
                                            <div className="flex col-span-2">
                                                <span className="w-24 shrink-0 font-bold">Jabatan</span>
                                                <span className="mr-2">:</span>
                                                <span>{slipJabatan}</span>
                                            </div>
                                        </div>

                                        {/* Financial Breakdown Table Grid */}
                                        <div className="grid grid-cols-2 gap-4 border border-black mb-4">
                                            {/* Earnings Column */}
                                            <div className="border-r border-black flex flex-col justify-between">
                                                <div>
                                                    <div className="border-b border-black bg-gray-100 px-3 py-1 font-bold text-center uppercase text-[7.5pt]">
                                                        Rincian Penghasilan (Earnings)
                                                    </div>
                                                    <div className="p-3 space-y-1.5 min-h-[40mm]">
                                                        {earnings.map(row => (
                                                            <div key={row.id} className="flex justify-between">
                                                                <span>{row.description}</span>
                                                                <span className="font-bold">Rp {formatIDR(row.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="border-t border-black bg-gray-50 p-3 flex justify-between font-bold text-[8.5pt]">
                                                    <span>Total Bruto (A)</span>
                                                    <span>Rp {formatIDR(totalEarnings)}</span>
                                                </div>
                                            </div>

                                            {/* Deductions Column */}
                                            <div className="flex flex-col justify-between">
                                                <div>
                                                    <div className="border-b border-black bg-gray-100 px-3 py-1 font-bold text-center uppercase text-[7.5pt]">
                                                        Rincian Potongan (Deductions)
                                                    </div>
                                                    <div className="p-3 space-y-1.5 min-h-[40mm]">
                                                        {deductions.map(row => (
                                                            <div key={row.id} className="flex justify-between">
                                                                <span>{row.description}</span>
                                                                <span className="font-bold">Rp {formatIDR(row.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="border-t border-black bg-gray-50 p-3 flex justify-between font-bold text-[8.5pt]">
                                                    <span>Total Potongan (B)</span>
                                                    <span>Rp {formatIDR(totalDeductions)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Take Home Pay */}
                                        <div className="border-[1.5px] border-black bg-gray-100 p-4 mb-4 flex flex-col md:flex-row justify-between items-center gap-2">
                                            <div>
                                                <h4 className="font-black text-[9pt] uppercase tracking-wide">TOTAL PENERIMAAN BERSIH (TAKE HOME PAY)</h4>
                                                <p className="text-[7.5pt] italic text-gray-700 mt-1 font-bold">{displayTerbilang}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-black text-sm border-b-2 border-black pb-0.5">
                                                    Rp {formatIDR(takeHomePay)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bank Keterangan Note */}
                                        <div className="border border-black p-3 mb-6 bg-gray-50 text-[7.5pt] leading-normal">
                                            <span className="font-bold">Catatan Bank:</span> {slipBankText}
                                        </div>

                                        {/* Signatures */}
                                        <div className="grid grid-cols-2 gap-4 text-center mt-auto border-t border-dashed border-black pt-4">
                                            <div className="flex flex-col items-center justify-between min-h-[28mm]">
                                                <span className="font-bold">Disetujui Oleh,</span>
                                                <div className="h-[20mm] flex items-center justify-center my-0.5 relative w-[40mm]">
                                                    {showTtd && (
                                                        <img 
                                                            src="/ttd.png" 
                                                            alt="Hilal Bafagih Ttd" 
                                                            className="h-[20mm] w-auto object-contain absolute mix-blend-multiply"
                                                        />
                                                    )}
                                                </div>
                                                <span className="font-bold underline uppercase">{slipPersetujuanNama}</span>
                                                <span className="text-[7.5pt] text-gray-500">({slipPersetujuanTitle})</span>
                                            </div>

                                            <div className="flex flex-col items-center justify-between min-h-[28mm]">
                                                <span className="font-bold">Diterima Oleh,</span>
                                                <div className="h-[20mm] flex items-center justify-center my-0.5">
                                                    {/* blank space for sign */}
                                                </div>
                                                <span className="font-bold underline uppercase">{slipDiterimaNama}</span>
                                                <span className="text-[7.5pt] text-gray-500">( Karyawan )</span>
                                            </div>
                                        </div>

                                        {/* Footnote */}
                                        <div className="text-[6.5pt] text-gray-400 text-center mt-6 border-t pt-2 italic">
                                            Dokumen ini dibuat secara digital dan sah tanpa tanda tangan basah jika dicetak dari sistem penggajian CV Cahaya Cargo Express.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // PREVIEW: SURAT KETERANGAN KERJA (SKK)
                                <div className="print-page-wrapper w-full max-w-[210mm] text-black bg-white p-4 select-text">
                                    <div className="font-serif text-[10.5pt] leading-relaxed p-6 flex flex-col min-h-[240mm]">
                                        
                                        {/* Professional Kop Surat */}
                                        <div className="text-center border-b-[3px] border-black pb-3 mb-6">
                                            <h2 className="font-black text-lg tracking-wide font-sans">{COMPANY_INFO.name}</h2>
                                            <p className="text-[8pt] text-gray-600 font-sans mt-1">
                                                JASA PENGIRIMAN CARGO LOGISTIK &amp; EXPEDISI BERSKALA NASIONAL
                                            </p>
                                            <p className="text-[7.5pt] text-gray-500 font-sans mt-0.5">
                                                Surabaya: {COMPANY_INFO.address} - Telp: {COMPANY_INFO.phone} | Makassar: {COMPANY_INFO.branchAddress} - Telp: {COMPANY_INFO.branchPhone}
                                            </p>
                                        </div>

                                        {/* Letter Title */}
                                        <div className="text-center mb-8">
                                            <h3 className="font-black text-sm underline tracking-wide uppercase">SURAT KETERANGAN KERJA</h3>
                                            <p className="text-[9pt] font-bold text-gray-600 mt-1">Nomor: {skkNoSurat}</p>
                                        </div>

                                        {/* Letter Body Intro */}
                                        <div className="space-y-4">
                                            <p>Yang bertanda tangan di bawah ini:</p>
                                            <div className="grid grid-cols-12 gap-1 ml-6">
                                                <div className="col-span-3 font-semibold">Nama</div>
                                                <div className="col-span-9">: {skkPenandatanganNama}</div>
                                                <div className="col-span-3 font-semibold">Jabatan</div>
                                                <div className="col-span-9">: {skkPenandatanganRole}</div>
                                                <div className="col-span-3 font-semibold">Perusahaan</div>
                                                <div className="col-span-9">: CV. Cahaya Cargo Express</div>
                                            </div>

                                            <p className="pt-2">Dengan ini menerangkan dengan sebenarnya bahwa:</p>
                                            <div className="grid grid-cols-12 gap-1 ml-6 border border-gray-300 p-3 bg-gray-50/50 rounded-lg">
                                                <div className="col-span-3 font-semibold">Nama Karyawan</div>
                                                <div className="col-span-9 font-black">: {skkNama}</div>
                                                <div className="col-span-3 font-semibold">ID Karyawan</div>
                                                <div className="col-span-9">: {skkId}</div>
                                                <div className="col-span-3 font-semibold">Jabatan</div>
                                                <div className="col-span-9 font-bold">: {skkJabatan}</div>
                                                <div className="col-span-3 font-semibold">Status</div>
                                                <div className="col-span-9">: {skkStatus}</div>
                                            </div>

                                            {/* Core statement (> 2 years) */}
                                            <p className="pt-2 text-justify">
                                                Adalah benar-benar bekerja sebagai karyawan pada <strong>CV. Cahaya Cargo Express</strong> terhitung sejak tanggal <strong>{skkMulaiBekerja}</strong> sampai dengan saat ini, dan telah memiliki masa kerja selama lebih dari 2 (dua) tahun secara berturut-turut.
                                            </p>

                                            <p className="text-justify">
                                                Selama menjalankan tugasnya di perusahaan kami, yang bersangkutan telah menunjukkan loyalitas, dedikasi, kedisiplinan, serta kinerja operasional yang sangat baik. Yang bersangkutan juga senantiasa mematuhi regulasi internal serta menjaga integritas nama baik perusahaan dengan penuh rasa tanggung jawab.
                                            </p>

                                            <p className="text-justify">
                                                Demikian Surat Keterangan Kerja ini kami terbitkan dengan keadaan sebenarnya agar dapat dipergunakan sebagaimana mestinya, khususnya untuk memenuhi kelengkapan administrasi pengajuan kebutuhan yang bersangkutan.
                                            </p>
                                        </div>

                                        {/* Signature block */}
                                        <div className="mt-12 ml-auto w-[65mm] text-center flex flex-col items-center">
                                            <span className="block font-sans text-[9pt]">{skkKotaSurat}, {skkTanggalSurat}</span>
                                            <span className="block font-bold text-[9pt] mt-1 font-sans">CV. Cahaya Cargo Express</span>
                                            
                                            <div className="h-[25mm] flex items-center justify-center my-1 relative w-[40mm]">
                                                {showTtd && (
                                                    <img 
                                                        src="/ttd.png" 
                                                        alt="Hilal Bafagih Signature" 
                                                        className="h-[25mm] w-auto object-contain absolute mix-blend-multiply"
                                                    />
                                                )}
                                            </div>

                                            <span className="font-bold underline block uppercase font-sans text-[9.5pt]">{skkPenandatanganNama}</span>
                                            <span className="text-[8pt] text-gray-500 uppercase tracking-wider font-sans mt-0.5">{skkPenandatanganRole}</span>
                                        </div>

                                    </div>
                                </div>
                            )}

                        </div>

                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
