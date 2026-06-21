'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import { getExpensesByVoyage, subscribeToExpenses } from '@/lib/firestore-expenses';
import type { Voyage, Expense } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
    Calendar, 
    Ship, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Printer, 
    Copy,
    Search,
    Info,
    CalendarRange,
    FileText,
    ArrowRightLeft,
    Coins,
    UserCheck,
    CreditCard
} from 'lucide-react';

// Date utility to format Date to YYYY-MM-DD
const toYYYYMMDD = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Date range calculation based on departure day
interface CalculatedRange {
    startDate: Date;
    endDate: Date;
    label: string;
}

const getOperationalDateRange = (departureDate: Date): CalculatedRange => {
    const day = departureDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const start = new Date(departureDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(departureDate);
    end.setHours(23, 59, 59, 999);

    let startDayOffset = 0;
    let cycleLabel = '';

    if (day === 4) { // Thursday
        startDayOffset = -3; // Thursday - 3 days = Monday
        cycleLabel = 'Senin - Kamis';
    } else if (day === 0) { // Sunday
        startDayOffset = -2; // Sunday - 2 days = Friday
        cycleLabel = 'Jumat - Minggu';
    } else if (day >= 1 && day <= 3) { // Monday, Tuesday, Wednesday
        startDayOffset = -(day - 1);
        cycleLabel = `Senin - ${['Senin', 'Selasa', 'Rabu'][day - 1]}`;
    } else { // Friday, Saturday (5, 6)
        startDayOffset = -(day - 5);
        cycleLabel = `Jumat - ${['Jumat', 'Sabtu'][day - 5]}`;
    }

    start.setDate(start.getDate() + startDayOffset);

    return {
        startDate: start,
        endDate: end,
        label: cycleLabel
    };
};

export default function VoyageOperationalReportPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [selectedVoyageId, setSelectedVoyageId] = useState<string>('');
    const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [voyageExpenses, setVoyageExpenses] = useState<Expense[]>([]);
    const [allGeneralExpenses, setAllGeneralExpenses] = useState<Expense[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Date range picker states (automatically preset based on selected voyage, can override manually)
    const [startDateStr, setStartDateStr] = useState<string>('');
    const [endDateStr, setEndDateStr] = useState<string>('');
    const [cycleLabel, setCycleLabel] = useState<string>('');

    // Fetch Voyages and General Expenses
    useEffect(() => {
        if (!user) return;

        const unsubscribeVoyages = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
            setLoading(false);
        });

        const unsubscribeExpenses = subscribeToExpenses(user.uid, (data) => {
            // Keep general expenses only
            setAllGeneralExpenses(data.filter(e => e.type === 'general' || !e.type));
        });

        return () => {
            unsubscribeVoyages();
            unsubscribeExpenses();
        };
    }, [user]);

    // Update details when selected voyage changes
    useEffect(() => {
        const loadVoyageDetails = async () => {
            if (!selectedVoyageId || !user) {
                setSelectedVoyage(null);
                setTransactions([]);
                setVoyageExpenses([]);
                return;
            }

            setLoadingDetails(true);
            try {
                const voyage = voyages.find(v => v.id === selectedVoyageId);
                if (voyage) {
                    setSelectedVoyage(voyage);

                    // Preset operational date range
                    const calculated = getOperationalDateRange(voyage.departureDate);
                    setStartDateStr(toYYYYMMDD(calculated.startDate));
                    setEndDateStr(toYYYYMMDD(calculated.endDate));
                    setCycleLabel(calculated.label);

                    // Load transactions
                    const txPromises = voyage.transactionIds.map(txId => getTransactionById(txId));
                    const txData = await Promise.all(txPromises);
                    setTransactions(txData.filter((tx): tx is Transaction => tx !== null));

                    // Load voyage-specific expenses
                    const directExpenses = await getExpensesByVoyage(voyage.id, user.uid);
                    setVoyageExpenses(directExpenses);
                }
            } catch (error) {
                console.error("Error loading voyage report details:", error);
            } finally {
                setLoadingDetails(false);
            }
        };

        loadVoyageDetails();
    }, [selectedVoyageId, voyages, user]);

    // Filter and group general expenses inside the operational range
    const operationalExpenses = useMemo(() => {
        if (!startDateStr || !endDateStr) return [];
        const start = new Date(`${startDateStr}T00:00:00`);
        const end = new Date(`${endDateStr}T23:59:59`);

        return allGeneralExpenses.filter(e => {
            const expDate = new Date(e.date);
            return expDate >= start && expDate <= end;
        });
    }, [allGeneralExpenses, startDateStr, endDateStr]);

    // Segment operational expenses into:
    // 1. Tiket (category: tiket)
    // 2. Gaji (category: gaji_sopir or gaji_karyawan)
    // 3. Sewa Mobil (category: sewa_mobil)
    // 4. Operasional Harian Umum (others)
    const segmentedExpenses = useMemo(() => {
        let ticketSum = 0;
        let salarySum = 0;
        let carRentalSum = 0;
        let generalOpsSum = 0;

        const ticketList: Expense[] = [];
        const salaryList: Expense[] = [];
        const carRentalList: Expense[] = [];
        const generalOpsList: Expense[] = [];

        operationalExpenses.forEach(exp => {
            const cat = exp.category;
            const amount = exp.amount;

            if (cat === 'tiket') {
                ticketSum += amount;
                ticketList.push(exp);
            } else if (cat === 'gaji_sopir' || cat === 'gaji_karyawan') {
                salarySum += amount;
                salaryList.push(exp);
            } else if (cat === 'sewa_mobil') {
                carRentalSum += amount;
                carRentalList.push(exp);
            } else {
                generalOpsSum += amount;
                generalOpsList.push(exp);
            }
        });

        return {
            ticketSum,
            salarySum,
            carRentalSum,
            generalOpsSum,
            ticketList,
            salaryList,
            carRentalList,
            generalOpsList
        };
    }, [operationalExpenses]);

    // Financial summaries
    const totalRevenue = useMemo(() => {
        return transactions.reduce((sum, tx) => sum + tx.jumlah, 0);
    }, [transactions]);

    const totalVoyageExpenses = useMemo(() => {
        return voyageExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    }, [voyageExpenses]);

    const netProfit = useMemo(() => {
        return totalRevenue 
            - totalVoyageExpenses 
            - segmentedExpenses.generalOpsSum 
            - segmentedExpenses.ticketSum 
            - segmentedExpenses.salarySum 
            - segmentedExpenses.carRentalSum;
    }, [totalRevenue, totalVoyageExpenses, segmentedExpenses]);

    // Print & WA Lapor handlers
    const handlePrint = () => {
        if (!selectedVoyageId) return;
        window.open(
            `/finance/reports/voyage-ops/print?voyageId=${selectedVoyageId}&start=${startDateStr}&end=${endDateStr}`, 
            '_blank'
        );
    };

    const handleCopyReportWA = () => {
        if (!selectedVoyage) return;

        const formatD = (dStr: string) => {
            const date = new Date(dStr);
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        };

        const depDateStr = selectedVoyage.departureDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        let report = `*LAPORAN KEUANGAN VOYAGE & OPERASIONAL HARIAN*\n`;
        report += `*CV. CAHAYA CARGO EXPRESS*\n`;
        report += `-------------------------------------------\n`;
        report += `*VOYAGE DETAIL*\n`;
        report += `• No. Voyage: *${selectedVoyage.voyageNumber}*\n`;
        report += `• Rute: ${selectedVoyage.route}\n`;
        report += `• Kapal: ${selectedVoyage.shipName || '-'}\n`;
        report += `• Tanggal Berangkat: ${depDateStr}\n`;
        report += `• Periode Operasional Harian: ${formatD(startDateStr)} s/d ${formatD(endDateStr)} (${cycleLabel})\n`;
        report += `-------------------------------------------\n`;
        report += `*RINGKASAN KEUANGAN*\n`;
        report += `• (+) Pendapatan Kargo (Sales): *${formatRupiah(totalRevenue)}*\n`;
        report += `• (-) Biaya Khusus Voyage: *${formatRupiah(totalVoyageExpenses)}*\n`;
        report += `• (-) Biaya Operasional Harian (Umum): *${formatRupiah(segmentedExpenses.generalOpsSum)}*\n`;
        report += `• (-) Biaya Tiket: *${formatRupiah(segmentedExpenses.ticketSum)}*\n`;
        report += `• (-) Biaya Gaji: *${formatRupiah(segmentedExpenses.salarySum)}*\n`;
        report += `• (-) Biaya Sewa Mobil: *${formatRupiah(segmentedExpenses.carRentalSum)}*\n`;
        report += `-------------------------------------------\n`;
        report += `• *LABA / RUGI BERSIH*: *${formatRupiah(netProfit)}* ${netProfit >= 0 ? '✅' : '⚠️'}\n`;
        report += `-------------------------------------------\n`;
        report += `Dicetak via C2-MS System pada ${new Date().toLocaleString('id-ID')} WIB.`;

        navigator.clipboard.writeText(report)
            .then(() => alert('Laporan WhatsApp disalin ke clipboard!'))
            .catch(() => alert('Gagal menyalin laporan.'));
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-[400px] text-gray-500 animate-pulse">
                    Memuat data pemberangkatan kapal...
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                
                {/* Title Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                            <Ship className="text-blue-600 shrink-0" />
                            Laporan Per-Pemberangkatan
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Laba Rugi voyage dikurangi dengan biaya operasional harian terhitung.
                        </p>
                    </div>
                </div>

                {/* Voyage selector & Date range configurator */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1. Selector */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Pilih Pemberangkatan (Voyage)
                            </label>
                            <select
                                value={selectedVoyageId}
                                onChange={(e) => setSelectedVoyageId(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            >
                                <option value="">-- Pilih Voyage --</option>
                                {voyages.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.voyageNumber} - {v.route} ({new Date(v.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Start Date */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="text-blue-500" size={14} /> Mulai Operasional Harian
                            </label>
                            <input
                                type="date"
                                value={startDateStr}
                                disabled={!selectedVoyageId}
                                onChange={(e) => setStartDateStr(e.target.value)}
                                className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* 3. End Date */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="text-blue-500" size={14} /> Selesai Operasional Harian
                            </label>
                            <input
                                type="date"
                                value={endDateStr}
                                disabled={!selectedVoyageId}
                                onChange={(e) => setEndDateStr(e.target.value)}
                                className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {selectedVoyage && (
                        <div className="flex items-start gap-2.5 bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800 font-medium">
                            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                            <div>
                                <p>
                                    Voyage berangkat pada hari <strong>{selectedVoyage.departureDate.toLocaleDateString('id-ID', { weekday: 'long' })}</strong> ({toYYYYMMDD(selectedVoyage.departureDate)}). 
                                    Sistem secara otomatis menetapkan rentang harian ke cycle <strong>{cycleLabel}</strong>. Anda dapat merubah tanggal di atas secara manual jika diperlukan.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Dashboard Loading */}
                {loadingDetails && (
                    <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse">
                        Memuat data keuangan pemberangkatan kapal...
                    </div>
                )}

                {/* Report Panel */}
                {!loadingDetails && selectedVoyage && (
                    <div className="space-y-6">
                        
                        {/* Financial summary banner */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pendapatan Kargo</span>
                                <p className="text-xl font-bold text-blue-600 mt-1">{formatRupiah(totalRevenue)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Biaya Voyage</span>
                                <p className="text-xl font-bold text-red-500 mt-1">-{formatRupiah(totalVoyageExpenses)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operasional Harian</span>
                                <p className="text-xl font-bold text-orange-600 mt-1">-{formatRupiah(segmentedExpenses.generalOpsSum + segmentedExpenses.ticketSum + segmentedExpenses.salarySum + segmentedExpenses.carRentalSum)}</p>
                            </div>
                            <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-center ${netProfit >= 0 ? 'bg-green-600 text-white border-green-600 shadow-green-600/10' : 'bg-red-600 text-white border-red-600 shadow-red-600/10'}`}>
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Laba / Rugi Bersih</span>
                                <p className="text-2xl font-black mt-1">{formatRupiah(netProfit)}</p>
                            </div>
                        </div>

                        {/* Detailed Report Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            
                            {/* Left details panel (Tables) */}
                            <div className="lg:col-span-8 space-y-6">
                                
                                {/* 1. Cargo Revenue */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                            <FileText className="text-blue-500" size={16} />
                                            Pendapatan Perjalanan (Sales Kargo)
                                        </h3>
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                                            {transactions.length} STT
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px]">
                                                    <th className="p-3 text-center w-[5%]">No</th>
                                                    <th className="p-3 w-[25%]">No STT</th>
                                                    <th className="p-3 w-[35%]">Pengirim & Penerima</th>
                                                    <th className="p-3 text-center w-[15%]">Koli</th>
                                                    <th className="p-3 text-right w-[20%]">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                                {transactions.map((tx, idx) => (
                                                    <tr key={tx.id} className="hover:bg-gray-50/50">
                                                        <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}.</td>
                                                        <td className="p-3 font-mono font-bold text-gray-800">{tx.noSTT}</td>
                                                        <td className="p-3">
                                                            <div className="font-semibold text-gray-900">{tx.pengirimName}</div>
                                                            <div className="text-[10px] text-gray-400">➔ {tx.penerimaName}</div>
                                                        </td>
                                                        <td className="p-3 text-center font-semibold">{tx.koli}</td>
                                                        <td className="p-3 text-right font-bold text-blue-600">{formatRupiah(tx.jumlah)}</td>
                                                    </tr>
                                                ))}
                                                {transactions.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-6 text-center text-gray-400 italic">
                                                            Belum ada transaksi (kargo) yang terhubung ke voyage ini.
                                                        </td>
                                                    </tr>
                                                )}
                                                {transactions.length > 0 && (
                                                    <tr className="bg-blue-50/30 font-bold border-t border-blue-100">
                                                        <td colSpan={3} className="p-3 text-right text-gray-600 uppercase text-[10px] tracking-wider">Total Pendapatan</td>
                                                        <td className="p-3 text-center text-blue-900">{transactions.reduce((sum, tx) => sum + tx.koli, 0)}</td>
                                                        <td className="p-3 text-right text-blue-700 text-sm">{formatRupiah(totalRevenue)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 2. Voyage Expenses */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                            <TrendingDown className="text-red-500" size={16} />
                                            Pengeluaran Khusus Voyage
                                        </h3>
                                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded font-semibold">
                                            Direct Expenses
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px]">
                                                    <th className="p-3 text-center w-[5%]">No</th>
                                                    <th className="p-3 w-[20%]">Tanggal</th>
                                                    <th className="p-3 w-[25%]">Kategori</th>
                                                    <th className="p-3 w-[30%]">Keterangan</th>
                                                    <th className="p-3 text-right w-[20%]">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                                {voyageExpenses.map((exp, idx) => (
                                                    <tr key={exp.id} className="hover:bg-gray-50/50">
                                                        <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}.</td>
                                                        <td className="p-3 text-gray-500">
                                                            {new Date(exp.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                        </td>
                                                        <td className="p-3 font-semibold text-gray-800">
                                                            {EXPENSE_CATEGORY_LABELS[exp.category]}
                                                        </td>
                                                        <td className="p-3 text-gray-600">{exp.description}</td>
                                                        <td className="p-3 text-right font-bold text-red-600">{formatRupiah(exp.amount)}</td>
                                                    </tr>
                                                ))}
                                                {voyageExpenses.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-6 text-center text-gray-400 italic">
                                                            Tidak ada pengeluaran langsung voyage.
                                                        </td>
                                                    </tr>
                                                )}
                                                {voyageExpenses.length > 0 && (
                                                    <tr className="bg-red-50/30 font-bold border-t border-red-100">
                                                        <td colSpan={4} className="p-3 text-right text-gray-600 uppercase text-[10px] tracking-wider">Total Pengeluaran Voyage</td>
                                                        <td className="p-3 text-right text-red-700 text-sm">{formatRupiah(totalVoyageExpenses)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 3. Segmented General Expenses Detail (Tiket, Gaji, Sewa, Harian) */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm space-y-4 p-5">
                                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                                        <Coins className="text-orange-500" size={16} />
                                        Rincian Pengeluaran Kas Operasional Harian ({cycleLabel})
                                    </h3>

                                    {/* Tiket */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-gray-50 border border-gray-200/60 p-2.5 rounded-lg text-xs font-semibold">
                                            <span className="text-gray-700 flex items-center gap-1.5"><CreditCard size={14} className="text-blue-500" /> Pengeluaran Tiket</span>
                                            <span className="text-red-600 font-bold">{formatRupiah(segmentedExpenses.ticketSum)}</span>
                                        </div>
                                        {segmentedExpenses.ticketList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {segmentedExpenses.ticketList.map(e => (
                                                    <div key={e.id} className="flex justify-between text-[11px] text-gray-500 py-0.5">
                                                        <span>{e.description} ({new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})</span>
                                                        <span className="font-medium">{formatRupiah(e.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Gaji */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-gray-50 border border-gray-200/60 p-2.5 rounded-lg text-xs font-semibold">
                                            <span className="text-gray-700 flex items-center gap-1.5"><UserCheck size={14} className="text-blue-500" /> Pengeluaran Gaji / Sopir</span>
                                            <span className="text-red-600 font-bold">{formatRupiah(segmentedExpenses.salarySum)}</span>
                                        </div>
                                        {segmentedExpenses.salaryList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {segmentedExpenses.salaryList.map(e => (
                                                    <div key={e.id} className="flex justify-between text-[11px] text-gray-500 py-0.5">
                                                        <span>{e.description} ({new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})</span>
                                                        <span className="font-medium">{formatRupiah(e.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Sewa Mobil */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-gray-50 border border-gray-200/60 p-2.5 rounded-lg text-xs font-semibold">
                                            <span className="text-gray-700 flex items-center gap-1.5"><Ship size={14} className="text-blue-500" /> Pengeluaran Sewa Mobil</span>
                                            <span className="text-red-600 font-bold">{formatRupiah(segmentedExpenses.carRentalSum)}</span>
                                        </div>
                                        {segmentedExpenses.carRentalList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {segmentedExpenses.carRentalList.map(e => (
                                                    <div key={e.id} className="flex justify-between text-[11px] text-gray-500 py-0.5">
                                                        <span>{e.description} ({new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})</span>
                                                        <span className="font-medium">{formatRupiah(e.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Harian Umum Lainnya */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-gray-50 border border-gray-200/60 p-2.5 rounded-lg text-xs font-semibold">
                                            <span className="text-gray-700 flex items-center gap-1.5"><CalendarRange size={14} className="text-blue-500" /> Operasional Harian Umum (Lainnya)</span>
                                            <span className="text-red-600 font-bold">{formatRupiah(segmentedExpenses.generalOpsSum)}</span>
                                        </div>
                                        {segmentedExpenses.generalOpsList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {segmentedExpenses.generalOpsList.map(e => (
                                                    <div key={e.id} className="flex justify-between text-[11px] text-gray-500 py-0.5">
                                                        <span><strong>[{EXPENSE_CATEGORY_LABELS[e.category]}]</strong> {e.description} ({new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})</span>
                                                        <span className="font-medium">{formatRupiah(e.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right actions & profit summary block */}
                            <div className="lg:col-span-4 space-y-6">
                                
                                {/* Voyage overview details */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3">
                                        Pemberangkatan Detail
                                    </h3>
                                    <div className="space-y-3 text-xs">
                                        <div>
                                            <span className="text-gray-400 block uppercase font-bold tracking-wider text-[10px]">Nomor Voyage</span>
                                            <p className="font-mono font-bold text-gray-900 text-sm mt-0.5">{selectedVoyage.voyageNumber}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block uppercase font-bold tracking-wider text-[10px]">Rute & Kapal</span>
                                            <p className="font-bold text-gray-900 mt-0.5">{selectedVoyage.route} • {selectedVoyage.shipName || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block uppercase font-bold tracking-wider text-[10px]">Kendaraan / Plat Truk</span>
                                            <p className="font-semibold text-gray-850 mt-0.5">
                                                {selectedVoyage.vehicleNumbers?.join(', ') || selectedVoyage.vehicleNumber || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block uppercase font-bold tracking-wider text-[10px]">Hari Keberangkatan</span>
                                            <p className="font-semibold text-gray-850 mt-0.5">
                                                {selectedVoyage.departureDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Profit & Loss Summary Card */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3">
                                        Perhitungan Laba Bersih
                                    </h3>
                                    <div className="space-y-3 text-xs border-b border-gray-100 pb-4">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Pendapatan (Kargo)</span>
                                            <span className="font-bold text-blue-600">{formatRupiah(totalRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Voyage (Direct)</span>
                                            <span className="font-bold text-red-600">-{formatRupiah(totalVoyageExpenses)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Harian Umum</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(segmentedExpenses.generalOpsSum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Tiket</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(segmentedExpenses.ticketSum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Gaji</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(segmentedExpenses.salarySum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Sewa Mobil</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(segmentedExpenses.carRentalSum)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 font-bold text-sm">
                                        <span className="text-gray-800">Laba Bersih</span>
                                        <span className={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {formatRupiah(netProfit)}
                                        </span>
                                    </div>
                                </div>

                                {/* Export options */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handlePrint}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
                                    >
                                        <Printer size={18} /> Cetak Laporan (A4)
                                    </button>
                                    <button
                                        onClick={handleCopyReportWA}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
                                    >
                                        <Copy size={18} /> Salin WhatsApp (WA)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!selectedVoyageId && (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
                        <Ship className="mx-auto mb-3 opacity-20" size={48} />
                        <p className="text-sm font-semibold">Pilih pemberangkatan kapal di atas untuk menampilkan laporan.</p>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
