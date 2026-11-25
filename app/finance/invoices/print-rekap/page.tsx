'use client';

import React, { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { formatRupiah, terbilang } from '@/lib/currency';
import { resolveInvoiceClientIdentity } from '@/lib/invoice-reconciliation';
import { COMPANY_INFO } from '@/lib/company-config';
import { toPng } from 'html-to-image';

interface ManualRow {
    id: string;
    invoiceNumber: string;
    issueDate: Date;
    noSTT?: string;
    totalAmount: number;
}

function invoiceNumberMatchesToken(invoiceNumber: string, token: string): boolean {
    const invUpper = invoiceNumber.trim().toUpperCase();
    const tokUpper = token.trim().toUpperCase();
    if (!invUpper || !tokUpper) return false;
    if (invUpper === tokUpper) return true;
    const invDigits = invUpper.replace(/\D/g, '');
    const tokDigits = tokUpper.replace(/\D/g, '');
    return Boolean(tokDigits && invDigits && invDigits === tokDigits);
}

function PrintRekapContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const rekapRef = useRef<HTMLDivElement>(null);

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'unpaid' | 'all'>('unpaid');
    const [recipientName, setRecipientName] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [urlPreselectApplied, setUrlPreselectApplied] = useState(false);
    const [downloadingPng, setDownloadingPng] = useState(false);

    // State for manual invoice addition
    const [manualRows, setManualRows] = useState<ManualRow[]>([]);
    const [formNoInv, setFormNoInv] = useState('');
    const [formTglInv, setFormTglInv] = useState('');
    const [formNoSTT, setFormNoSTT] = useState('');
    const [formTotalTagihan, setFormTotalTagihan] = useState('');

    useEffect(() => {
        if (!user) return;

        const unsubscribeInvoices = subscribeToInvoices(user.uid, (data) => {
            const active = data.filter((inv) => inv.status !== 'Cancelled');
            active.sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
            setInvoices(active);
            setLoading(false);
        });

        const unsubscribeTx = subscribeToTransactions((txData) => {
            setTransactions(txData);
        }, user.uid);

        return () => {
            unsubscribeInvoices();
            unsubscribeTx();
        };
    }, [user]);

    // Live reconciliation of invoice details (clientName, totalAmount, sttNumbers, isTaxable)
    const { liveInvoices, sttNumbers } = useMemo(() => {
        const txMap = new Map(transactions.map((t) => [t.id, t]));
        const mapping: Record<string, string> = {};

        const processed = invoices.map((inv) => {
            if (!inv.transactionIds || inv.transactionIds.length === 0) return inv;
            const linked = inv.transactionIds
                .map((tid) => txMap.get(tid))
                .filter((t): t is Transaction => t !== undefined && t.status !== 'dibatalkan');
            if (linked.length === 0) return inv;

            mapping[inv.id] = linked.map((t) => t.noSTT.replace(/^STT/i, '')).join(', ');

            const resolvedIdentity = resolveInvoiceClientIdentity(inv, linked);
            const liveClientName = resolvedIdentity.clientName;
            const subtotal = linked.reduce((sum, t) => sum + (t.jumlah || 0), 0);
            const isTaxable = Boolean(inv.isTaxable) || linked.some((t) => t.isTaxable || (t.ppn && t.ppn > 0));
            const liveTotalAmount = subtotal + (isTaxable ? Math.round(subtotal * 0.011) : 0);

            return {
                ...inv,
                clientName: liveClientName,
                clientAddress: resolvedIdentity.clientAddress || inv.clientAddress,
                totalAmount: liveTotalAmount,
                isTaxable,
            };
        });

        return { liveInvoices: processed, sttNumbers: mapping };
    }, [invoices, transactions]);

    // Optional deep-link pre-selection: ?invoices=13828,13829
    useEffect(() => {
        if (loading || urlPreselectApplied || liveInvoices.length === 0) return;
        const param = searchParams.get('invoices') || '';
        const tokens = param
            .split(/[,;\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (tokens.length === 0) {
            setUrlPreselectApplied(true);
            return;
        }
        const matchedIds = new Set<string>();
        const matchedClients = new Set<string>();
        let firstAddr = '';
        for (const inv of liveInvoices) {
            if (tokens.some((tok) => invoiceNumberMatchesToken(inv.invoiceNumber, tok))) {
                matchedIds.add(inv.id);
                if (inv.clientName) matchedClients.add(inv.clientName);
                if (!firstAddr && inv.clientAddress) firstAddr = inv.clientAddress;
            }
        }
        if (matchedIds.size > 0) {
            setStatusFilter('all');
            setSelectedInvoiceIds(matchedIds);
            const unique = Array.from(matchedClients);
            setRecipientName(unique.length === 1 ? unique[0] : unique.slice(0, 3).join(' / '));
            if (unique.length === 1) setRecipientAddress(firstAddr);
        }
        setUrlPreselectApplied(true);
    }, [loading, urlPreselectApplied, liveInvoices, searchParams]);

    const clients = useMemo(() => {
        const unpaidOnly = liveInvoices.filter((inv) => inv.status !== 'Paid');
        const uniqueClients = new Set(unpaidOnly.map((inv) => inv.clientName));
        return Array.from(uniqueClients).sort();
    }, [liveInvoices]);

    const handleSelectClient = (client: string) => {
        setSelectedClient(client);
        setManualRows([]);
        if (!client) {
            setSelectedInvoiceIds(new Set());
            setRecipientName('');
            setRecipientAddress('');
            return;
        }
        const matched = liveInvoices.filter(
            (inv) => inv.status !== 'Paid' && inv.clientName === client
        );
        setSelectedInvoiceIds(new Set(matched.map((inv) => inv.id)));
        setRecipientName(client);
        setRecipientAddress(matched.find((m) => m.clientAddress)?.clientAddress || '');
    };

    const pickerInvoices = useMemo(() => {
        const q = invoiceSearch.trim().toLowerCase();
        return liveInvoices.filter((inv) => {
            if (statusFilter === 'unpaid' && inv.status === 'Paid') return false;
            if (!q) return true;
            const invNo = inv.invoiceNumber.toLowerCase();
            const cli = inv.clientName.toLowerCase();
            const stt = (sttNumbers[inv.id] || '').toLowerCase();
            return invNo.includes(q) || cli.includes(q) || stt.includes(q);
        });
    }, [liveInvoices, statusFilter, invoiceSearch, sttNumbers]);

    const syncDefaultRecipientFromIds = (ids: Set<string>) => {
        if (selectedClient) return;
        const picked = liveInvoices.filter((inv) => ids.has(inv.id));
        const unique = Array.from(new Set(picked.map((p) => p.clientName).filter(Boolean)));
        if (unique.length === 1) {
            setRecipientName(unique[0]);
            setRecipientAddress(picked.find((p) => p.clientAddress)?.clientAddress || '');
        } else if (unique.length > 1) {
            setRecipientName(unique.slice(0, 3).join(' / ') + (unique.length > 3 ? ` (+${unique.length - 3})` : ''));
            setRecipientAddress('');
        } else {
            setRecipientName('');
            setRecipientAddress('');
        }
    };

    const toggleInvoiceId = (id: string) => {
        const next = new Set(selectedInvoiceIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedInvoiceIds(next);
        syncDefaultRecipientFromIds(next);
    };

    const selectAllFiltered = () => {
        const next = new Set(selectedInvoiceIds);
        pickerInvoices.forEach((inv) => next.add(inv.id));
        setSelectedInvoiceIds(next);
        syncDefaultRecipientFromIds(next);
    };

    const clearAllSelected = () => {
        setSelectedClient('');
        setSelectedInvoiceIds(new Set());
        setRecipientName('');
        setRecipientAddress('');
        setManualRows([]);
    };

    const selectedInvoicesList = useMemo(() => {
        return liveInvoices.filter((inv) => selectedInvoiceIds.has(inv.id));
    }, [liveInvoices, selectedInvoiceIds]);

    // Combine chosen invoices and manual rows
    const combinedInvoices = useMemo(() => {
        const standardInvoices = selectedInvoicesList.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            issueDate: new Date(inv.issueDate),
            noSTT: sttNumbers[inv.id] || '-',
            totalAmount: inv.totalAmount,
            isTaxable: Boolean(inv.isTaxable),
            isManual: false,
        }));

        const customInvoices = manualRows.map((row) => ({
            id: row.id,
            invoiceNumber: row.invoiceNumber,
            issueDate: new Date(row.issueDate),
            noSTT: row.noSTT || '-',
            totalAmount: row.totalAmount,
            isTaxable: false,
            isManual: true,
        }));

        return [...standardInvoices, ...customInvoices];
    }, [selectedInvoicesList, manualRows, sttNumbers]);

    const totalAmount = useMemo(() => {
        return combinedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    }, [combinedInvoices]);

    const hasTaxableSelected = useMemo(
        () => combinedInvoices.some((inv) => inv.isTaxable),
        [combinedInvoices]
    );
    const hasNonTaxableSelected = useMemo(
        () => combinedInvoices.some((inv) => !inv.isTaxable),
        [combinedInvoices]
    );

    const displayRecipient =
        recipientName.trim() ||
        selectedClient ||
        (selectedInvoicesList[0]?.clientName || 'PELANGGAN CCE');

    const handleAddManualRow = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formNoInv || !formTglInv || !formTotalTagihan) return;

        const newRow: ManualRow = {
            id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            invoiceNumber: formNoInv,
            issueDate: new Date(formTglInv),
            noSTT: formNoSTT,
            totalAmount: parseFloat(formTotalTagihan),
        };

        setManualRows([...manualRows, newRow]);
        setFormNoInv('');
        setFormTglInv('');
        setFormNoSTT('');
        setFormTotalTagihan('');
    };

    const removeManualRow = (id: string) => {
        setManualRows(manualRows.filter((row) => row.id !== id));
    };

    const handleDownloadPng = async () => {
        if (!rekapRef.current || combinedInvoices.length === 0) return;
        setDownloadingPng(true);
        try {
            const dataUrl = await toPng(rekapRef.current, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                cacheBust: true,
                filter: (node) =>
                    !(node instanceof HTMLElement && node.classList.contains('no-print')),
            });
            const safeClient = displayRecipient
                .replace(/[^a-zA-Z0-9_-]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 32);
            const link = document.createElement('a');
            link.download = `Rekap-Invoice-${safeClient || 'CCE'}-${combinedInvoices.length}Inv.png`;
            link.href = dataUrl;
            link.click();
        } catch (err: any) {
            console.error('Error generating rekap PNG:', err);
            alert(`Gagal membuat gambar PNG: ${err?.message || 'Unknown error'}`);
        } finally {
            setDownloadingPng(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Memuat data rekap...</div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans pb-10">
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .a4-page { box-shadow: none !important; margin: 0 !important; }
                }
                .invoice-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
                .invoice-table th, .invoice-table td { border: 1px solid #000; padding: 4px 6px; }
                .invoice-table th { font-weight: bold; text-align: center; background: #fff; }
            `,
                }}
            />

            {/* Print & Selection Controls (Hidden in Print) */}
            <div className="no-print bg-white p-5 shadow-sm mb-6 border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="flex flex-wrap gap-4 items-end justify-between">
                        <div className="flex-1 min-w-[260px]">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                                Preset Customer (Semua Invoice Unpaid Customer Ini):
                            </label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700"
                                value={selectedClient}
                                onChange={(e) => handleSelectClient(e.target.value)}
                            >
                                <option value="">-- Mode Pilih Nomor Invoice Sendiri / Bebas --</option>
                                {clients.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleDownloadPng}
                                disabled={combinedInvoices.length === 0 || downloadingPng}
                                className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm cursor-pointer"
                            >
                                {downloadingPng ? 'Memproses PNG...' : '🖼️ Unduh Gambar PNG (Siap Kirim WA)'}
                            </button>
                            <button
                                onClick={() => window.print()}
                                disabled={combinedInvoices.length === 0}
                                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm cursor-pointer"
                            >
                                🖨️ Cetak Rekap ({combinedInvoices.length})
                            </button>
                            <button
                                onClick={() => window.close()}
                                className="bg-gray-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-gray-600 transition-colors text-sm cursor-pointer"
                            >
                                ✕ Tutup
                            </button>
                        </div>
                    </div>

                    {/* Multi-select Custom Invoice Numbers Picker */}
                    <div className="pt-4 border-t border-gray-200 grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-8 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                    Pilih Nomor Invoice Sendiri ({selectedInvoiceIds.size} terpilih):
                                </span>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as 'unpaid' | 'all')}
                                        className="border border-gray-300 rounded-md px-2 py-1 font-semibold text-gray-700 bg-gray-50"
                                    >
                                        <option value="unpaid">Belum Lunas Saja</option>
                                        <option value="all">Semua Invoice (Unpaid + Paid)</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={selectAllFiltered}
                                        className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200 hover:bg-blue-100 cursor-pointer"
                                    >
                                        Pilih Semua Hasil
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearAllSelected}
                                        className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-bold border border-gray-200 hover:bg-gray-200 cursor-pointer"
                                    >
                                        Reset Pilihan
                                    </button>
                                </div>
                            </div>

                            <input
                                type="text"
                                placeholder="Cari No. Invoice / Nama Client / Nomor STT..."
                                value={invoiceSearch}
                                onChange={(e) => setInvoiceSearch(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 text-gray-800"
                            />

                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-gray-50/50">
                                {pickerInvoices.length === 0 ? (
                                    <div className="p-3 text-center text-xs text-gray-400">
                                        Tidak ada invoice yang cocok dengan pencarian.
                                    </div>
                                ) : (
                                    pickerInvoices.slice(0, 80).map((inv) => {
                                        const checked = selectedInvoiceIds.has(inv.id);
                                        return (
                                            <label
                                                key={inv.id}
                                                className={`flex items-center justify-between gap-3 px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50/60 ${
                                                    checked ? 'bg-blue-50/80' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleInvoiceId(inv.id)}
                                                        className="w-3.5 h-3.5 cursor-pointer"
                                                    />
                                                    <span className="font-mono font-bold text-gray-900 shrink-0">
                                                        {inv.invoiceNumber}
                                                    </span>
                                                    <span className="font-semibold text-gray-700 truncate">
                                                        {inv.clientName}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-gray-500 truncate">
                                                        STT: {sttNumbers[inv.id] || '-'}
                                                    </span>
                                                    {inv.status === 'Paid' && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">
                                                            LUNAS
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-mono font-bold text-gray-900 shrink-0">
                                                    {formatRupiah(inv.totalAmount)}
                                                </span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-4 space-y-2.5 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Kepada Yth (Header Rekap):
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nama Customer / Perusahaan"
                                    value={recipientName}
                                    onChange={(e) => setRecipientName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Alamat Tujuan (Opsional):
                                </label>
                                <input
                                    type="text"
                                    placeholder="Alamat pada header rekap..."
                                    value={recipientAddress}
                                    onChange={(e) => setRecipientAddress(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 bg-white outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="pt-1 flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-semibold">Grand Total Rekap:</span>
                                <span className="font-mono font-black text-blue-700 text-sm">
                                    {formatRupiah(totalAmount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Manual row addition form */}
                    <div className="pt-3 border-t border-gray-150">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                            Tambah Data Tagihan Manual (Sementara/Kustom)
                        </h4>
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
                </div>
            </div>

            {/* A4 Document Area */}
            {combinedInvoices.length > 0 ? (
                <div
                    ref={rekapRef}
                    className="a4-page bg-white mx-auto shadow-xl"
                    style={{ width: '210mm', minHeight: '297mm', padding: '10mm 15mm' }}
                >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
                        <div className="flex items-center gap-4">
                            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain" />
                            <div>
                                <h1 className="font-black text-xl tracking-wide">{COMPANY_INFO.name}</h1>
                                <p className="text-xs mt-1 text-gray-800">
                                    {COMPANY_INFO.address}, {COMPANY_INFO.city}
                                </p>
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
                            <p className="font-bold text-lg uppercase">{displayRecipient}</p>
                            {recipientAddress && (
                                <p className="font-medium text-gray-800 uppercase">{recipientAddress}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <table className="inline-table text-left text-sm">
                                <tbody>
                                    <tr>
                                        <td className="pr-4 text-gray-600">Tanggal Cetak</td>
                                        <td>:</td>
                                        <td className="font-bold pl-2">
                                            {new Date().toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                            })}
                                        </td>
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
                            {combinedInvoices.length < 5 &&
                                Array.from({ length: 5 - combinedInvoices.length }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ height: '8mm' }}>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
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
                            {hasNonTaxableSelected &&
                                COMPANY_INFO.bankAccounts.map((acc, i) => (
                                    <p key={i} className="font-bold">
                                        {acc.bank} {acc.accountNumber} a/n {acc.accountName}
                                    </p>
                                ))}
                            {hasTaxableSelected && (
                                <p className="font-bold">
                                    BCA 187 1414 187 a/n CAHAYA CARGO EXPRESS CV (PKP)
                                </p>
                            )}
                            <p className="mt-4 text-xs italic text-gray-500">
                                * Mohon cantumkan nama perusahaan / nomor invoice saat melakukan transfer.
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
                    <p className="text-lg font-semibold">
                        Pilih customer atau centang satu/lebih nomor invoice di atas untuk mencetak atau mengunduh PNG Rekapitulasi Tagihan.
                    </p>
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
