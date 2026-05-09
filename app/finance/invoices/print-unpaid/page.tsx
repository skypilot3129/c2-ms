'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import type { Invoice } from '@/types/invoice';
import { formatRupiah } from '@/lib/currency';

function PrintUnpaidInvoicesContent() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
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
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!loading && invoices.length >= 0) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, invoices]);

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data laporan...</div>;

    const totalUnpaidAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

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
                        <span className="font-semibold">{invoices.length} Invoice</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
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
                            
                            return (
                                <tr key={inv.id} className="break-inside-avoid">
                                    <td className="py-3 text-gray-500 text-center">{index + 1}</td>
                                    <td className="py-3 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                                    <td className="py-3">{new Date(inv.issueDate).toLocaleDateString('id-ID')}</td>
                                    <td className={`py-3 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
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
