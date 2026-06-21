'use client';

import { use, useEffect, useState, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getVoyageById } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import { getExpensesByVoyage, subscribeToExpenses } from '@/lib/firestore-expenses';
import type { Voyage, Expense } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';

function PrintVoyageOpsReportContent({ 
    searchParams 
}: { 
    searchParams: { voyageId?: string; start?: string; end?: string } 
}) {
    const { voyageId, start, end } = searchParams;
    const { user } = useAuth();

    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [voyageExpenses, setVoyageExpenses] = useState<Expense[]>([]);
    const [allGeneralExpenses, setAllGeneralExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !voyageId) return;

        const loadData = async () => {
            try {
                // 1. Fetch Voyage
                const voyageData = await getVoyageById(voyageId);
                if (!voyageData) {
                    alert('Pemberangkatan tidak ditemukan');
                    setLoading(false);
                    return;
                }
                setVoyage(voyageData);

                // 2. Fetch Transactions
                const txPromises = voyageData.transactionIds.map(txId => getTransactionById(txId));
                const txData = await Promise.all(txPromises);
                setTransactions(txData.filter((tx): tx is Transaction => tx !== null));

                // 3. Fetch Voyage-Specific Expenses
                const directExpenses = await getExpensesByVoyage(voyageData.id, user.uid);
                setVoyageExpenses(directExpenses);

                // 4. Subscribe/Load general expenses
                const unsubscribe = subscribeToExpenses(user.uid, (data) => {
                    setAllGeneralExpenses(data.filter(e => e.type === 'general' || !e.type));
                    setLoading(false);
                });

                return () => unsubscribe();
            } catch (error) {
                console.error("Error loading print data:", error);
                setLoading(false);
            }
        };

        loadData();
    }, [voyageId, user]);

    // Automatically trigger browser print once loading finishes
    useEffect(() => {
        if (!loading && voyage) {
            const timer = setTimeout(() => {
                window.print();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [loading, voyage]);

    const formatD = (dStr?: string) => {
        if (!dStr) return '';
        const date = new Date(dStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Filter in-range general expenses
    const operationalExpenses = useMemo(() => {
        if (!start || !end) return [];
        const startDate = new Date(`${start}T00:00:00`);
        const endDate = new Date(`${end}T23:59:59`);

        return allGeneralExpenses.filter(e => {
            const expDate = new Date(e.date);
            return expDate >= startDate && expDate <= endDate;
        });
    }, [allGeneralExpenses, start, end]);

    // Segment operational expenses
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

    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.jumlah, 0);
    const totalVoyageExpenses = voyageExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalRevenue - totalVoyageExpenses - generalOpsSum - ticketSum - salarySum - carRentalSum;

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Memuat data laporan cetak...</div>;
    if (!voyage) return <div className="p-8 text-center text-red-500 font-semibold">Pemberangkatan tidak ditemukan.</div>;

    return (
        <div className="bg-white min-h-screen p-8 text-xs text-gray-800 font-sans leading-normal">
            
            {/* Document Header */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-wide mb-1 font-serif">Laporan Keuangan Per-Voyage & Operasional</h1>
                        <p className="text-gray-500 text-[10px]">Cahaya Cargo Express Management System (C2-MS)</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-500 text-[10px] uppercase">No. Voyage</p>
                        <h2 className="text-xl font-mono font-bold text-gray-900">{voyage.voyageNumber}</h2>
                        <p className="text-gray-400 text-[9px] mt-0.5">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4 text-[11px] bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div>
                        <span className="text-gray-400 block text-[9px] uppercase font-bold">Rute Perjalanan</span>
                        <span className="font-semibold text-gray-800">{voyage.route}</span>
                    </div>
                    <div>
                        <span className="text-gray-400 block text-[9px] uppercase font-bold">Kapal / Plat Truk</span>
                        <span className="font-semibold text-gray-800">{voyage.shipName || '-'} / {voyage.vehicleNumbers?.join(', ') || voyage.vehicleNumber || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-400 block text-[9px] uppercase font-bold">Tanggal Berangkat</span>
                        <span className="font-semibold text-gray-800">{new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div>
                        <span className="text-gray-400 block text-[9px] uppercase font-bold">Periode Operasional Harian</span>
                        <span className="font-semibold text-gray-800">{formatD(start)} - {formatD(end)}</span>
                    </div>
                </div>
            </div>

            {/* Financial Summary Dashboard */}
            <div className="grid grid-cols-4 gap-4 border border-gray-300 bg-gray-50 rounded-lg p-4 mb-6 text-center font-semibold">
                <div>
                    <p className="text-gray-500 text-[9px] uppercase mb-1">Total Pendapatan (Sales)</p>
                    <p className="text-base font-bold text-blue-700">{formatRupiah(totalRevenue)}</p>
                </div>
                <div className="border-l border-gray-200">
                    <p className="text-gray-500 text-[9px] uppercase mb-1">Total Pengeluaran Voyage</p>
                    <p className="text-base font-bold text-red-650">-{formatRupiah(totalVoyageExpenses)}</p>
                </div>
                <div className="border-l border-gray-200">
                    <p className="text-gray-500 text-[9px] uppercase mb-1">Total Operasional Harian</p>
                    <p className="text-base font-bold text-orange-600">-{formatRupiah(ticketSum + salarySum + carRentalSum + generalOpsSum)}</p>
                </div>
                <div className="border-l border-gray-200 bg-gray-100 rounded-r-md">
                    <p className="text-gray-500 text-[9px] uppercase mb-1">Keuntungan Bersih (Net)</p>
                    <p className={`text-base font-extrabold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatRupiah(netProfit)}
                    </p>
                </div>
            </div>

            {/* Income Cargo Table */}
            <div className="mb-6">
                <h3 className="text-xs font-bold border-b border-gray-400 pb-1 mb-2.5 uppercase tracking-wide text-gray-900">1. Rincian Pendapatan (Kargo)</h3>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-350 text-[9px] text-gray-500 uppercase font-semibold bg-gray-50">
                            <th className="py-1.5 px-2 w-10 text-center">No</th>
                            <th className="py-1.5 px-2">No STT</th>
                            <th className="py-1.5 px-2">Pengirim ➔ Penerima</th>
                            <th className="py-1.5 px-2 text-center w-24">Koli</th>
                            <th className="py-1.5 px-2 text-right w-36">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-[10px]">
                        {transactions.map((tx, i) => (
                            <tr key={tx.id}>
                                <td className="py-2 px-2 text-center text-gray-400 font-mono">{i + 1}</td>
                                <td className="py-2 px-2 font-mono font-bold text-gray-800">{tx.noSTT}</td>
                                <td className="py-2 px-2">
                                    <span className="font-semibold text-gray-900">{tx.pengirimName}</span>
                                    <span className="text-gray-400 mx-1">➔</span>
                                    <span>{tx.penerimaName}</span>
                                </td>
                                <td className="py-2 px-2 text-center">{tx.koli}</td>
                                <td className="py-2 px-2 text-right font-semibold text-gray-900">{formatRupiah(tx.jumlah)}</td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-4 text-center text-gray-400 italic">Belum ada cargo assigned.</td>
                            </tr>
                        )}
                        <tr className="bg-gray-100 font-bold border-t border-gray-300">
                            <td colSpan={3} className="py-2 px-2 text-right pr-4 uppercase text-[9px] tracking-wider text-gray-600">Total Pendapatan (Sales)</td>
                            <td className="py-2 px-2 text-center">{transactions.reduce((sum, t) => sum + t.koli, 0)}</td>
                            <td className="py-2 px-2 text-right text-blue-700">{formatRupiah(totalRevenue)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Direct Expenses Table */}
            <div className="mb-6">
                <h3 className="text-xs font-bold border-b border-gray-400 pb-1 mb-2.5 uppercase tracking-wide text-gray-900">2. Rincian Pengeluaran Khusus Voyage</h3>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-350 text-[9px] text-gray-500 uppercase font-semibold bg-gray-50">
                            <th className="py-1.5 px-2 w-10 text-center">No</th>
                            <th className="py-1.5 px-2 w-28">Tanggal</th>
                            <th className="py-1.5 px-2 w-48">Kategori</th>
                            <th className="py-1.5 px-2">Keterangan</th>
                            <th className="py-1.5 px-2 text-right w-36">Biaya</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-[10px]">
                        {voyageExpenses.map((exp, i) => (
                            <tr key={exp.id}>
                                <td className="py-2 px-2 text-center text-gray-400 font-mono">{i + 1}</td>
                                <td className="py-2 px-2 text-gray-600">{new Date(exp.date).toLocaleDateString('id-ID')}</td>
                                <td className="py-2 px-2 font-medium text-gray-800">{EXPENSE_CATEGORY_LABELS[exp.category]}</td>
                                <td className="py-2 px-2 text-gray-600">{exp.description}</td>
                                <td className="py-2 px-2 text-right font-medium text-red-650">{formatRupiah(exp.amount)}</td>
                            </tr>
                        ))}
                        {voyageExpenses.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-4 text-center text-gray-400 italic">Tidak ada pengeluaran langsung voyage.</td>
                            </tr>
                        )}
                        <tr className="bg-gray-100 font-bold border-t border-gray-300">
                            <td colSpan={4} className="py-2 px-2 text-right pr-4 uppercase text-[9px] tracking-wider text-gray-600">Total Pengeluaran Voyage (Direct)</td>
                            <td className="py-2 px-2 text-right text-red-700">{formatRupiah(totalVoyageExpenses)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Daily Operational Expenses Details (Isolations) */}
            <div className="mb-6">
                <h3 className="text-xs font-bold border-b border-gray-400 pb-1 mb-2.5 uppercase tracking-wide text-gray-900">3. Rincian Pengeluaran Kas Operasional Harian</h3>
                
                <div className="space-y-4">
                    {/* Tiket */}
                    {ticketList.length > 0 && (
                        <div>
                            <div className="flex justify-between font-bold text-[10px] text-gray-700 border-b border-gray-200 pb-1 mb-1">
                                <span>A. Biaya Tiket</span>
                                <span className="text-red-700">{formatRupiah(ticketSum)}</span>
                            </div>
                            <table className="w-full text-left">
                                <tbody className="text-[9px] text-gray-600 divide-y divide-gray-100">
                                    {ticketList.map((e, idx) => (
                                        <tr key={e.id}>
                                            <td className="py-1 w-8 text-gray-400 font-mono">{idx + 1}.</td>
                                            <td className="py-1 w-32">{new Date(e.date).toLocaleDateString('id-ID')}</td>
                                            <td className="py-1">{e.description}</td>
                                            <td className="py-1 text-right w-36 font-semibold">{formatRupiah(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Gaji */}
                    {salaryList.length > 0 && (
                        <div>
                            <div className="flex justify-between font-bold text-[10px] text-gray-700 border-b border-gray-200 pb-1 mb-1">
                                <span>B. Biaya Gaji / Sopir</span>
                                <span className="text-red-700">{formatRupiah(salarySum)}</span>
                            </div>
                            <table className="w-full text-left">
                                <tbody className="text-[9px] text-gray-600 divide-y divide-gray-100">
                                    {salaryList.map((e, idx) => (
                                        <tr key={e.id}>
                                            <td className="py-1 w-8 text-gray-400 font-mono">{idx + 1}.</td>
                                            <td className="py-1 w-32">{new Date(e.date).toLocaleDateString('id-ID')}</td>
                                            <td className="py-1">{e.description}</td>
                                            <td className="py-1 text-right w-36 font-semibold">{formatRupiah(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Sewa Mobil */}
                    {carRentalList.length > 0 && (
                        <div>
                            <div className="flex justify-between font-bold text-[10px] text-gray-700 border-b border-gray-200 pb-1 mb-1">
                                <span>C. Biaya Sewa Mobil</span>
                                <span className="text-red-700">{formatRupiah(carRentalSum)}</span>
                            </div>
                            <table className="w-full text-left">
                                <tbody className="text-[9px] text-gray-600 divide-y divide-gray-100">
                                    {carRentalList.map((e, idx) => (
                                        <tr key={e.id}>
                                            <td className="py-1 w-8 text-gray-400 font-mono">{idx + 1}.</td>
                                            <td className="py-1 w-32">{new Date(e.date).toLocaleDateString('id-ID')}</td>
                                            <td className="py-1">{e.description}</td>
                                            <td className="py-1 text-right w-36 font-semibold">{formatRupiah(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Harian Umum Lainnya */}
                    <div>
                        <div className="flex justify-between font-bold text-[10px] text-gray-700 border-b border-gray-200 pb-1 mb-1">
                            <span>D. Biaya Operasional Harian Umum (Lainnya)</span>
                            <span className="text-red-700">{formatRupiah(generalOpsSum)}</span>
                        </div>
                        {generalOpsList.length > 0 ? (
                            <table className="w-full text-left">
                                <tbody className="text-[9px] text-gray-600 divide-y divide-gray-100">
                                    {generalOpsList.map((e, idx) => (
                                        <tr key={e.id}>
                                            <td className="py-1 w-8 text-gray-400 font-mono">{idx + 1}.</td>
                                            <td className="py-1 w-32">{new Date(e.date).toLocaleDateString('id-ID')}</td>
                                            <td className="py-1"><strong>[{EXPENSE_CATEGORY_LABELS[e.category]}]</strong> {e.description}</td>
                                            <td className="py-1 text-right w-36 font-semibold">{formatRupiah(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-[9px] text-gray-400 italic py-1">Tidak ada biaya harian lainnya.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Signature Section */}
            <div className="mt-16 pt-8 border-t border-gray-200 flex justify-between items-end text-[9px] text-gray-400">
                <div>
                    <p>Laporan Keuangan Voyage &amp; Operasional Harian C2-MS</p>
                    <p>Waktu Cetak: {new Date().toLocaleString('id-ID')} WIB</p>
                </div>
                <div className="text-center w-40">
                    <div className="h-14 mb-2 border-b border-gray-200"></div>
                    <p className="font-semibold text-gray-700 text-[10px]">Manager Keuangan</p>
                </div>
            </div>

            {/* Print Specific CSS Styles */}
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
                        size: A4 portrait;
                        margin: 10mm;
                    }
                }
                `
            }} />
        </div>
    );
}

export default function PrintVoyageOpsReportPage(props: {
    searchParams: Promise<{ voyageId?: string; start?: string; end?: string }>
}) {
    const searchParams = use(props.searchParams);
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat halaman cetak...</div>}>
            <PrintVoyageOpsReportContent searchParams={searchParams} />
        </Suspense>
    );
}
