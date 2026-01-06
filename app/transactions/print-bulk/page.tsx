'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Transaction } from '@/types/transaction';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';

function PrintBulkInvoiceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Invoice form data from modal
    const [invoiceData, setInvoiceData] = useState({
        kepadaYth: '',
        nama: '',
        kota: '',
        noNPWP: '',
        keteranganKeberangkatan: '',
        keteranganPerSTT: {} as { [key: string]: string },
        includePPN: false,
    });

    useEffect(() => {
        const loadTransactions = async () => {
            const idsParam = searchParams.get('ids');
            if (!idsParam) {
                setError('No transaction IDs provided');
                setLoading(false);
                return;
            }

            // Read invoice data from URL params
            const kepadaYth = searchParams.get('kepadaYth') || '';
            const nama = searchParams.get('nama') || '';
            const kota = searchParams.get('kota') || '';
            const noNPWP = searchParams.get('noNPWP') || '';
            const keteranganKeberangkatan = searchParams.get('keteranganKeberangkatan') || '';
            const includePPN = searchParams.get('includePPN') === 'true';
            const keteranganJSON = searchParams.get('keterangan') || '{}';

            try {
                const keteranganPerSTT = JSON.parse(keteranganJSON);
                setInvoiceData({
                    kepadaYth,
                    nama,
                    kota,
                    noNPWP,
                    keteranganKeberangkatan,
                    keteranganPerSTT,
                    includePPN,
                });
            } catch (e) {
                console.error('Failed to parse keterangan:', e);
            }

            const ids = idsParam.split(',').filter(id => id.trim());
            if (ids.length === 0) {
                setError('Invalid transaction IDs');
                setLoading(false);
                return;
            }

            try {
                // Fetch all transactions in parallel
                const fetchedTransactions = await Promise.all(
                    ids.map(id => getTransactionById(id))
                );

                // Filter out nulls and validate
                const validTransactions = fetchedTransactions.filter((t): t is Transaction => t !== null);

                if (validTransactions.length === 0) {
                    setError('Tidak ada transaksi ditemukan');
                    setLoading(false);
                    return;
                }

                // Validate all transactions have same sender
                const firstSender = validTransactions[0].pengirimName;
                const allSameSender = validTransactions.every(
                    t => t.pengirimName === firstSender
                );

                if (!allSameSender) {
                    setError('Semua transaksi harus memiliki pengirim yang sama');
                    setLoading(false);
                    return;
                }

                // Validate same date
                const firstDate = new Date(validTransactions[0].tanggal).toDateString();
                const allSameDate = validTransactions.every(
                    t => new Date(t.tanggal).toDateString() === firstDate
                );

                if (!allSameDate) {
                    setError('Semua transaksi harus memiliki tanggal yang sama');
                    setLoading(false);
                    return;
                }

                setTransactions(validTransactions);
                setLoading(false);

                // Auto print when loaded
                setTimeout(() => window.print(), 500);
            } catch (error) {
                console.error('Error loading transactions:', error);
                setError('Gagal memuat transaksi');
                setLoading(false);
            }
        };

        loadTransactions();
    }, [searchParams]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Memuat invoice gabungan...</p>
                </div>
            </div>
        );
    }

    if (error || transactions.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
                    <p className="text-gray-600">{error || 'Tidak ada transaksi ditemukan'}</p>
                    <button
                        onClick={() => window.close()}
                        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        );
    }

    // Calculate totals
    const grandTotal = {
        koli: transactions.reduce((sum, t) => sum + t.koli, 0),
        berat: transactions.reduce((sum, t) => sum + parseFloat(t.berat.toString()), 0),
        jumlah: transactions.reduce((sum, t) => sum + t.jumlah, 0),
    };

    const ppnAmount = invoiceData.includePPN ? grandTotal.jumlah * 0.011 : 0;
    const totalWithPPN = grandTotal.jumlah + ppnAmount;

    // Use invoice number from first transaction
    const bulkInvoiceNo = transactions[0].noInvoice;

    const tanggalFormatted = new Date(transactions[0].tanggal).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <>
            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 5mm 8mm;
                    }
                    body { 
                        print-color-adjust: exact; 
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                    }
                    .no-print { display: none !important; }
                }
                .mini-invoice { font-size: 8px; line-height: 1.2; }
                .mini-invoice h1 { font-size: 12px; margin: 0; font-weight: bold; line-height: 1.1; }
                .mini-invoice h2 { font-size: 14px; margin: 2px 0; letter-spacing: 3px; font-weight: bold; }
                .mini-invoice p { margin: 0.5px 0; }
                .mini-invoice table { font-size: 8px; border-collapse: collapse; }
                .mini-invoice th, .mini-invoice td { padding: 1.5px 3px !important; line-height: 1.1; }
            `}} />

            <div className="no-print fixed top-4 right-4 z-50">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700">🖨️ Print</button>
                <button onClick={() => router.back()} className="ml-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-gray-700">✕ Tutup</button>
            </div>

            <div className="mini-invoice" style={{ maxWidth: '190mm', maxHeight: '148mm', margin: '1rem auto', padding: '0', background: 'white', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5mm', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '16mm', height: '16mm', objectFit: 'contain' }} />
                        <div>
                            <h1 style={{ fontWeight: 'bold' }}>{COMPANY_INFO.name}</h1>
                            <p>{COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                            <p>{COMPANY_INFO.branchAddress}, {COMPANY_INFO.branchCity}</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '7px' }}>
                        <p><strong>No:</strong> {bulkInvoiceNo}</p>
                        <p><strong>Tgl:</strong> {tanggalFormatted}</p>
                    </div>
                </div>

                <h2 style={{ textAlign: 'center', fontWeight: 'bold', margin: '1mm 0' }}>INVOICE</h2>

                <div style={{ marginBottom: '1.5mm' }}>
                    <p style={{ fontSize: '7px' }}>Kepada Yth,</p>
                    <p style={{ fontWeight: 'bold', fontSize: '9px' }}>{invoiceData.kepadaYth || invoiceData.nama}</p>
                    <p style={{ fontWeight: 'bold', fontSize: '9px' }}>{invoiceData.nama}</p>
                    {invoiceData.kota && <p style={{ fontSize: '7px' }}>{invoiceData.kota}</p>}
                    {invoiceData.noNPWP && <p style={{ fontSize: '7px' }}>No. NPWP: {invoiceData.noNPWP}</p>}
                </div>

                {/* Keterangan Keberangkatan Umum */}
                {invoiceData.keteranganKeberangkatan && (
                    <div style={{ marginBottom: '1.5mm', padding: '1mm', background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '1px' }}>
                        <p style={{ fontSize: '7px', fontWeight: 'bold', margin: 0 }}>{invoiceData.keteranganKeberangkatan}</p>
                    </div>
                )}

                {/* Multi-Row Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5mm' }}>
                    <thead>
                        <tr style={{ border: '1.5px solid black', background: '#f5f5f5' }}>
                            <th style={{ border: '1px solid black', width: '3%' }}>NO</th>
                            <th style={{ border: '1px solid black', width: '28%', textAlign: 'left' }}>KETERANGAN</th>
                            <th style={{ border: '1px solid black', width: '10%' }}>STT</th>
                            <th style={{ border: '1px solid black', width: '6%' }}>KOLI</th>
                            <th style={{ border: '1px solid black', width: '9%' }}>KG/M3</th>
                            <th style={{ border: '1px solid black', width: '16%', textAlign: 'right' }}>HARGA</th>
                            <th style={{ border: '1px solid black', width: '18%', textAlign: 'right' }}>JUMLAH</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((transaction, index) => (
                            <tr key={transaction.id}>
                                <td style={{ border: '1px solid black', textAlign: 'center' }}>{index + 1}</td>
                                <td style={{ border: '1px solid black' }}>
                                    {invoiceData.keteranganPerSTT[transaction.id] ? (
                                        <>{invoiceData.keteranganPerSTT[transaction.id]}</>
                                    ) : (
                                        <>
                                            <strong>PENGIRIMAN BARANG</strong><br />
                                            {transaction.pengirimCity || 'ASAL'} - {transaction.tujuan}
                                            {transaction.isiBarang && <><br />{transaction.isiBarang}</>}
                                        </>
                                    )}
                                </td>
                                <td style={{ border: '1px solid black', textAlign: 'center', fontSize: '8px' }}>{transaction.noSTT}</td>
                                <td style={{ border: '1px solid black', textAlign: 'center' }}>{transaction.koli}</td>
                                <td style={{ border: '1px solid black', textAlign: 'center' }}>{transaction.berat}</td>
                                <td style={{ border: '1px solid black', textAlign: 'right' }}>
                                    {transaction.tipeTransaksi === 'regular' ? formatRupiah(transaction.harga).replace('Rp', '').trim() : '-'}
                                </td>
                                <td style={{ border: '1px solid black', textAlign: 'right' }}>
                                    {formatRupiah(transaction.jumlah).replace('Rp', '').trim()}
                                </td>
                            </tr>
                        ))}
                        {/* TOTAL TAGIHAN Row */}
                        <tr>
                            <td colSpan={6} style={{ border: '1px solid black', textAlign: 'right', fontWeight: 'bold' }}>
                                TOTAL TAGIHAN:
                            </td>
                            <td style={{ border: '1px solid black', textAlign: 'right', fontWeight: 'bold', background: '#f0f0f0' }}>
                                {formatRupiah(grandTotal.jumlah).replace('Rp', '').trim()}
                            </td>
                        </tr>
                        {/* PPN Row if enabled */}
                        {invoiceData.includePPN && (
                            <tr>
                                <td colSpan={6} style={{ border: '1px solid black', textAlign: 'right', fontWeight: 'bold' }}>
                                    PPN 1.1%:
                                </td>
                                <td style={{ border: '1px solid black', textAlign: 'right', fontWeight: 'bold', background: '#fff9e6' }}>
                                    {formatRupiah(ppnAmount).replace('Rp', '').trim()}
                                </td>
                            </tr>
                        )}
                        {/* Grand Total Row with PPN */}
                        {invoiceData.includePPN && (
                            <tr>
                                <td colSpan={6} style={{ border: '2px solid black', textAlign: 'right', fontWeight: 'bold', fontSize: '10px' }}>
                                    <strong>TOTAL:</strong>
                                </td>
                                <td style={{ border: '2px solid black', textAlign: 'right', fontWeight: 'bold', background: '#ffe6e6', fontSize: '10px' }}>
                                    {formatRupiah(totalWithPPN).replace('Rp', '').trim()}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={7} style={{ border: '1px solid black' }}>
                                <em style={{ fontSize: '7px' }}>Terbilang: {terbilang(invoiceData.includePPN ? totalWithPPN : grandTotal.jumlah)}</em>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5mm' }}>
                    <div style={{ fontSize: '7px' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '0.5mm' }}>TRANSFER:</p>
                        {invoiceData.includePPN ? (
                            <>
                                <p style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '7px' }}>⚠️ Transfer hanya ke Rekening BCA</p>
                                <p style={{ fontWeight: 'bold' }}>BCA 1870444342 a/n CAHAYA CARGO EXPRESS CV</p>
                            </>
                        ) : (
                            COMPANY_INFO.bankAccounts.map((acc, i) => (
                                <p key={i}>{acc.bank} {acc.accountNumber} a/n {acc.accountName}</p>
                            ))
                        )}
                    </div>
                    <div style={{ textAlign: 'center', width: '80px' }}>
                        <p style={{ fontSize: '7px', marginBottom: '10mm' }}>{COMPANY_INFO.signatureTitle},</p>
                        <p style={{ fontWeight: 'bold', borderTop: '1px solid black', paddingTop: '0.5mm', fontSize: '7px' }}>
                            {COMPANY_INFO.signatureName}
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: '4mm', fontSize: '7px', padding: '2mm', background: '#f0f9ff', border: '1px solid #93c5fd', borderRadius: '4px' }}>
                    <p><strong>📋 Invoice ini menggabungkan {transactions.length} transaksi:</strong></p>
                    <p style={{ marginTop: '1mm' }}>
                        {transactions.map(t => t.noSTT).join(', ')}
                    </p>
                </div>

                <div style={{ marginTop: '6mm', textAlign: 'center', fontSize: '8px', color: '#999', borderTop: '2px dashed #ccc', paddingTop: '2mm' }}>
                    <em>--- Desain compact di bagian atas (full A4) ---</em>
                </div>
            </div>
        </>
    );
}

export default function PrintBulkInvoicePage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <PrintBulkInvoiceContent />
        </Suspense>
    );
}
