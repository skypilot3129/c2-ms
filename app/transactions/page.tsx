'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions, deleteTransaction, searchTransactions } from '@/lib/firestore-transactions';
import type { Transaction, StatusTransaksi } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import StatusBadge from '@/components/StatusBadge';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Plus, Search, Eye, Edit2, Trash2, Filter, Printer, X, Download, Package, TrendingUp, AlertCircle, CheckCircle, ArrowUpDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import BulkInvoiceModal, { type BulkInvoiceFormData } from '@/components/BulkInvoiceModal';

type SortOption = 'date-newest' | 'date-oldest' | 'amount-highest' | 'amount-lowest';

export default function TransactionsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusTransaksi | 'all'>('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [sortOption, setSortOption] = useState<SortOption>('date-newest');
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Bulk invoice selection
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkModal, setShowBulkModal] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Subscribe to transactions
    useEffect(() => {
        if (!mounted || !user) return;

        const unsubscribe = subscribeToTransactions((updated) => {
            setTransactions(updated);
            setLoading(false);
        }, user.uid);

        return () => unsubscribe();
    }, [mounted, user]);

    // Apply search, filters, and sort
    useEffect(() => {
        let result = searchTransactions(transactions, searchTerm);

        if (statusFilter !== 'all') {
            result = result.filter(t => t.status === statusFilter);
        }

        if (paymentFilter !== 'all') {
            if (paymentFilter === 'lunas') {
                // Check if pelunasan is NOT 'Pending' (meaning it's Cash or TF)
                result = result.filter(t => t.pelunasan !== 'Pending');
            } else if (paymentFilter === 'pending') {
                result = result.filter(t => t.pelunasan === 'Pending');
            }
        }

        // Sorting
        result.sort((a, b) => {
            switch (sortOption) {
                case 'date-newest':
                    return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
                case 'date-oldest':
                    return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
                case 'amount-highest':
                    return b.jumlah - a.jumlah;
                case 'amount-lowest':
                    return a.jumlah - b.jumlah;
                default:
                    return 0;
            }
        });

        setFilteredTransactions(result);
        // Reset to page 1 when filters change
        setCurrentPage(1);
    }, [searchTerm, statusFilter, paymentFilter, transactions, sortOption]);

    const handleDelete = async (id: string) => {
        try {
            await deleteTransaction(id);
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Gagal menghapus transaksi');
        }
    };

    const handleExportCSV = () => {
        const headers = ['Tanggal', 'No STT', 'Pengirim', 'Penerima', 'Tujuan', 'Koli', 'Berat', 'Total', 'Status', 'Metode Pembayaran'];
        const csvContent = [
            headers.join(','),
            ...filteredTransactions.map(t => [
                `"${new Date(t.tanggal).toLocaleDateString('id-ID')}"`,
                `"${t.noSTT}"`,
                `"${t.pengirimName}"`,
                `"${t.penerimaName}"`,
                `"${t.tujuan}"`,
                t.koli,
                t.berat,
                t.jumlah,
                `"${t.status}"`,
                `"${t.pembayaran}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `transaksi_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handlePrintReport = () => {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (sortOption) params.append('sort', sortOption);

        window.open(`/transactions/print-report?${params.toString()}`, '_blank');
    };

    // Bulk Invoice Selection Logic
    const selectedTransactions = useMemo(() => {
        return transactions.filter(t => selectedIds.includes(t.id));
    }, [transactions, selectedIds]);

    const selectionTotals = useMemo(() => {
        return {
            koli: selectedTransactions.reduce((sum, t) => sum + t.koli, 0),
            jumlah: selectedTransactions.reduce((sum, t) => sum + t.jumlah, 0),
        };
    }, [selectedTransactions]);

    // Allow any selection for bulk delete. Validation for invoice will be separate.
    const canSelectTransaction = (transaction: Transaction): boolean => {
        return true;
    };

    const toggleSelection = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(sid => sid !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const toggleSelectAll = () => {
        const currentPageIds = paginatedTransactions.map(t => t.id);
        const allCurrentPageSelected = currentPageIds.every(id => selectedIds.includes(id));

        if (allCurrentPageSelected) {
            // Deselect all items on current page
            setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
        } else {
            // Select all items on current page that aren't already selected
            const newIds = currentPageIds.filter(id => !selectedIds.includes(id));
            setSelectedIds(prev => [...prev, ...newIds]);
        }
    };

    // Validation for Bulk Invoice
    const isSelectionValidForInvoice = useMemo(() => {
        if (selectedTransactions.length <= 1) return true;
        const first = selectedTransactions[0];
        return selectedTransactions.every(t =>
            t.pengirimName === first.pengirimName &&
            new Date(t.tanggal).toDateString() === new Date(first.tanggal).toDateString() &&
            t.status !== 'dibatalkan'
        );
    }, [selectedTransactions]);

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} transaksi terpilih? Tindakan ini permanen.`)) {
            return;
        }

        try {
            // Delete sequentially to avoid overwhelming Firestore if too many
            for (const id of selectedIds) {
                await deleteTransaction(id);
            }
            setSelectedIds([]);
        } catch (error) {
            console.error('Error bulk deleting:', error);
            alert('Gagal menghapus beberapa transaksi.');
        }
    };

    const handleBulkPrint = () => {
        if (selectedIds.length === 0) return;
        if (!isSelectionValidForInvoice) {
            alert('Untuk membuat Invoice Gabungan:\n- Pengirim harus sama\n- Tanggal harus sama\n- Status tidak boleh "Dibatalkan"');
            return;
        }
        setShowBulkModal(true);
    };

    const handleModalSubmit = (formData: BulkInvoiceFormData) => {
        const params = new URLSearchParams({
            ids: selectedIds.join(','),
            kepadaYth: formData.kepadaYth,
            nama: formData.nama,
            kota: formData.kota,
            noNPWP: formData.noNPWP,
            keteranganKeberangkatan: formData.keteranganKeberangkatan,
            includePPN: formData.includePPN.toString(),
            keterangan: JSON.stringify(formData.keteranganPerSTT),
        });
        router.push(`/transactions/print-bulk?${params.toString()}`);
        setShowBulkModal(false);
        setSelectedIds([]);
    };

    const clearSelection = () => setSelectedIds([]);

    // Stats Calculation
    const stats = useMemo(() => {
        const total = transactions.length;
        const omset = transactions.reduce((sum, t) => sum + t.jumlah, 0);
        const pending = transactions.filter(t => t.status === 'pending').length;
        const cancelled = transactions.filter(t => t.status === 'dibatalkan').length;
        return { total, omset, pending, cancelled };
    }, [transactions]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const nextPage = () => goToPage(currentPage + 1);
    const prevPage = () => goToPage(currentPage - 1);

    if (!mounted) return null;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-24">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <Link href="/" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                                    ← Kembali ke Home
                                </Link>
                                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    <Package className="text-blue-600" />
                                    Resi & Transaksi
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">Manajemen pengiriman & pelacakan</p>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button
                                    onClick={handleExportCSV}
                                    className="flex-1 md:flex-none border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                >
                                    <Download size={18} />
                                    Export CSV
                                </button>
                                <button
                                    onClick={handlePrintReport}
                                    className="flex-1 md:flex-none border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} />
                                    Cetak PDF
                                </button>
                                <Link href="/transactions/new" className="flex-1 md:flex-none">
                                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105">
                                        <Plus size={20} />
                                        Buat Resi
                                    </button>
                                </Link>
                            </div>
                        </div>

                        {/* Search, Filter & Sort */}
                        <div className="mt-6 flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Cari No STT, Pengirim, Penerima..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as StatusTransaksi | 'all')}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-blue-500"
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="diproses">Diproses</option>
                                    <option value="dikirim">Dikirim</option>
                                    <option value="selesai">Selesai</option>
                                    <option value="dibatalkan">Dibatalkan</option>
                                </select>
                                <select
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value)}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-blue-500"
                                >
                                    <option value="all">Semua Pembayaran</option>
                                    <option value="lunas">Lunas (Cash/TF)</option>
                                    <option value="pending">Belum Lunas (Pending)</option>
                                </select>
                                <select
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-blue-500"
                                >
                                    <option value="date-newest">Terbaru</option>
                                    <option value="date-oldest">Terlama</option>
                                    <option value="amount-highest">Nominal Tertinggi</option>
                                    <option value="amount-lowest">Nominal Terendah</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <Package size={20} />
                                </div>
                                <span className="text-gray-500 text-sm font-medium">Total Resi</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                    <TrendingUp size={20} />
                                </div>
                                <span className="text-gray-500 text-sm font-medium">Total Omset</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{formatRupiah(stats.omset)}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                                    <AlertCircle size={20} />
                                </div>
                                <span className="text-gray-500 text-sm font-medium">Pending</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{stats.pending}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-red-50 rounded-lg text-red-600">
                                    <X size={20} />
                                </div>
                                <span className="text-gray-500 text-sm font-medium">Dibatalkan</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{stats.cancelled}</div>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Memuat transaksi...</p>
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-dashed border-gray-200 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Package className="text-gray-400" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Tidak ada data transaksi</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-6">
                                {searchTerm || statusFilter !== 'all'
                                    ? 'Coba sesuaikan pencarian atau filter Anda.'
                                    : 'Mulai buat resi pengiriman pertama Anda untuk melihat data di sini.'}
                            </p>
                            {(searchTerm || statusFilter !== 'all') && (
                                <button
                                    onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                                    className="text-blue-600 font-medium hover:underline"
                                >
                                    Reset Filter
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-center w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        paginatedTransactions.length > 0 &&
                                                        paginatedTransactions.every(t => selectedIds.includes(t.id))
                                                    }
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No STT</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pengirim / Penerima</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tujuan</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Koli</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedTransactions.map((transaction) => {
                                            const isSelected = selectedIds.includes(transaction.id);
                                            const isSelectable = canSelectTransaction(transaction);
                                            const isDisabled = !isSelectable && selectedIds.length > 0;

                                            return (
                                                <tr
                                                    key={transaction.id}
                                                    className={`hover:bg-blue-50/50 transition-colors ${isSelected ? 'bg-blue-50/80' : ''}`}
                                                >
                                                    <td className="px-6 py-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelection(transaction.id)}
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center text-sm text-gray-600">
                                                            <Calendar size={14} className="mr-2 text-gray-400" />
                                                            {new Date(transaction.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="font-mono text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                            {transaction.noSTT}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-gray-900">{transaction.pengirimName}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                                            → {transaction.penerimaName}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                        {transaction.tujuan}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                                        {transaction.koli}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-800">
                                                        {formatRupiah(transaction.jumlah)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <StatusBadge status={transaction.status} />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Link href={`/transactions/${transaction.id}`}>
                                                                <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                                    <Eye size={18} />
                                                                </button>
                                                            </Link>
                                                            <Link href={`/transactions/${transaction.id}/edit`}>
                                                                <button className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                                                                    <Edit2 size={18} />
                                                                </button>
                                                            </Link>
                                                            <button
                                                                onClick={() => setDeleteConfirm(transaction.id)}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {filteredTransactions.length > 0 && (
                                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                        {/* Items per page selector */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-600">Tampilkan</span>
                                            <select
                                                value={itemsPerPage}
                                                onChange={(e) => {
                                                    setItemsPerPage(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-blue-500"
                                            >
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                            </select>
                                            <span className="text-sm text-gray-600">
                                                dari {filteredTransactions.length} transaksi
                                            </span>
                                        </div>

                                        {/* Page info and navigation */}
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-600">
                                                Halaman {currentPage} dari {totalPages || 1}
                                            </span>

                                            <div className="flex items-center gap-2">
                                                {/* Previous button */}
                                                <button
                                                    onClick={prevPage}
                                                    disabled={currentPage === 1}
                                                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                                                >
                                                    <ChevronLeft size={18} className="text-gray-600" />
                                                </button>

                                                {/* Page numbers */}
                                                <div className="hidden md:flex items-center gap-1">
                                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                        let pageNum;
                                                        if (totalPages <= 5) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage <= 3) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage >= totalPages - 2) {
                                                            pageNum = totalPages - 4 + i;
                                                        } else {
                                                            pageNum = currentPage - 2 + i;
                                                        }

                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                onClick={() => goToPage(pageNum)}
                                                                className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Next button */}
                                                <button
                                                    onClick={nextPage}
                                                    disabled={currentPage === totalPages}
                                                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                                                >
                                                    <ChevronRight size={18} className="text-gray-600" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Floating Action Bar - Bulk Invoice */}
                {selectedIds.length > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom duration-300">
                        <div className="bg-gray-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-8 border border-gray-700/50 backdrop-blur-xl">
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Terpilih</p>
                                    <p className="text-xl font-bold">{selectedIds.length} <span className="text-sm font-normal text-gray-400">Resi</span></p>
                                </div>
                                <div className="h-10 w-px bg-gray-700"></div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Nilai</p>
                                    <p className="text-xl font-bold text-green-400">{formatRupiah(selectionTotals.jumlah)}</p>
                                </div>
                                <div className="h-10 w-px bg-gray-700"></div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Koli</p>
                                    <p className="text-xl font-bold">{selectionTotals.koli}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={clearSelection}
                                    className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-red-600/30"
                                >
                                    <Trash2 size={18} />
                                    Hapus ({selectedIds.length})
                                </button>
                                <button
                                    onClick={handleBulkPrint}
                                    disabled={!isSelectionValidForInvoice}
                                    className={`px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg ${isSelectionValidForInvoice
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        }`}
                                    title={!isSelectionValidForInvoice ? 'Pengirim dan Tanggal harus sama' : 'Buat Invoice'}
                                >
                                    <Printer size={18} />
                                    Cetak Invoice
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 transform transition-all">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Hapus Transaksi?</h3>
                            <p className="text-gray-500 text-center mb-8 text-sm">
                                Tindakan ini tidak dapat dibatalkan. Data transaksi akan hilang permanen.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                                >
                                    Ya, Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bulk Invoice Modal */}
                {showBulkModal && (
                    <BulkInvoiceModal
                        transactions={selectedTransactions}
                        onClose={() => setShowBulkModal(false)}
                        onSubmit={handleModalSubmit}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}
