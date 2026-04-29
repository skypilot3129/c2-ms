'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Transaction } from '@/types/transaction';
import { COMPANY_INFO } from '@/lib/company-config';

function fmtAngka(num: number): string {
    return num.toLocaleString('id-ID');
}

function formatTanggal(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).toUpperCase();
}

const MIN_ROWS = 15;

function CekHargaPrintContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadTransactions = async () => {
            const idsParam = searchParams.get('ids');
            if (!idsParam) {
                setError('Tidak ada transaksi yang dipilih');
                setLoading(false);
                return;
            }

            const ids = idsParam.split(',').filter(id => id.trim());
            
            try {
                const fetched = await Promise.all(ids.map(id => getTransactionById(id)));
                const valid = fetched.filter((t): t is Transaction => t !== null);
                
                // Sort by date ascending (oldest first) so checking is chronological
                valid.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

                setTransactions(valid);
                setLoading(false);
                setTimeout(() => window.print(), 800);
            } catch (err) {
                console.error(err);
                setError('Gagal memuat transaksi');
                setLoading(false);
            }
        };

        loadTransactions();
    }, [searchParams]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, border: '4px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontFamily: 'Arial, sans-serif' }}>Memuat dokumen...</p>
                </div>
            </div>
        );
    }

    if (error || transactions.length === 0) {
        return (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Arial' }}>
                <h2 style={{ color: 'red' }}>{error || 'Transaksi tidak ditemukan'}</h2>
                <button onClick={() => router.back()} style={{ marginTop: 16, padding: '8px 16px' }}>Kembali</button>
            </div>
        );
    }

    const emptyRowsCount = Math.max(0, MIN_ROWS - transactions.length);
    const datePrinted = formatTanggal(new Date());

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
                    min-height: 297mm;
                    background: white;
                    margin: 0 auto;
                    padding: 12mm;
                    font-size: 9pt;
                    color: #000;
                }
                .cek-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 5mm;
                }
                .cek-table th {
                    border: 1px solid #000;
                    padding: 6px 4px;
                    text-align: center;
                    font-weight: bold;
                    background: #f3f4f6;
                    font-size: 8.5pt;
                }
                .cek-table td {
                    border: 1px solid #000;
                    padding: 6px 4px;
                    font-size: 8.5pt;
                    vertical-align: middle;
                }
                .checkbox-box {
                    width: 14px;
                    height: 14px;
                    border: 1px solid #000;
                    margin: 0 auto;
                }
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .a4-page { margin: 0; box-shadow: none; min-height: 297mm; }
                    .no-print { display: none !important; }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}} />

            <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }}>
                <button onClick={() => window.print()} style={{ background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                    🖨️ Cetak
                </button>
                <button onClick={() => router.back()} style={{ background: '#6b7280', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                    ✕ Tutup
                </button>
            </div>

            <div className="a4-page">
                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '4mm', marginBottom: '6mm' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '20mm', height: '20mm', objectFit: 'contain' }} />
                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '12pt', lineHeight: 1.2 }}>{COMPANY_INFO.name}</p>
                            <p style={{ fontSize: '9pt', lineHeight: 1.5 }}>{COMPANY_INFO.address}</p>
                            <p style={{ fontSize: '9pt', lineHeight: 1.5 }}>{COMPANY_INFO.city}</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <h1 style={{ fontSize: '14pt', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '2mm' }}>DAFTAR CEK HARGA</h1>
                        <p style={{ fontSize: '9pt' }}>Tanggal Cetak: <span style={{ fontWeight: 'bold' }}>{datePrinted}</span></p>
                        <p style={{ fontSize: '9pt' }}>Jumlah Item: <span style={{ fontWeight: 'bold' }}>{transactions.length}</span></p>
                    </div>
                </div>

                {/* TABLE */}
                <table className="cek-table">
                    <thead>
                        <tr>
                            <th style={{ width: '4%' }}>NO</th>
                            <th style={{ width: '15%' }}>STT & TANGGAL</th>
                            <th style={{ width: '18%' }}>PENGIRIM - TUJUAN</th>
                            <th style={{ width: '8%' }}>KOLI/KG</th>
                            <th style={{ width: '11%' }}>HRG SATUAN</th>
                            <th style={{ width: '13%' }}>TOTAL HRG</th>
                            <th style={{ width: '12%' }}>KOREKSI SATUAN</th>
                            <th style={{ width: '13%' }}>KOREKSI TOTAL</th>
                            <th style={{ width: '6%' }}>CEK</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((t, idx) => (
                            <tr key={t.id}>
                                <td style={{ textAlign: 'center' }}>{idx + 1}.</td>
                                <td style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold' }}>{t.noSTT}</div>
                                    <div style={{ fontSize: '7.5pt', color: '#4b5563' }}>{formatTanggal(t.tanggal)}</div>
                                </td>
                                <td>{t.pengirimName.substring(0, 15)} - {t.tujuan}</td>
                                <td style={{ textAlign: 'center' }}>{t.koli} / {t.berat}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>
                                    {t.tipeTransaksi === 'regular' ? fmtAngka(t.harga) : '-'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>
                                    {fmtAngka(t.jumlah)}
                                </td>
                                <td></td>
                                <td></td>
                                <td>
                                    <div className="checkbox-box"></div>
                                </td>
                            </tr>
                        ))}

                        {/* Baris Kosong */}
                        {Array.from({ length: emptyRowsCount }).map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                                <td><div className="checkbox-box" style={{ borderColor: 'transparent' }}></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* FOOTER SIGNATURES */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '30mm', marginTop: '10mm', paddingRight: '10mm' }}>
                    <div style={{ textAlign: 'center', width: '40mm' }}>
                        <p style={{ fontSize: '9pt', marginBottom: '20mm' }}>Disiapkan Oleh,</p>
                        <p style={{ borderTop: '1px solid #000', paddingTop: '2mm', fontSize: '9pt' }}>( Admin )</p>
                    </div>
                    <div style={{ textAlign: 'center', width: '40mm' }}>
                        <p style={{ fontSize: '9pt', marginBottom: '20mm' }}>Diperiksa Oleh,</p>
                        <p style={{ borderTop: '1px solid #000', paddingTop: '2mm', fontSize: '9pt' }}>( Checker )</p>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function CekHargaPrintPage() {
    return (
        <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', fontFamily: 'Arial' }}>Loading...</div>}>
            <CekHargaPrintContent />
        </Suspense>
    );
}
