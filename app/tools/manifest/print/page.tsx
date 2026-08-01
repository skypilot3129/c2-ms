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

    // Ensure at least 30 rows display like in the screenshot
    const rows = [...data.items];
    const minRows = 30;
    while (rows.length < minRows) {
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
                    padding: 20px 0;
                }

                .print-canvas {
                    width: ${isLandscape ? '297mm' : '210mm'};
                    min-height: ${isLandscape ? '210mm' : '297mm'};
                    background: white;
                    margin: 0 auto;
                    padding: 8mm 10mm;
                    font-size: 8.5pt;
                    line-height: 1.2;
                    position: relative;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                }

                /* Header Title */
                .manifest-title {
                    text-align: center;
                    font-size: 15pt;
                    font-weight: 900;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    text-decoration: underline;
                    text-underline-offset: 4px;
                    margin-bottom: 5mm;
                }

                /* Header Metadata Grid */
                .header-meta-table {
                    width: 100%;
                    margin-bottom: 4mm;
                    border-collapse: collapse;
                    font-size: 9pt;
                    font-weight: bold;
                }

                .header-meta-table td {
                    vertical-align: top;
                    padding: 1px 4px;
                }

                /* Main Manifest Table */
                .manifest-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8pt;
                }

                .manifest-table th {
                    border: 1.5px solid #000;
                    padding: 4px 4px;
                    text-align: center;
                    font-weight: 900;
                    background: #ffffff;
                    text-transform: uppercase;
                    font-size: 8pt;
                    letter-spacing: 0.5px;
                }

                .manifest-table td {
                    border: 1px solid #000;
                    padding: 3px 5px;
                    vertical-align: middle;
                    height: 6mm;
                    text-transform: uppercase;
                    font-size: 8pt;
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
                        margin: 4mm;
                    }
                    body {
                        background: white;
                        padding: 0;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    .print-canvas {
                        width: 100% !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        padding: 4mm 6mm !important;
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
                            <td style={{ width: '30%' }}>
                                <div>Tgl : {data.tanggal || '-'}</div>
                                <div style={{ marginTop: '2px' }}>Kapal : {data.kapal || '-'}</div>
                            </td>
                            <td style={{ width: '35%', textAlign: 'center' }}>
                                <div>Nopol : {data.nopol || '-'}</div>
                                <div style={{ marginTop: '2px' }}>Sopir : {data.sopir || '-'}</div>
                            </td>
                            <td style={{ width: '35%', textAlign: 'right' }}>
                                <div>Kepada Yth,</div>
                                <div style={{ marginTop: '2px', fontSize: '10pt', fontWeight: '900' }}>{data.kepadaYth || 'CAHAYA CARGO EXP MKS'}</div>
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
