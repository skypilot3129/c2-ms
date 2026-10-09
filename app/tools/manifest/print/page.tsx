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

type DensityMode = 'normal' | 'compact' | 'extra-compact';

interface DensitySetting {
    label: string;
    fontSize: string;
    headerFontSize: string;
    metaFontSize: string;
    driverFontSize: string;
    cellPadding: string;
    headerPadding: string;
    cellHeight: string;
    headerHeight: string;
    titleSize: string;
    titleMargin: string;
    headerMargin: string;
}

const DENSITY_CONFIG: Record<DensityMode, DensitySetting> = {
    normal: {
        label: 'Standar',
        fontSize: '8pt',
        headerFontSize: '8pt',
        metaFontSize: '9pt',
        driverFontSize: '13pt',
        cellPadding: '2.2px 3.5px',
        headerPadding: '3.5px 2px',
        cellHeight: '5.2mm',
        headerHeight: '5.5mm',
        titleSize: '13.5pt',
        titleMargin: '2.5mm',
        headerMargin: '2.5mm'
    },
    compact: {
        label: 'Padat',
        fontSize: '7.5pt',
        headerFontSize: '7.5pt',
        metaFontSize: '8.5pt',
        driverFontSize: '12pt',
        cellPadding: '1.2px 2.5px',
        headerPadding: '2px 2px',
        cellHeight: '4.4mm',
        headerHeight: '4.8mm',
        titleSize: '12pt',
        titleMargin: '1.8mm',
        headerMargin: '1.8mm'
    },
    'extra-compact': {
        label: 'Sangat Padat',
        fontSize: '7pt',
        headerFontSize: '7pt',
        metaFontSize: '8pt',
        driverFontSize: '11pt',
        cellPadding: '0.8px 2px',
        headerPadding: '1.5px 2px',
        cellHeight: '3.8mm',
        headerHeight: '4.2mm',
        titleSize: '11pt',
        titleMargin: '1.2mm',
        headerMargin: '1.2mm'
    }
};

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
    const [density, setDensity] = useState<DensityMode>('normal');
    const [padEmptyRows, setPadEmptyRows] = useState<boolean>(true);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('cce_print_manifest');
            if (raw) {
                const parsed: ManifestPrintData = JSON.parse(raw);
                setData(parsed);
                if (parsed.orientation) {
                    setIsLandscape(parsed.orientation === 'landscape');
                }
                // Auto-suggest compact if items count is between 18 and 25
                if (parsed.items && parsed.items.length >= 18 && parsed.items.length <= 25) {
                    setDensity('compact');
                } else if (parsed.items && parsed.items.length > 25 && parsed.items.length <= 30) {
                    setDensity('extra-compact');
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

    // Dynamic row padding:
    // If few items (< 16) and padEmptyRows is true, pad up to 16 rows to make single-page manifest neatly full.
    // If items >= 16, do NOT add empty dummy rows so large manifests flow cleanly across multiple pages without trailing blank space.
    const rows = [...data.items];
    if (padEmptyRows && data.items.length < 16) {
        while (rows.length < 16) {
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
    }

    const cfg = DENSITY_CONFIG[density];

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background: #475569;
                    color: #000;
                    padding: 0;
                    margin: 0;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    text-rendering: optimizeLegibility;
                }

                .print-canvas {
                    width: ${isLandscape ? '297mm' : '210mm'};
                    min-height: ${isLandscape ? '204mm' : '289mm'};
                    height: auto;
                    background: white;
                    margin: 20px auto 40px auto;
                    padding: 4mm 6mm;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: ${cfg.fontSize};
                    line-height: 1.15;
                    position: relative;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
                    box-sizing: border-box;
                    page-break-after: auto;
                    page-break-inside: auto;
                    overflow: visible;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    text-rendering: optimizeLegibility;
                }

                /* Header Title */
                .manifest-title {
                    text-align: center;
                    font-size: ${cfg.titleSize};
                    font-weight: 900;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    text-decoration: underline;
                    text-underline-offset: 3px;
                    margin-bottom: ${cfg.titleMargin};
                    color: #000;
                    page-break-inside: avoid;
                }

                /* Header Metadata Grid */
                .header-meta-table {
                    width: 100%;
                    margin-bottom: ${cfg.headerMargin};
                    border-collapse: collapse;
                    page-break-inside: avoid;
                }

                .header-meta-table td {
                    vertical-align: middle;
                    padding: 1px 4px;
                    color: #000;
                }

                /* Main Manifest Table */
                .manifest-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: ${cfg.fontSize};
                    color: #000;
                    page-break-inside: auto;
                }

                .manifest-table thead {
                    display: table-header-group;
                }

                .manifest-table tr {
                    page-break-inside: avoid;
                    page-break-after: auto;
                }

                .manifest-table th {
                    border: 1.5px solid #000;
                    padding: ${cfg.headerPadding};
                    text-align: center;
                    font-weight: 900;
                    background: #f8fafc;
                    color: #000;
                    text-transform: uppercase;
                    font-size: ${cfg.headerFontSize};
                    letter-spacing: 0.3px;
                    height: ${cfg.headerHeight};
                }

                .manifest-table td {
                    border: 1px solid #000;
                    padding: ${cfg.cellPadding};
                    vertical-align: middle;
                    height: ${cfg.cellHeight};
                    text-transform: uppercase;
                    font-size: ${cfg.fontSize};
                    line-height: 1.15;
                    color: #000;
                }

                .manifest-summary-row {
                    page-break-inside: avoid;
                }

                .row-purple { background-color: #f3e8ff !important; color: #000 !important; }
                .row-yellow { background-color: #fef9c3 !important; color: #000 !important; }
                .row-green { background-color: #dcfce7 !important; color: #000 !important; }
                .row-red { background-color: #fee2e2 !important; color: #000 !important; }
                .row-blue { background-color: #dbeafe !important; color: #000 !important; }
                .row-white { background-color: #ffffff !important; color: #000 !important; }

                @media print {
                    @page {
                        size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
                        margin: 4mm 5mm;
                    }
                    html, body {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
                    .print-canvas {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        height: auto !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        page-break-inside: auto !important;
                        page-break-after: auto !important;
                        page-break-before: auto !important;
                        overflow: visible !important;
                    }
                    .no-print { display: none !important; }

                    .manifest-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: auto !important;
                    }
                    .manifest-table thead {
                        display: table-header-group !important;
                    }
                    .manifest-table tr {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                    }
                    .manifest-summary-row {
                        page-break-inside: avoid !important;
                    }
                    .manifest-title, .header-meta-table {
                        page-break-inside: avoid !important;
                    }
                }
            ` }} />

            {/* Print toolbar - Sticky on screen, hidden on print */}
            <div className="no-print" style={{
                position: 'sticky',
                top: 0,
                zIndex: 9999,
                background: '#0f172a',
                color: '#f8fafc',
                padding: '10px 20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            }}>
                {/* Left controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => router.back()}
                        style={{
                            background: '#334155',
                            color: '#fff',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            border: '1px solid #475569',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        ← Kembali
                    </button>

                    <div style={{
                        background: '#1e293b',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#38bdf8'
                    }}>
                        📦 Total: {data.items.length} Resi
                    </div>

                    {/* Orientation toggle */}
                    <button
                        onClick={() => setIsLandscape(!isLandscape)}
                        style={{
                            background: '#1e293b',
                            color: '#f8fafc',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            border: '1px solid #334155',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '12px'
                        }}
                        title="Ubah Orientasi Kertas"
                    >
                        🔄 {isLandscape ? 'Landscape' : 'Portrait'}
                    </button>

                    {/* Density selector */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '3px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', padding: '0 8px', fontWeight: 'bold' }}>Kepadatan:</span>
                        {(['normal', 'compact', 'extra-compact'] as DensityMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setDensity(mode)}
                                style={{
                                    background: density === mode ? '#2563eb' : 'transparent',
                                    color: density === mode ? '#ffffff' : '#cbd5e1',
                                    border: 'none',
                                    padding: '5px 11px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: density === mode ? 'bold' : 'normal',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {DENSITY_CONFIG[mode].label}
                            </button>
                        ))}
                    </div>

                    {/* Pad empty rows toggle (only relevant when items < 16) */}
                    {data.items.length < 16 && (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer', background: '#1e293b', padding: '6px 10px', borderRadius: '8px', border: '1px solid #334155' }}>
                            <input
                                type="checkbox"
                                checked={padEmptyRows}
                                onChange={(e) => setPadEmptyRows(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                            />
                            Penuhi 16 Baris
                        </label>
                    )}
                </div>

                {/* Right action button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => window.print()}
                        style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '8px 22px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 10px rgba(16,185,129,0.4)'
                        }}
                    >
                        🖨️ Cetak PDF / Kertas
                    </button>
                </div>
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
                                <div style={{ fontSize: cfg.metaFontSize, fontWeight: 'bold' }}>Tgl : {data.tanggal || '-'}</div>
                                <div style={{ marginTop: '2px', fontSize: cfg.metaFontSize, fontWeight: 'bold' }}>Kapal : {data.kapal || '-'}</div>
                            </td>
                            <td style={{ width: '44%', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ fontSize: cfg.driverFontSize, fontWeight: '900', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#000', lineHeight: 1.15 }}>
                                    NOPOL : <span style={{ textDecoration: 'underline' }}>{data.nopol || '-'}</span>
                                </div>
                                <div style={{ fontSize: cfg.driverFontSize, fontWeight: '900', marginTop: '2px', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#000', lineHeight: 1.15 }}>
                                    SOPIR : <span style={{ textDecoration: 'underline' }}>{data.sopir || '-'}</span>
                                </div>
                            </td>
                            <td style={{ width: '28%', textAlign: 'right', verticalAlign: 'middle' }}>
                                <div style={{ fontSize: cfg.fontSize, fontWeight: 'bold' }}>Kepada Yth,</div>
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
                            const rowColorClass = item.color ? `row-${item.color}` : 'row-white';

                            return (
                                <tr key={index} className={rowColorClass}>
                                    <td style={{ textAlign: 'center', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }}>
                                        {index + 1}.
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: '900', letterSpacing: '0.4px', fontVariantNumeric: 'tabular-nums', color: '#000' }}>
                                        {item.noSTT || ''}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: '#000' }}>
                                        {item.koli ? item.koli : ''}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: '#000' }}>
                                        {item.berat !== undefined && item.berat !== 0 ? item.berat : ''}
                                    </td>
                                    <td style={{ fontWeight: '800', letterSpacing: '0.1px', color: '#000' }}>
                                        {item.pengirim || ''}
                                    </td>
                                    <td style={{ fontWeight: '800', letterSpacing: '0.1px', color: '#000' }}>
                                        {item.penerima || ''}
                                    </td>
                                    <td style={{ fontWeight: '600', color: '#000' }}>
                                        {item.isiBarang || ''}
                                    </td>
                                    <td style={{ fontWeight: '600', color: '#000' }}>
                                        {item.alamat || ''}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: '800', color: '#000' }}>
                                        {item.keterangan || ''}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Summary Row */}
                        <tr className="manifest-summary-row" style={{ fontWeight: '900', background: '#f1f5f9', borderTop: '2px solid #000' }}>
                            <td colSpan={2} style={{ textAlign: 'right', paddingRight: '8px', fontWeight: '900', fontSize: cfg.fontSize, color: '#000', height: cfg.headerHeight }}>TOTAL :</td>
                            <td style={{ textAlign: 'center', fontWeight: '900', fontSize: cfg.fontSize, color: '#000', fontVariantNumeric: 'tabular-nums', height: cfg.headerHeight }}>{totalKoli > 0 ? totalKoli : ''}</td>
                            <td style={{ textAlign: 'center', fontWeight: '900', fontSize: cfg.fontSize, color: '#000', fontVariantNumeric: 'tabular-nums', height: cfg.headerHeight }}>{totalBerat > 0 ? totalBerat.toLocaleString('id-ID') : ''}</td>
                            <td colSpan={5} style={{ height: cfg.headerHeight }}></td>
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
