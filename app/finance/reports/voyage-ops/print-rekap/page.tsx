'use client';

import { use, useEffect, useState, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import { getExpensesByVoyage, subscribeToExpenses } from '@/lib/firestore-expenses';
import type { Voyage, Expense, ExpenseCategory } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';

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

function PrintMonthlyRecapContent({ 
    searchParams 
}: { 
    searchParams: { month?: string; year?: string } 
}) {
    const month = searchParams.month ? Number(searchParams.month) : new Date().getMonth();
    const year = searchParams.year ? Number(searchParams.year) : new Date().getFullYear();
    const { user } = useAuth();

    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [allGeneralExpenses, setAllGeneralExpenses] = useState<Expense[]>([]);
    const [recapRows, setRecapRows] = useState<MonthlyRecapRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Subscribe to Voyages and General Expenses
    useEffect(() => {
        if (!user) return;

        const unsubscribeVoyages = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
        });

        const unsubscribeExpenses = subscribeToExpenses(user.uid, (data) => {
            setAllGeneralExpenses(data.filter(e => e.type === 'general' || !e.type));
        });

        return () => {
            unsubscribeVoyages();
            unsubscribeExpenses();
        };
    }, [user]);

    // Calculate monthly recap rows
    useEffect(() => {
        if (voyages.length === 0 || allGeneralExpenses.length === 0) return;

        const calculateRecap = async () => {
            try {
                const filtered = voyages.filter(v => {
                    const depDate = new Date(v.departureDate);
                    return depDate.getMonth() === month && depDate.getFullYear() === year;
                });

                const rows: MonthlyRecapRow[] = [];

                for (const voyage of filtered) {
                    const txPromises = voyage.transactionIds.map(txId => getTransactionById(txId));
                    const txData = await Promise.all(txPromises);
                    const revenue = txData.reduce((sum, tx) => sum + (tx?.jumlah || 0), 0);

                    const directExpensesList = await getExpensesByVoyage(voyage.id, user!.uid);
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

                rows.sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime());
                setRecapRows(rows);
                setLoading(false);
            } catch (error) {
                console.error("Error calculating monthly print recap:", error);
                setLoading(false);
            }
        };

        calculateRecap();
    }, [voyages, allGeneralExpenses, month, year, user]);

    // Automatically trigger browser print once loading finishes
    useEffect(() => {
        if (!loading && recapRows.length > 0) {
            const timer = setTimeout(() => {
                window.print();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [loading, recapRows]);

    // Filter in-range general expenses
    const monthlyOperationalExpenses = useMemo(() => {
        if (recapRows.length === 0) return [];
        
        return allGeneralExpenses.filter(exp => {
            const expDate = new Date(exp.date);
            return recapRows.some(row => {
                const start = new Date(row.opStart);
                start.setHours(0,0,0,0);
                const end = new Date(row.opEnd);
                end.setHours(23,59,59,999);
                return expDate >= start && expDate <= end;
            });
        });
    }, [allGeneralExpenses, recapRows]);

    // Segment and total expenses
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

    const totalRevenue = recapRows.reduce((sum, row) => sum + row.revenue, 0);
    const totalDirectExpenses = recapRows.reduce((sum, row) => sum + row.directExpenses, 0);
    const totalDailyOps = monthlySegmentedExpenses.ticketSum + monthlySegmentedExpenses.salarySum + monthlySegmentedExpenses.carRentalSum + monthlySegmentedExpenses.otherOpsSum;
    const netProfit = totalRevenue - totalDirectExpenses - totalDailyOps;

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Memuat data rekap bulanan...</div>;
    if (recapRows.length === 0) return <div className="p-8 text-center text-red-500 font-semibold">Tidak ada keberangkatan kapal untuk periode ini.</div>;

    return (
        <div className="bg-white min-h-screen p-8 text-[10px] text-gray-800 font-sans leading-normal">
            
            {/* Document Header */}
            <div className="border-b-2 border-gray-800 pb-3 mb-5">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-bold uppercase tracking-wide mb-1 font-serif">Laporan Rekap Bulanan Kapal &amp; Operasional Harian</h1>
                        <p className="text-gray-500 text-[9px]">Cahaya Cargo Express Management System (C2-MS)</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-500 text-[9px] uppercase">Periode Laporan</p>
                        <h2 className="text-lg font-bold text-gray-900">{months[month]} {year}</h2>
                        <p className="text-gray-400 text-[8px] mt-0.5">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
            </div>

            {/* Financial Summary Dashboard */}
            <div className="grid grid-cols-4 gap-4 border border-gray-300 bg-gray-50 rounded-lg p-3 mb-5 text-center font-semibold text-[11px]">
                <div>
                    <p className="text-gray-500 text-[8px] uppercase mb-0.5">Total Pendapatan Kargo</p>
                    <p className="text-sm font-bold text-blue-700">{formatRupiah(totalRevenue)}</p>
                </div>
                <div className="border-l border-gray-200">
                    <p className="text-gray-500 text-[8px] uppercase mb-0.5">Total Biaya Kapal (Direct)</p>
                    <p className="text-sm font-bold text-red-650">-{formatRupiah(totalDirectExpenses)}</p>
                </div>
                <div className="border-l border-gray-200">
                    <p className="text-gray-500 text-[8px] uppercase mb-0.5">Total Operasional Harian</p>
                    <p className="text-sm font-bold text-orange-600">-{formatRupiah(totalDailyOps)}</p>
                </div>
                <div className="border-l border-gray-200 bg-gray-100 rounded-r-md">
                    <p className="text-gray-500 text-[8px] uppercase mb-0.5">Keuntungan Bersih (Net)</p>
                    <p className={`text-sm font-extrabold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatRupiah(netProfit)}
                    </p>
                </div>
            </div>

            {/* List of Voyages Table */}
            <div className="mb-5">
                <h3 className="text-[11px] font-bold border-b border-gray-400 pb-1 mb-2 uppercase tracking-wide text-gray-900">1. Rekap Penjualan Kargo &amp; Biaya Langsung Kapal</h3>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-350 text-[8px] text-gray-500 uppercase font-semibold bg-gray-50">
                            <th className="py-1 px-1.5 w-8 text-center">No</th>
                            <th className="py-1 px-1.5 w-24">No Keberangkatan</th>
                            <th className="py-1 px-1.5">Rute &amp; Kapal</th>
                            <th className="py-1 px-1.5 w-36">Tanggal Berangkat</th>
                            <th className="py-1 px-1.5 w-32">Siklus Ops Harian</th>
                            <th className="py-1 px-1.5 text-right w-36">Pendapatan (Kargo)</th>
                            <th className="py-1 px-1.5 text-right w-36">Biaya Kapal (Direct)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-[9px]">
                        {recapRows.map((row, i) => (
                            <tr key={row.voyageId}>
                                <td className="py-1.5 px-1.5 text-center text-gray-400 font-mono">{i + 1}</td>
                                <td className="py-1.5 px-1.5 font-mono font-bold text-gray-800">{row.voyageNumber}</td>
                                <td className="py-1.5 px-1.5 font-semibold">{row.route} <span className="text-[8px] font-normal text-gray-450">({row.shipName || '-'})</span></td>
                                <td className="py-1.5 px-1.5 text-gray-650">{new Date(row.departureDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</td>
                                <td className="py-1.5 px-1.5 text-blue-650 font-semibold">{row.opLabel}</td>
                                <td className="py-1.5 px-1.5 text-right font-bold text-blue-600">{formatRupiah(row.revenue)}</td>
                                <td className="py-1.5 px-1.5 text-right font-bold text-red-650">{formatRupiah(row.directExpenses)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-150 font-bold border-t border-gray-350">
                            <td colSpan={5} className="py-1.5 px-1.5 text-right pr-3 uppercase text-[8px] tracking-wider text-gray-600">Total Akumulasi</td>
                            <td className="py-1.5 px-1.5 text-right text-blue-700">{formatRupiah(totalRevenue)}</td>
                            <td className="py-1.5 px-1.5 text-right text-red-700">{formatRupiah(totalDirectExpenses)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Segmented Big Ticket Details (Tiket, Gaji, Sewa) */}
            <div className="grid grid-cols-3 gap-6 mb-5 items-start">
                
                {/* Sewa Mobil */}
                <div>
                    <h4 className="font-bold border-b border-gray-300 pb-1 mb-1.5 uppercase text-[9px] tracking-wide text-gray-900 flex justify-between">
                        <span>A. Rincian Sewa Mobil</span>
                        <span className="text-red-700 font-bold">{formatRupiah(monthlySegmentedExpenses.carRentalSum)}</span>
                    </h4>
                    {monthlySegmentedExpenses.carRentalList.length > 0 ? (
                        <table className="w-full text-[8px] text-left">
                            <tbody className="divide-y divide-gray-100 text-gray-650">
                                {monthlySegmentedExpenses.carRentalList.map((e, idx) => (
                                    <tr key={e.id}>
                                        <td className="py-1 w-5 text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="py-1 w-20">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                        <td className="py-1 truncate max-w-[80px]" title={e.description}>{e.description}</td>
                                        <td className="py-1 text-right font-bold text-red-600">{formatRupiah(e.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-[8px] text-gray-400 italic">Tidak ada data biaya sewa mobil.</p>
                    )}
                </div>

                {/* Gaji / Sopir */}
                <div>
                    <h4 className="font-bold border-b border-gray-300 pb-1 mb-1.5 uppercase text-[9px] tracking-wide text-gray-900 flex justify-between">
                        <span>B. Rincian Gaji / Uang Jalan</span>
                        <span className="text-red-700 font-bold">{formatRupiah(monthlySegmentedExpenses.salarySum)}</span>
                    </h4>
                    {monthlySegmentedExpenses.salaryList.length > 0 ? (
                        <table className="w-full text-[8px] text-left">
                            <tbody className="divide-y divide-gray-100 text-gray-650">
                                {monthlySegmentedExpenses.salaryList.map((e, idx) => (
                                    <tr key={e.id}>
                                        <td className="py-1 w-5 text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="py-1 w-20">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                        <td className="py-1 truncate max-w-[80px]" title={e.description}>{e.description}</td>
                                        <td className="py-1 text-right font-bold text-red-600">{formatRupiah(e.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-[8px] text-gray-400 italic">Tidak ada data biaya gaji / sopir.</p>
                    )}
                </div>

                {/* Tiket Kapal */}
                <div>
                    <h4 className="font-bold border-b border-gray-300 pb-1 mb-1.5 uppercase text-[9px] tracking-wide text-gray-900 flex justify-between">
                        <span>C. Rincian Tiket Kapal</span>
                        <span className="text-red-700 font-bold">{formatRupiah(monthlySegmentedExpenses.ticketSum)}</span>
                    </h4>
                    {monthlySegmentedExpenses.ticketList.length > 0 ? (
                        <table className="w-full text-[8px] text-left">
                            <tbody className="divide-y divide-gray-100 text-gray-650">
                                {monthlySegmentedExpenses.ticketList.map((e, idx) => (
                                    <tr key={e.id}>
                                        <td className="py-1 w-5 text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="py-1 w-20">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                        <td className="py-1 truncate max-w-[80px]" title={e.description}>{e.description}</td>
                                        <td className="py-1 text-right font-bold text-red-600">{formatRupiah(e.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-[8px] text-gray-400 italic">Tidak ada data biaya tiket kapal.</p>
                    )}
                </div>

            </div>

            {/* Other categories summary */}
            <div className="mb-5 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h4 className="font-bold text-[9px] uppercase tracking-wider mb-2 text-gray-900 border-b pb-1.5 flex justify-between">
                    <span>D. Akumulasi Operasional Harian Umum (Lainnya)</span>
                    <span className="text-orange-600 font-black">{formatRupiah(monthlySegmentedExpenses.otherOpsSum)}</span>
                </h4>
                <div className="grid grid-cols-4 gap-x-6 gap-y-1.5 text-[8.5px]">
                    {Object.entries(monthlySegmentedExpenses.categorySums).map(([cat, sum]) => (
                        <div key={cat} className="flex justify-between border-b border-gray-150 py-0.5">
                            <span className="text-gray-600 font-medium">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</span>
                            <span className="font-bold text-gray-800">{formatRupiah(sum)}</span>
                        </div>
                    ))}
                    {Object.keys(monthlySegmentedExpenses.categorySums).length === 0 && (
                        <p className="text-gray-400 italic col-span-4 text-center py-2">Tidak ada pengeluaran harian lainnya.</p>
                    )}
                </div>
            </div>

            {/* Bottom Signature */}
            <div className="mt-12 pt-4 border-t border-gray-200 flex justify-between items-end text-[8px] text-gray-400">
                <div>
                    <p>Laporan Rekap Bulanan Kapal &amp; Operasional Harian C2-MS</p>
                    <p>Waktu Cetak: {new Date().toLocaleString('id-ID')} WIB</p>
                </div>
                <div className="text-center w-40">
                    <div className="h-12 mb-1.5 border-b border-gray-200"></div>
                    <p className="font-semibold text-gray-700 text-[9px]">Manager Keuangan</p>
                </div>
            </div>

            {/* Print Specific CSS Styles for Landscape A4 */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    header, .no-print, button, Link {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                        padding: 10mm !important;
                    }
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                }
                `
            }} />
        </div>
    );
}

export default function PrintMonthlyRecapPage(props: {
    searchParams: Promise<{ month?: string; year?: string }>
}) {
    const searchParams = use(props.searchParams);
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-medium">Memuat halaman rekap cetak...</div>}>
            <PrintMonthlyRecapContent searchParams={searchParams} />
        </Suspense>
    );
}
