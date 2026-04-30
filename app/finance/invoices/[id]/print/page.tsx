'use client';

import { use, useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getInvoiceById } from '@/lib/firestore-invoices';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';

function fmtAngka(num: number): string {
    return num.toLocaleString('id-ID');
}

function formatTanggal(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).toUpperCase();
}

const MIN_ROWS = 2;

function PrintInvoiceContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [keteranganPerSTT, setKeteranganPerSTT] = useState<{[key: string]: string}>({});

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
                    <div style={{ width: 40, height: 40, border: '4px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontFamily: 'Arial, sans-serif' }}>Memuat invoice...</p>
                </div>
            </div>
        );
    }

    const emptyRowsCount = Math.max(0, MIN_ROWS - transactions.length);
    const isTaxableInvoice = transactions.some(t => t.isTaxable || (t.ppn && t.ppn > 0));

    // Calculate totals for tax layout dynamically to enforce 1.1% PPN rule on all invoices (including historical)
    const subtotalTagihan = transactions.reduce((acc, t) => acc + t.jumlah, 0);
    const totalPPN = isTaxableInvoice ? Math.round(subtotalTagihan * 0.011) : 0;
    const totalAkhirDisplay = subtotalTagihan + totalPPN;
    
    const totalKoli = transactions.reduce((acc, t) => acc + (t.koli || 0), 0);
    const totalBerat = transactions.reduce((acc, t) => acc + (t.berat || 0), 0);

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    font-family: Arial, sans-serif;
                    background: #d1d5db;
                }

                .a4-page {
                    width: 210mm;
                    height: 297mm;
                    background: white;
                    margin: 0 auto;
                    padding: 8mm 12mm 6mm 12mm;
                    font-size: 8.5pt;
                    color: #000;
                }

                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9.5pt;
                }
                .invoice-table th {
                    border: 1px solid #000;
                    padding: 3px 4px;
                    text-align: center;
                    font-weight: 900;
                    font-size: 9.5pt;
                    background: #fff;
                }
                .invoice-table td {
                    border: 1px solid #000;
                    padding: 3px 4px;
                    font-size: 9.5pt;
                    vertical-align: middle;
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
                    .a4-page {
                        margin: 0;
                        box-shadow: none;
                    }
                    .no-print { display: none !important; }
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

            <div className="a4-page">
                {isTaxableInvoice ? (
                    // ==========================================
                    // LAYOUT FAKTUR PAJAK (PKP)
                    // ==========================================
                    <>
                        {/* HEADER FAKTUR */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4mm' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                                <img src="/logo.png" alt="Logo" style={{ width: '18mm', height: '18mm', objectFit: 'contain' }} />
                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: '11pt', lineHeight: 1.3 }}>CV. CAHAYA CARGO EXPRESS</p>
                                    <p style={{ fontSize: '8pt', lineHeight: 1.5 }}>Jl. KEMUDI NO. 4 - SURABAYA</p>
                                    <p style={{ fontSize: '8pt', lineHeight: 1.5 }}>Jl. IRIAN NO. 245 B - MAKASSAR</p>
                                </div>
                            </div>
                            <div style={{ fontSize: '8.5pt', lineHeight: 1.8 }}>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '75px' }}>Nomer</span>
                                    <span>:</span>
                                    <span contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', outline: 'none' }}>{invoice.invoiceNumber}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '75px' }}>Tanggal</span>
                                    <span>:</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatTanggal(invoice.issueDate)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '75px' }}>No. NPWP</span>
                                    <span>:</span>
                                    <span 
                                        contentEditable 
                                        suppressContentEditableWarning 
                                        style={{ fontWeight: 'bold', outline: 'none' }}
                                    >
                                        031.509.910.1-615.000
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* JUDUL */}
                        <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
                            <span style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '8px' }}>
                                I N V O I C E
                            </span>
                        </div>

                        {/* KEPADA YTH */}
                        <div style={{ marginBottom: '3mm' }}>
                            <p style={{ fontSize: '8.5pt' }}>Kepada Yth,</p>
                            <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '9.5pt', textTransform: 'uppercase', outline: 'none' }}>{invoice.clientName}</p>
                            {invoice.clientAddress && (
                                <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '9.5pt', textTransform: 'uppercase', outline: 'none' }}>{invoice.clientAddress}</p>
                            )}
                        </div>

                        {/* TABEL FAKTUR */}
                        <table className="invoice-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '5%' }}>NO</th>
                                    <th style={{ width: '53%' }}>KETERANGAN</th>
                                    <th style={{ width: '6%' }}>KOLI</th>
                                    <th style={{ width: '12%' }}>KG/M3</th>
                                    <th style={{ width: '10%' }}>HARGA</th>
                                    <th style={{ width: '14%' }}>JUMLAH</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Baris info keberangkatan (Editable) */}
                                <tr>
                                    <td></td>
                                    <td style={{ paddingLeft: 4 }}>
                                        <div 
                                            contentEditable 
                                            suppressContentEditableWarning 
                                            style={{ outline: 'none', fontWeight: 'bold' }}
                                        >
                                            BERANGKAT TGL ... KM. ...
                                        </div>
                                    </td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td style={{ textAlign: 'right', paddingRight: 4 }}>-</td>
                                </tr>
                                {/* Optional: Notes Row Spanning Columns */}
                                {invoice.notes && (
                                    <tr>
                                        <td></td>
                                        <td colSpan={5} style={{ fontWeight: 'bold', paddingLeft: 4 }}>
                                            {invoice.notes.toUpperCase()}
                                        </td>
                                    </tr>
                                )}

                                {/* Data Rows */}
                                {transactions.map((t, idx) => {
                                    const baseAmount = t.jumlah;
                                    return (
                                        <tr key={t.id}>
                                            <td style={{ textAlign: 'center' }}>{idx + 1}.</td>
                                            <td style={{ paddingLeft: 4 }}>
                                                <div
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={(e) => setKeteranganPerSTT({ ...keteranganPerSTT, [t.id]: e.currentTarget.textContent || '' })}
                                                    style={{ outline: 'none', minWidth: '100px', cursor: 'text' }}
                                                >
                                                    {keteranganPerSTT[t.id] ?? `SPX ${(t.tujuan || '').toUpperCase()}`}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{fmtAngka(t.koli)}</td>
                                            <td style={{ textAlign: 'right', paddingRight: 4 }}>{fmtAngka(t.berat)}</td>
                                            <td style={{ textAlign: 'right', paddingRight: 4 }}>
                                                {t.tipeTransaksi === 'regular' ? fmtAngka(t.harga) : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', paddingRight: 4 }}>{fmtAngka(baseAmount)}</td>
                                        </tr>
                                    );
                                })}

                                {/* TOTAL TAGIHAN Row */}
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '8.5pt' }}>
                                        TOTAL TAGIHAN
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmtAngka(totalKoli)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>{fmtAngka(totalBerat)}</td>
                                    <td></td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>{fmtAngka(subtotalTagihan)}</td>
                                </tr>

                                {/* PPN Row */}
                                <tr>
                                    <td style={{ textAlign: 'center' }}>{transactions.length + 1}.</td>
                                    <td colSpan={4} style={{ paddingLeft: 4 }}>
                                        <span contentEditable suppressContentEditableWarning style={{ outline: 'none' }}>PPN 1.1%</span>
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: 4 }}>{fmtAngka(totalPPN)}</td>
                                </tr>

                                {/* Baris kosong tambahan jika kurang dari minimum */}
                                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                                    <tr key={`empty-tax-${i}`} style={{ height: '6mm' }}>
                                        <td></td><td></td><td></td><td></td><td></td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>-</td>
                                    </tr>
                                ))}

                                {/* Terbilang + TOTAL AKHIR */}
                                <tr>
                                    <td colSpan={5} style={{ fontSize: '7.5pt', fontStyle: 'italic', paddingLeft: 4 }}>
                                        Terbilang : # {terbilang(totalAkhirDisplay)} #
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>
                                        {fmtAngka(totalAkhirDisplay)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* FOOTER FAKTUR */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6mm' }}>
                            <div style={{ fontSize: '8.5pt', lineHeight: 1.8 }}>
                                <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1mm' }}>TRANSFER :</p>
                                {COMPANY_INFO.bankAccounts.map((acc, i) => (
                                    <p 
                                        key={i}
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={{ outline: 'none', fontSize: '10.5pt', fontWeight: 'bold' }}
                                    >
                                        {acc.bank} {acc.accountNumber}  a/n {acc.accountName} CV
                                    </p>
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', minWidth: '45mm', paddingTop: '2mm' }}>
                                <p style={{ fontSize: '8.5pt', marginBottom: '1mm' }}>Hormat Kami,</p>
                                <div style={{ height: '20mm' }}></div>
                                <p style={{ fontSize: '8.5pt', fontWeight: 'bold', display: 'inline-block', paddingTop: '2mm' }}>{COMPANY_INFO.signatureName}</p>
                            </div>
                        </div>
                    </>
                ) : (
                    // ==========================================
                    // LAYOUT INVOICE STANDAR (Non-PKP)
                    // ==========================================
                    <>
                        {/* HEADER STANDAR */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4mm' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                                <img src="/logo.png" alt="Logo" style={{ width: '18mm', height: '18mm', objectFit: 'contain' }} />
                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: '11pt', lineHeight: 1.3 }}>{COMPANY_INFO.name}</p>
                                    <p style={{ fontSize: '8pt', lineHeight: 1.5 }}>{COMPANY_INFO.address}</p>
                                    <p style={{ fontSize: '8pt', lineHeight: 1.5 }}>{COMPANY_INFO.city}</p>
                                </div>
                            </div>
                            <div style={{ fontSize: '8.5pt', lineHeight: 1.8 }}>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '75px' }}>Nomer</span>
                                    <span>:</span>
                                    <span contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', outline: 'none' }}>{invoice.invoiceNumber}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '75px' }}>Tanggal</span>
                                    <span>:</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatTanggal(invoice.issueDate)}</span>
                                </div>
                            </div>
                        </div>

                        {/* JUDUL */}
                        <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
                            <span style={{ fontSize: '13pt', fontWeight: 'bold', letterSpacing: '8px', textDecoration: 'underline' }}>
                                I N V O I C E
                            </span>
                        </div>

                        {/* KEPADA YTH */}
                        <div style={{ marginBottom: '3mm' }}>
                            <p style={{ fontSize: '8.5pt' }}>Kepada Yth,</p>
                            <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '9.5pt', textTransform: 'uppercase', outline: 'none' }}>{invoice.clientName}</p>
                            {invoice.clientAddress && (
                                <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '9.5pt', textTransform: 'uppercase', outline: 'none' }}>{invoice.clientAddress}</p>
                            )}
                            {invoice.notes && (
                                <p style={{ fontSize: '7.5pt', fontStyle: 'italic', marginTop: '0.5mm' }}>{invoice.notes}</p>
                            )}
                        </div>

                        {/* TABEL STANDAR */}
                        <table className="invoice-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '5%' }}>NO</th>
                                    <th style={{ width: '45%' }}>KETERANGAN</th>
                                    <th style={{ width: '9%' }}>NO STT</th>
                                    <th style={{ width: '6%' }}>KOLI</th>
                                    <th style={{ width: '11%' }}>KG/M3</th>
                                    <th style={{ width: '10%' }}>HARGA</th>
                                    <th style={{ width: '14%' }}>JUMLAH</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((t, idx) => (
                                    <tr key={t.id}>
                                        <td style={{ textAlign: 'center' }}>{idx + 1}.</td>
                                        <td style={{ paddingLeft: 4 }}>
                                            <div
                                                contentEditable
                                                suppressContentEditableWarning
                                                onBlur={(e) => setKeteranganPerSTT({ ...keteranganPerSTT, [t.id]: e.currentTarget.textContent || '' })}
                                                style={{ outline: 'none', minWidth: '100px', cursor: 'text' }}
                                            >
                                                {keteranganPerSTT[t.id] ?? `PENGIRIMAN BARANG ${(t.pengirimCity || 'ASAL').toUpperCase()} - ${t.tujuan.toUpperCase()}`}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{t.noSTT.replace(/^STT/i, '')}</td>
                                        <td style={{ textAlign: 'center' }}>{t.koli}</td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>{t.berat}</td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>
                                            {t.tipeTransaksi === 'regular' ? fmtAngka(t.harga) : '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>{fmtAngka(t.jumlah)}</td>
                                    </tr>
                                ))}

                                {/* Baris kosong */}
                                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ height: '6mm' }}>
                                        <td></td><td></td><td></td><td></td><td></td><td></td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>-</td>
                                    </tr>
                                ))}

                                {/* Terbilang + TOTAL */}
                                <tr>
                                    <td colSpan={5} style={{ fontSize: '7.5pt', fontStyle: 'italic', paddingLeft: 4 }}>
                                        Terbilang : # {terbilang(totalAkhirDisplay)} #
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', letterSpacing: '2px', fontSize: '8pt' }}>
                                        T O T A L
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>
                                        {fmtAngka(totalAkhirDisplay)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* FOOTER STANDAR */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '4mm' }}>
                            <div style={{ fontSize: '8.5pt', lineHeight: 1.8 }}>
                                <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1mm' }}>TRANSFER :</p>
                                {COMPANY_INFO.bankAccounts.map((acc, i) => (
                                    <p 
                                        key={i}
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={{ outline: 'none', fontSize: '10.5pt', fontWeight: 'bold' }}
                                    >
                                        {acc.bank} {acc.accountNumber}  an {acc.accountName}
                                    </p>
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', minWidth: '45mm', paddingTop: '4mm' }}>
                                <img
                                    src="/ttd.png"
                                    alt="Tanda Tangan & Stempel"
                                    style={{ width: '45mm', height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

export default function PrintInvoicePage(props: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', fontFamily: 'Arial' }}>Loading...</div>}>
            <PrintInvoiceContent params={props.params} />
        </Suspense>
    );
}
