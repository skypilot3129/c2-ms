'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices, deleteInvoice, updateInvoiceStatus } from '@/lib/firestore-invoices';
import type { Invoice } from '@/types/invoice';
import { formatRupiah } from '@/lib/currency';
import { Plus, Search, FileText, Trash2, CheckCircle2, XCircle, Printer, Eye } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function InvoicesPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'unpaid'>('all');

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToInvoices(user.uid, (data) => {
            setInvoices(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.clientName.toLowerCase().includes(searchTerm.toLowerCase());

        if (activeTab === 'paid') return matchesSearch && inv.status === 'Paid';
        if (activeTab === 'unpaid') return matchesSearch && inv.status !== 'Paid';
        return matchesSearch;
    });

    const handleDelete = async (id: string, number: string) => {
        if (confirm(`Hapus invoice ${number}? Pastikan tagihan ini belum dibayar/dikirim.`)) {
            await deleteInvoice(id);
        }
    };

    const handleMarkPaid = async (inv: Invoice) => {
        if (confirm(`Tandai invoice ${inv.invoiceNumber} sebagai LUNAS?`)) {
            await updateInvoiceStatus(inv.id, 'Paid', {
                date: new Date(),
                method: 'Cash', // Default simple
            });
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data invoice...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Daftar Invoice</h1>
                        <p className="text-gray-500">Kelola tagihan pelanggan (Consolidated Invoices)</p>
                    </div>
                    <Link
                        href="/finance/invoices/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105"
                    >
                        <Plus size={20} />
                        Buat Invoice Baru
                    </Link>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    {/* Tabs */}
                    <div className="border-b border-gray-100 flex">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-6 py-4 text-sm font-medium transition-all relative ${activeTab === 'all' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Semua
                            {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTab('unpaid')}
                            className={`px-6 py-4 text-sm font-medium transition-all relative ${activeTab === 'unpaid' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Belum Lunas
                            {activeTab === 'unpaid' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTab('paid')}
                            className={`px-6 py-4 text-sm font-medium transition-all relative ${activeTab === 'paid' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Lunas (Riwayat)
                            {activeTab === 'paid' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                    </div>

                    <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari No. Invoice / Client..."
                                className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm w-full focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-xl text-xs uppercase tracking-wider">Invoice #</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider">Tanggal</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider">Client</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider text-right">Total</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider text-center">Status</th>
                                    <th className="px-6 py-4 rounded-tr-xl text-xs uppercase tracking-wider text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 font-mono font-medium text-blue-600">
                                            {inv.invoiceNumber}
                                            <div className="text-xs text-gray-400 font-sans mt-0.5">{inv.transactionIds.length} Resi</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {inv.issueDate.toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-800">{inv.clientName}</td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-700">{formatRupiah(inv.totalAmount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${inv.status === 'Paid'
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {inv.status === 'Paid' ? 'LUNAS' : 'BELUM LUNAS'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {inv.status !== 'Paid' ? (
                                                    <button
                                                        onClick={() => handleMarkPaid(inv)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-gray-200"
                                                        title="Tandai Sudah Bayar"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                ) : (
                                                    <span title="Sudah Lunas" className="p-2 text-green-600">
                                                        <CheckCircle2 size={16} />
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => window.open(`/finance/invoices/${inv.id}/print`, '_blank')}
                                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                                    title="Cetak Invoice"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-gray-400">Belum ada invoice {activeTab === 'all' ? '' : activeTab === 'unpaid' ? 'belum lunas' : 'lunas'}.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
