'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToClients } from '@/lib/firestore';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { createInvoice } from '@/lib/firestore-invoices';
import type { Client } from '@/types/client';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { ArrowLeft, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';

export default function NewInvoicePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState(1);

    // Data
    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Selection
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Filter Logic
    const [clientSearch, setClientSearch] = useState('');

    useEffect(() => {
        if (!user) return;

        // Load Clients
        const unsubClients = subscribeToClients((data) => setClients(data), user.uid);

        // Load Transactions (Optimized: we could filter by client here if needed, but client-side filter is fine for MVP size)
        const unsubTrans = subscribeToTransactions((data) => {
            // Only Pending transactions
            setTransactions(data.filter(t => t.pelunasan === 'Pending'));
        }, user.uid);

        return () => {
            unsubClients();
            unsubTrans();
        };
    }, [user]);

    // Derived Data
    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

    const clientTransactions = selectedClient
        ? transactions.filter(t => t.pengirimName === selectedClient.name) // Match by Name (Simplification)
        : [];

    const selectedTotal = clientTransactions
        .filter(t => selectedTransactionIds.includes(t.id))
        .reduce((sum, t) => sum + t.jumlah, 0);

    const handleSubmit = async () => {
        if (!user || !selectedClient) return;
        setLoading(true);

        try {
            const invoiceId = await createInvoice({
                clientId: selectedClient.id,
                clientName: selectedClient.name,
                clientAddress: selectedClient.address,
                transactionIds: selectedTransactionIds,
                totalAmount: selectedTotal,
                issueDate: new Date().toISOString(),
                dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                            {filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => {
                                        setSelectedClient(client);
                                        setStep(2);
                                    }}
                                    className="text-left p-4 rounded-xl border border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                >
                                    <h3 className="font-bold text-gray-800 group-hover:text-blue-700">{client.name}</h3>
                                    <p className="text-sm text-gray-500">{client.city || 'Kota tidak ada'}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Select Transactions */}
                {step === 2 && selectedClient && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">Tagihan Pending: {selectedClient.name}</h3>
                                <p className="text-gray-500 text-sm">Pilih resi yang akan ditagihkan</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Total Terpilih</p>
                                <p className="text-xl font-bold text-blue-600">{formatRupiah(selectedTotal)}</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-8 max-h-[400px] overflow-y-auto">
                            {clientTransactions.length === 0 ? (
                                <p className="text-center py-8 text-gray-400">Tidak ada resi pending untuk client ini.</p>
                            ) : (
                                clientTransactions.map(tx => (
                                    <label key={tx.id} className="flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedTransactionIds.includes(tx.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedTransactionIds([...selectedTransactionIds, tx.id]);
                                                } else {
                                                    setSelectedTransactionIds(selectedTransactionIds.filter(id => id !== tx.id));
                                                }
                                            }}
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <span className="font-mono font-medium text-gray-700">{tx.noSTT}</span>
                                                <span className="font-bold text-gray-800">{formatRupiah(tx.jumlah)}</span>
                                            </div>
                                            <p className="text-sm text-gray-500">{new Date(tx.tanggal).toLocaleDateString('id-ID')} • {tx.tujuan}</p>
                                        </div>
                                    </label>
                                ))
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

                        <div className="grid grid-cols-2 gap-6 mb-6">
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
                                <span className="font-medium text-gray-800">{selectedClient.name}</span>
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
