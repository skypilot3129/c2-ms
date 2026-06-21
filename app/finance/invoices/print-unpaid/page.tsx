'use client';

import { use, useEffect, useState, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import { formatRupiah } from '@/lib/currency';

function PrintUnpaidInvoicesContent({ 
    searchParams 
}: { 
    searchParams: { month?: string } 
}) {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sttNumbers, setSttNumbers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const initialMonth = searchParams.month || '';
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);

    useEffect(() => {
        if (searchParams.month) {
            setSelectedMonth(searchParams.month);
        }
    }, [searchParams.month]);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToInvoices(user.uid, (data) => {
            // Filter out Paid invoices
            const unpaidInvoices = data.filter(inv => inv.status !== 'Paid');
            
            // Sort by issue date (oldest first)
            unpaidInvoices.sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
            
            setInvoices(unpaidInvoices);
            
            if (loading) {
                // Fetch STT numbers for all unpaid invoices
                const loadSttNumbers = async () => {
                    const mapping: Record<string, string> = {};
                    for (const inv of unpaidInvoices) {
                        if (inv.transactionIds && inv.transactionIds.length > 0) {
                            try {
                                const txs = await Promise.all(inv.transactionIds.map(tid => getTransactionById(tid)));
                                mapping[inv.id] = txs.filter(t => t !== null).map(t => t!.noSTT.replace(/^STT/i, '')).join(', ');
                            } catch (error) {
                                console.error('Failed to load STT for invoice', inv.id, error);
                            }
                        }
                    }
                    setSttNumbers(mapping);
                    setLoading(false);
                };
                loadSttNumbers();
            }
        });

        return () => unsubscribe();
    }, [user, loading]);

    // Filtered invoices based on selectedMonth
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            if (!selectedMonth) return true;
            const date = new Date(inv.issueDate);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return monthStr === selectedMonth;
        });
    }, [invoices, selectedMonth]);

    // Available months list for dropdown
    const availableMonths = useMemo(() => {
        const monthsSet = new Set<string>();
        invoices.forEach(inv => {
            const date = new Date(inv.issueDate);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsSet.add(monthStr);
        });
        return Array.from(monthsSet).sort().reverse().map(m => {
            const [y, mm] = m.split('-');
            const date = new Date(parseInt(y), parseInt(mm) - 1);
            return {
                value: m,
                label: date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
            };
        });
    }, [invoices]);

    // Update selection when month filter changes or list loads
    useEffect(() => {
        setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
    }, [selectedMonth, invoices.length]);

    const totalUnpaidAmount = filteredInvoices
        .filter(inv => selectedIds.has(inv.id))
        .reduce((sum, inv) => sum + inv.totalAmount, 0);
    const selectedCount = filteredInvoices.filter(inv => selectedIds.has(inv.id)).length;

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
        else setSelectedIds(new Set());
    };

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Memuat data tagihan...</div>;

    return (
        <div className="bg-white min-h-screen p-8 text-sm text-gray-800 font-sans">
            {/* Report Header */}
            <div className="border-b-2 border-gray-800 pb-6 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">Daftar Tagihan Belum Lunas</h1>
                        <p className="text-gray-500">Cahaya Cargo Express Management System</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-650">Tanggal Cetak</p>
                        <p className="text-lg font-bold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-gray-400 text-xs mt-1">Dicetak oleh: {user?.displayName || user?.email}</p>
                    </div>
                </div>

                {/* Filter Summary & Month Selection */}
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-gray-150 pt-4">
                    <div className="flex flex-wrap gap-8 text-sm">
                        <div>
                            <span className="text-gray-500 block text-xs uppercase tracking-wider">Status Invoice</span>
                            <span className="font-semibold uppercase text-red-600">Belum Lunas (Unpaid)</span>
                        </div>
                        {selectedMonth && (
                            <div>
                                <span className="text-gray-500 block text-xs uppercase tracking-wider">Bulan Tagihan</span>
                                <span className="font-bold text-blue-650">
                                    {availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}
                                </span>
                            </div>
                        )}
                        <div>
                            <span className="text-gray-500 block text-xs uppercase tracking-wider">Total Dokumen</span>
                            <span className="font-semibold">{selectedCount} dari {filteredInvoices.length} Invoice</span>
                        </div>
                    </div>
                    
                    {/* Month selector dropdown (hidden in print) */}
                    <div className="print:hidden flex items-center gap-2 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-gray-600 font-bold text-xs uppercase tracking-wider">Filter Bulan:</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-semibold text-gray-700 cursor-pointer"
                        >
                            <option value="">Semua Bulan</option>
                            {availableMonths.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        <th className="py-3 font-bold uppercase text-xs tracking-wider w-10 text-center print:hidden">
                            <input 
                                type="checkbox" 
                                checked={filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedIds.has(inv.id))} 
                                onChange={(e) => toggleAll(e.target.checked)}
                                className="w-4 h-4 cursor-pointer"
                            />
                        </th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider w-12 text-center">No</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">No. Invoice</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">No. STT</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Tgl Jatuh Tempo</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Klien (Penagihan)</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Status</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Sisa Tagihan</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredInvoices.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="py-8 text-center text-gray-500 italic">Tidak ada invoice yang belum dilunasi.</td>
                        </tr>
                    ) : (
                        filteredInvoices.map((inv, index) => {
                            const isOverdue = new Date(inv.dueDate).getTime() < new Date().getTime();
                            const isSelected = selectedIds.has(inv.id);
                            
                            return (
                                <tr key={inv.id} className={`break-inside-avoid ${!isSelected ? 'print:hidden opacity-40 bg-gray-50' : ''}`}>
                                    <td className="py-3 text-center print:hidden">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onChange={() => toggleSelection(inv.id)}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                    <td className="py-3 text-gray-500 text-center">{index + 1}</td>
                                    <td className="py-3 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                                    <td className="py-3 max-w-[200px] break-words text-xs font-mono">{sttNumbers[inv.id] || '-'}</td>
                                    <td className={`py-3 ${isOverdue && isSelected ? 'text-red-600 font-bold' : ''}`}>
                                        {new Date(inv.dueDate).toLocaleDateString('id-ID')}
                                    </td>
                                    <td className="py-3">
                                        <div className="font-bold">{inv.clientName}</div>
                                    </td>
                                    <td className="py-3 text-center">
                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white bg-red-500">
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right font-mono font-bold text-lg">{formatRupiah(inv.totalAmount)}</td>
                                </tr>
                            );
                        })
                    )}
                    
                    {/* Grand Total */}
                    {filteredInvoices.length > 0 && (
                        <tr className="bg-gray-50 border-t-2 border-gray-800">
                            <td className="print:hidden"></td>
                            <td colSpan={6} className="py-4 text-right pr-4 uppercase text-sm tracking-wider font-bold">Total Piutang Belum Lunas</td>
                            <td className="py-4 text-right font-bold text-xl text-red-600">{formatRupiah(totalUnpaidAmount)}</td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between items-end text-xs text-gray-500">
                <div>
                    <p>Dicetak melalui C2-MS System</p>
                    <p>{new Date().toLocaleString('id-ID')} WIB</p>
                </div>
                <div className="text-center w-40">
                    <div className="h-16 mb-2 border-b border-gray-300"></div>
                    <p className="font-semibold text-gray-700">Finance / Admin</p>
                </div>
            </div>

            {/* Floating Print Button */}
            <button 
                onClick={() => window.print()}
                disabled={selectedCount === 0}
                className="print:hidden fixed bottom-8 right-8 bg-blue-600 text-white px-8 py-4 rounded-full shadow-2xl font-bold hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50 disabled:hover:scale-100 z-50"
            >
                <span className="text-xl">🖨️</span> 
                {selectedCount > 0 ? `Cetak ${selectedCount} Invoice` : 'Pilih Invoice Dulu'}
            </button>
        </div>
    );
}

export default function PrintUnpaidInvoicesPage(props: {
    searchParams: Promise<{ month?: string }>
}) {
    const searchParams = use(props.searchParams);
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-medium">Memuat halaman cetak...</div>}>
            <PrintUnpaidInvoicesContent searchParams={searchParams} />
        </Suspense>
    );
}
