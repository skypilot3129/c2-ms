'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToClients } from '@/lib/firestore';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { subscribeToInvoices, createInvoice } from '@/lib/firestore-invoices';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import { buildInvoiceLookup, resolveTransactionPaymentInfo, getTransactionEffectiveAmount } from '@/lib/invoice-reconciliation';
import type { Client } from '@/types/client';
import type { Transaction } from '@/types/transaction';
import type { Invoice } from '@/types/invoice';
import type { Voyage } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, Search, Ship, Users } from 'lucide-react';
import Link from 'next/link';

const ALL_CLIENT_PLACEHOLDER: Client = {
    id: '__ALL__',
    userId: '',
    name: 'Semua Client (Bebas Pilih STT)',
    address: '-',
    city: 'Semua Kota',
    phone: '-',
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
};

export default function NewInvoicePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState(1);

    // Data
    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [voyages, setVoyages] = useState<Voyage[]>([]);

    // Selection
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [customClientName, setCustomClientName] = useState('');
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Filter Logic
    const [clientSearch, setClientSearch] = useState('');
    const [sttSearch, setSttSearch] = useState('');

    useEffect(() => {
        if (!user) return;

        // Load Clients
        const unsubClients = subscribeToClients((data) => setClients(data), user.uid);

        // Load Transactions (active pending STT)
        const unsubTrans = subscribeToTransactions((data) => {
            setTransactions(data.filter(t => t.pelunasan === 'Pending' && t.status !== 'dibatalkan'));
        }, user.uid);

        // Load existing invoices so we don't double-bill already linked STTs
        const unsubInvoices = subscribeToInvoices(user.uid, (data) => {
            setInvoices(data);
        });

        // Load voyages so Finance can see which ship / voyage each STT belongs to
        const unsubVoyages = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
        });

        return () => {
            unsubClients();
            unsubTrans();
            unsubInvoices();
            unsubVoyages();
        };
    }, [user]);

    const invoiceLookup = useMemo(() => buildInvoiceLookup(invoices), [invoices]);

    const voyageByTxId = useMemo(() => {
        const map = new Map<string, Voyage>();
        voyages.forEach(v => {
            (v.transactionIds || []).forEach(txId => {
                map.set(txId, v);
            });
        });
        return map;
    }, [voyages]);

    // Derived Data
    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

    const unbilledPendingCountByClient = useMemo(() => {
        const counts = new Map<string, number>();
        transactions.forEach(t => {
            const info = resolveTransactionPaymentInfo(t, invoiceLookup);
            if (info.linkedInvoice) return;
            const key = (t.pengirimName || '').trim().toLowerCase();
            if (key) counts.set(key, (counts.get(key) || 0) + 1);
        });
        return counts;
    }, [transactions, invoiceLookup]);

    const clientTransactions = useMemo(() => {
        if (!selectedClient) return [];
        const baseList = selectedClient.id === '__ALL__'
            ? transactions
            : transactions.filter(t =>
                (t.pengirimId && t.pengirimId === selectedClient.id) ||
                (t.pengirimName || '').trim().toLowerCase() === selectedClient.name.trim().toLowerCase()
            );

        if (!sttSearch.trim()) return baseList;
        const q = sttSearch.trim().toLowerCase();
        return baseList.filter(t => {
            const v = voyageByTxId.get(t.id);
            return (
                (t.noSTT || '').toLowerCase().includes(q) ||
                (t.pengirimName || '').toLowerCase().includes(q) ||
                (t.penerimaName || '').toLowerCase().includes(q) ||
                (t.tujuan || '').toLowerCase().includes(q) ||
                (v?.voyageNumber || '').toLowerCase().includes(q) ||
                (v?.shipName || '').toLowerCase().includes(q)
            );
        });
    }, [selectedClient, transactions, sttSearch, voyageByTxId]);

    const selectableClientTransactions = useMemo(() => {
        return clientTransactions.filter(t => !resolveTransactionPaymentInfo(t, invoiceLookup).linkedInvoice);
    }, [clientTransactions, invoiceLookup]);

    const selectedTransactionsList = useMemo(() => {
        return transactions.filter(t => selectedTransactionIds.includes(t.id));
    }, [transactions, selectedTransactionIds]);

    const selectedTotal = useMemo(() => {
        return selectedTransactionsList.reduce((sum, t) => sum + getTransactionEffectiveAmount(t), 0);
    }, [selectedTransactionsList]);

    const resolvedClientName = useMemo(() => {
        if (!selectedClient) return '';
        if (selectedClient.id !== '__ALL__') return selectedClient.name;
        if (customClientName.trim()) return customClientName.trim();
        return selectedTransactionsList[0]?.pengirimName || 'Client Umum';
    }, [selectedClient, customClientName, selectedTransactionsList]);

    const handleToggleSelectAllAvailable = () => {
        const availableIds = selectableClientTransactions.map(t => t.id);
        const allSelected = availableIds.length > 0 && availableIds.every(id => selectedTransactionIds.includes(id));
        if (allSelected) {
            setSelectedTransactionIds(prev => prev.filter(id => !availableIds.includes(id)));
        } else {
            setSelectedTransactionIds(prev => Array.from(new Set([...prev, ...availableIds])));
        }
    };

    const handleSubmit = async () => {
        if (!user || !selectedClient || selectedTransactionIds.length === 0) return;
        setLoading(true);

        try {
            const finalClientId = selectedClient.id === '__ALL__'
                ? (selectedTransactionsList[0]?.pengirimId || 'manual')
                : selectedClient.id;
            const finalClientAddress = selectedClient.id === '__ALL__'
                ? (selectedTransactionsList[0]?.pengirimAddress || '')
                : (selectedClient.address || '');

            await createInvoice({
                clientId: finalClientId,
                clientName: resolvedClientName,
                clientAddress: finalClientAddress,
                transactionIds: selectedTransactionIds,
                totalAmount: selectedTotal,
                issueDate: issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
                dueDate: dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                invoiceNumber: customInvoiceNumber.trim() || undefined,
                isTaxable: selectedTransactionsList.some(t => Boolean(t.isTaxable) || (Number(t.ppn) || 0) > 0),
                notes: notes,
            }, user.uid);

            router.push('/finance/invoices');
        } catch (error) {
            console.error(error);
            alert('Gagal membuat invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/finance/invoices" className="p-2 hover:bg-white rounded-lg transition-colors text-gray-500">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Buat Invoice Baru</h1>
                </div>

                {/* Steps Config */}
                <div className="flex items-center gap-4 mb-8">
                    <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>1</div>
                        Pilih Client
                    </div>
                    <div className="w-12 h-0.5 bg-gray-200"></div>
                    <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>2</div>
                        Pilih Resi
                    </div>
                    <div className="w-12 h-0.5 bg-gray-200"></div>
                    <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>3</div>
                        Konfirmasi
                    </div>
                </div>

                {/* Step 1: Select Client */}
                {step === 1 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <input
                            type="text"
                            placeholder="Cari nama client..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                        />
                        <button
                            onClick={() => {
                                setSelectedClient(ALL_CLIENT_PLACEHOLDER);
                                setSelectedTransactionIds([]);
                                setSttSearch('');
                                setStep(2);
                            }}
                            className="w-full text-left p-4 mb-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-600 text-white">
                                    <Users size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-blue-900">Semua Client / Bebas Pilih Resi STT</h3>
                                    <p className="text-xs text-blue-700">Cari & gabungkan resi pending berdasarkan nomor STT atau Pemberangkatan Kapal</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-blue-600" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                            {filteredClients.map(client => {
                                const pendingCount = unbilledPendingCountByClient.get(client.name.trim().toLowerCase()) || 0;
                                return (
                                    <button
                                        key={client.id}
                                        onClick={() => {
                                            setSelectedClient(client);
                                            setSelectedTransactionIds([]);
                                            setSttSearch('');
                                            setStep(2);
                                        }}
                                        className="text-left p-4 rounded-xl border border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group flex justify-between items-start gap-2"
                                    >
                                        <div>
                                            <h3 className="font-bold text-gray-800 group-hover:text-blue-700">{client.name}</h3>
                                            <p className="text-sm text-gray-500">{client.city || 'Kota tidak ada'}</p>
                                        </div>
                                        {pendingCount > 0 && (
                                            <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                {pendingCount} STT
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Select Transactions */}
                {step === 2 && selectedClient && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">Tagihan Pending: {selectedClient.name}</h3>
                                <p className="text-gray-500 text-sm">Pilih resi STT yang akan ditagihkan ke invoice ini</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Total Terpilih ({selectedTransactionIds.length})</p>
                                <p className="text-xl font-bold text-blue-600">{formatRupiah(selectedTotal)}</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari No. STT, Pengirim, Tujuan, Kapal / Voyage..."
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={sttSearch}
                                    onChange={(e) => setSttSearch(e.target.value)}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleToggleSelectAllAvailable}
                                disabled={selectableClientTransactions.length === 0}
                                className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold disabled:opacity-40 whitespace-nowrap"
                            >
                                Pilih Semua Belum Ber-Invoice ({selectableClientTransactions.length})
                            </button>
                        </div>

                        <div className="space-y-2.5 mb-8 max-h-[420px] overflow-y-auto">
                            {clientTransactions.length === 0 ? (
                                <p className="text-center py-8 text-gray-400">Tidak ada resi pending yang cocok.</p>
                            ) : (
                                clientTransactions.map(tx => {
                                    const paymentInfo = resolveTransactionPaymentInfo(tx, invoiceLookup);
                                    const alreadyInvoiced = Boolean(paymentInfo.linkedInvoice);
                                    const voyage = voyageByTxId.get(tx.id);
                                    const effectiveAmount = getTransactionEffectiveAmount(tx);
                                    return (
                                        <label
                                            key={tx.id}
                                            className={`flex items-center gap-4 p-4 border rounded-xl transition-colors ${
                                                alreadyInvoiced
                                                    ? 'bg-gray-50 border-gray-200 opacity-65 cursor-not-allowed'
                                                    : 'cursor-pointer hover:bg-blue-50/40 border-gray-200'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={alreadyInvoiced}
                                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                                checked={selectedTransactionIds.includes(tx.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedTransactionIds([...selectedTransactionIds, tx.id]);
                                                    } else {
                                                        setSelectedTransactionIds(selectedTransactionIds.filter(id => id !== tx.id));
                                                    }
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono font-bold text-gray-800">{tx.noSTT}</span>
                                                        {voyage && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                                                                <Ship size={11} />
                                                                {voyage.shipName || voyage.voyageNumber}
                                                            </span>
                                                        )}
                                                        {alreadyInvoiced && paymentInfo.linkedInvoice && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                                                <FileText size={11} />
                                                                Sudah di #{paymentInfo.linkedInvoice.invoiceNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="font-bold text-gray-900 shrink-0">{formatRupiah(effectiveAmount)}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(tx.tanggal).toLocaleDateString('id-ID')} • Pengirim: <strong className="text-gray-700">{tx.pengirimName}</strong> • Tujuan: {tx.tujuan}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setStep(1)}
                                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={selectedTransactionIds.length === 0}
                                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Lanjut <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {step === 3 && selectedClient && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="font-bold text-lg text-gray-800 mb-6">Detail Invoice</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                            {selectedClient.id === '__ALL__' && (
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Nama Client Tertagih</label>
                                    <input
                                        type="text"
                                        placeholder={selectedTransactionsList[0]?.pengirimName || 'Nama PT / Client'}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        value={customClientName}
                                        onChange={(e) => setCustomClientName(e.target.value)}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Nomor Invoice (Opsional)</label>
                                <input
                                    type="text"
                                    placeholder="Kosongkan untuk nomor otomatis"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 font-mono text-sm"
                                    value={customInvoiceNumber}
                                    onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Terbit</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={issueDate}
                                    onChange={(e) => setIssueDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Jatuh Tempo</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Catatan (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Silakan transfer ke BCA..."
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl mb-8">
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-500">Client</span>
                                <span className="font-medium text-gray-800">{resolvedClientName}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-500">Jumlah Resi</span>
                                <span className="font-medium text-gray-800">{selectedTransactionIds.length} item</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                                <span className="font-bold text-gray-800">Total Tagihan</span>
                                <span className="font-bold text-blue-600 text-lg">{formatRupiah(selectedTotal)}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setStep(2)}
                                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-8 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? 'Memproses...' : 'Buat Invoice'}
                                {!loading && <CheckCircle2 size={18} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
