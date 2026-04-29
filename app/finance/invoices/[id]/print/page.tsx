'use client';

import { use, useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getInvoiceById } from '@/lib/firestore-invoices';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';

// Format angka dengan titik ribuan tanpa Rp
function fmtAngka(num: number): string {
    return num.toLocaleString('id-ID');
}

// Format tanggal: "20 APRIL 2026"
function formatTanggal(date: Date): string {
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).toUpperCase();
}

// Jumlah baris minimum di tabel (termasuk data)
const MIN_ROWS = 10;

function PrintInvoiceContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            const inv = await getInvoiceById(id);
            if (inv) {
                setInvoice(inv);
                const txItems = await Promise.all(inv.transactionIds.map(tid => getTransactionById(tid)));
                setTransactions(txItems.filter((t): t is Transaction => t !== null));
            }
            setLoading(false);
        };
        loadData();
    }, [id, user]);

    useEffect(() => {
        if (!loading && invoice) {
            setTimeout(() => window.print(), 800);
        }
    }, [loading, invoice]);

    if (loading || !invoice) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, border: '4px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                    <p>Memuat invoice...</p>
                </div>
            </div>
        );
    }

    const totalAkhir = invoice.totalAmount;
    const emptyRowsCount = Math.max(0, MIN_ROWS - transactions.length);

    // Nomor invoice: ambil angka di belakang saja jika format INV/xxx/xxx/XXXXX
    const nomorDisplay = invoice.invoiceNumber;

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: Arial, sans-serif;
                    background: #e5e7eb;
                }
                .invoice-page {
                    width: 210mm;
                    min-height: 297mm;
                    background: white;
                    margin: 0 auto;
                    padding: 12mm 14mm;
                    font-size: 10pt;
                    color: #000;
                }
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        background: white;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    .invoice-page {
                        margin: 0;
                        padding: 12mm 14mm;
                        box-shadow: none;
                        width: 210mm;
                        min-height: 297mm;
                    }
                    .no-print { display: none !important; }
                }
                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9pt;
                }
                .invoice-table th {
                    border: 1px solid #000;
                    padding: 3px 5px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 9pt;
                    background: #fff;
                }
                .invoice-table td {
                    border: 1px solid #000;
                    padding: 3px 5px;
                    font-size: 9pt;
                    vertical-align: middle;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}} />

            {/* Tombol aksi (tidak tercetak) */}
            <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }}>
                <button
                    onClick={() => window.print()}
                    style={{ background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
                >
                    🖨️ Cetak
                </button>
                <button
                    onClick={() => window.close()}
                    style={{ background: '#6b7280', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
                >
                    ✕ Tutup
                </button>
            </div>

            <div className="invoice-page">

                {/* ===== HEADER ===== */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6mm' }}>
                    {/* Logo + Info Perusahaan */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4mm' }}>
                        <img
                            src="/logo.png"
                            alt="Logo Cahaya Cargo Express"
                            style={{ width: '22mm', height: '22mm', objectFit: 'contain' }}
                        />
                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '12pt', lineHeight: 1.3 }}>
                                {COMPANY_INFO.name}
                            </p>
                            <p style={{ fontSize: '9pt', lineHeight: 1.5 }}>{COMPANY_INFO.address}</p>
                            <p style={{ fontSize: '9pt', lineHeight: 1.5 }}>{COMPANY_INFO.city}</p>
                        </div>
                    </div>

                    {/* Nomer & Tanggal */}
                    <div style={{ fontSize: '10pt', textAlign: 'left', lineHeight: 1.8 }}>
                        <div style={{ display: 'flex', gap: '4mm', alignItems: 'center' }}>
                            <span style={{ minWidth: '45px' }}>Nomer</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold' }}>{nomorDisplay}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4mm', alignItems: 'center' }}>
                            <span style={{ minWidth: '45px' }}>Tanggal</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold' }}>{formatTanggal(invoice.issueDate)}</span>
                        </div>
                    </div>
                </div>

                {/* ===== JUDUL INVOICE ===== */}
                <div style={{ textAlign: 'center', marginBottom: '5mm' }}>
                    <h1 style={{
                        fontSize: '16pt',
                        fontWeight: 'bold',
                        letterSpacing: '8px',
                        textDecoration: 'underline',
                        display: 'inline-block',
                    }}>
                        I N V O I C E
                    </h1>
                </div>

                {/* ===== KEPADA YTH ===== */}
                <div style={{ marginBottom: '5mm' }}>
                    <p style={{ fontSize: '10pt' }}>Kepada Yth,</p>
                    <p style={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase' }}>
                        {invoice.clientName}
                    </p>
                    {invoice.clientAddress && (
                        <p style={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase' }}>
                            {invoice.clientAddress}
                        </p>
                    )}
                    {invoice.notes && (
                        <p style={{ fontSize: '9pt', fontStyle: 'italic', marginTop: '1mm' }}>{invoice.notes}</p>
                    )}
                </div>

                {/* ===== TABEL ===== */}
                <table className="invoice-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>NO</th>
                            <th style={{ width: '34%', textAlign: 'center' }}>KETERANGAN</th>
                            <th style={{ width: '9%' }}>NO STT</th>
                            <th style={{ width: '7%' }}>KOLI</th>
                            <th style={{ width: '10%' }}>KG/M3</th>
                            <th style={{ width: '14%' }}>HARGA</th>
                            <th style={{ width: '14%' }}>JUMLAH</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Baris transaksi */}
                        {transactions.map((t, idx) => (
                            <tr key={t.id}>
                                <td style={{ textAlign: 'center' }}>{idx + 1}.</td>
                                <td style={{ paddingLeft: 4 }}>
                                    {`PENGIRIMAN BARANG ${(t.pengirimCity || 'ASAL').toUpperCase()} - ${t.tujuan.toUpperCase()}`}
                                </td>
                                <td style={{ textAlign: 'center' }}>{t.noSTT}</td>
                                <td style={{ textAlign: 'center' }}>{t.koli}</td>
                                <td style={{ textAlign: 'center' }}>{t.berat}</td>
                                <td style={{ textAlign: 'right', paddingRight: 4 }}>
                                    {t.tipeTransaksi === 'regular' ? fmtAngka(t.harga) : '-'}
                                </td>
                                <td style={{ textAlign: 'right', paddingRight: 4 }}>
                                    {fmtAngka(t.jumlah)}
                                </td>
                            </tr>
                        ))}

                        {/* Baris kosong pengisi */}
                        {Array.from({ length: emptyRowsCount }).map((_, i) => (
                            <tr key={`empty-${i}`} style={{ height: '8mm' }}>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td style={{ textAlign: 'right', paddingRight: 4 }}>-</td>
                            </tr>
                        ))}

                        {/* Baris Terbilang + TOTAL */}
                        <tr>
                            <td
                                colSpan={5}
                                style={{ border: '1px solid #000', fontSize: '8.5pt', fontStyle: 'italic', paddingLeft: 4 }}
                            >
                                Terbilang : # {terbilang(totalAkhir)} #
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', letterSpacing: '2px' }}>
                                T O T A L
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>
                                {fmtAngka(totalAkhir)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ===== FOOTER ===== */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6mm' }}>

                    {/* Info Transfer (kiri) */}
                    <div style={{ fontSize: '10pt', lineHeight: 1.8 }}>
                        <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '2mm' }}>
                            TRANSFER :
                        </p>
                        {COMPANY_INFO.bankAccounts.map((acc, i) => (
                            <p key={i}>{acc.bank} {acc.accountNumber}  an {acc.accountName}</p>
                        ))}
                    </div>

                    {/* Tanda Tangan (kanan) */}
                    <div style={{ textAlign: 'center', minWidth: '50mm' }}>
                        <p style={{ fontSize: '10pt', marginBottom: '2mm' }}>Hormat Kami,</p>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img
                                src="/logo.png"
                                alt="Stempel"
                                style={{
                                    width: '28mm',
                                    height: '28mm',
                                    objectFit: 'contain',
                                    opacity: 0.35,
                                    display: 'block',
                                    margin: '0 auto',
                                }}
                            />
                        </div>
                        <p style={{ fontWeight: 'bold', fontSize: '10pt', borderTop: '1px solid #000', paddingTop: '1mm', marginTop: '1mm', letterSpacing: '1px' }}>
                            {COMPANY_INFO.signatureName}
                        </p>
                    </div>
                </div>

            </div>
        </>
    );
}

export default function PrintInvoicePage(props: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>}>
            <PrintInvoiceContent params={props.params} />
        </Suspense>
    );
}
