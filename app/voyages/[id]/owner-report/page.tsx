'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import OwnerVoyageReportView from '@/components/OwnerVoyageReportView';
import LinkInvoiceModal from '@/components/LinkInvoiceModal';
import { getVoyageById, subscribeToVoyages } from '@/lib/firestore-voyages';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { subscribeToInvoices, unlinkTransactionFromInvoice } from '@/lib/firestore-invoices';
import { subscribeToExpensesByVoyage } from '@/lib/firestore-expenses';
import { subscribeToOwnerShipExpenses, saveOwnerShipExpense } from '@/lib/firestore-owner-ship-expenses';
import type { Voyage, Expense } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import type { Invoice } from '@/types/invoice';
import type { OwnerShipExpense } from '@/types/owner-ship-report';
import { formatRupiah } from '@/lib/currency';
import {
    ArrowLeft, CheckCircle2, DollarSign, Save, Settings2, TrendingUp, X
} from 'lucide-react';

export default function VoyageOwnerReportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();

    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [ownerShipExpense, setOwnerShipExpense] = useState<OwnerShipExpense | null>(null);
    const [loading, setLoading] = useState(true);

    // Inline Modals
    const [linkModalTransactions, setLinkModalTransactions] = useState<Transaction[] | null>(null);
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
    const [formPenjualanMakassar, setFormPenjualanMakassar] = useState<number>(0);
    const [formTiket, setFormTiket] = useState<number>(0);
    const [formTiketMakassar, setFormTiketMakassar] = useState<number>(0);
    const [formOpsMakassar, setFormOpsMakassar] = useState<number>(0);
    const [formOpsSurabaya, setFormOpsSurabaya] = useState<number>(0);
    const [formGajiSopir, setFormGajiSopir] = useState<number>(0);
    const [formSewaMobil, setFormSewaMobil] = useState<number>(0);
    const [formOpsTambahan, setFormOpsTambahan] = useState<number>(0);
    const [formCostNotes, setFormCostNotes] = useState<string>('');
    const [savingCost, setSavingCost] = useState(false);

    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    useEffect(() => {
        if (!user) return;
        let isMounted = true;

        getVoyageById(id).then((v) => {
            if (!isMounted) return;
            if (!v) {
                alert('Pemberangkatan tidak ditemukan');
                router.push('/voyages');
                return;
            }
            setVoyage(v);
            setLoading(false);
        }).catch((err) => {
            console.error('Error loading initial voyage:', err);
            if (isMounted) setLoading(false);
        });

        const unsubVoyages = subscribeToVoyages(user.uid, (list) => {
            if (!isMounted) return;
            const found = list.find(v => v.id === id);
            if (found) {
                setVoyage(found);
                setLoading(false);
            }
        });

        const unsubTx = subscribeToTransactions((txList) => {
            if (!isMounted) return;
            setAllTransactions(txList);
        }, user.uid);

        const unsubInvoices = subscribeToInvoices(user.uid, (invList) => {
            if (!isMounted) return;
            setInvoices(invList);
        });

        return () => {
            isMounted = false;
            unsubVoyages();
            unsubTx();
            unsubInvoices();
        };
    }, [id, user, router]);

    useEffect(() => {
        if (!voyage || !user) return;
        const unsubExp = subscribeToExpensesByVoyage(voyage.id, user.uid, (data) => {
            setExpenses(data);
        });
        const unsubShip = subscribeToOwnerShipExpenses((list) => {
            const match = list.find(e => e.voyageId === voyage.id) || null;
            setOwnerShipExpense(match);
            if (match) {
                setFormPenjualanMakassar(match.penjualanMakassar || 0);
                setFormTiket(match.tiket || 0);
                setFormTiketMakassar(match.tiketMakassar || 0);
                setFormOpsMakassar(match.opsMakassar || 0);
                setFormOpsSurabaya(match.opsSurabaya || 0);
                setFormGajiSopir(match.gajiSopir || 0);
                setFormSewaMobil(match.sewaMobil || 0);
                setFormOpsTambahan(match.opsTambahan || 0);
                setFormCostNotes(match.notes || '');
            } else {
                setFormPenjualanMakassar(0);
                setFormTiket(0);
                setFormTiketMakassar(0);
                setFormOpsMakassar(0);
                setFormOpsSurabaya(0);
                setFormGajiSopir(0);
                setFormSewaMobil(0);
                setFormOpsTambahan(0);
                setFormCostNotes('');
            }
        });
        return () => {
            unsubExp();
            unsubShip();
        };
    }, [voyage, user]);

    const voyageTransactions = useMemo(() => {
        if (!voyage) return [];
        const txMap = new Map(allTransactions.map(t => [t.id, t]));
        return (voyage.transactionIds || [])
            .map(txId => txMap.get(txId))
            .filter((t): t is Transaction => t !== undefined && t.status !== 'dibatalkan');
    }, [voyage, allTransactions]);

    const omzetStt = useMemo(() => {
        return voyageTransactions.reduce((sum, tx) => {
            const subtotal = Number(tx.jumlah) || 0;
            const ppn = tx.isTaxable || (tx.ppn && Number(tx.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
            return sum + subtotal + ppn;
        }, 0);
    }, [voyageTransactions]);

    const handleUnlinkInvoice = async (invoiceId: string, invoiceNumber: string, txId: string, noSTT: string) => {
        if (!confirm(`Lepas hubungan STT ${noSTT} dari Invoice #${invoiceNumber}?`)) return;
        try {
            await unlinkTransactionFromInvoice(invoiceId, txId);
            showToast(`STT ${noSTT} dilepas dari Invoice #${invoiceNumber}.`);
        } catch (err: any) {
            console.error('Failed to unlink invoice:', err);
            alert('Gagal melepas tautan invoice: ' + (err?.message || ''));
        }
    };

    const handleSaveCost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!voyage || !user) return;
        setSavingCost(true);
        try {
            const depDateStr = voyage.departureDate instanceof Date
                ? voyage.departureDate.toISOString().split('T')[0]
                : '';

            await saveOwnerShipExpense({
                voyageId: voyage.id,
                voyageNumber: voyage.voyageNumber,
                shipName: voyage.shipName || '',
                departureDate: depDateStr,
                route: voyage.route || '',
                penjualanMakassar: Number(formPenjualanMakassar) || 0,
                tiket: Number(formTiket) || 0,
                tiketMakassar: Number(formTiketMakassar) || 0,
                opsMakassar: Number(formOpsMakassar) || 0,
                opsSurabaya: Number(formOpsSurabaya) || 0,
                gajiSopir: Number(formGajiSopir) || 0,
                sewaMobil: Number(formSewaMobil) || 0,
                opsTambahan: Number(formOpsTambahan) || 0,
                notes: formCostNotes.trim(),
            }, user.uid, user.displayName || user.email || 'Owner');

            showToast('Biaya operasional kapal berhasil diperbarui!');
            setIsCostModalOpen(false);
        } catch (err: any) {
            console.error('Error saving ship costs:', err);
            alert('Gagal menyimpan biaya kapal: ' + (err?.message || ''));
        } finally {
            setSavingCost(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-[70vh]">
                    <div className="text-center space-y-3">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-gray-500 font-semibold text-xs">Menyiapkan Laporan Detail Owner...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!voyage) return null;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-100/70 pb-24 font-sans">
                {toastMessage && (
                    <div className="fixed bottom-5 right-4 left-4 sm:left-auto sm:max-w-sm z-50 bg-gray-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-gray-700 text-xs font-semibold">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* Compact Mobile-First Sticky Header */}
                <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
                    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <Link
                                href="/voyages"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 shrink-0"
                                title="Kembali ke Pemberangkatan"
                            >
                                <ArrowLeft size={16} />
                            </Link>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                                        Laporan Owner
                                    </span>
                                    <span className="font-mono text-[10.5px] font-bold text-gray-500 truncate">
                                        {voyage.voyageNumber}
                                    </span>
                                </div>
                                <h1 className="font-black text-xs sm:text-sm text-gray-900 truncate">
                                    {voyage.shipName || voyage.route}
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsCostModalOpen(true)}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-[11px] font-bold flex items-center gap-1"
                            >
                                <DollarSign size={13} />
                                <span>Biaya</span>
                            </button>
                            <Link
                                href={`/voyages/${voyage.id}`}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold flex items-center gap-1"
                            >
                                <Settings2 size={13} />
                                <span>Kelola</span>
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4">
                    <OwnerVoyageReportView
                        voyage={voyage}
                        transactions={voyageTransactions}
                        invoices={invoices}
                        ownerShipExpense={ownerShipExpense}
                        expenses={expenses}
                        onEditCosts={() => setIsCostModalOpen(true)}
                        onLinkTransactions={(txList) => setLinkModalTransactions(txList)}
                        onUnlinkInvoice={handleUnlinkInvoice}
                        onNotify={showToast}
                        showPrintButton={true}
                    />
                </main>

                {/* Modal Input / Edit Biaya Kapal */}
                {isCostModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
                            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70 shrink-0">
                                <div>
                                    <span className="font-mono text-[10.5px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                        {voyage.voyageNumber}
                                    </span>
                                    <h3 className="font-black text-gray-900 text-sm sm:text-base mt-1 flex items-center gap-1.5">
                                        <DollarSign size={18} className="text-emerald-600" />
                                        Edit Biaya: {voyage.shipName || 'Trip Kapal'}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setIsCostModalOpen(false)}
                                    className="p-1.5 hover:bg-gray-200/80 rounded-full text-gray-400"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveCost} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
                                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                                    <label className="font-extrabold text-emerald-950 block mb-1 flex items-center justify-between">
                                        <span className="flex items-center gap-1"><TrendingUp size={13} /> Penjualan Makassar (Rp)</span>
                                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Penambah Omzet</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formPenjualanMakassar || ''}
                                        onChange={(e) => setFormPenjualanMakassar(Number(e.target.value))}
                                        placeholder="Rp 0"
                                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-300"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Tiket Kapal / SBY (Rp)</label>
                                        <input
                                            type="number"
                                            value={formTiket || ''}
                                            onChange={(e) => setFormTiket(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Tiket Makassar (Rp)</label>
                                        <input
                                            type="number"
                                            value={formTiketMakassar || ''}
                                            onChange={(e) => setFormTiketMakassar(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Operasional Makassar (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsMakassar || ''}
                                            onChange={(e) => setFormOpsMakassar(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Operasional Surabaya (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsSurabaya || ''}
                                            onChange={(e) => setFormOpsSurabaya(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Gaji Sopir (Rp)</label>
                                        <input
                                            type="number"
                                            value={formGajiSopir || ''}
                                            onChange={(e) => setFormGajiSopir(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Sewa Mobil (Rp)</label>
                                        <input
                                            type="number"
                                            value={formSewaMobil || ''}
                                            onChange={(e) => setFormSewaMobil(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="font-extrabold text-gray-800 block mb-1">Operasional Tambahan (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsTambahan || ''}
                                            onChange={(e) => setFormOpsTambahan(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Catatan</label>
                                    <textarea
                                        rows={2}
                                        value={formCostNotes}
                                        onChange={(e) => setFormCostNotes(e.target.value)}
                                        placeholder="Catatan tambahan..."
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800"
                                    />
                                </div>

                                {(() => {
                                    const totalRevCalc = omzetStt + (Number(formPenjualanMakassar) || 0);
                                    const totalCostCalc = formTiket + formTiketMakassar + formOpsMakassar + formOpsSurabaya + formGajiSopir + formSewaMobil + formOpsTambahan;
                                    const netProfitCalc = totalRevCalc - totalCostCalc;
                                    return (
                                        <div className="bg-slate-900 text-white p-3 rounded-xl flex justify-between items-center font-bold">
                                            <span>Estimasi Laba Bersih:</span>
                                            <span className={`font-mono text-sm ${netProfitCalc >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatRupiah(netProfitCalc)}
                                            </span>
                                        </div>
                                    );
                                })()}

                                <div className="flex items-center gap-2.5 pt-2 sticky bottom-0 bg-white">
                                    <button
                                        type="button"
                                        onClick={() => setIsCostModalOpen(false)}
                                        className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingCost}
                                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Save size={14} />
                                        {savingCost ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {linkModalTransactions && linkModalTransactions.length > 0 && user && (
                    <LinkInvoiceModal
                        targetTransactions={linkModalTransactions}
                        invoices={invoices}
                        userId={user.uid}
                        onClose={() => setLinkModalTransactions(null)}
                        onSuccess={(msg) => {
                            setLinkModalTransactions(null);
                            showToast(msg);
                        }}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}

