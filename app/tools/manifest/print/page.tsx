'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { ManifestItem, ManifestRowColor } from '@/types/manifest';

interface ManifestPrintData {
    tanggal: string;
    kapal: string;
    nopol: string;
    sopir: string;
    kepadaYth: string;
    items: ManifestItem[];
    orientation?: 'landscape' | 'portrait';
}

const COLOR_MAP: Record<ManifestRowColor, string> = {
    white: '#ffffff',
    purple: '#c084fc',
    yellow: '#fef08a',
    green: '#bbf7d0',
    red: '#fca5a5',
    blue: '#93c5fd'
};

function PrintContent() {
    const router = useRouter();
    const [data, setData] = useState<ManifestPrintData | null>(null);
    const [isLandscape, setIsLandscape] = useState<boolean>(true);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('cce_print_manifest');
            if (raw) {
                const parsed: ManifestPrintData = JSON.parse(raw);
                setData(parsed);
                if (parsed.orientation) {
                    setIsLandscape(parsed.orientation === 'landscape');
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

    // Totals calculation
    const totalKoli = data.items.reduce((sum, item) => sum + (Number(item.koli) || 0), 0);
    const totalBerat = data.items.reduce((sum, item) => {
        const val = parseFloat(String(item.berat || '').replace(',', '.'));
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    // For single-page A4 landscape, display actual items and pad with empty rows up to max 16-20 rows if few items
    const rows = [...data.items];
    const targetRows = Math.min(Math.max(data.items.length, 16), 20);
    while (rows.length < targetRows) {
        rows.push({
            noSTT: '',
            koli: 0,
            berat: '',
            pengirim: '',
            penerima: '',
            isiBarang: '',
            alamat: '',
            keterangan: '',
            color: 'white'
        });
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    font-family: Arial, Helvetica, sans-serif;
                    background: #64748b;
                    color: #000;
                    padding: 10px 0;
                }

                .print-canvas {
                    width: ${isLandscape ? '297mm' : '210mm'};
                    max-height: ${isLandscape ? '204mm' : '289mm'};
                    background: white;
                    margin: 0 auto;
                    padding: 3mm 6mm;
                    font-size: 8pt;
                    line-height: 1.15;
                    position: relative;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    box-sizing: border-box;
                    page-break-after: avoid;
                    page-break-inside: avoid;
                    overflow: hidden;
                }

                /* Header Title */
                .manifest-title {
                    text-align: center;
                    font-size: 13pt;
                    font-weight: 900;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    text-decoration: underline;
                    text-underline-offset: 3px;
                    margin-bottom: 2.5mm;
                }

                /* Header Metadata Grid */
                .header-meta-table {
                    width: 100%;
                    margin-bottom: 2.5mm;
                    border-collapse: collapse;
                }

                .header-meta-table td {
                    vertical-align: middle;
                    padding: 1px 4px;
                }

                /* Main Manifest Table */
                .manifest-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 7.5pt;
                    page-break-inside: avoid;
                }

                .manifest-table th {
                    border: 1.5px solid #000;
                    padding: 3px 2px;
                    text-align: center;
                    font-weight: 900;
                    background: #ffffff;
                    text-transform: uppercase;
                    font-size: 7.5pt;
                    letter-spacing: 0.3px;
                    height: 5.5mm;
                }

                .manifest-table td {
                    border: 1px solid #000;
                    padding: 1.5px 3px;
                    vertical-align: middle;
                    height: 5mm;
                    text-transform: uppercase;
                    font-size: 7.5pt;
                    line-height: 1.15;
                }

                .row-purple { background-color: #c084fc !important; color: #000 !important; }
                .row-yellow { background-color: #fef08a !important; color: #000 !important; }
                .row-green { background-color: #bbf7d0 !important; color: #000 !important; }
                .row-red { background-color: #fca5a5 !important; color: #000 !important; }
                .row-blue { background-color: #93c5fd !important; color: #000 !important; }
                .row-white { background-color: #ffffff !important; color: #000 !important; }

                @media print {
                    @page {
                        size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
                        margin: 3mm 4mm;
                    }
                    html, body {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        height: 100% !important;
                        overflow: hidden !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    .print-canvas {
                        width: 100% !important;
                        max-height: 100vh !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        padding: 1mm 2mm !important;
                        page-break-inside: avoid !important;
                        page-break-after: avoid !important;
                        page-break-before: avoid !important;
                        overflow: hidden !important;
                    }
                    .no-print { display: none !important; }
                }
            ` }} />

            {/* Print toolbar */}
            <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 10, background: '#0f172a', padding: '10px 16px', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: '#475569', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
                >
                    ← Kembali
                </button>
                <button
                    onClick={() => setIsLandscape(!isLandscape)}
                    style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
                >
                    🔄 Mode: {isLandscape ? 'Landscape' : 'Portrait'}
                </button>
                <button
                    onClick={() => window.print()}
                    style={{ background: '#10b981', color: 'white', padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
                >
                    🖨️ Cetak PDF / Kertas
                </button>
            </div>

            <div className="print-canvas">
                {/* Title Header */}
                <h1 className="manifest-title">
                    DAFTAR CARGO MANIFES CAHAYA CARGO EXPRESS
                </h1>

                {/* Metadata Header Grid */}
                <table className="header-meta-table">
                    <tbody>
                        <tr>
                            <td style={{ width: '28%', verticalAlign: 'middle' }}>
                                <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>Tgl : {data.tanggal || '-'}</div>
                                <div style={{ marginTop: '2px', fontSize: '9pt', fontWeight: 'bold' }}>Kapal : {data.kapal || '-'}</div>
                            </td>
                            <td style={{ width: '44%', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ fontSize: '13pt', fontWeight: '900', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#000', lineHeight: 1.15 }}>
                                    NOPOL : <span style={{ textDecoration: 'underline' }}>{data.nopol || '-'}</span>
                                </div>
                                <div style={{ fontSize: '13pt', fontWeight: '900', marginTop: '2px', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#000', lineHeight: 1.15 }}>
                                    SOPIR : <span style={{ textDecoration: 'underline' }}>{data.sopir || '-'}</span>
                                </div>
                            </td>
                            <td style={{ width: '28%', textAlign: 'right', verticalAlign: 'middle' }}>
                                <div style={{ fontSize: '8.5pt', fontWeight: 'bold' }}>Kepada Yth,</div>
                                <div style={{ marginTop: '1px', fontSize: '10pt', fontWeight: '900' }}>{data.kepadaYth || 'CAHAYA CARGO EXP MKS'}</div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Main 9-Column Table */}
                <table className="manifest-table">
                    <thead>
                        <tr>
                            <th style={{ width: '4%' }}>NO.</th>
                            <th style={{ width: '8%' }}>NO STT</th>
                            <th style={{ width: '6%' }}>KOLI</th>
                            <th style={{ width: '8%' }}>BERAT</th>
                            <th style={{ width: '15%', textAlign: 'left' }}>PENGIRIM</th>
                            <th style={{ width: '15%', textAlign: 'left' }}>PENERIMA</th>
                            <th style={{ width: '13%', textAlign: 'left' }}>ISI BARANG</th>
                            <th style={{ width: '21%', textAlign: 'left' }}>ALAMAT</th>
                            <th style={{ width: '10%', textAlign: 'left' }}>KETERANGAN</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((item, index) => {
                            const isDummy = !item.noSTT && !item.pengirim && !item.penerima && !item.koli;
                            const rowColorClass = item.color ? `row-${item.color}` : 'row-white';

                            return (
                                <tr key={index} className={rowColorClass}>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                        {index + 1}.
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                        {item.noSTT || ''}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: item.koli ? 'bold' : 'normal' }}>
                                        {item.koli ? item.koli : ''}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: item.berat ? 'bold' : 'normal' }}>
                                        {item.berat !== undefined && item.berat !== 0 ? item.berat : ''}
                                    </td>
                                    <td style={{ fontWeight: item.color && item.color !== 'white' ? 'bold' : 'bold' }}>
                                        {item.pengirim || ''}
                                    </td>
                                    <td style={{ fontWeight: item.color && item.color !== 'white' ? 'bold' : 'bold' }}>
                                        {item.penerima || ''}
                                    </td>
                                    <td style={{ fontWeight: 'normal' }}>
                                        {item.isiBarang || ''}
                                    </td>
                                    <td style={{ fontWeight: item.color && item.color !== 'white' ? 'bold' : 'normal' }}>
                                        {item.alamat || ''}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                        {item.keterangan || ''}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Summary Row */}
                        <tr style={{ fontWeight: '900', background: '#e2e8f0', borderTop: '2px solid #000' }}>
                            <td colSpan={2} style={{ textAlign: 'right', paddingRight: '8px' }}>TOTAL :</td>
                            <td style={{ textAlign: 'center', fontSize: '9pt' }}>{totalKoli > 0 ? totalKoli : ''}</td>
                            <td style={{ textAlign: 'center', fontSize: '9pt' }}>{totalBerat > 0 ? totalBerat.toLocaleString('id-ID') : ''}</td>
                            <td colSpan={5}></td>
                        </tr>
                    </tbody>
                </table>
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
