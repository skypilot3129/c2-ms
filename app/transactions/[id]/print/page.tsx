'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Transaction } from '@/types/transaction';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';

export default function PrintInvoicePage() {
    const params = useParams();
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTransaction = async () => {
            if (!params.id || typeof params.id !== 'string') return;

            try {
                const data = await getTransactionById(params.id);
                setTransaction(data);
                setLoading(false);

                // Auto print when loaded
                if (data) {
                    setTimeout(() => window.print(), 500);
                }
            } catch (error) {
                console.error('Error loading transaction:', error);
                setLoading(false);
            }
        };

        loadTransaction();
    }, [params.id]);

    if (loading || !transaction) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Memuat invoice...</p>
                </div>
            </div>
        );
    }

    const tanggalFormatted = new Date(transaction.tanggal).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <>
            {/* Custom Half-Page Print */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 8mm 10mm;
                    }
                    body { 
                        print-color-adjust: exact; 
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                    }
                    .no-print { display: none !important; }
                }
                .mini-invoice { font-size: 9px; line-height: 1.3; }
                .mini-invoice h1 { font-size: 14px; margin: 0; font-weight: bold; }
                .mini-invoice h2 { font-size: 18px; margin: 4px 0; letter-spacing: 4px; font-weight: bold; }
                .mini-invoice p { margin: 1px 0; }
                .mini-invoice table { font-size: 9px; border-collapse: collapse; }
                .mini-invoice th, .mini-invoice td { padding: 3px 4px !important; }
            `}} />

            <div className="no-print fixed top-4 right-4 z-50">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700">🖨️ Print</button>
                <button onClick={() => window.close()} className="ml-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-gray-700">✕ Tutup</button>
            </div>

            <div className="mini-invoice" style={{ maxWidth: '190mm', margin: '1rem auto', padding: '0', background: 'white' }}>
                {/* Header - Ultra Compact */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4mm', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '22mm', height: '22mm', objectFit: 'contain' }} />
                        <div>
                            <h1 style={{ fontWeight: 'bold' }}>{COMPANY_INFO.name}</h1>
                            <p>{COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '8px' }}>
                        <p><strong>No:</strong> {transaction.noInvoice}</p>
                        <p><strong>Tgl:</strong> {tanggalFormatted}</p>
                    </div>
                </div>

                <h2 style={{ textAlign: 'center', fontWeight: 'bold' }}>INVOICE</h2>

                <div style={{ marginBottom: '3mm' }}>
                    <p style={{ fontSize: '8px' }}>Kepada Yth,</p>
                    <p style={{ fontWeight: 'bold', fontSize: '10px' }}>{transaction.penerimaName}</p>
                    <p style={{ fontSize: '8px' }}>{transaction.penerimaCity || '-'}</p>
                </div>

                {/* Mini Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3mm' }}>
                    <thead>
                        <tr style={{ border: '1.5px solid black', background: '#f5f5f5' }}>
                            <th style={{ border: '1px solid black', width: '3%' }}>NO</th>
                            <th style={{ border: '1px solid black', width: '30%', textAlign: 'left' }}>KETERANGAN</th>
                            <th style={{ border: '1px solid black', width: '10%' }}>STT</th>
                            <th style={{ border: '1px solid black', width: '6%' }}>KO LI</th>
                            <th style={{ border: '1px solid black', width: '9%' }}>KG/M3</th>
                            <th style={{ border: '1px solid black', width: '16%', textAlign: 'right' }}>HARGA</th>
                            <th style={{ border: '1px solid black', width: '18%', textAlign: 'right' }}>JUMLAH</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>1</td>
                            <td style={{ border: '1px solid black' }}>
                                <strong>PENGIRIMAN BARANG</strong><br />
                                {transaction.pengirimCity || 'ASAL'} - {transaction.tujuan}
                                {transaction.isiBarang && <><br />{transaction.isiBarang}</>}
                            </td>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{transaction.noSTT}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{transaction.koli}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{transaction.berat}</td>
                            <td style={{ border: '1px solid black', textAlign: 'right' }}>
                                {transaction.tipeTransaksi === 'regular' ? formatRupiah(transaction.harga).replace('Rp', '').trim() : '-'}
                            </td>
                            <td style={{ border: '1px solid black', textAlign: 'right' }}>
                                {formatRupiah(transaction.jumlah).replace('Rp', '').trim()}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={6} style={{ border: '1px solid black' }}>
                                <em style={{ fontSize: '7px' }}>Terbilang: {terbilang(transaction.jumlah)}</em>
                            </td>
                            <td style={{ border: '1px solid black', textAlign: 'right' }}><strong>SUBTOTAL</strong></td>
                        </tr>
                        {transaction.ppn && transaction.ppn > 0 && (
                            <tr>
                                <td colSpan={6} style={{ border: '1px solid black' }}></td>
                                <td style={{ border: '1px solid black', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
                                        <span>PPN ({(transaction.ppnRate || 0.11) * 100}%)</span>
                                        <span>{formatRupiah(transaction.ppn).replace('Rp', '').trim()}</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={6} style={{ border: '1px solid black' }}>
                                <em style={{ fontSize: '7px' }}>Terbilang: {terbilang(transaction.jumlah)}</em>
                            </td>
                            <td style={{ border: '1px solid black', textAlign: 'right' }}><strong>TOTAL</strong></td>
                        </tr>
                        <tr>
                            <td colSpan={6} style={{ border: '1px solid black', padding: '1px' }}></td>
                            <td style={{ border: '2px solid black', textAlign: 'right', fontWeight: 'bold' }}>
                                {formatRupiah(transaction.jumlah).replace('Rp', '').trim()}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Footer - Compact */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3mm' }}>
                    <div style={{ fontSize: '7px' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '1mm' }}>TRANSFER:</p>
                        {COMPANY_INFO.bankAccounts.map((acc, i) => (
                            <p key={i}>{acc.bank} {acc.accountNumber} a/n {acc.accountName}</p>
                        ))}
                    </div>
                    <div style={{ textAlign: 'center', width: '100px' }}>
                        <p style={{ fontSize: '7px', marginBottom: '15mm' }}>{COMPANY_INFO.signatureTitle},</p>
                        <p style={{ fontWeight: 'bold', borderTop: '1px solid black', paddingTop: '1mm', fontSize: '8px' }}>
                            {COMPANY_INFO.signatureName}
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: '2mm', fontSize: '7px' }}>
                    <p><strong>Pembayaran:</strong> {transaction.pembayaran} | <strong>Pelunasan:</strong> {transaction.pelunasan}</p>
                    {transaction.keterangan && <p><strong>Ket:</strong> {transaction.keterangan}</p>}
                </div>

                <div style={{ marginTop: '8mm', textAlign: 'center', fontSize: '8px', color: '#999', borderTop: '2px dashed #ccc', paddingTop: '2mm' }}>
                    <em>--- Desain compact di bagian atas (full A4) ---</em>
                </div>
            </div>
        </>
    );
}
