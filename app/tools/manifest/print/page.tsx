'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { COMPANY_INFO } from '@/lib/company-config';

interface ManifestItem {
    noSTT: string;
    koli: number;
    berat: number;
    isiBarang: string;
    pengirim: string;
    penerima: string;
    keterangan: string;
}

interface ManifestPrintData {
    tanggal: string;
    kapal: string;
    nopol: string;
    sopir: string;
    kepadaYth: string;
    items: ManifestItem[];
}

function PrintContent() {
    const router = useRouter();
    const [data, setData] = useState<ManifestPrintData | null>(null);
    const [printDateFormatted, setPrintDateFormatted] = useState('');

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('cce_print_manifest');
            if (raw) {
                const parsed: ManifestPrintData = JSON.parse(raw);
                setData(parsed);
                
                // Format tanggal for display
                if (parsed.tanggal) {
                    const dateObj = new Date(parsed.tanggal);
                    // Format as DDMMYY for matching handwritten style if needed,
                    // or DD Month YYYY. Let's use DD-MM-YYYY
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const year = String(dateObj.getFullYear()).slice(-2); // YY format
                    setPrintDateFormatted(`${day}/${month}/${year}`);
                }
            }
        } catch (error) {
            console.error('Failed to parse manifest print session:', error);
        }

        const timer = setTimeout(() => window.print(), 600);
        return () => clearTimeout(timer);
    }, []);

    if (!data) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial' }}>
                <p>Memuat Data Manifest...</p>
            </div>
        );
    }

    // Totals
    const totalKoli = data.items.reduce((sum, item) => sum + (Number(item.koli) || 0), 0);
    const totalBerat = data.items.reduce((sum, item) => sum + (Number(item.berat) || 0), 0);

    // Padding empty rows up to minimum 10 rows
    const rows = [...data.items];
    const minRows = 10;
    while (rows.length < minRows) {
        rows.push({
            noSTT: '',
            koli: 0,
            berat: 0,
            isiBarang: '',
            pengirim: '',
            penerima: '',
            keterangan: ''
        });
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    font-family: Arial, sans-serif;
                    background: #d1d5db;
                    color: #000;
                }

                .a4-page {
                    width: 210mm;
                    background: white;
                    margin: 0 auto;
                    padding: 8mm 12mm;
                    font-size: 8.5pt;
                    line-height: 1.3;
                    position: relative;
                }

                .manifest-header-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2px solid #000;
                    padding-bottom: 4mm;
                    margin-bottom: 3mm;
                }

                .manifest-header-left {
                    width: 48%;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5mm;
                }

                .manifest-header-right {
                    width: 48%;
                    text-align: right;
                }

                .manifest-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8.5pt;
                    margin-top: 4mm;
                }

                .manifest-table th {
                    border: 1px solid #000;
                    padding: 4px 6px;
                    text-align: center;
                    font-weight: bold;
                    background: #f3f4f6;
                    font-size: 8pt;
                }

                .manifest-table td {
                    border: 1px solid #000;
                    padding: 4px 6px;
                    vertical-align: middle;
                    min-height: 7.5mm;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 70px 6px 1fr;
                    gap: 1mm 2mm;
                    align-items: center;
                }

                .kepada-yth-block {
                    margin-top: 3mm;
                    font-size: 8.5pt;
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
                        padding: 8mm 12mm;
                    }
                    .no-print { display: none !important; }
                }
            ` }} />

            {/* Print toolbar */}
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
                    🖨️ Cetak Manifest
                </button>
            </div>

            <div className="a4-page">
                {/* Header Container */}
                <div className="manifest-header-container">
                    
                    {/* Left: Transport details */}
                    <div className="manifest-header-left">
                        <div className="info-grid">
                            <span style={{ fontWeight: 'bold' }}>Tgl</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold' }}>{printDateFormatted || '-'}</span>

                            <span style={{ fontWeight: 'bold' }}>Kapal</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{data.kapal || '-'}</span>
                        </div>
                        
                        <div className="info-grid" style={{ marginTop: '2mm', paddingTop: '2mm', borderTop: '1px dashed #ccc' }}>
                            <span style={{ fontWeight: 'bold' }}>Nopol</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{data.nopol || '-'}</span>

                            <span style={{ fontWeight: 'bold' }}>Sopir</span>
                            <span>:</span>
                            <span style={{ fontWeight: 'bold' }}>{data.sopir || '-'}</span>
                        </div>

                        <div className="kepada-yth-block">
                            <p>Kepada Yth,</p>
                            <p style={{ fontWeight: 'bold', fontSize: '9.5pt', marginTop: '1mm', textTransform: 'uppercase' }}>
                                {data.kepadaYth || 'CAHAYA CARGO EXP MKS'}
                            </p>
                        </div>
                    </div>

                    {/* Right: Company identity (Surabaya Kalimas Header) */}
                    <div className="manifest-header-right">
                        <h1 style={{ fontWeight: '900', fontSize: '15pt', letterSpacing: '0.5px', lineHeight: '1.2' }}>
                            CAHAYA CARGO EXPRESS
                        </h1>
                        <h2 style={{ fontWeight: 'bold', fontSize: '10pt', letterSpacing: '0.5px', marginTop: '1px' }}>
                            EKSPEDISI FERRY CEPAT
                        </h2>
                        <p style={{ fontSize: '7.5pt', color: '#333', marginTop: '2mm', lineHeight: '1.4' }}>
                            Jl. Kalimas Baru (Pelabuhan Kalimas) No. 60 - SURABAYA
                        </p>
                        <p style={{ fontSize: '7.5pt', color: '#333', lineHeight: '1.4' }}>
                            Telp: 081 357 979 159 &bull; E-mail: c2express@yahoo.com
                        </p>
                    </div>

                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', margin: '4mm 0' }}>
                    <h2 style={{ 
                        fontWeight: 'bold', 
                        fontSize: '13pt', 
                        letterSpacing: '3px', 
                        textDecoration: 'underline',
                        textTransform: 'uppercase'
                    }}>
                        DAFTAR CARGO MANIFES
                    </h2>
                </div>

                {/* Main Table */}
                <table className="manifest-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>NO.</th>
                            <th style={{ width: '15%' }}>NO STT</th>
                            <th style={{ width: '9%' }}>KOLI</th>
                            <th style={{ width: '13%' }}>BERAT</th>
                            <th style={{ width: '15%', textAlign: 'left' }}>ISI BARANG</th>
                            <th style={{ width: '14%', textAlign: 'left' }}>PENGIRIM</th>
                            <th style={{ width: '14%', textAlign: 'left' }}>PENERIMA</th>
                            <th style={{ width: '15%', textAlign: 'left' }}>KETERANGAN</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((item, index) => {
                            const isDummy = item.noSTT.trim() === '';
                            return (
                                <tr key={index} style={{ height: '7.5mm' }}>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                                    <td style={{ 
                                        textAlign: 'center', 
                                        fontFamily: isDummy ? 'inherit' : 'monospace', 
                                        fontWeight: isDummy ? 'normal' : 'bold',
                                        fontSize: '9pt'
                                    }}>
                                        {isDummy ? '' : item.noSTT}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: isDummy ? 'normal' : 'bold' }}>
                                        {isDummy ? '' : item.koli}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: isDummy ? 'normal' : 'bold' }}>
                                        {isDummy ? '' : `${item.berat} kg`}
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{item.isiBarang}</td>
                                    <td style={{ fontWeight: isDummy ? 'normal' : 'bold', textTransform: 'uppercase' }}>
                                        {item.pengirim}
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{item.penerima}</td>
                                    <td style={{ fontSize: '8pt', color: '#222' }}>{item.keterangan}</td>
                                </tr>
                            );
                        })}

                        {/* Sum Totals Row */}
                        <tr style={{ fontWeight: 'bold', background: '#f3f4f6', borderTop: '2px solid #000' }}>
                            <td colSpan={2} style={{ textAlign: 'right', paddingRight: '4mm' }}>TOTAL :</td>
                            <td style={{ textAlign: 'center', fontSize: '9pt' }}>{totalKoli}</td>
                            <td style={{ textAlign: 'center', fontSize: '9pt' }}>{totalBerat} kg</td>
                            <td colSpan={4}></td>
                        </tr>
                    </tbody>
                </table>

                {/* Footer and Stamps / Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10mm', paddingTop: '4mm', borderTop: '1px dashed #999' }}>
                    <div style={{ fontSize: '7.5pt', color: '#444', lineHeight: '1.6' }}>
                        <p style={{ fontWeight: 'bold', color: '#000', marginBottom: '1mm' }}>Keterangan & Ketentuan:</p>
                        <p>&bull; Daftar cargo manifest ini mewakili muatan sah kapal / armada ekspedisi.</p>
                        <p>&bull; Harap memeriksa kembali jumlah koli saat pembongkaran di pelabuhan tujuan.</p>
                    </div>

                    {/* Signature Block (Standard for cargo documents) */}
                    <div style={{ display: 'flex', gap: '8mm' }}>
                        <div style={{ textAlign: 'center', width: '35mm' }}>
                            <p style={{ fontSize: '7.5pt', marginBottom: '12mm' }}>Supir / Driver</p>
                            <p style={{ borderTop: '1px solid #000', paddingTop: '1mm', fontSize: '7.5pt' }}>
                                ( {data.sopir?.split('/')[0]?.trim() || '.......................'} )
                            </p>
                        </div>
                        <div style={{ textAlign: 'center', width: '35mm' }}>
                            <p style={{ fontSize: '7.5pt', marginBottom: '12mm' }}>Mengetahui, Surabaya</p>
                            <p style={{ borderTop: '1px solid #000', paddingTop: '1mm', fontSize: '7.5pt' }}>
                                ( ....................... )
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function PrintManifestPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial' }}>
                <p>Menyiapkan Preview Cetak...</p>
            </div>
        }>
            <PrintContent />
        </Suspense>
    );
}
