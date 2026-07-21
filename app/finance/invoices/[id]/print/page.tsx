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
    let d: Date;
    if (typeof date === 'string') {
        if (date.includes('-')) {
            const parts = date.split('-');
            if (parts.length === 3) {
                d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            } else {
                d = new Date(date);
            }
        } else {
            d = new Date(date);
        }
    } else {
        d = date;
    }
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).toUpperCase();
}

const MIN_ROWS = 10;

function PrintInvoiceContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [keteranganPerSTT, setKeteranganPerSTT] = useState<{[key: string]: string}>({});
    
    // States for custom edit date and additional manual fee
    const [issueDate, setIssueDate] = useState<string>('');
    const [additionalFee, setAdditionalFee] = useState<number>(0);
    const [feeLabel, setFeeLabel] = useState<string>('BIAYA TAMBAHAN');

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            const inv = await getInvoiceById(id);
            if (inv) {
                const txItems = await Promise.all(inv.transactionIds.map(tid => getTransactionById(tid)));
                const loaded = txItems.filter((t): t is Transaction => t !== null);
                // Sort by noSTT numerically (strip non-numeric prefix if any)
                loaded.sort((a, b) => {
                    const numA = parseInt(a.noSTT.replace(/\D/g, ''), 10) || 0;
                    const numB = parseInt(b.noSTT.replace(/\D/g, ''), 10) || 0;
                    return numA - numB;
                });
                setTransactions(loaded);

                if (loaded.length > 0 && loaded[0].pengirimName) {
                    inv.clientName = loaded[0].pengirimName;
                    if (loaded[0].pengirimAddress) {
                        inv.clientAddress = loaded[0].pengirimAddress;
                    }
                }

                setInvoice(inv);
                const dateObj = inv.issueDate instanceof Date ? inv.issueDate : new Date(inv.issueDate);
                setIssueDate(dateObj.toISOString().substring(0, 10));
            }
            setLoading(false);
        };
        loadData();
    }, [id, user]);

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
    const hasKgVolume = transactions.some(t => t.beratUnit === 'KG/VOLUME');

    // Calculate totals for tax layout dynamically to enforce 1.1% PPN rule on all invoices (including historical)
    const subtotalTagihan = transactions.reduce((acc, t) => acc + t.jumlah, 0);
    const subtotalWithFee = subtotalTagihan + additionalFee;
    const totalPPN = isTaxableInvoice ? Math.round(subtotalWithFee * 0.011) : 0;
    const totalAkhirDisplay = subtotalWithFee + totalPPN;
    
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
                    font-weight: bold;
                    font-size: 9.5pt;
                    background: #fff;
                }
                .invoice-table td {
                    border: 1px solid #000;
                    padding: 3px 4px;
                    font-size: 9.5pt;
                    vertical-align: middle;
                }

                @media screen {
                    body {
                        padding-top: 75px;
                    }
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

            {/* Control Panel (tidak tercetak) */}
            <div className="no-print" style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                right: 0, 
                background: '#1e293b', 
                color: 'white', 
                padding: '12px 24px', 
                zIndex: 9999, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '13px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#94a3b8' }}>Tanggal Cetak:</span>
                        <input 
                            type="date" 
                            value={issueDate} 
                            onChange={e => setIssueDate(e.target.value)}
                            style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#94a3b8' }}>Keterangan Biaya Tambahan:</span>
                        <input 
                            type="text" 
                            placeholder="Mis: Biaya Packing / Penerusan" 
                            value={feeLabel} 
                            onChange={e => setFeeLabel(e.target.value)}
                            style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', outline: 'none', width: '200px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#94a3b8' }}>Nominal Biaya:</span>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>Rp</span>
                            <input 
                                type="number" 
                                placeholder="0" 
                                value={additionalFee || ''} 
                                onChange={e => setAdditionalFee(Math.max(0, Number(e.target.value) || 0))}
                                style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '6px 12px 6px 25px', borderRadius: '6px', outline: 'none', width: '120px' }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => window.print()}
                        style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        🖨️ Cetak
                    </button>
                    <button
                        onClick={() => window.close()}
                        style={{ background: '#475569', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        ✕ Tutup
                    </button>
                </div>
            </div>

            <div className="a4-page">
                {isTaxableInvoice ? (
                    // ==========================================
                    // LAYOUT FAKTUR PAJAK (PKP)
                    // ==========================================
                    <>
                        {/* HEADER FAKTUR */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '5mm' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4mm' }}>
                                <img src="/logo.png" alt="Logo" style={{ width: '22mm', height: '22mm', objectFit: 'contain' }} />
                                <div style={{ color: '#000', fontFamily: 'Arial, sans-serif' }}>
                                    <p style={{ fontWeight: 'bold', fontSize: '13pt', marginBottom: '1.5mm', letterSpacing: '0.5px' }}>CV. CAHAYA CARGO EXPRESS</p>
                                    <p style={{ fontSize: '9pt', fontWeight: 'bold', lineHeight: 1.4 }}>Jl. KEMUDI NO. 4 - SURABAYA</p>
                                    <p style={{ fontSize: '9pt', fontWeight: 'bold', lineHeight: 1.4 }}>Jl. IRIAN NO. 245 B - MAKASSAR</p>
                                </div>
                            </div>
                            <div style={{ fontSize: '20pt', fontWeight: 'bold', letterSpacing: '6px', color: '#000', paddingBottom: '1mm', fontFamily: 'Arial, sans-serif' }}>
                                INVOICE
                            </div>
                        </div>

                        {/* KEPADA YTH & METADATA BLOCK */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4mm', fontFamily: 'Arial, sans-serif', color: '#000' }}>
                            <div style={{ fontSize: '10pt', lineHeight: 1.5 }}>
                                <p>Kepada Yth,</p>
                                <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '10.5pt', textTransform: 'uppercase', outline: 'none' }}>{invoice.clientName}</p>
                                {invoice.clientAddress ? (
                                    <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '10.5pt', textTransform: 'uppercase', outline: 'none' }}>{invoice.clientAddress}</p>
                                ) : (
                                    <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '10.5pt', textTransform: 'uppercase', outline: 'none', color: '#94a3b8' }}>ALAMAT CLIENT</p>
                                )}
                                <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: '10.5pt', outline: 'none' }}>UP BP. FARHAN</p>
                            </div>
                            <div style={{ fontSize: '10pt', lineHeight: 1.5, minWidth: '85mm' }}>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '85px', fontWeight: 'bold' }}>Nomer</span>
                                    <span style={{ fontWeight: 'bold' }}>:</span>
                                    <span contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', outline: 'none', flex: 1 }}>{invoice.invoiceNumber}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '85px', fontWeight: 'bold' }}>Tanggal</span>
                                    <span style={{ fontWeight: 'bold' }}>:</span>
                                    <span contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', outline: 'none', flex: 1 }}>{formatTanggal(issueDate)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <span style={{ minWidth: '85px', fontWeight: 'bold' }}>No. NPWP</span>
                                    <span style={{ fontWeight: 'bold' }}>:</span>
                                    <span 
                                        contentEditable 
                                        suppressContentEditableWarning 
                                        style={{ fontWeight: 'bold', outline: 'none', flex: 1 }}
                                    >
                                        076.049.538.2-618.000
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* TABEL FAKTUR */}
                        <table className="invoice-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '5%', border: '1.5px solid #000' }}>NO</th>
                                    <th style={{ width: '53%', border: '1.5px solid #000' }}>KETERANGAN</th>
                                    <th style={{ width: '8%', border: '1.5px solid #000' }}>KOLI</th>
                                    <th style={{ width: '12%', border: '1.5px solid #000' }}>{hasKgVolume ? 'KG VOLUME' : 'KG/M3'}</th>
                                    <th style={{ width: '10%', border: '1.5px solid #000' }}>HARGA</th>
                                    <th style={{ width: '12%', border: '1.5px solid #000' }}>JUMLAH</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Description Row 1 */}
                                <tr>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ paddingLeft: 6, fontWeight: 'bold', border: '1px solid #000' }}>
                                        <div 
                                            contentEditable 
                                            suppressContentEditableWarning 
                                            style={{ outline: 'none' }}
                                        >
                                            {invoice.notes ? invoice.notes.toUpperCase() : (transactions.length > 0 ? `PENGIRIMAN BARANG DARI ${transactions[0].branch.toUpperCase()} KE ${transactions[0].tujuan.toUpperCase()}` : 'PENGIRIMAN BARANG')}
                                        </div>
                                    </td>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ textAlign: 'right', paddingRight: 6, border: '1px solid #000', fontWeight: 'bold' }}>-</td>
                                </tr>
                                {/* Description Row 2 */}
                                <tr>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ paddingLeft: 6, fontWeight: 'bold', border: '1px solid #000' }}>
                                        <div 
                                            contentEditable 
                                            suppressContentEditableWarning 
                                            style={{ outline: 'none' }}
                                        >
                                            BERANGKAT TGL 25 JUNI 2026 KM. DHARMA KENCANA VII
                                        </div>
                                    </td>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ textAlign: 'right', paddingRight: 6, border: '1px solid #000', fontWeight: 'bold' }}>-</td>
                                </tr>

                                {/* Data Rows */}
                                {transactions.map((t, idx) => {
                                    const baseAmount = t.jumlah;
                                    return (
                                        <tr key={t.id}>
                                            <td style={{ textAlign: 'center', border: '1px solid #000' }}>{idx + 1}.</td>
                                            <td style={{ paddingLeft: 6, border: '1px solid #000' }}>
                                                <div
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={(e) => setKeteranganPerSTT({ ...keteranganPerSTT, [t.id]: e.currentTarget.textContent || '' })}
                                                    style={{ outline: 'none', minWidth: '100px', cursor: 'text' }}
                                                >
                                                    {keteranganPerSTT[t.id] ?? `${(t.penerimaName || '').toUpperCase()} - ${(t.tujuan || '').toUpperCase()}`}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', border: '1px solid #000' }}>
                                                <span contentEditable suppressContentEditableWarning style={{ outline: 'none', display: 'block', textAlign: 'center', cursor: 'text' }}>
                                                    {t.koli && t.koli > 0 ? fmtAngka(t.koli) : ''}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', paddingRight: 6, border: '1px solid #000' }}>
                                                <span contentEditable suppressContentEditableWarning style={{ outline: 'none', display: 'block', textAlign: 'right', cursor: 'text' }}>
                                                    {t.berat && t.berat > 0 ? fmtAngka(t.berat) : ''}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', paddingRight: 6, border: '1px solid #000' }}>
                                                {t.tipeTransaksi === 'regular' && t.harga > 0 ? fmtAngka(t.harga) : ''}
                                            </td>
                                            <td style={{ textAlign: 'right', paddingRight: 6, border: '1px solid #000', fontWeight: 'bold' }}>
                                                {baseAmount && baseAmount > 0 ? fmtAngka(baseAmount) : ''}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Additional Manual Fee Row */}
                                {additionalFee > 0 && (
                                    <tr>
                                        <td style={{ textAlign: 'center', border: '1px solid #000' }}>{transactions.length + 1}.</td>
                                        <td colSpan={4} style={{ paddingLeft: 6, textTransform: 'uppercase', fontWeight: 'bold', border: '1px solid #000' }}>
                                            <span contentEditable suppressContentEditableWarning style={{ outline: 'none' }}>
                                                {feeLabel.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: 6, fontWeight: 'bold', border: '1px solid #000' }}>{fmtAngka(additionalFee)}</td>
                                    </tr>
                                )}

                                {/* TOTAL TAGIHAN Row */}
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9.5pt', border: '1px solid #000' }}>
                                        TOTAL TAGIHAN
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid #000' }}>
                                        {totalKoli && totalKoli > 0 ? fmtAngka(totalKoli) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 6, border: '1px solid #000' }}>
                                        {totalBerat && totalBerat > 0 ? fmtAngka(totalBerat) : ''}
                                    </td>
                                    <td style={{ border: '1px solid #000' }}></td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 6, border: '1px solid #000' }}>{fmtAngka(subtotalTagihan)}</td>
                                </tr>

                                {/* PPN Row */}
                                <tr>
                                    <td style={{ textAlign: 'center', border: '1px solid #000' }}>{transactions.length + (additionalFee > 0 ? 2 : 1)}.</td>
                                    <td colSpan={4} style={{ paddingLeft: 6, border: '1px solid #000' }}>
                                        <span contentEditable suppressContentEditableWarning style={{ outline: 'none' }}>PPN 1.1%</span>
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: 6, border: '1px solid #000' }}>{fmtAngka(totalPPN)}</td>
                                </tr>

                                {/* Baris kosong tambahan jika kurang dari minimum */}
                                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                                    <tr key={`empty-tax-${i}`} style={{ height: '7.5mm' }}>
                                        <td style={{ border: '1px solid #000' }}></td>
                                        <td style={{ border: '1px solid #000' }}></td>
                                        <td style={{ border: '1px solid #000' }}></td>
                                        <td style={{ border: '1px solid #000' }}></td>
                                        <td style={{ border: '1px solid #000' }}></td>
                                        <td style={{ textAlign: 'right', paddingRight: 6, border: '1px solid #000' }}></td>
                                    </tr>
                                ))}

                                {/* Terbilang + TOTAL AKHIR */}
                                <tr>
                                    <td colSpan={4} style={{ fontSize: '8.5pt', fontStyle: 'italic', paddingLeft: 6, border: '1px solid #000', borderRight: 'none' }}>
                                        Terbilang : # {terbilang(totalAkhirDisplay)} #
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10pt', border: '1px solid #000', borderLeft: 'none' }}>
                                        TOTAL
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 6, fontSize: '11.5pt', border: '2.5px solid #000' }}>
                                        {fmtAngka(totalAkhirDisplay)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* FOOTER FAKTUR */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6mm', color: '#000', fontFamily: 'Arial, sans-serif' }}>
                            <div style={{ fontSize: '9pt', lineHeight: 1.6 }}>
                                <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1.5mm', fontSize: '10.5pt' }}>TRANSFER :</p>
                                <p 
                                    contentEditable
                                    suppressContentEditableWarning
                                    style={{ outline: 'none', fontSize: '10.5pt', fontWeight: 'bold' }}
                                >
                                    BCA 187 1414 187 a/n CAHAYA CARGO EXPRESS CV
                                </p>
                            </div>
                            <div style={{ textAlign: 'center', minWidth: '50mm', paddingTop: '2mm' }}>
                                <p style={{ fontSize: '10pt', marginBottom: '1mm' }}>Hormat Kami,</p>
                                <div style={{ height: '28mm' }}></div>
                                <p style={{ fontSize: '10pt', fontWeight: 'bold', display: 'inline-block', textTransform: 'uppercase' }}>HILAL BAFAGIH</p>
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
                                    <span contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', outline: 'none' }}>{formatTanggal(issueDate)}</span>
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
                                    <th style={{ width: '11%' }}>{hasKgVolume ? 'KG VOLUME' : 'KG/M3'}</th>
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
                                                {keteranganPerSTT[t.id] ?? `${(t.penerimaName || '').toUpperCase()} - ${(t.tujuan || '').toUpperCase()}`}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{t.noSTT.replace(/^STT/i, '')}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span contentEditable suppressContentEditableWarning style={{ outline: 'none', display: 'block', textAlign: 'center', cursor: 'text' }}>{t.koli}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>
                                            <span contentEditable suppressContentEditableWarning style={{ outline: 'none', display: 'block', textAlign: 'right', cursor: 'text' }}>{t.berat}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>
                                            {t.tipeTransaksi === 'regular' ? fmtAngka(t.harga) : '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>{fmtAngka(t.jumlah)}</td>
                                    </tr>
                                ))}

                                {/* Additional Manual Fee Row */}
                                {additionalFee > 0 && (
                                    <tr>
                                        <td style={{ textAlign: 'center' }}>{transactions.length + 1}.</td>
                                        <td colSpan={5} style={{ paddingLeft: 4, textTransform: 'uppercase', fontWeight: 'bold' }}>
                                            <span contentEditable suppressContentEditableWarning style={{ outline: 'none' }}>
                                                {feeLabel.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: 4, fontWeight: 'bold' }}>{fmtAngka(additionalFee)}</td>
                                    </tr>
                                )}

                                {/* Baris kosong */}
                                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ height: '6mm' }}>
                                        <td></td><td></td><td></td><td></td><td></td><td></td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>-</td>
                                    </tr>
                                ))}

                                {/* Terbilang + TOTAL */}
                                <tr>
                                    <td colSpan={4} style={{ fontSize: '7.5pt', fontStyle: 'italic', paddingLeft: 4 }}>
                                        Terbilang : # {terbilang(totalAkhirDisplay)} #
                                    </td>
                                    <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', letterSpacing: '2px', fontSize: '9pt' }}>
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
                                <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1mm', fontSize: '10.5pt', outline: 'none' }}>TRANSFER :</p>
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
