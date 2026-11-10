'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions, deleteTransaction, updateSuratJalanData } from '@/lib/firestore-transactions';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import { buildInvoiceLookup, resolveTransactionPaymentInfo } from '@/lib/invoice-reconciliation';
import type { Transaction, SuratJalanData } from '@/types/transaction';
import type { Invoice } from '@/types/invoice';
import { formatRupiah } from '@/lib/currency';
import StatusBadge from '@/components/StatusBadge';
import ProtectedRoute from '@/components/ProtectedRoute';
import SuratJalanModal from '@/components/SuratJalanModal';
import LinkInvoiceModal from '@/components/LinkInvoiceModal';
import { ArrowLeft, Edit2, Trash2, Printer, Package, User, MapPin, Banknote, FileText, Truck, Calendar, Clock, CreditCard, Link2, CheckCircle2 } from 'lucide-react';

export default function TransactionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [suratJalanModalOpen, setSuratJalanModalOpen] = useState(false);
    const [linkInvoiceOpen, setLinkInvoiceOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!params.id || typeof params.id !== 'string' || !user) return;
        const targetId = params.id;

        const unsubTx = subscribeToTransactions((all) => {
            const found = all.find(t => t.id === targetId) || null;
            setTransaction(found);
            setLoading(false);
        }, user.uid);

        const unsubInv = subscribeToInvoices(user.uid, (invList) => {
            setInvoices(invList);
        });

        return () => {
            unsubTx();
            unsubInv();
        };
    }, [params.id, user]);

    const invoiceLookup = useMemo(() => buildInvoiceLookup(invoices), [invoices]);
    const paymentInfo = useMemo(() => {
        if (!transaction) return null;
        return resolveTransactionPaymentInfo(transaction, invoiceLookup);
    }, [transaction, invoiceLookup]);

    const handleDelete = async () => {
        if (!transaction) return;

        try {
            await deleteTransaction(transaction.id);
            router.push('/transactions');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Gagal menghapus transaksi');
        }
    };

    const handlePrint = () => {
        window.open(`/transactions/${transaction?.id}/print`, '_blank');
    };

    const handleSuratJalan = async (data: SuratJalanData) => {
        if (!transaction) return;

        try {
            // Save surat jalan data to transaction
            await updateSuratJalanData(transaction.id, data);

            // Open print window with URL params (all new fields)
            const params = new URLSearchParams({
                tanggalPC: data.tanggalPC || '',
                mobil: data.nomorMobil || '',
                sopir: data.namaSopir || '',
                rute: data.rute || '',
                namaPengirim: data.namaPengirim || '',
                alamatPengirim: data.alamatPengirim || '',
                namaPenerima: data.namaPenerima || '',
                alamatPenerima: data.alamatPenerima || '',
                konsesiBaik: data.konsesiBaik.toString(),
                konsesiRusak: data.konsesiRusak.toString(),
                konsesiBerkurang: data.konsesiBerkurang.toString(),
                konsesiKeterangan: data.konsesiKeterangan || '',
                asuransi: data.asuransi.toString(),
                caraPembayaran: data.caraPembayaran,
                pembayaranOngkos: data.pembayaranOngkos || '',
                dimensi: data.dimensi || '',
                beratVolume: data.beratVolume?.toString() || '',
                satuanVolume: data.satuanVolume || '',
                catatanKhusus: data.catatanKhusus || '',
            });

            window.open(`/transactions/${transaction.id}/surat-jalan?${params.toString()}`, '_blank');
            setSuratJalanModalOpen(false);
        } catch (error) {
            console.error('Error creating surat jalan:', error);
            alert('Gagal membuat surat jalan');
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Memuat transaksi...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!transaction) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="text-center">
                        <div className="text-6xl mb-4">❌</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Transaksi Tidak Ditemukan</h2>
                        <p className="text-gray-600 mb-6">Transaksi yang Anda cari tidak ada atau telah dihapus.</p>
                        <Link href="/transactions">
                            <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all">
                                Kembali ke Daftar
                            </button>
                        </Link>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Clean White Sticky Header */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto max-w-5xl px-4 py-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <Link href="/transactions" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                                    <ArrowLeft size={16} />
                                    Kembali ke Daftar
                                </Link>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-gray-800 font-mono tracking-tight">
                                        {transaction.noSTT}
                                    </h1>
                                    <StatusBadge status={transaction.status} />
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1">
                                <button
                                    onClick={handlePrint}
                                    className="bg-white border border-gray-200 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Printer size={18} />
                                    Invoice
                                </button>
                                <button
                                    onClick={() => setSuratJalanModalOpen(true)}
                                    className="bg-white border border-gray-200 text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Truck size={18} />
                                    Surat Jalan
                                </button>
                                <Link href={`/transactions/${transaction.id}/edit`}>
                                    <button className="bg-white border border-gray-200 text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors flex items-center gap-2 whitespace-nowrap">
                                        <Edit2 size={18} />
                                        Edit
                                    </button>
                                </Link>
                                <button
                                    onClick={() => setDeleteConfirm(true)}
                                    className="bg-white border border-gray-200 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="container mx-auto max-w-5xl px-4 py-8">
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Main Info Column */}
                        <div className="md:col-span-2 space-y-6">
                            {/* Info Dasar */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                                    <FileText size={20} className="text-blue-600" />
                                    Informasi Dasar
                                </h2>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Tanggal</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-medium">
                                            <Calendar size={16} className="text-gray-400" />
                                            {new Date(transaction.tanggal).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Tujuan</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-medium">
                                            <MapPin size={16} className="text-red-400" />
                                            {transaction.tujuan}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl sm:col-span-2 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">No Invoice (Resi)</label>
                                                <div className="font-mono text-gray-800 font-semibold tracking-wide">
                                                    {transaction.noInvoice || '-'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setLinkInvoiceOpen(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                            >
                                                <Link2 size={14} />
                                                {paymentInfo?.linkedInvoice ? 'Ganti Invoice Keuangan' : 'Hubungkan / Buat Invoice'}
                                            </button>
                                        </div>

                                        {/* Connected Finance Invoice Card */}
                                        {paymentInfo?.linkedInvoice ? (
                                            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                paymentInfo.isPaid
                                                    ? 'bg-emerald-50 border-emerald-200'
                                                    : paymentInfo.isOverdue
                                                        ? 'bg-rose-50 border-rose-200'
                                                        : 'bg-amber-50 border-amber-200'
                                            }`}>
                                                <div>
                                                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                                                        Invoice Penagihan Keuangan
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <Link
                                                            href={`/finance/invoices/${paymentInfo.linkedInvoice.id}/print`}
                                                            target="_blank"
                                                            className="font-mono font-bold text-sm text-indigo-700 hover:underline"
                                                        >
                                                            #{paymentInfo.linkedInvoice.invoiceNumber}
                                                        </Link>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            paymentInfo.isPaid
                                                                ? 'bg-emerald-600 text-white'
                                                                : paymentInfo.isOverdue
                                                                    ? 'bg-rose-600 text-white'
                                                                    : 'bg-amber-600 text-white'
                                                        }`}>
                                                            {paymentInfo.isPaid ? 'LUNAS' : paymentInfo.isOverdue ? 'JATUH TEMPO' : 'BELUM LUNAS'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        {paymentInfo.isPaid
                                                            ? `Dilunasi${paymentInfo.paymentMethod ? ` via ${paymentInfo.paymentMethod}` : ''}${paymentInfo.paidAt ? ` pada ${new Date(paymentInfo.paidAt).toLocaleDateString('id-ID')}` : ''}`
                                                            : `Jatuh tempo: ${new Date(paymentInfo.linkedInvoice.dueDate).toLocaleDateString('id-ID')}`}
                                                    </div>
                                                </div>
                                                <Link
                                                    href={`/finance/invoices/${paymentInfo.linkedInvoice.id}/print`}
                                                    target="_blank"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 self-start sm:self-center"
                                                >
                                                    <Printer size={13} /> Cetak Invoice
                                                </Link>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-500 bg-white px-3 py-2 rounded-lg border border-dashed border-gray-300">
                                                Resi ini belum dihubungkan ke Invoice Konsolidasi di Modul Keuangan.
                                            </div>
                                        )}

                                        {transaction.isTaxable && (
                                            <div className="bg-blue-50 p-3 rounded-xl sm:col-span-2 border border-blue-100 flex items-center justify-between">
                                                <div>
                                                    <label className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1 block">Status Pajak</label>
                                                    <div className="font-bold text-blue-800 flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                        PKP ({(transaction.ppnRate || 0.011) * 100}%)
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-blue-500 font-medium">Nilai PPN</div>
                                                    <div className="font-bold text-blue-700">{formatRupiah(transaction.ppn || 0)}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Pengirim & Penerima */}
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <div className="grid md:grid-cols-2 gap-8">
                                        {/* Pengirim */}
                                        <div className="relative">
                                            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-transparent rounded-full opacity-30"></div>
                                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <User size={16} className="text-blue-500" />
                                                Pengirim
                                            </h3>
                                            <div className="space-y-1">
                                                <p className="text-lg font-bold text-gray-800">{transaction.pengirimName}</p>
                                                {transaction.pengirimPhone && (
                                                    <p className="text-sm text-gray-500">{transaction.pengirimPhone}</p>
                                                )}
                                                {transaction.pengirimAddress && (
                                                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{transaction.pengirimAddress}</p>
                                                )}
                                                {transaction.pengirimCity && (
                                                    <span className="inline-block mt-2 text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded">
                                                        {transaction.pengirimCity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Penerima */}
                                        <div className="relative">
                                            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-green-400 to-transparent rounded-full opacity-30"></div>
                                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <User size={16} className="text-green-500" />
                                                Penerima
                                            </h3>
                                            <div className="space-y-1">
                                                <p className="text-lg font-bold text-gray-800">{transaction.penerimaName}</p>
                                                {transaction.penerimaPhone && (
                                                    <p className="text-sm text-gray-500">{transaction.penerimaPhone}</p>
                                                )}
                                                {transaction.penerimaAddress && (
                                                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{transaction.penerimaAddress}</p>
                                                )}
                                                {transaction.penerimaCity && (
                                                    <span className="inline-block mt-2 text-xs font-semibold bg-green-50 text-green-600 px-2 py-1 rounded">
                                                        {transaction.penerimaCity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Timeline */}
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <Clock size={20} className="text-orange-500" />
                                        Riwayat Status
                                    </h2>
                                    <div className="space-y-6 pl-2">
                                        {transaction.statusHistory.map((entry, index) => (
                                            <div key={index} className="relative flex gap-4">
                                                {/* Timeline Line */}
                                                {index < transaction.statusHistory.length - 1 && (
                                                    <div className="absolute left-[7px] top-6 bottom-[-24px] w-0.5 bg-gray-100"></div>
                                                )}

                                                <div className={`relative z-10 w-4 h-4 rounded-full mt-1 flex-shrink-0 ${index === 0
                                                    ? 'bg-blue-500 ring-4 ring-blue-100'
                                                    : 'bg-gray-300'
                                                    }`}></div>

                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <StatusBadge status={entry.status} />
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(entry.timestamp).toLocaleString('id-ID', {
                                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    {entry.catatan && (
                                                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg mt-2 italic border border-gray-100">
                                                            "{entry.catatan}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Column */}
                            <div className="space-y-6">
                                {/* Summary Card */}
                                <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
                                    <h3 className="text-blue-100 text-sm font-semibold uppercase tracking-wider mb-1">Total Biaya</h3>
                                    <div className="text-3xl font-bold mb-1">{formatRupiah(transaction.jumlah + (transaction.ppn || 0))}</div>
                                    {transaction.ppn && transaction.ppn > 0 ? (
                                        <div className="mb-4 text-xs text-blue-200">
                                            (DPP: {formatRupiah(transaction.jumlah)} + PPN: {formatRupiah(transaction.ppn)})
                                        </div>
                                    ) : (
                                        <div className="mb-4"></div>
                                    )}

                                    <div className="space-y-3 pt-4 border-t border-white/10">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-blue-100">Tipe</span>
                                            <span className="font-semibold px-2 py-0.5 bg-white/10 rounded capitalize">{transaction.tipeTransaksi}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-blue-100">Pembayaran</span>
                                            <span className="font-semibold">{transaction.pembayaran}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-blue-100">Status Bayar</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                paymentInfo?.isPaid
                                                    ? 'bg-green-400 text-green-900'
                                                    : paymentInfo?.isOverdue
                                                        ? 'bg-rose-400 text-rose-950'
                                                        : 'bg-yellow-400 text-yellow-900'
                                            }`}>
                                                {paymentInfo?.isPaid
                                                    ? `LUNAS${paymentInfo.paymentMethod ? ` (${paymentInfo.paymentMethod})` : ''}`
                                                    : paymentInfo?.state === 'invoiced_unpaid'
                                                        ? 'BELUM LUNAS'
                                                        : transaction.pelunasan.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cargo Details */}
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Package size={20} className="text-purple-600" />
                                        Data Muatan
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                                <div className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Koli</div>
                                                <div className="text-xl font-bold text-gray-800">{transaction.koli}</div>
                                            </div>
                                            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                                <div className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Berat</div>
                                                <div className="text-xl font-bold text-gray-800">{transaction.berat} <span className="text-sm text-gray-500 font-normal">{transaction.beratUnit}</span></div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Isi Barang</label>
                                            <p className="text-gray-800 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100 min-h-[60px]">
                                                {transaction.isiBarang || '-'}
                                            </p>
                                        </div>

                                        {transaction.keterangan && (
                                            <div>
                                                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Keterangan Tambahan</label>
                                                <p className="text-gray-600 text-sm italic bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                                                    "{transaction.keterangan}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Surat Jalan Modal */}
                    <SuratJalanModal
                        isOpen={suratJalanModalOpen}
                        onClose={() => setSuratJalanModalOpen(false)}
                        onSubmit={handleSuratJalan}
                        transactionId={transaction.id}
                        namaPengirim={transaction.pengirimName}
                        alamatPengirim={transaction.pengirimAddress}
                        namaPenerima={transaction.penerimaName}
                        alamatPenerima={transaction.penerimaAddress}
                    />

                    {/* Delete Confirmation Modal */}
                    {deleteConfirm && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                                    <Trash2 size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Hapus Transaksi?</h3>
                                <p className="text-gray-500 text-center mb-8 text-sm">
                                    Tindakan ini tidak dapat dibatalkan. Data transaksi <span className="font-mono font-bold text-gray-800">{transaction.noSTT}</span> akan hilang selamanya.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeleteConfirm(false)}
                                        className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                                    >
                                        Ya, Hapus
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Link Finance Invoice Modal */}
                    {linkInvoiceOpen && (
                        <LinkInvoiceModal
                            targetTransactions={[transaction]}
                            invoices={invoices}
                            userId={user?.uid || ''}
                            onClose={() => setLinkInvoiceOpen(false)}
                            onSuccess={(msg) => {
                                setLinkInvoiceOpen(false);
                                setToastMsg(msg);
                                setTimeout(() => setToastMsg(null), 5000);
                            }}
                        />
                    )}

                    {toastMsg && (
                        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl font-semibold text-sm flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            <span>{toastMsg}</span>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
