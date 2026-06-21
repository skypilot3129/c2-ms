'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';

interface ManualRow {
    id: string;
    invoiceNumber: string;
    issueDate: Date;
    noSTT?: string;
    totalAmount: number;
}

function PrintRekapContent() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [sttNumbers, setSttNumbers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<string>('');

    // State for manual invoice addition
    const [manualRows, setManualRows] = useState<ManualRow[]>([]);
    const [formNoInv, setFormNoInv] = useState('');
    const [formTglInv, setFormTglInv] = useState('');
    const [formNoSTT, setFormNoSTT] = useState('');
    const [formTotalTagihan, setFormTotalTagihan] = useState('');

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToInvoices(user.uid, (data) => {
            const unpaidInvoices = data.filter(inv => inv.status !== 'Paid');
            unpaidInvoices.sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
            
            setInvoices(unpaidInvoices);
            if (loading) {
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

    // Reset manual rows when selected customer changes
    useEffect(() => {
        setManualRows([]);
    }, [selectedClient]);

    const clients = useMemo(() => {
        const uniqueClients = new Set(invoices.map(inv => inv.clientName));
        return Array.from(uniqueClients).sort();
    }, [invoices]);

    const clientInvoices = useMemo(() => {
        if (!selectedClient) return [];
        return invoices.filter(inv => inv.clientName === selectedClient);
    }, [invoices, selectedClient]);

    // Combine standard invoices and manual rows
    const combinedInvoices = useMemo(() => {
        const standardInvoices = clientInvoices.map(inv => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            issueDate: new Date(inv.issueDate),
            noSTT: sttNumbers[inv.id] || '-',
            totalAmount: inv.totalAmount,
            isManual: false
        }));

        const customInvoices = manualRows.map(row => ({
            id: row.id,
            invoiceNumber: row.invoiceNumber,
            issueDate: new Date(row.issueDate),
            noSTT: row.noSTT || '-',
            totalAmount: row.totalAmount,
            isManual: true
        }));

        return [...standardInvoices, ...customInvoices];
    }, [clientInvoices, manualRows, sttNumbers]);

    const totalAmount = useMemo(() => {
        return combinedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    }, [combinedInvoices]);

    const handleAddManualRow = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formNoInv || !formTglInv || !formTotalTagihan) return;

        const newRow: ManualRow = {
            id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            invoiceNumber: formNoInv,
            issueDate: new Date(formTglInv),
            noSTT: formNoSTT,
            totalAmount: parseFloat(formTotalTagihan)
        };

        setManualRows([...manualRows, newRow]);

        // Reset form
        setFormNoInv('');
        setFormTglInv('');
        setFormNoSTT('');
        setFormTotalTagihan('');
    };

    const removeManualRow = (id: string) => {
        setManualRows(manualRows.filter(row => row.id !== id));
    };

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Memuat data rekap...</div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .a4-page { box-shadow: none !important; margin: 0 !important; }
                }
                .invoice-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
                .invoice-table th, .invoice-table td { border: 1px solid #000; padding: 4px 6px; }
                .invoice-table th { font-weight: bold; text-align: center; background: #fff; }
            `}} />

            {/* Print & Selection Controls (Hidden in Print) */}
            <div className="no-print bg-white p-6 shadow-sm mb-6 border-b border-gray-200 sticky top-0 z-50">
                <div className="flex flex-wrap gap-6 items-end justify-between">
                    <div className="flex-1 min-w-[300px]">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Customer untuk Direkap:</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700"
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                        >
                            <option value="">-- Pilih Customer --</option>
                            {clients.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => window.print()}
                            disabled={!selectedClient || combinedInvoices.length === 0}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            🖨️ Cetak Rekap
                        </button>
                        <button 
                            onClick={() => window.close()}
                            className="bg-gray-500 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                        >
                            ✕ Tutup
                        </button>
                    </div>
                </div>

                {/* Manual row addition form (shows only when a client is selected) */}
                {selectedClient && (
                    <div className="mt-6 pt-6 border-t border-gray-150">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Tambah Data Tagihan Manual (Sementara/Kustom)</h4>
                        <form onSubmit={handleAddManualRow} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                            <div>
                                <label className="block text-xs font-semibold text-gray-650 mb-1">No. Invoice:</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: INV/2026/001"
                                    value={formNoInv}
                                    onChange={(e) => setFormNoInv(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:border-blue-500 text-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-650 mb-1">Tanggal Invoice:</label>
                                <input
                                    type="date"
                                    required
                                    value={formTglInv}
                                    onChange={(e) => setFormTglInv(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:border-blue-500 text-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-650 mb-1">Nomor STT (Opsional):</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: 12345, 12346"
                                    value={formNoSTT}
                                    onChange={(e) => setFormNoSTT(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:border-blue-500 text-gray-700"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-650 mb-1">Total Tagihan (Rp):</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        placeholder="Contoh: 1500000"
                                        value={formTotalTagihan}
                                        onChange={(e) => setFormTotalTagihan(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:border-blue-500 font-mono font-bold text-gray-700"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg active:scale-95 transition-all h-[36px]"
                                >
                                    + Tambah
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* A4 Document Area */}
            {selectedClient && combinedInvoices.length > 0 ? (
                <div className="a4-page bg-white mx-auto shadow-xl" style={{ width: '210mm', minHeight: '297mm', padding: '10mm 15mm' }}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
                        <div className="flex items-center gap-4">
                            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain" />
                            <div>
                                <h1 className="font-black text-xl tracking-wide">{COMPANY_INFO.name}</h1>
                                <p className="text-xs mt-1 text-gray-800">{COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                                <p className="text-xs text-gray-800">Telp: {COMPANY_INFO.phone}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-black tracking-widest text-gray-800">REKAPITULASI</h2>
                            <p className="text-sm font-bold mt-1 text-gray-600">TAGIHAN PELANGGAN</p>
                        </div>
                    </div>

                    {/* Meta Info */}
                    <div className="flex justify-between mb-6 text-sm">
                        <div>
                            <p className="text-gray-600 mb-1">Kepada Yth,</p>
                            <p className="font-bold text-lg uppercase">{selectedClient}</p>
                            <p className="font-medium text-gray-800">{clientInvoices[0]?.clientAddress || ''}</p>
                        </div>
                        <div className="text-right">
                            <table className="inline-table text-left text-sm">
                                <tbody>
                                    <tr>
                                        <td className="pr-4 text-gray-600">Tanggal Cetak</td>
                                        <td>:</td>
                                        <td className="font-bold pl-2">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-4 text-gray-600">Total Invoice</td>
                                        <td>:</td>
                                        <td className="font-bold pl-2">{combinedInvoices.length} Dokumen</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="invoice-table mb-6">
                        <thead>
                            <tr className="bg-gray-50">
                                <th style={{ width: '5%' }}>NO</th>
                                <th style={{ width: '20%' }}>NO. INVOICE</th>
                                <th style={{ width: '15%' }}>TGL INVOICE</th>
                                <th style={{ width: '40%' }}>NOMOR STT</th>
                                <th style={{ width: '20%' }}>TOTAL TAGIHAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {combinedInvoices.map((inv, idx) => (
                                <tr key={inv.id}>
                                    <td className="text-center">{idx + 1}</td>
                                    <td className="font-mono font-bold text-center">{inv.invoiceNumber}</td>
                                    <td className="text-center">{inv.issueDate.toLocaleDateString('id-ID')}</td>
                                    <td className="font-mono text-xs max-w-[200px] break-words">
                                        <div className="flex justify-between items-center">
                                            <span>{inv.noSTT}</span>
                                            {inv.isManual && (
                                                <button
                                                    onClick={() => removeManualRow(inv.id)}
                                                    className="no-print text-red-650 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-[8px] font-bold transition-all active:scale-95 cursor-pointer ml-2"
                                                    title="Hapus baris manual ini"
                                                >
                                                    Hapus
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-right font-bold pr-2">{formatRupiah(inv.totalAmount)}</td>
                                </tr>
                            ))}
                            {/* Empty padding rows to make it look formal */}
                            {combinedInvoices.length < 5 && Array.from({ length: 5 - combinedInvoices.length }).map((_, i) => (
                                <tr key={`empty-${i}`} style={{ height: '8mm' }}>
                                    <td></td><td></td><td></td><td></td><td></td>
                                </tr>
                            ))}
                            {/* Grand Total */}
                            <tr className="border-t-2 border-black">
                                <td colSpan={4} className="text-right font-black italic pr-4 py-3 bg-gray-50">
                                    GRAND TOTAL :
                                </td>
                                <td className="text-right font-black text-lg pr-2 py-3 bg-gray-50">
                                    {formatRupiah(totalAmount)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Terbilang */}
                    <div className="bg-gray-50 p-3 border border-gray-300 rounded mb-8 font-mono text-sm italic">
                        <span className="font-bold mr-2 not-italic">Terbilang:</span> 
                        # {terbilang(totalAmount)} #
                    </div>

                    {/* Footer / Signature */}
                    <div className="flex justify-between items-end text-sm">
                        <div className="leading-relaxed">
                            <p className="font-bold underline mb-1">PEMBAYARAN DITRANSFER KE :</p>
                            {COMPANY_INFO.bankAccounts.map((acc, i) => (
                                <p key={i} className="font-bold">
                                    {acc.bank} {acc.accountNumber} a/n {acc.accountName}
                                </p>
                            ))}
                            <p className="mt-4 text-xs italic text-gray-500">
                                * Mohon cantumkan nama perusahaan saat melakukan transfer.
                            </p>
                        </div>
                        <div className="text-center w-48">
                            <div className="h-28 mt-4">
                                <img src="/ttd.png" alt="Tanda Tangan & Stempel" className="w-full h-full object-contain" />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center text-gray-500 pt-20 no-print">
                    <p className="text-lg">Pilih customer di atas untuk melihat dan mencetak Rekapitulasi Tagihan.</p>
                </div>
            )}
        </div>
    );
}

export default function PrintRekapPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center font-medium text-gray-500">Loading...</div>}>
            <PrintRekapContent />
        </Suspense>
    );
}
