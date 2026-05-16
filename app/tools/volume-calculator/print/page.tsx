'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatWeight } from '@/lib/volume-calculator';
import { COMPANY_INFO } from '@/lib/company-config';

interface KoliData {
    koliNumber: number;
    itemName: string;
    length: number;
    width: number;
    height: number;
    actualWeight: number;
    quantity: number;
    volume: number;
    volumetricWeight: number;
    chargeableWeight: number;
    weightType: 'actual' | 'volumetric';
}

function PrintContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [koliList, setKoliList] = useState<KoliData[]>([]);
    const [pricePerKg, setPricePerKg] = useState(0);
    const [senderName, setSenderName] = useState('');
    const [printDate, setPrintDate] = useState('');

    useEffect(() => {
        const koliData = searchParams.get('data');
        const price = searchParams.get('price');
        const sender = searchParams.get('sender');

        if (koliData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(koliData));
                setKoliList(parsed);
            } catch (error) {
                console.error('Failed to parse koli data:', error);
            }
        }
        if (price) setPricePerKg(parseFloat(price));
        if (sender) setSenderName(decodeURIComponent(sender));

        const now = new Date();
        setPrintDate(now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));

        const timer = setTimeout(() => window.print(), 500);
        return () => clearTimeout(timer);
    }, [searchParams]);

    const totalWeight = koliList.reduce((sum, koli) => sum + koli.chargeableWeight, 0);
    const totalActual = koliList.reduce((sum, koli) => sum + (koli.actualWeight * koli.quantity), 0);
    const totalVolumetric = koliList.reduce((sum, koli) => sum + koli.volumetricWeight, 0);
    const totalPrice = totalWeight * pricePerKg;
    const docRef = `CCE-VOL-${Date.now().toString().slice(-6)}`;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    font-family: Arial, sans-serif;
                    background: #d1d5db;
                }

                .a4-page {
                    width: 210mm;
                    background: white;
                    margin: 0 auto;
                    padding: 8mm 12mm 8mm 12mm;
                    font-size: 9pt;
                    color: #000;
                }

                .vol-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9pt;
                    margin-top: 0;
                }
                .vol-table th {
                    border: 1px solid #000;
                    padding: 3px 5px;
                    text-align: center;
                    font-weight: bold;
                    background: #f3f4f6;
                    font-size: 8.5pt;
                }
                .vol-table td {
                    border: 1px solid #000;
                    padding: 3px 5px;
                    font-size: 9pt;
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
            ` }} />

            {/* Tombol aksi (tidak tercetak) */}
            <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: '#6b7280', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
                >
                    ← Kembali
                </button>
                <button
                    onClick={() => window.print()}
                    style={{ background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
                >
                    🖨️ Print (A4)
                </button>
            </div>

            <div className="a4-page">
                {/* ===== HEADER ===== */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5mm', borderBottom: '2px solid #000', paddingBottom: '4mm' }}>
                    {/* Kiri: Logo + Nama Perusahaan */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                        <img src="/logo.png" alt="Logo CCE" style={{ width: '18mm', height: '18mm', objectFit: 'contain' }} />
                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '11pt', lineHeight: 1.3 }}>{COMPANY_INFO.name}</p>
                            <p style={{ fontSize: '8pt', lineHeight: 1.6 }}>Jl. {COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                            <p style={{ fontSize: '8pt', lineHeight: 1.6 }}>Jl. {COMPANY_INFO.branchAddress}, {COMPANY_INFO.branchCity}</p>
                            <p style={{ fontSize: '8pt', lineHeight: 1.6 }}>Telp: {COMPANY_INFO.phone} / {COMPANY_INFO.branchPhone}</p>
                        </div>
                    </div>

                    {/* Kanan: Info Dokumen */}
                    <div style={{ textAlign: 'right', fontSize: '8.5pt', lineHeight: 1.8 }}>
                        <p style={{ fontWeight: 'bold', fontSize: '13pt', letterSpacing: '4px', marginBottom: '2mm' }}>RINCIAN VOLUME</p>
                        <div style={{ display: 'flex', gap: '3mm', justifyContent: 'flex-end' }}>
                            <span style={{ minWidth: '55px' }}>No. Ref</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold' }}>{docRef}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '3mm', justifyContent: 'flex-end' }}>
                            <span style={{ minWidth: '55px' }}>Tanggal</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold' }}>{printDate}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '3mm', justifyContent: 'flex-end' }}>
                            <span style={{ minWidth: '55px' }}>Pengirim</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{senderName || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* ===== TABEL KOLI ===== */}
                <table className="vol-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>NO</th>
                            <th style={{ width: '28%', textAlign: 'left', paddingLeft: 5 }}>NAMA BARANG</th>
                            <th style={{ width: '6%' }}>QTY</th>
                            <th style={{ width: '17%' }}>DIMENSI (cm)</th>
                            <th style={{ width: '13%' }}>B. AKTUAL (kg)</th>
                            <th style={{ width: '13%' }}>B. VOLUME (kg)</th>
                            <th style={{ width: '12%' }}>B. TAGIHAN (kg)</th>
                            <th style={{ width: '6%' }}>TIPE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {koliList.map((koli) => (
                            <tr key={koli.koliNumber}>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{koli.koliNumber}</td>
                                <td style={{ paddingLeft: 5 }}>{koli.itemName}</td>
                                <td style={{ textAlign: 'center' }}>{koli.quantity}</td>
                                <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{koli.length} × {koli.width} × {koli.height}</td>
                                <td style={{ textAlign: 'right', paddingRight: 5 }}>{formatWeight(koli.actualWeight * koli.quantity)}</td>
                                <td style={{ textAlign: 'right', paddingRight: 5 }}>{formatWeight(koli.volumetricWeight)}</td>
                                <td style={{ textAlign: 'right', paddingRight: 5, fontWeight: 'bold', background: '#f9fafb' }}>{formatWeight(koli.chargeableWeight)}</td>
                                <td style={{ textAlign: 'center', fontSize: '7.5pt', fontWeight: 'bold' }}>
                                    {koli.weightType === 'actual' ? 'AKT' : 'VOL'}
                                </td>
                            </tr>
                        ))}

                        {/* Baris kosong minimal */}
                        {koliList.length < 3 && Array.from({ length: 3 - koliList.length }).map((_, i) => (
                            <tr key={`empty-${i}`} style={{ height: '7mm' }}>
                                <td /><td /><td /><td /><td /><td />
                                <td style={{ textAlign: 'right', paddingRight: 5 }}>-</td>
                                <td />
                            </tr>
                        ))}

                        {/* Total */}
                        <tr style={{ fontWeight: 'bold', borderTop: '2px solid #000', background: '#f3f4f6' }}>
                            <td colSpan={4} style={{ textAlign: 'right', paddingRight: 5 }}>TOTAL BERAT TAGIHAN :</td>
                            <td style={{ textAlign: 'right', paddingRight: 5 }}>{formatWeight(totalActual)}</td>
                            <td style={{ textAlign: 'right', paddingRight: 5 }}>{formatWeight(totalVolumetric)}</td>
                            <td style={{ textAlign: 'right', paddingRight: 5, fontSize: '10pt' }}>{formatWeight(totalWeight)}</td>
                            <td />
                        </tr>
                    </tbody>
                </table>

                {/* ===== RINGKASAN BIAYA (jika ada tarif) ===== */}
                {pricePerKg > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4mm' }}>
                        <div style={{ border: '1px solid #000', padding: '3mm 5mm', minWidth: '80mm', fontSize: '9pt' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                                <span>Total Berat Tagihan</span>
                                <span style={{ fontWeight: 'bold' }}>{formatWeight(totalWeight)} kg</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                                <span>Tarif per kg</span>
                                <span style={{ fontWeight: 'bold' }}>Rp {pricePerKg.toLocaleString('id-ID')}</span>
                            </div>
                            <div style={{ borderTop: '1px solid #000', paddingTop: '2mm', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>ESTIMASI BIAYA</span>
                                <span style={{ fontWeight: 'bold', fontSize: '10.5pt' }}>Rp {totalPrice.toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== FOOTER ===== */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '6mm', paddingTop: '4mm', borderTop: '1px dashed #888' }}>
                    <div style={{ fontSize: '7.5pt', lineHeight: 1.8, color: '#444', maxWidth: '60%' }}>
                        <p style={{ fontWeight: 'bold', color: '#000', marginBottom: '1mm' }}>Catatan :</p>
                        <p>- Berat Tagihan = nilai tertinggi antara Berat Aktual dan Berat Volume.</p>
                        <p>- Rumus Berat Volume : P(cm) × L(cm) × T(cm) / 4.000</p>
                        <p>- Dokumen ini bukan bukti pembayaran sah.</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '45mm' }}>
                        <img
                            src="/ttd.png"
                            alt="Tanda Tangan & Stempel"
                            style={{ width: '45mm', height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export default function PrintVolumeCalculation() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial' }}>
                <p>Menyiapkan Dokumen Rincian...</p>
            </div>
        }>
            <PrintContent />
        </Suspense>
    );
}
