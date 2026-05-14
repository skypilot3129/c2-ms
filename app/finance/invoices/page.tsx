'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices, deleteInvoice, updateInvoiceStatus } from '@/lib/firestore-invoices';
import type { Invoice } from '@/types/invoice';
import { formatRupiah } from '@/lib/currency';
import { Plus, Search, Trash2, CheckCircle2, Printer, CheckSquare, Eye, ChevronLeft, ChevronRight, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Filter, FileText } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

type SortField = 'date' | 'totalAmount' | 'clientName' | 'dueDate';
type SortDir = 'asc' | 'desc';

export default function InvoicesPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Filter & Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [dateFilter, setDateFilter] = useState(''); // YYYY-MM
    const [showOverdueOnly, setShowOverdueOnly] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToInvoices(user.uid, (data) => {
            // Convert Firestore Timestamps to Date if necessary
            const processedData = data.map(inv => ({
                ...inv,
                issueDate: inv.issueDate instanceof Date ? inv.issueDate : (inv.issueDate as any)?.toDate ? (inv.issueDate as any).toDate() : new Date(inv.issueDate),
                dueDate: inv.dueDate instanceof Date ? inv.dueDate : (inv.dueDate as any)?.toDate ? (inv.dueDate as any).toDate() : new Date(inv.dueDate),
            }));
            setInvoices(processedData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const isOverdue = (inv: Invoice) => {
        if (inv.status === 'Paid') return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return inv.dueDate < today;
    };

    // Derived Data for Filters & Display
    const { filteredInvoices, summary, tabCounts, months } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let totalActive = 0;
        let totalPiutang = 0;
        let countUnpaid = 0;
        let countOverdue = 0;
        const availableMonths = new Set<string>();

        let unpaidCount = 0;
        let paidCount = 0;

        let filtered = invoices.filter(inv => {
            const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.clientName.toLowerCase().includes(searchTerm.toLowerCase());

            // Collect months for filter
            const monthStr = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, '0')}`;
            availableMonths.add(monthStr);

            // Calculate Summary (for all matched search, ignoring other filters to show overall state or based on search)
            if (inv.status !== 'Paid') {
                totalActive += inv.totalAmount;
                totalPiutang += inv.totalAmount;
                countUnpaid++;
                unpaidCount++;
                if (inv.dueDate < today) {
                    countOverdue++;
                }
            } else {
                paidCount++;
            }

            if (!matchesSearch) return false;

            // Apply Date Filter
            if (dateFilter && monthStr !== dateFilter) return false;

            // Apply Tab Filter
            if (activeTab === 'paid' && inv.status !== 'Paid') return false;
            if (activeTab === 'unpaid' && inv.status === 'Paid') return false;

            // Apply Overdue Filter
            if (showOverdueOnly && !isOverdue(inv)) return false;

            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            let valA: any = a[sortField === 'date' ? 'issueDate' : sortField];
            let valB: any = b[sortField === 'date' ? 'issueDate' : sortField];
            
            if (sortField === 'clientName') {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        const monthOptions = Array.from(availableMonths).sort().reverse().map(m => {
            const [y, mm] = m.split('-');
            const date = new Date(parseInt(y), parseInt(mm) - 1);
            return { value: m, label: date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
        });

        return {
            filteredInvoices: filtered,
            summary: { totalActive, totalPiutang, countUnpaid, countOverdue },
            tabCounts: { all: invoices.length, unpaid: unpaidCount, paid: paidCount },
            months: monthOptions
        };
    }, [invoices, searchTerm, activeTab, dateFilter, showOverdueOnly, sortField, sortDir]);

    // Pagination
    const totalPages = Math.ceil(filteredInvoices.length / pageSize);
    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, dateFilter, showOverdueOnly, pageSize]);

    const handleDelete = async (id: string, number: string) => {
        if (confirm(`Hapus invoice ${number}? Pastikan tagihan ini belum dibayar/dikirim.`)) {
            await deleteInvoice(id);
        }
    };

    const handleMarkPaid = async (inv: Invoice) => {
        if (confirm(`Tandai invoice ${inv.invoiceNumber} sebagai LUNAS?`)) {
            setProcessingId(inv.id);
            try {
                await updateInvoiceStatus(inv.id, 'Paid', {
                    date: new Date(),
                    method: 'Cash',
                });
            } catch (error: any) {
                console.error("Error marking paid:", error);
                alert(`Gagal menandai lunas: ${error.message}`);
            } finally {
                setProcessingId(null);
            }
        }
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={14} className="text-gray-400" />;
        return sortDir === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />;
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data invoice...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Daftar Invoice</h1>
                        <p className="text-gray-500 text-sm">Kelola tagihan pelanggan (Consolidated Invoices)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/finance/invoices/print-unpaid"
                            target="_blank"
                            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Printer size={18} className="text-red-500" />
                            <span className="hidden sm:inline">Cetak Belum Lunas</span>
                        </Link>
                        <Link
                            href="/finance/invoices/cek-harga"
                            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <CheckSquare size={18} className="text-blue-600" />
                            <span className="hidden sm:inline">Cek Harga Barang</span>
                        </Link>
                        <Link
                            href="/finance/invoices/new"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                        >
                            <Plus size={18} />
                            Buat Invoice Baru
                        </Link>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                        <span className="text-sm text-gray-500 font-medium mb-1">Total Invoice</span>
                        <span className="text-2xl font-bold text-gray-800">{tabCounts.all}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                        <span className="text-sm text-gray-500 font-medium mb-1">Total Piutang</span>
                        <span className="text-xl sm:text-2xl font-bold text-blue-600">{formatRupiah(summary.totalPiutang)}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                        <span className="text-sm text-gray-500 font-medium mb-1">Belum Lunas</span>
                        <span className="text-2xl font-bold text-yellow-600">{summary.countUnpaid}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-center bg-red-50/50">
                        <span className="text-sm text-red-600 font-medium mb-1 flex items-center gap-1"><AlertCircle size={14} /> Overdue</span>
                        <span className="text-2xl font-bold text-red-600">{summary.countOverdue}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Tabs */}
                    <div className="border-b border-gray-100 flex overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all relative flex-shrink-0 flex items-center gap-2 ${activeTab === 'all' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Semua
                            <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">{tabCounts.all}</span>
                            {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTab('unpaid')}
                            className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all relative flex-shrink-0 flex items-center gap-2 ${activeTab === 'unpaid' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Belum Lunas
                            <span className={`${activeTab === 'unpaid' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-50 text-yellow-700'} py-0.5 px-2 rounded-full text-xs`}>{tabCounts.unpaid}</span>
                            {activeTab === 'unpaid' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTab('paid')}
                            className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all relative flex-shrink-0 flex items-center gap-2 ${activeTab === 'paid' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Lunas (Riwayat)
                            <span className={`${activeTab === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-green-50 text-green-700'} py-0.5 px-2 rounded-full text-xs`}>{tabCounts.paid}</span>
                            {activeTab === 'paid' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                    </div>

                    {/* Filters & Search */}
                    <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="relative flex-1 w-full max-w-md">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari No. Invoice / Client..."
                                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-full focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Semua Bulan</option>
                                {months.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            
                            <button
                                onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${showOverdueOnly ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                <Filter size={14} />
                                Overdue Only
                            </button>
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider">Invoice #</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('date')}>
                                        <div className="flex items-center gap-1">Tanggal <SortIcon field="date" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('dueDate')}>
                                        <div className="flex items-center gap-1">Jatuh Tempo <SortIcon field="dueDate" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('clientName')}>
                                        <div className="flex items-center gap-1">Client <SortIcon field="clientName" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('totalAmount')}>
                                        <div className="flex items-center justify-end gap-1"><SortIcon field="totalAmount" /> Total</div>
                                    </th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider text-center">Status</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-wider text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {paginatedInvoices.map((inv) => {
                                    const overdue = isOverdue(inv);
                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4 font-mono font-medium text-blue-600">
                                                {inv.invoiceNumber}
                                                <div className="text-xs text-gray-400 font-sans mt-0.5">{inv.transactionIds.length} Resi</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {inv.issueDate.toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                    {inv.dueDate.toLocaleDateString('id-ID')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-800">{inv.clientName}</td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-700">{formatRupiah(inv.totalAmount)}</td>
                                            <td className="px-6 py-4 text-center">
                                                {inv.status === 'Paid' ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                                                        LUNAS
                                                    </span>
                                                ) : overdue ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                                                        JATUH TEMPO
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-yellow-50 text-yellow-700 border-yellow-200">
                                                        BELUM LUNAS
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {inv.status !== 'Paid' ? (
                                                        <button
                                                            onClick={() => handleMarkPaid(inv)}
                                                            disabled={processingId === inv.id}
                                                            className={`p-2 rounded-lg transition-colors border border-gray-200 ${processingId === inv.id ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-green-600 hover:bg-green-50'}`}
                                                            title="Tandai Sudah Bayar"
                                                        >
                                                            {processingId === inv.id ? (
                                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                                            ) : (
                                                                <CheckCircle2 size={16} />
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span title="Sudah Lunas" className="p-2 text-green-600">
                                                            <CheckCircle2 size={16} />
                                                        </span>
                                                    )}
                                                    <Link
                                                        href={`/finance/invoices/${inv.id}/print`}
                                                        target="_blank"
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                                                        title="Lihat / Cetak Invoice"
                                                    >
                                                        <Eye size={16} />
                                                    </Link>
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card List */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {paginatedInvoices.map((inv) => {
                            const overdue = isOverdue(inv);
                            return (
                                <div key={inv.id} className="p-4 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono font-bold text-blue-600 text-sm">{inv.invoiceNumber}</span>
                                                <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border ${inv.status === 'Paid'
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                    }`}>
                                                    {inv.status === 'Paid' ? 'LUNAS' : overdue ? 'JATUH TEMPO' : 'PENDING'}
                                                </span>
                                            </div>
                                            <p className="font-medium text-gray-800 text-sm">{inv.clientName}</p>
                                            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-1">
                                                <span>{inv.transactionIds.length} Resi</span>
                                                <span>•</span>
                                                <span>Tgl: {inv.issueDate.toLocaleDateString('id-ID')}</span>
                                                <span>•</span>
                                                <span className={overdue ? 'text-red-600 font-medium' : ''}>JT: {inv.dueDate.toLocaleDateString('id-ID')}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-800 text-base">{formatRupiah(inv.totalAmount)}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                                        {inv.status !== 'Paid' && (
                                            <button
                                                onClick={() => handleMarkPaid(inv)}
                                                disabled={processingId === inv.id}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg active:scale-95 transition-all ${processingId === inv.id ? 'opacity-50 text-gray-400 bg-gray-50 border-gray-100' : 'text-green-700 bg-green-50 border-green-200'}`}
                                            >
                                                {processingId === inv.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <CheckCircle2 size={14} />
                                                )}
                                                {processingId === inv.id ? 'Memproses...' : 'Lunas'}
                                            </button>
                                        )}
                                        <Link
                                            href={`/finance/invoices/${inv.id}/print`}
                                            target="_blank"
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg active:scale-95 transition-transform"
                                        >
                                            <Eye size={14} /> Detail
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg active:scale-95 transition-transform"
                                        >
                                            <Trash2 size={14} /> Hapus
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {paginatedInvoices.length === 0 && (
                        <div className="text-center py-12 px-4 text-gray-400 flex flex-col items-center">
                            <FileText size={48} className="mb-4 text-gray-300" />
                            <p className="text-sm">Tidak ada data invoice yang sesuai kriteria.</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>Tampilkan</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </select>
                                <span>data dari {filteredInvoices.length}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="px-3 py-1 text-sm font-medium text-gray-700">
                                    Halaman {currentPage} dari {totalPages}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
