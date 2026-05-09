'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import type { Invoice } from '@/types/invoice';
import { formatRupiah } from '@/lib/currency';

function PrintUnpaidInvoicesContent() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToInvoices(user.uid, (data) => {
            // Filter out Paid invoices
            const unpaidInvoices = data.filter(inv => inv.status !== 'Paid');
            
            // Sort by issue date (oldest first, or newest first?)
            // Let's sort oldest first to prioritize oldest unpaid
            unpaidInvoices.sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
            
            setInvoices(unpaidInvoices);
            // Only initialize selectedIds once when first loaded
            if (loading) {
                setSelectedIds(new Set(unpaidInvoices.map(inv => inv.id)));
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user]);

    // Removed auto-print to allow user selection first

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data laporan...</div>;

    const totalUnpaidAmount = invoices
        .filter(inv => selectedIds.has(inv.id))
        .reduce((sum, inv) => sum + inv.totalAmount, 0);
    const selectedCount = selectedIds.size;

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(invoices.map(i => i.id)));
        else setSelectedIds(new Set());
    };

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
                        <p className="font-semibold text-gray-600">Tanggal Cetak</p>
                        <p className="text-lg font-bold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-gray-400 text-xs mt-1">Dicetak oleh: {user?.displayName || user?.email}</p>
                    </div>
                </div>

                {/* Filter Summary */}
                <div className="mt-6 flex gap-8 text-sm">
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Status Invoice</span>
                        <span className="font-semibold uppercase text-red-600">Belum Lunas (Unpaid)</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Total Dokumen</span>
                        <span className="font-semibold">{selectedCount} dari {invoices.length} Invoice</span>
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
                                checked={selectedIds.size === invoices.length && invoices.length > 0} 
                                onChange={(e) => toggleAll(e.target.checked)}
                                className="w-4 h-4 cursor-pointer"
                            />
                        </th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider w-12 text-center">No</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">No. Invoice</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Tgl Terbit</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Tgl Jatuh Tempo</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Klien (Penagihan)</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Status</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Sisa Tagihan</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {invoices.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="py-8 text-center text-gray-500 italic">Tidak ada invoice yang belum dilunasi.</td>
                        </tr>
                    ) : (
                        invoices.map((inv, index) => {
                            // Calculate if overdue
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
                                    <td className="py-3">{new Date(inv.issueDate).toLocaleDateString('id-ID')}</td>
                                    <td className={`py-3 ${isOverdue && isSelected ? 'text-red-600 font-bold' : ''}`}>
                                        {new Date(inv.dueDate).toLocaleDateString('id-ID')}
                                    </td>
                                    <td className="py-3">
                                        <div className="font-bold">{inv.clientName}</div>
                                    </td>
                                    <td className="py-3 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white bg-red-500`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right font-mono font-bold text-lg">{formatRupiah(inv.totalAmount)}</td>
                                </tr>
                            );
                        })
                    )}
                    
                    {/* Grand Total */}
                    {invoices.length > 0 && (
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
                    <p>{new Date().toLocaleString('id-ID')}</p>
                </div>
                <div className="text-center w-40">
                    <div className="h-16 mb-2 border-b border-gray-300"></div>
                    <p className="font-semibold">Finance / Admin</p>
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

export default function PrintUnpaidInvoicesPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PrintUnpaidInvoicesContent />
        </Suspense>
    );
}
