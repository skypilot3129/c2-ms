'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import { getExpensesByVoyage, subscribeToExpenses } from '@/lib/firestore-expenses';
import type { Voyage, Expense, ExpenseCategory } from '@/types/voyage';
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
    CreditCard,
    LayoutGrid,
    CalendarDays
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

interface MonthlyRecapRow {
    voyageId: string;
    voyageNumber: string;
    route: string;
    shipName?: string;
    departureDate: Date;
    opStart: Date;
    opEnd: Date;
    opLabel: string;
    revenue: number;
    directExpenses: number;
}

export default function VoyageOperationalReportPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [voyages, setVoyages] = useState<Voyage[]>([]);
    
    // Toggle state: 'single' (Per Keberangkatan) or 'monthly' (Rekap Bulanan)
    const [reportType, setReportType] = useState<'single' | 'monthly'>('single');

    // Single Voyage states
    const [selectedVoyageId, setSelectedVoyageId] = useState<string>('');
    const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [voyageExpenses, setVoyageExpenses] = useState<Expense[]>([]);
    
    // Monthly Recap states
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [recapRows, setRecapRows] = useState<MonthlyRecapRow[]>([]);
    const [calculatingRecap, setCalculatingRecap] = useState<boolean>(false);

    // Global expenses ( kas umum )
    const [allGeneralExpenses, setAllGeneralExpenses] = useState<Expense[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Single Date range picker states (automatically preset based on selected voyage, can override manually)
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

    // Update details when selected single voyage changes
    useEffect(() => {
        const loadVoyageDetails = async () => {
            if (!selectedVoyageId || !user || reportType !== 'single') {
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

                    // Load voyage-specific direct expenses
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
    }, [selectedVoyageId, voyages, user, reportType]);

    // Trigger Monthly Recap calculation
    useEffect(() => {
        if (!user || loading || reportType !== 'monthly') return;

        const calculateRecap = async () => {
            setCalculatingRecap(true);
            try {
                // Filter voyages departing in selected month and year
                const filteredVoyages = voyages.filter(v => {
                    const depDate = new Date(v.departureDate);
                    return depDate.getMonth() === selectedMonth && depDate.getFullYear() === selectedYear;
                });

                const rows: MonthlyRecapRow[] = [];

                for (const voyage of filteredVoyages) {
                    // Fetch transactions
                    const txPromises = voyage.transactionIds.map(txId => getTransactionById(txId));
                    const txData = await Promise.all(txPromises);
                    const revenue = txData.reduce((sum, tx) => sum + (tx?.jumlah || 0), 0);

                    // Fetch direct voyage expenses
                    const directExpensesList = await getExpensesByVoyage(voyage.id, user.uid);
                    const directExpenses = directExpensesList.reduce((sum, exp) => sum + exp.amount, 0);

                    const range = getOperationalDateRange(voyage.departureDate);

                    rows.push({
                        voyageId: voyage.id,
                        voyageNumber: voyage.voyageNumber,
                        route: voyage.route,
                        shipName: voyage.shipName,
                        departureDate: voyage.departureDate,
                        opStart: range.startDate,
                        opEnd: range.endDate,
                        opLabel: range.label,
                        revenue,
                        directExpenses
                    });
                }

                // Sort by departure date ascending
                rows.sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime());
                setRecapRows(rows);
            } catch (error) {
                console.error("Error calculating monthly recap:", error);
            } finally {
                setCalculatingRecap(false);
            }
        };

        calculateRecap();
    }, [user, voyages, selectedMonth, selectedYear, reportType, loading]);

    // ==========================================
    // SINGLE REPORT MEMOS
    // ==========================================
    const singleOperationalExpenses = useMemo(() => {
        if (reportType !== 'single' || !startDateStr || !endDateStr) return [];
        const start = new Date(`${startDateStr}T00:00:00`);
        const end = new Date(`${endDateStr}T23:59:59`);

        return allGeneralExpenses.filter(e => {
            const expDate = new Date(e.date);
            return expDate >= start && expDate <= end;
        });
    }, [allGeneralExpenses, startDateStr, endDateStr, reportType]);

    const singleSegmentedExpenses = useMemo(() => {
        let ticketSum = 0;
        let salarySum = 0;
        let carRentalSum = 0;
        let generalOpsSum = 0;

        const ticketList: Expense[] = [];
        const salaryList: Expense[] = [];
        const carRentalList: Expense[] = [];
        const generalOpsList: Expense[] = [];

        singleOperationalExpenses.forEach(exp => {
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
    }, [singleOperationalExpenses]);

    const singleTotalRevenue = useMemo(() => {
        return transactions.reduce((sum, tx) => sum + tx.jumlah, 0);
    }, [transactions]);

    const singleTotalVoyageExpenses = useMemo(() => {
        return voyageExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    }, [voyageExpenses]);

    const singleNetProfit = useMemo(() => {
        return singleTotalRevenue 
            - singleTotalVoyageExpenses 
            - singleSegmentedExpenses.generalOpsSum 
            - singleSegmentedExpenses.ticketSum 
            - singleSegmentedExpenses.salarySum 
            - singleSegmentedExpenses.carRentalSum;
    }, [singleTotalRevenue, singleTotalVoyageExpenses, singleSegmentedExpenses]);

    // ==========================================
    // MONTHLY REPORT MEMOS
    // ==========================================
    // Get disjoint union of dates matching operational ranges of all voyages in this month
    const monthlyOperationalExpenses = useMemo(() => {
        if (reportType !== 'monthly' || recapRows.length === 0) return [];
        
        return allGeneralExpenses.filter(exp => {
            const expDate = new Date(exp.date);
            
            // Check if expense date falls into the calculated operational range of ANY voyage in this month
            return recapRows.some(row => {
                const start = new Date(row.opStart);
                start.setHours(0,0,0,0);
                const end = new Date(row.opEnd);
                end.setHours(23,59,59,999);
                return expDate >= start && expDate <= end;
            });
        });
    }, [allGeneralExpenses, recapRows, reportType]);

    // Segment and total monthly operational expenses:
    // - Sewa Mobil, Gaji, Tiket: Itemized (detail lists)
    // - Others: Grouped by category sum
    const monthlySegmentedExpenses = useMemo(() => {
        const ticketList: Expense[] = [];
        const salaryList: Expense[] = [];
        const carRentalList: Expense[] = [];
        
        const categorySums: Record<string, number> = {};

        monthlyOperationalExpenses.forEach(exp => {
            const cat = exp.category;
            const amount = exp.amount;

            if (cat === 'tiket') {
                ticketList.push(exp);
            } else if (cat === 'gaji_sopir' || cat === 'gaji_karyawan') {
                salaryList.push(exp);
            } else if (cat === 'sewa_mobil') {
                carRentalList.push(exp);
            } else {
                categorySums[cat] = (categorySums[cat] || 0) + amount;
            }
        });

        // Sum up lists
        const ticketSum = ticketList.reduce((s, e) => s + e.amount, 0);
        const salarySum = salaryList.reduce((s, e) => s + e.amount, 0);
        const carRentalSum = carRentalList.reduce((s, e) => s + e.amount, 0);
        const otherOpsSum = Object.values(categorySums).reduce((s, a) => s + a, 0);

        return {
            ticketSum,
            salarySum,
            carRentalSum,
            otherOpsSum,
            ticketList,
            salaryList,
            carRentalList,
            categorySums
        };
    }, [monthlyOperationalExpenses]);

    const monthlyTotalRevenue = useMemo(() => {
        return recapRows.reduce((sum, row) => sum + row.revenue, 0);
    }, [recapRows]);

    const monthlyTotalDirectExpenses = useMemo(() => {
        return recapRows.reduce((sum, row) => sum + row.directExpenses, 0);
    }, [recapRows]);

    const monthlyTotalDailyOps = useMemo(() => {
        return monthlySegmentedExpenses.ticketSum 
            + monthlySegmentedExpenses.salarySum 
            + monthlySegmentedExpenses.carRentalSum 
            + monthlySegmentedExpenses.otherOpsSum;
    }, [monthlySegmentedExpenses]);

    const monthlyNetProfit = useMemo(() => {
        return monthlyTotalRevenue - monthlyTotalDirectExpenses - monthlyTotalDailyOps;
    }, [monthlyTotalRevenue, monthlyTotalDirectExpenses, monthlyTotalDailyOps]);

    // ==========================================
    // HANDLERS & EXPORTS
    // ==========================================
    const handlePrintSingle = () => {
        if (!selectedVoyageId) return;
        window.open(
            `/finance/reports/voyage-ops/print?voyageId=${selectedVoyageId}&start=${startDateStr}&end=${endDateStr}`, 
            '_blank'
        );
    };

    const handlePrintMonthly = () => {
        window.open(
            `/finance/reports/voyage-ops/print-rekap?month=${selectedMonth}&year=${selectedYear}`, 
            '_blank'
        );
    };

    const handleCopySingleWA = () => {
        if (!selectedVoyage) return;

        const formatD = (dStr: string) => {
            const date = new Date(dStr);
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        };

        const depDateStr = selectedVoyage.departureDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        let report = `*LAPORAN KEUANGAN KAPAL & OPERASIONAL HARIAN*\n`;
        report += `*CV. CAHAYA CARGO EXPRESS*\n`;
        report += `-------------------------------------------\n`;
        report += `*DETAIL KEBERANGKATAN*\n`;
        report += `• No. Keberangkatan: *${selectedVoyage.voyageNumber}*\n`;
        report += `• Rute: ${selectedVoyage.route}\n`;
        report += `• Kapal: ${selectedVoyage.shipName || '-'}\n`;
        report += `• Tanggal Berangkat: ${depDateStr}\n`;
        report += `• Periode Operasional Harian: ${formatD(startDateStr)} s/d ${formatD(endDateStr)} (${cycleLabel})\n`;
        report += `-------------------------------------------\n`;
        report += `*RINGKASAN KEUANGAN*\n`;
        report += `• (+) Pendapatan Kargo (Sales): *${formatRupiah(singleTotalRevenue)}*\n`;
        report += `• (-) Biaya Kapal (Langsung): *${formatRupiah(singleTotalVoyageExpenses)}*\n`;
        report += `• (-) Biaya Operasional Harian (Umum): *${formatRupiah(singleSegmentedExpenses.generalOpsSum)}*\n`;
        report += `• (-) Biaya Tiket: *${formatRupiah(singleSegmentedExpenses.ticketSum)}*\n`;
        report += `• (-) Biaya Gaji: *${formatRupiah(singleSegmentedExpenses.salarySum)}*\n`;
        report += `• (-) Biaya Sewa Mobil: *${formatRupiah(singleSegmentedExpenses.carRentalSum)}*\n`;
        report += `-------------------------------------------\n`;
        report += `• *LABA / RUGI BERSIH*: *${formatRupiah(singleNetProfit)}* ${singleNetProfit >= 0 ? '✅' : '⚠️'}\n`;
        report += `-------------------------------------------\n`;
        report += `Dicetak via C2-MS System pada ${new Date().toLocaleString('id-ID')} WIB.`;

        navigator.clipboard.writeText(report)
            .then(() => alert('Laporan WhatsApp disalin ke clipboard!'))
            .catch(() => alert('Gagal menyalin laporan.'));
    };

    const handleCopyMonthlyWA = () => {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Mei',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        let report = `*LAPORAN REKAP BULANAN KAPAL & OPERASIONAL HARIAN*\n`;
        report += `*CV. CAHAYA CARGO EXPRESS*\n`;
        report += `-------------------------------------------\n`;
        report += `Periode: *${months[selectedMonth]} ${selectedYear}*\n`;
        report += `Jumlah Keberangkatan: *${recapRows.length} Kapal*\n`;
        report += `-------------------------------------------\n`;
        report += `*RINGKASAN UTAMA BULANAN*\n`;
        report += `• (+) Total Pendapatan Kargo: *${formatRupiah(monthlyTotalRevenue)}*\n`;
        report += `• (-) Total Biaya Kapal (Direct): *${formatRupiah(monthlyTotalDirectExpenses)}*\n`;
        report += `• (-) Total Operasional Harian: *${formatRupiah(monthlyTotalDailyOps)}*\n`;
        report += `  - Tiket: ${formatRupiah(monthlySegmentedExpenses.ticketSum)}\n`;
        report += `  - Gaji/Sopir: ${formatRupiah(monthlySegmentedExpenses.salarySum)}\n`;
        report += `  - Sewa Mobil: ${formatRupiah(monthlySegmentedExpenses.carRentalSum)}\n`;
        report += `  - Lain-lain: ${formatRupiah(monthlySegmentedExpenses.otherOpsSum)}\n`;
        report += `-------------------------------------------\n`;
        report += `• *LABA / RUGI BERSIH BULANAN*: *${formatRupiah(monthlyNetProfit)}* ${monthlyNetProfit >= 0 ? '✅' : '⚠️'}\n`;
        report += `-------------------------------------------\n`;
        report += `Dicetak via C2-MS System pada ${new Date().toLocaleString('id-ID')} WIB.`;

        navigator.clipboard.writeText(report)
            .then(() => alert('Laporan rekap bulanan WhatsApp disalin ke clipboard!'))
            .catch(() => alert('Gagal menyalin laporan.'));
    };

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                            <Ship className="text-blue-600 shrink-0" />
                            Laporan Per-Kapal &amp; Operasional
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Laba rugi kargo dan kapal dikurangi dengan biaya operasional harian terhitung.
                        </p>
                    </div>

                    {/* Report Type Selector Switch */}
                    <div className="bg-white border border-gray-200 p-1.5 rounded-xl flex shadow-sm w-fit self-start md:self-auto">
                        <button
                            onClick={() => setReportType('single')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                reportType === 'single'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-650 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            <Ship size={14} /> Per Keberangkatan
                        </button>
                        <button
                            onClick={() => setReportType('monthly')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                reportType === 'monthly'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-650 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            <LayoutGrid size={14} /> Rekap Bulanan
                        </button>
                    </div>
                </div>

                {/* ==================================================== */}
                {/* 1. REPORT WIDGET CONFIGURATION: SINGLE VOYAGE VIEW */}
                {/* ==================================================== */}
                {reportType === 'single' && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Selector */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Pilih Pemberangkatan Kapal
                                </label>
                                <select
                                    value={selectedVoyageId}
                                    onChange={(e) => setSelectedVoyageId(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                >
                                    <option value="">-- Pilih Pemberangkatan --</option>
                                    {voyages.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.voyageNumber} - {v.route} ({new Date(v.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Start Date */}
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

                            {/* End Date */}
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
                                        Kapal berangkat pada hari <strong>{selectedVoyage.departureDate.toLocaleDateString('id-ID', { weekday: 'long' })}</strong> ({toYYYYMMDD(selectedVoyage.departureDate)}). 
                                        Sistem secara otomatis menetapkan rentang harian ke siklus <strong>{cycleLabel}</strong>. Anda dapat mengubah tanggal di atas secara manual jika diperlukan.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================================================== */}
                {/* 2. REPORT WIDGET CONFIGURATION: MONTHLY RECAP VIEW */}
                {/* ==================================================== */}
                {reportType === 'monthly' && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            {/* Month Select */}
                            <div className="flex flex-col gap-1.5 flex-1 w-full">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <CalendarDays size={14} className="text-blue-500" /> Pilih Bulan
                                </label>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                >
                                    {months.map((m, i) => (
                                        <option key={i} value={i}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Year Select */}
                            <div className="flex flex-col gap-1.5 w-full sm:w-36">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <CalendarDays size={14} className="text-blue-500" /> Tahun
                                </label>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5 bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800 font-medium">
                            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                            <div>
                                <p>
                                    Laporan ini merekap total penjualan seluruh kapal yang berangkat pada periode **{months[selectedMonth]} {selectedYear}**.
                                    Biaya operasional harian otomatis diakumulasikan hanya pada hari operasional kapal yang terdeteksi di bulan tersebut.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dashboard Loading */}
                {loadingDetails && (
                    <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse">
                        Memuat detail laporan keuangan...
                    </div>
                )}

                {calculatingRecap && (
                    <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse">
                        Menghitung akumulasi rekap bulanan kargo...
                    </div>
                )}

                {/* ==================================================== */}
                {/* 3. REPORT OUTPUT: SINGLE VOYAGE VIEW */}
                {/* ==================================================== */}
                {!loadingDetails && reportType === 'single' && selectedVoyage && (
                    <div className="space-y-6">
                        {/* Financial summary banner */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pendapatan Kargo</span>
                                <p className="text-xl font-bold text-blue-600 mt-1">{formatRupiah(singleTotalRevenue)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Biaya Kapal (Langsung)</span>
                                <p className="text-xl font-bold text-red-500 mt-1">-{formatRupiah(singleTotalVoyageExpenses)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operasional Harian</span>
                                <p className="text-xl font-bold text-orange-600 mt-1">-{formatRupiah(singleSegmentedExpenses.generalOpsSum + singleSegmentedExpenses.ticketSum + singleSegmentedExpenses.salarySum + singleSegmentedExpenses.carRentalSum)}</p>
                            </div>
                            <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-center ${singleNetProfit >= 0 ? 'bg-green-600 text-white border-green-600 shadow-green-600/10' : 'bg-red-600 text-white border-red-600 shadow-red-600/10'}`}>
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Laba / Rugi Bersih</span>
                                <p className="text-2xl font-black mt-1">{formatRupiah(singleNetProfit)}</p>
                            </div>
                        </div>

                        {/* Detailed Report Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left details panel (Tables) */}
                            <div className="lg:col-span-8 space-y-6">
                                {/* Cargo Revenue */}
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
                                                    <th className="p-3 w-[35%]">Pengirim &amp; Penerima</th>
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
                                                            Belum ada transaksi (kargo) yang terhubung ke kapal ini.
                                                        </td>
                                                    </tr>
                                                )}
                                                {transactions.length > 0 && (
                                                    <tr className="bg-blue-50/30 font-bold border-t border-blue-100">
                                                        <td colSpan={3} className="p-3 text-right text-gray-600 uppercase text-[10px] tracking-wider">Total Pendapatan</td>
                                                        <td className="p-3 text-center text-blue-900">{transactions.reduce((sum, tx) => sum + tx.koli, 0)}</td>
                                                        <td className="p-3 text-right text-blue-700 text-sm">{formatRupiah(singleTotalRevenue)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Voyage Direct Expenses */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                            <TrendingDown className="text-red-500" size={16} />
                                            Pengeluaran Khusus Kapal (Direct)
                                        </h3>
                                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded font-semibold">
                                            Biaya Langsung Kapal
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
                                                            Tidak ada pengeluaran langsung kapal.
                                                        </td>
                                                    </tr>
                                                )}
                                                {voyageExpenses.length > 0 && (
                                                    <tr className="bg-red-50/30 font-bold border-t border-red-100">
                                                        <td colSpan={4} className="p-3 text-right text-gray-600 uppercase text-[10px] tracking-wider">Total Pengeluaran Kapal</td>
                                                        <td className="p-3 text-right text-red-700 text-sm">{formatRupiah(singleTotalVoyageExpenses)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Segmented General Expenses Detail (Tiket, Gaji, Sewa, Harian) */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm space-y-4 p-5">
                                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                                        <Coins className="text-orange-500" size={16} />
                                        Rincian Pengeluaran Kas Operasional Harian ({cycleLabel})
                                    </h3>

                                    {/* Tiket */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-gray-50 border border-gray-200/60 p-2.5 rounded-lg text-xs font-semibold">
                                            <span className="text-gray-700 flex items-center gap-1.5"><CreditCard size={14} className="text-blue-500" /> Pengeluaran Tiket</span>
                                            <span className="text-red-600 font-bold">{formatRupiah(singleSegmentedExpenses.ticketSum)}</span>
                                        </div>
                                        {singleSegmentedExpenses.ticketList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {singleSegmentedExpenses.ticketList.map(e => (
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
                                            <span className="text-red-600 font-bold">{formatRupiah(singleSegmentedExpenses.salarySum)}</span>
                                        </div>
                                        {singleSegmentedExpenses.salaryList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {singleSegmentedExpenses.salaryList.map(e => (
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
                                            <span className="text-red-600 font-bold">{formatRupiah(singleSegmentedExpenses.carRentalSum)}</span>
                                        </div>
                                        {singleSegmentedExpenses.carRentalList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {singleSegmentedExpenses.carRentalList.map(e => (
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
                                            <span className="text-red-600 font-bold">{formatRupiah(singleSegmentedExpenses.generalOpsSum)}</span>
                                        </div>
                                        {singleSegmentedExpenses.generalOpsList.length > 0 && (
                                            <div className="pl-4 border-l border-gray-200 space-y-1">
                                                {singleSegmentedExpenses.generalOpsList.map(e => (
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
                                {/* Keberangkatan overview details */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3">
                                        Detail Keberangkatan
                                    </h3>
                                    <div className="space-y-3 text-xs">
                                        <div>
                                            <span className="text-gray-400 block uppercase font-bold tracking-wider text-[10px]">Nomor Keberangkatan</span>
                                            <p className="font-mono font-bold text-gray-900 text-sm mt-0.5">{selectedVoyage.voyageNumber}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block uppercase font-bold tracking-wider text-[10px]">Rute &amp; Kapal</span>
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
                                            <span className="font-bold text-blue-600">{formatRupiah(singleTotalRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Kapal (Direct)</span>
                                            <span className="font-bold text-red-600">-{formatRupiah(singleTotalVoyageExpenses)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Harian Umum</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(singleSegmentedExpenses.generalOpsSum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Tiket</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(singleSegmentedExpenses.ticketSum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Gaji</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(singleSegmentedExpenses.salarySum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Biaya Sewa Mobil</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(singleSegmentedExpenses.carRentalSum)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 font-bold text-sm">
                                        <span className="text-gray-800">Laba Bersih</span>
                                        <span className={singleNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {formatRupiah(singleNetProfit)}
                                        </span>
                                    </div>
                                </div>

                                {/* Export options */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handlePrintSingle}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
                                    >
                                        <Printer size={18} /> Cetak Laporan (A4)
                                    </button>
                                    <button
                                        onClick={handleCopySingleWA}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
                                    >
                                        <Copy size={18} /> Salin WhatsApp (WA)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================================================== */}
                {/* 4. REPORT OUTPUT: MONTHLY RECAP VIEW */}
                {/* ==================================================== */}
                {!calculatingRecap && reportType === 'monthly' && (
                    <div className="space-y-6">
                        
                        {/* Monthly recap summary banner */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Pendapatan Bulanan</span>
                                <p className="text-xl font-bold text-blue-600 mt-1">{formatRupiah(monthlyTotalRevenue)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Biaya Kapal (Direct)</span>
                                <p className="text-xl font-bold text-red-500 mt-1">-{formatRupiah(monthlyTotalDirectExpenses)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Operasional Harian</span>
                                <p className="text-xl font-bold text-orange-600 mt-1">-{formatRupiah(monthlyTotalDailyOps)}</p>
                            </div>
                            <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-center ${monthlyNetProfit >= 0 ? 'bg-green-600 text-white border-green-600 shadow-green-600/10' : 'bg-red-600 text-white border-red-600 shadow-red-600/10'}`}>
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Laba Bersih Bulanan</span>
                                <p className="text-2xl font-black mt-1">{formatRupiah(monthlyNetProfit)}</p>
                            </div>
                        </div>

                        {/* List of Voyages in selected month */}
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                    <Ship className="text-blue-600" size={16} />
                                    Daftar Keberangkatan Kapal - {months[selectedMonth]} {selectedYear}
                                </h3>
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                                    {recapRows.length} Kapal
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px]">
                                            <th className="p-3 text-center w-[5%]">No</th>
                                            <th className="p-3 w-[20%]">No Keberangkatan</th>
                                            <th className="p-3 w-[20%]">Rute &amp; Kapal</th>
                                            <th className="p-3 w-[20%]">Tanggal Berangkat</th>
                                            <th className="p-3 w-[15%]">Siklus Operasional Harian</th>
                                            <th className="p-3 text-right w-[20%]">Pendapatan</th>
                                            <th className="p-3 text-right w-[20%]">Biaya Kapal (Direct)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {recapRows.map((row, idx) => (
                                            <tr key={row.voyageId} className="hover:bg-gray-50/50">
                                                <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}.</td>
                                                <td className="p-3 font-mono font-bold text-gray-800">{row.voyageNumber}</td>
                                                <td className="p-3 font-semibold text-gray-900">{row.route} <span className="text-[10px] text-gray-400">({row.shipName || '-'})</span></td>
                                                <td className="p-3 text-gray-500">{new Date(row.departureDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</td>
                                                <td className="p-3 font-semibold text-blue-600">{row.opLabel}</td>
                                                <td className="p-3 text-right font-bold text-blue-600">{formatRupiah(row.revenue)}</td>
                                                <td className="p-3 text-right font-bold text-red-650">{formatRupiah(row.directExpenses)}</td>
                                            </tr>
                                        ))}
                                        {recapRows.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-6 text-center text-gray-400 italic">
                                                    Tidak ada data keberangkatan kapal pada bulan ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Special itemized tables and grouped operational expenses */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            
                            {/* Left detailed tables (Tiket, Gaji, Sewa) */}
                            <div className="lg:col-span-8 space-y-6">
                                
                                {/* A. Sewa Mobil (Itemized) */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                                            <Ship size={14} className="text-blue-500" /> Rincian Sewa Mobil
                                        </h4>
                                        <span className="text-xs text-red-600 font-bold">{formatRupiah(monthlySegmentedExpenses.carRentalSum)}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[9px]">
                                                    <th className="p-2.5 text-center w-[8%]">No</th>
                                                    <th className="p-2.5 w-[22%]">Tanggal</th>
                                                    <th className="p-2.5">Keterangan</th>
                                                    <th className="p-2.5 text-right w-[25%]">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                                {monthlySegmentedExpenses.carRentalList.map((e, idx) => (
                                                    <tr key={e.id} className="hover:bg-gray-50/50">
                                                        <td className="p-2.5 text-center text-gray-400 font-mono">{idx + 1}.</td>
                                                        <td className="p-2.5 text-gray-500">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                        <td className="p-2.5 font-medium text-gray-900">{e.description}</td>
                                                        <td className="p-2.5 text-right font-semibold text-red-600">{formatRupiah(e.amount)}</td>
                                                    </tr>
                                                ))}
                                                {monthlySegmentedExpenses.carRentalList.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="p-4 text-center text-gray-400 italic">Tidak ada data biaya sewa mobil.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* B. Gaji / Sopir (Itemized) */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                                            <UserCheck size={14} className="text-blue-500" /> Rincian Gaji / Uang Jalan Sopir
                                        </h4>
                                        <span className="text-xs text-red-600 font-bold">{formatRupiah(monthlySegmentedExpenses.salarySum)}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[9px]">
                                                    <th className="p-2.5 text-center w-[8%]">No</th>
                                                    <th className="p-2.5 w-[22%]">Tanggal</th>
                                                    <th className="p-2.5">Keterangan</th>
                                                    <th className="p-2.5 text-right w-[25%]">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                                {monthlySegmentedExpenses.salaryList.map((e, idx) => (
                                                    <tr key={e.id} className="hover:bg-gray-50/50">
                                                        <td className="p-2.5 text-center text-gray-400 font-mono">{idx + 1}.</td>
                                                        <td className="p-2.5 text-gray-500">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                        <td className="p-2.5 font-medium text-gray-900">{e.description}</td>
                                                        <td className="p-2.5 text-right font-semibold text-red-600">{formatRupiah(e.amount)}</td>
                                                    </tr>
                                                ))}
                                                {monthlySegmentedExpenses.salaryList.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="p-4 text-center text-gray-400 italic">Tidak ada data biaya gaji / sopir.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* C. Tiket Kapal (Itemized) */}
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                                            <CreditCard size={14} className="text-blue-500" /> Rincian Tiket Kapal
                                        </h4>
                                        <span className="text-xs text-red-600 font-bold">{formatRupiah(monthlySegmentedExpenses.ticketSum)}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[9px]">
                                                    <th className="p-2.5 text-center w-[8%]">No</th>
                                                    <th className="p-2.5 w-[22%]">Tanggal</th>
                                                    <th className="p-2.5">Keterangan</th>
                                                    <th className="p-2.5 text-right w-[25%]">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                                {monthlySegmentedExpenses.ticketList.map((e, idx) => (
                                                    <tr key={e.id} className="hover:bg-gray-50/50">
                                                        <td className="p-2.5 text-center text-gray-400 font-mono">{idx + 1}.</td>
                                                        <td className="p-2.5 text-gray-500">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                        <td className="p-2.5 font-medium text-gray-900">{e.description}</td>
                                                        <td className="p-2.5 text-right font-semibold text-red-600">{formatRupiah(e.amount)}</td>
                                                    </tr>
                                                ))}
                                                {monthlySegmentedExpenses.ticketList.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="p-4 text-center text-gray-400 italic">Tidak ada data biaya tiket kapal.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>

                            {/* Right summary panel (Other grouped categories & Action buttons) */}
                            <div className="lg:col-span-4 space-y-6">
                                
                                {/* Grouped Other Categories */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3 flex justify-between items-center">
                                        <span>Ringkasan Harian Lainnya</span>
                                        <span className="text-xs text-orange-600 font-black">{formatRupiah(monthlySegmentedExpenses.otherOpsSum)}</span>
                                    </h3>
                                    <div className="space-y-2.5 text-xs text-gray-700">
                                        {Object.entries(monthlySegmentedExpenses.categorySums).map(([cat, sum]) => (
                                            <div key={cat} className="flex justify-between items-center py-1 border-b border-gray-50">
                                                <span className="font-medium text-gray-650">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</span>
                                                <span className="font-bold text-gray-900">{formatRupiah(sum)}</span>
                                            </div>
                                        ))}
                                        {Object.keys(monthlySegmentedExpenses.categorySums).length === 0 && (
                                            <p className="text-gray-400 italic text-center py-4">Tidak ada pengeluaran harian lainnya.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Calculation card */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3">
                                        Laba Rugi Bulanan
                                    </h3>
                                    <div className="space-y-3 text-xs border-b border-gray-100 pb-4">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Total Pendapatan (Kargo)</span>
                                            <span className="font-bold text-blue-600">{formatRupiah(monthlyTotalRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Total Biaya Kapal (Direct)</span>
                                            <span className="font-bold text-red-600">-{formatRupiah(monthlyTotalDirectExpenses)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Total Biaya Sewa Mobil</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(monthlySegmentedExpenses.carRentalSum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Total Biaya Gaji</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(monthlySegmentedExpenses.salarySum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Total Biaya Tiket</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(monthlySegmentedExpenses.ticketSum)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Total Harian Lain-Lain</span>
                                            <span className="font-bold text-red-650">-{formatRupiah(monthlySegmentedExpenses.otherOpsSum)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 font-bold text-sm">
                                        <span className="text-gray-800">Laba Bersih Rekap</span>
                                        <span className={monthlyNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {formatRupiah(monthlyNetProfit)}
                                        </span>
                                    </div>
                                </div>

                                {/* Export Options */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handlePrintMonthly}
                                        disabled={recapRows.length === 0}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <Printer size={18} /> Cetak Rekap (A4 Landscape)
                                    </button>
                                    <button
                                        onClick={handleCopyMonthlyWA}
                                        disabled={recapRows.length === 0}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <Copy size={18} /> Salin Rekap WA
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* Empty State */}
                {reportType === 'single' && !selectedVoyageId && (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
                        <Ship className="mx-auto mb-3 opacity-20" size={48} />
                        <p className="text-sm font-semibold">Pilih pemberangkatan kapal di atas untuk menampilkan laporan.</p>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
