'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Transaction, SuratJalanData } from '@/types/transaction';

interface ManualSuratJalanPayload {
    noSTT: string;
    tanggal: string;
    pengirimName: string;
    pengirimAddress?: string;
    pengirimPhone?: string;
    penerimaName: string;
    penerimaAddress?: string;
    penerimaPhone?: string;
    tujuan?: string;
    koli: number;
    berat: number | string;
    beratUnit?: string;
    isiBarang?: string;
    keterangan?: string;
    harga?: number;
    jumlah?: number;
    pembayaran?: string;
    mobil?: string;
    sopir?: string;
    kapal?: string;
}

interface PlySheetConfig {
    id: 'putih' | 'merah' | 'kuning';
    label: string;
    role: string;
    paperBg: string;
    watermarkColor: string;
    previewBadgeCls: string;
}

const PLY_SHEETS: PlySheetConfig[] = [
    {
        id: 'putih',
        label: 'Halaman 1 — PUTIH (Depan / Asli)',
        role: 'Lembar Asli / Pengirim',
        paperBg: '#ffffff',
        watermarkColor: 'rgba(217, 119, 54, 0.16)',
        previewBadgeCls: 'bg-white text-slate-800 border-slate-300',
    },
    {
        id: 'merah',
        label: 'Halaman 2 — MERAH (Tengah / Tindisan 1)',
        role: 'Lembar Tindisan Tengah',
        paperBg: '#f9dce4',
        watermarkColor: 'rgba(194, 90, 42, 0.16)',
        previewBadgeCls: 'bg-rose-100 text-rose-900 border-rose-300',
    },
    {
        id: 'kuning',
        label: 'Halaman 3 — KUNING (Belakang / Tindisan 2)',
        role: 'Lembar Tindisan Belakang',
        paperBg: '#fbf4bf',
        watermarkColor: 'rgba(196, 115, 36, 0.16)',
        previewBadgeCls: 'bg-amber-100 text-amber-900 border-amber-300',
    },
];

/**
 * Adaptive font sizing so text scales cleanly inside fixed table boxes
 * without clipping or overflowing.
 */
function adaptivePt(text: string | number | undefined | null, basePt: number, minPt: number, softLimit: number): string {
    const str = String(text ?? '').trim();
    if (!str || str.length <= softLimit) return `${basePt}pt`;
    const ratio = softLimit / str.length;
    const scaled = Math.max(minPt, Number((basePt * Math.sqrt(ratio)).toFixed(1)));
    return `${scaled}pt`;
}

function formatDateDisplay(raw?: string | Date | null): string {
    if (!raw) return '';
    if (raw instanceof Date) {
        if (isNaN(raw.getTime())) return '';
        return raw.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const trimmed = String(raw).trim();
    if (!trimmed) return '';
    // If already formatted like "KAMIS - 23 JULI 2026"
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return trimmed;
    return parsed.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function SuratJalanCheckbox({ checked }: { checked?: boolean }) {
    return (
        <span className="sj-checkbox">
            {checked ? '✓' : ''}
        </span>
    );
}

function PrintSuratJalanContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [manualData, setManualData] = useState<ManualSuratJalanPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Print Options
    const [paperMode, setPaperMode] = useState<'a4' | 'a5'>('a4');
    const [useColoredPlies, setUseColoredPlies] = useState<boolean>(true);
    const [printAllThree, setPrintAllThree] = useState<boolean>(true);

    // URL Params overrides (from SuratJalanModal or Manifest page)
    const paramTanggalPC = searchParams.get('tanggalPC') || '';
    const paramMobil = searchParams.get('mobil') || '';
    const paramSopir = searchParams.get('sopir') || '';
    const paramKapal = searchParams.get('kapal') || '';
    const paramRute = searchParams.get('rute') || '';
    const paramNamaPengirim = searchParams.get('namaPengirim') || '';
    const paramAlamatPengirim = searchParams.get('alamatPengirim') || '';
    const paramNamaPenerima = searchParams.get('namaPenerima') || '';
    const paramAlamatPenerima = searchParams.get('alamatPenerima') || '';
    const paramKonsesiBaik = searchParams.get('konsesiBaik');
    const paramKonsesiRusak = searchParams.get('konsesiRusak');
    const paramKonsesiKet = searchParams.get('konsesiKeterangan') || '';
    const paramAsuransi = searchParams.get('asuransi');
    const paramCaraPembayaran = searchParams.get('caraPembayaran') || '';
    const paramService = searchParams.get('service') || '';
    const paramDimensi = searchParams.get('dimensi') || '';
    const paramBeratVolume = searchParams.get('beratVolume') || '';
    const paramSatuanVolume = searchParams.get('satuanVolume') || '';
    const paramCatatanKhusus = searchParams.get('catatanKhusus') || '';

    useEffect(() => {
        const loadData = async () => {
            const rawId = params?.id;
            if (!rawId || typeof rawId !== 'string') {
                setLoading(false);
                setNotFound(true);
                return;
            }

            if (rawId === 'manual') {
                try {
                    const stored = sessionStorage.getItem('cce_print_surat_jalan_manual');
                    if (stored) {
                        setManualData(JSON.parse(stored));
                    } else {
                        setNotFound(true);
                    }
                } catch (err) {
                    console.error('Failed reading manual surat jalan data:', err);
                    setNotFound(true);
                } finally {
                    setLoading(false);
                }
                return;
            }

            try {
                const data = await getTransactionById(rawId);
                if (!data) {
                    setNotFound(true);
                } else {
                    setTransaction(data);
                }
            } catch (error) {
                console.error('Error loading transaction for surat jalan:', error);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [params?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-600">Menyiapkan Surat Jalan Rangkap 3...</p>
                </div>
            </div>
        );
    }

    if (notFound || (!transaction && !manualData)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
                <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full text-center space-y-4">
                    <h2 className="text-lg font-black text-slate-900">Data Surat Jalan Tidak Ditemukan</h2>
                    <p className="text-xs text-slate-500">
                        Pastikan resi STT sudah tersimpan atau buka kembali dari halaman Manifes Cargo / Transaksi.
                    </p>
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
                    >
                        Kembali
                    </button>
                </div>
            </div>
        );
    }

    // Merge data from Firestore Transaction (plus saved suratJalan if any) OR manual manifest row
    const savedSJ: Partial<SuratJalanData> = transaction?.suratJalan || {};

    const noResiRaw = transaction?.noSTT || manualData?.noSTT || '';
    const displayNoResi = noResiRaw.trim() || '-';

    const tanggalDisplay = formatDateDisplay(
        paramTanggalPC || savedSJ.tanggalPC || transaction?.tanggal || manualData?.tanggal
    );

    const pengirimPerusahaan = (transaction?.pengirimName || manualData?.pengirimName || '').trim();
    const pengirimNama = (paramNamaPengirim || savedSJ.namaPengirim || pengirimPerusahaan).trim();
    const pengirimAlamat = (
        paramAlamatPengirim ||
        savedSJ.alamatPengirim ||
        [transaction?.pengirimAddress, transaction?.pengirimCity].filter(Boolean).join(' - ') ||
        manualData?.pengirimAddress ||
        ''
    ).trim();
    const pengirimTelp = (transaction?.pengirimPhone || manualData?.pengirimPhone || '').trim();

    const penerimaPerusahaan = (transaction?.penerimaName || manualData?.penerimaName || '').trim();
    const penerimaNama = (paramNamaPenerima || savedSJ.namaPenerima || penerimaPerusahaan).trim();
    const penerimaAlamat = (
        paramAlamatPenerima ||
        savedSJ.alamatPenerima ||
        [transaction?.penerimaAddress, transaction?.tujuan].filter(Boolean).join(' - ') ||
        [manualData?.penerimaAddress, manualData?.tujuan].filter(Boolean).join(' - ') ||
        ''
    ).trim();
    const penerimaTelp = (transaction?.penerimaPhone || manualData?.penerimaPhone || '').trim();

    const konsesiBaik = paramKonsesiBaik !== null ? paramKonsesiBaik === 'true' : (savedSJ.konsesiBaik ?? true);
    const konsesiRusak = paramKonsesiRusak !== null ? paramKonsesiRusak === 'true' : (savedSJ.konsesiRusak ?? false);
    const konsesiKeterangan = (paramKonsesiKet || savedSJ.konsesiKeterangan || transaction?.keterangan || manualData?.keterangan || '').trim();

    const asuransiChecked = paramAsuransi !== null ? paramAsuransi === 'true' : savedSJ.asuransi;

    const serviceVal = (paramService || savedSJ.service || 'laut').toLowerCase();
    const serviceUdara = serviceVal === 'udara';
    const serviceDarat = serviceVal === 'darat';
    const serviceLaut = serviceVal === 'laut';

    const rawPayment = (
        paramCaraPembayaran ||
        savedSJ.caraPembayaran ||
        transaction?.pembayaran ||
        manualData?.pembayaran ||
        ''
    ).toLowerCase();
    const bayarTunai = rawPayment === 'tunai' || rawPayment === 'cash';
    const bayarInvoice = rawPayment === 'invoice' || rawPayment === 'kredit' || rawPayment === 'bank';
    const bayarTujuan = rawPayment === 'bayar tujuan' || rawPayment === 'cod' || rawPayment === 'dp';

    const transportNotes = [
        paramKapal || manualData?.kapal ? `Kapal: ${paramKapal || manualData?.kapal}` : '',
        paramMobil || savedSJ.nomorMobil || manualData?.mobil ? `Truk: ${paramMobil || savedSJ.nomorMobil || manualData?.mobil}` : '',
        paramSopir || savedSJ.namaSopir || manualData?.sopir ? `Sopir: ${paramSopir || savedSJ.namaSopir || manualData?.sopir}` : '',
        paramRute || savedSJ.rute ? `Rute: ${paramRute || savedSJ.rute}` : '',
    ].filter(Boolean).join(' | ');

    const catatanKhusus = (paramCatatanKhusus || savedSJ.catatanKhusus || transportNotes).trim();

    const totalKoli = transaction ? transaction.koli : (manualData?.koli ?? 0);
    const beratRaw = transaction ? transaction.berat : (manualData?.berat ?? '');
    const beratUnit = transaction?.beratUnit || manualData?.beratUnit || 'KG';
    const displayBerat = beratRaw !== '' && Number(beratRaw) > 0
        ? `${beratRaw} ${beratUnit}`
        : (typeof beratRaw === 'string' && beratRaw.trim() !== '' && beratRaw.trim() !== '0' ? beratRaw : '');

    const dimensiDisplay = (paramDimensi || savedSJ.dimensi || '').trim();
    const beratVolumeNum = parseFloat(paramBeratVolume || '') || savedSJ.beratVolume || 0;
    const beratVolumeDisplay = beratVolumeNum > 0
        ? `${beratVolumeNum} ${paramSatuanVolume || savedSJ.satuanVolume || 'M3'}`
        : '';

    const isiBarangDisplay = (transaction?.isiBarang || manualData?.isiBarang || '').trim();

    const hargaNum = transaction?.harga ?? manualData?.harga ?? 0;
    const jumlahNum = transaction?.jumlah ?? manualData?.jumlah ?? 0;
    const displayHarga = hargaNum > 0 ? `Rp ${hargaNum.toLocaleString('id-ID')}` : '';
    const displayJumlah = jumlahNum > 0 ? `Rp ${jumlahNum.toLocaleString('id-ID')}` : '';

    const sheetsToRender = printAllThree ? PLY_SHEETS : [PLY_SHEETS[0]];

    const pageSizeRule = paperMode === 'a5'
        ? `@page { size: 210mm 148mm; margin: 3mm; }`
        : `@page { size: A4 portrait; margin: 6mm; }`;

    const sheetWidth = paperMode === 'a5' ? '204mm' : '198mm';
    const sheetMinHeight = paperMode === 'a5' ? '141mm' : '156mm';
    const sigCellHeight = paperMode === 'a5' ? '30mm' : '36mm';

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    ${pageSizeRule}
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    .no-print { display: none !important; }
                    .sj-preview-wrapper {
                        padding: 0 !important;
                        background: transparent !important;
                        gap: 0 !important;
                    }
                    .sj-page-wrap {
                        margin: 0 !important;
                        padding: 0 !important;
                        page-break-after: always;
                        break-after: page;
                        box-shadow: none !important;
                    }
                    .sj-page-wrap:last-child {
                        page-break-after: auto;
                        break-after: auto;
                    }
                    .sj-sheet {
                        box-shadow: none !important;
                        margin: 0 auto !important;
                    }
                }

                * { box-sizing: border-box; }

                .sj-sheet {
                    width: ${sheetWidth};
                    min-height: ${sheetMinHeight};
                    font-family: Arial, Helvetica, sans-serif;
                    color: #164486;
                    border: 1.8px solid #164486;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                }

                .sj-kop {
                    display: grid;
                    grid-template-columns: 28mm 1fr 50mm;
                    align-items: center;
                    padding: 1.6mm 2.8mm 1.3mm 2.8mm;
                    border-bottom: 1.8px solid #164486;
                    position: relative;
                    z-index: 2;
                }

                .sj-kop-logo {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .sj-kop-logo img {
                    width: 23mm;
                    height: 19mm;
                    object-fit: contain;
                }

                .sj-kop-center {
                    text-align: center;
                    line-height: 1.18;
                }

                .sj-company-name {
                    font-size: 16pt;
                    font-weight: 900;
                    color: #d97326;
                    letter-spacing: 0.6px;
                    margin: 0;
                    line-height: 1.06;
                }

                .sj-addresses {
                    margin-top: 0.6mm;
                    font-size: 7.6pt;
                    font-weight: 700;
                    color: #164486;
                    line-height: 1.25;
                }

                .sj-subtitle {
                    margin-top: 1mm;
                    font-size: 10.5pt;
                    font-weight: 900;
                    color: #d97326;
                    letter-spacing: 1.4px;
                }

                .sj-kop-right {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    height: 100%;
                    padding: 0.4mm 0 0 2mm;
                    gap: 2mm;
                }

                .sj-resi-line {
                    display: flex;
                    align-items: baseline;
                    justify-content: flex-end;
                    gap: 1.5mm;
                    white-space: nowrap;
                }

                .sj-resi-label {
                    font-size: 8.5pt;
                    font-weight: 800;
                    color: #164486;
                    white-space: nowrap;
                }

                .sj-resi-number {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12.5pt;
                    font-weight: 900;
                    color: #111827;
                    letter-spacing: 0.5px;
                }

                .sj-tanggal-line {
                    display: flex;
                    align-items: baseline;
                    justify-content: flex-start;
                    gap: 1.5mm;
                    border-bottom: 1px dotted #164486;
                    padding-bottom: 0.4mm;
                    font-size: 8pt;
                    font-weight: 700;
                    color: #164486;
                }

                .sj-tanggal-lbl {
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .sj-tanggal-val {
                    color: #111827;
                    font-weight: 800;
                    line-height: 1.15;
                    word-break: break-word;
                }

                /* Main Table Structure */
                .sj-body {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }

                .sj-watermark {
                    position: absolute;
                    top: 48%;
                    left: 48%;
                    transform: translate(-50%, -50%) rotate(-19deg);
                    font-size: 26pt;
                    font-weight: 900;
                    letter-spacing: 2px;
                    white-space: nowrap;
                    pointer-events: none;
                    user-select: none;
                    z-index: 1;
                }

                .sj-band {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    position: relative;
                    z-index: 2;
                }

                .sj-band th, .sj-band td {
                    border: 1.2px solid #164486;
                    vertical-align: top;
                }

                .sj-band tr:first-child th,
                .sj-band tr:first-child td {
                    border-top: none;
                }

                .sj-band td:first-child,
                .sj-band th:first-child {
                    border-left: none;
                }

                .sj-band td:last-child,
                .sj-band th:last-child {
                    border-right: none;
                }

                .sj-sec-th {
                    text-align: center;
                    font-size: 8.6pt;
                    font-weight: 800;
                    color: #164486;
                    padding: 0.7mm 1.5mm;
                    letter-spacing: 0.4px;
                }

                .sj-field-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 1.2mm;
                    padding: 0.7mm 1.8mm;
                    border-bottom: 1px solid #164486;
                    min-height: 5.2mm;
                }

                .sj-field-row:last-child {
                    border-bottom: none;
                }

                .sj-field-label {
                    font-size: 7.3pt;
                    font-weight: 700;
                    color: #164486;
                    white-space: nowrap;
                    min-width: 19mm;
                    flex-shrink: 0;
                    padding-top: 0.2mm;
                }

                .sj-field-colon {
                    font-size: 7.4pt;
                    font-weight: 700;
                    color: #164486;
                    flex-shrink: 0;
                    padding-top: 0.2mm;
                }

                .sj-field-val {
                    color: #0f172a;
                    font-weight: 700;
                    line-height: 1.2;
                    word-break: break-word;
                    overflow-wrap: anywhere;
                    flex: 1;
                }

                .sj-checkbox {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 4.4mm;
                    height: 3.1mm;
                    border: 1.1px solid #164486;
                    font-size: 7.2pt;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1;
                    flex-shrink: 0;
                }

                .sj-check-item {
                    display: flex;
                    align-items: center;
                    gap: 1.4mm;
                    font-size: 7pt;
                    font-weight: 700;
                    color: #164486;
                    margin-bottom: 0.75mm;
                }

                .sj-band2-wrap {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    position: relative;
                    z-index: 2;
                    border-bottom: 1.2px solid #164486;
                }

                .sj-band2-hdr {
                    display: grid;
                    grid-template-columns: 39% 61%;
                    border-bottom: 1.2px solid #164486;
                }

                .sj-band2-hdr > div:first-child {
                    border-right: 1.2px solid #164486;
                }

                .sj-band2-body {
                    display: grid;
                    grid-template-columns: 39% 61%;
                    flex: 1;
                    align-items: stretch;
                }

                .sj-band2-left {
                    border-right: 1.2px solid #164486;
                    padding: 1.6mm 2mm;
                }

                .sj-band2-right {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .sj-koli-top {
                    display: grid;
                    grid-template-columns: 18% 16% 26% 18% 22%;
                    min-height: 22mm;
                    border-bottom: 1.2px solid #164486;
                }

                .sj-koli-top > div {
                    padding: 0.9mm 1.2mm;
                    text-align: center;
                    position: relative;
                }

                .sj-koli-top > div:not(:last-child) {
                    border-right: 1.2px solid #164486;
                }

                .sj-koli-bottom {
                    display: grid;
                    grid-template-columns: 78% 22%;
                    flex: 1;
                    min-height: 17mm;
                }

                .sj-koli-bottom > div {
                    padding: 1mm 1.5mm;
                }

                .sj-koli-bottom > div:first-child {
                    border-right: 1.2px solid #164486;
                }

                .sj-sub-hdr {
                    font-size: 6.7pt;
                    font-weight: 800;
                    color: #164486;
                    text-align: center;
                    line-height: 1.15;
                }

                .sj-sig-cell {
                    padding: 1.5mm 2.2mm 1.8mm 2.2mm;
                    height: ${sigCellHeight};
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                .sj-sig-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    font-size: 7.8pt;
                    font-weight: 700;
                    color: #164486;
                }

                .sj-sig-bottom {
                    font-size: 7.8pt;
                    font-weight: 700;
                    color: #164486;
                }
            `}} />

            {/* Sticky Screen-Only Print Toolbar */}
            <div className="no-print sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-700 px-4 py-3 shadow-lg">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm bg-blue-600 px-2.5 py-0.5 rounded-lg">
                                {displayNoResi}
                            </span>
                            <h1 className="font-black text-sm sm:text-base">
                                Cetak Surat Jalan / Surat Tanda Terima (Rangkap 3)
                            </h1>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                            3 Halaman Terpisah: Putih (Depan) • Merah (Tengah) • Kuning (Belakang)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Paper Size Switcher */}
                        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 font-bold">
                            <button
                                type="button"
                                onClick={() => setPaperMode('a4')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${paperMode === 'a4' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
                            >
                                Kertas A4
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaperMode('a5')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${paperMode === 'a5' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
                            >
                                A5 Landscape
                            </button>
                        </div>

                        {/* Color Background Toggle */}
                        <button
                            type="button"
                            onClick={() => setUseColoredPlies(prev => !prev)}
                            className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                                useColoredPlies
                                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                            title="Aktifkan warna kertas Putih / Merah / Kuning saat cetak di HVS putih"
                        >
                            {useColoredPlies ? '🎨 Warna Tindisan: ON' : '⬜ Warna Tindisan: OFF'}
                        </button>

                        {/* 3 Plies vs 1 Page Toggle */}
                        <button
                            type="button"
                            onClick={() => setPrintAllThree(prev => !prev)}
                            className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                                printAllThree
                                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                        >
                            {printAllThree ? '📑 Rangkap 3 (3 Hal)' : '📄 1 Halaman'}
                        </button>

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                            🖨️ Cetak Sekarang
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (window.opener) window.close();
                                else router.back();
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-xl font-bold"
                        >
                            ✕ Tutup
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview & Print Pages Container */}
            <div className="sj-preview-wrapper min-h-screen bg-slate-200 py-6 px-4 flex flex-col items-center gap-8">
                {sheetsToRender.map((ply) => {
                    const sheetBg = useColoredPlies ? ply.paperBg : '#ffffff';

                    return (
                        <div key={ply.id} className="sj-page-wrap flex flex-col items-center">
                            {/* Screen-only ply indicator pill */}
                            <div className={`no-print mb-2 px-3.5 py-1 rounded-full border text-xs font-extrabold shadow-xs ${ply.previewBadgeCls}`}>
                                {ply.label}
                            </div>

                            {/* OFFICIAL CAHAYA CARGO EXPRESS FORM SHEET */}
                            <div className="sj-sheet shadow-2xl" style={{ backgroundColor: sheetBg }}>
                                {/* ── KOP SURAT (LOGO KIRI | ALAMAT DI TENGAH | NO RESI & TANGGAL KANAN) ── */}
                                <div className="sj-kop">
                                    <div className="sj-kop-logo">
                                        <img src="/logo.png" alt="Cahaya Cargo Express Logo" />
                                    </div>

                                    <div className="sj-kop-center">
                                        <h1 className="sj-company-name">CAHAYA CARGO EXPRESS</h1>
                                        <div className="sj-addresses">
                                            <div>Jl. Kemudi No. 4 - Surabaya HP : 081 357 979 159</div>
                                            <div>Jl. Gandasari (Ps Sentra Bisnis Warlob) G1 - Bandung HP : 081 2254 777</div>
                                            <div>Jl. Irian No. 318 - Makassar HP : 0852 4220 9396</div>
                                        </div>
                                        <div className="sj-subtitle">SURAT TANDA TERIMA</div>
                                    </div>

                                    <div className="sj-kop-right">
                                        <div className="sj-resi-line">
                                            <span className="sj-resi-label">NO. RESI :</span>
                                            <span
                                                className="sj-resi-number"
                                                style={{ fontSize: adaptivePt(displayNoResi, 12.5, 9.5, 9) }}
                                            >
                                                {displayNoResi}
                                            </span>
                                        </div>
                                        <div className="sj-tanggal-line">
                                            <span className="sj-tanggal-lbl">Tanggal :</span>
                                            <span
                                                className="sj-tanggal-val"
                                                style={{ fontSize: adaptivePt(tanggalDisplay, 8.2, 6.8, 14) }}
                                            >
                                                {tanggalDisplay}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ── BODY TABLES ── */}
                                <div className="sj-body">
                                    {/* Diagonal Watermark spanning middle section */}
                                    <div className="sj-watermark" style={{ color: ply.watermarkColor }}>
                                        ISI TIDAK DI PERIKSA
                                    </div>

                                    {/* BAND 1: 1. PENGIRIM | 2. PENERIMA | 3. LAIN - LAIN */}
                                    <table className="sj-band">
                                        <colgroup>
                                            <col style={{ width: '39%' }} />
                                            <col style={{ width: '39%' }} />
                                            <col style={{ width: '22%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th className="sj-sec-th">1. PENGIRIM</th>
                                                <th className="sj-sec-th">2. PENERIMA</th>
                                                <th className="sj-sec-th">3. LAIN - LAIN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {/* 1. PENGIRIM */}
                                                <td style={{ padding: 0 }}>
                                                    <div className="sj-field-row">
                                                        <span className="sj-field-label">PERUSAHAAN</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(pengirimPerusahaan, 9.5, 7.2, 24) }}
                                                        >
                                                            {pengirimPerusahaan}
                                                        </span>
                                                    </div>
                                                    <div className="sj-field-row">
                                                        <span className="sj-field-label">NAMA</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(pengirimNama, 9.2, 7.2, 24) }}
                                                        >
                                                            {pengirimNama}
                                                        </span>
                                                    </div>
                                                    <div className="sj-field-row" style={{ minHeight: '11.5mm' }}>
                                                        <span className="sj-field-label">ALAMAT</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(pengirimAlamat, 8.8, 6.8, 42) }}
                                                        >
                                                            {pengirimAlamat}
                                                        </span>
                                                    </div>
                                                    <div className="sj-field-row">
                                                        <span className="sj-field-label">TELP</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(pengirimTelp, 8.8, 7.2, 20) }}
                                                        >
                                                            {pengirimTelp}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 2. PENERIMA */}
                                                <td style={{ padding: 0 }}>
                                                    <div className="sj-field-row">
                                                        <span className="sj-field-label">PERUSAHAAN</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(penerimaPerusahaan, 9.5, 7.2, 24) }}
                                                        >
                                                            {penerimaPerusahaan}
                                                        </span>
                                                    </div>
                                                    <div className="sj-field-row">
                                                        <span className="sj-field-label">NAMA</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(penerimaNama, 9.2, 7.2, 24) }}
                                                        >
                                                            {penerimaNama}
                                                        </span>
                                                    </div>
                                                    <div className="sj-field-row" style={{ minHeight: '11.5mm' }}>
                                                        <span className="sj-field-label">ALAMAT</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(penerimaAlamat, 8.8, 6.8, 42) }}
                                                        >
                                                            {penerimaAlamat}
                                                        </span>
                                                    </div>
                                                    <div className="sj-field-row">
                                                        <span className="sj-field-label">TELP</span>
                                                        <span className="sj-field-colon">:</span>
                                                        <span
                                                            className="sj-field-val"
                                                            style={{ fontSize: adaptivePt(penerimaTelp, 8.8, 7.2, 20) }}
                                                        >
                                                            {penerimaTelp}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 3. LAIN - LAIN */}
                                                <td style={{ padding: '1.5mm 2mm' }}>
                                                    <div style={{ fontSize: '7.1pt', fontWeight: 700, marginBottom: '1.8mm' }}>
                                                        KONDISI DITERIMA DENGAN :
                                                    </div>
                                                    <div style={{ paddingLeft: '3mm', marginBottom: '2mm' }}>
                                                        <div className="sj-check-item">
                                                            <SuratJalanCheckbox checked={konsesiBaik} />
                                                            <span>BAIK</span>
                                                        </div>
                                                        <div className="sj-check-item">
                                                            <SuratJalanCheckbox checked={konsesiRusak} />
                                                            <span>RUSAK</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '7.1pt', fontWeight: 700, marginBottom: '0.6mm' }}>
                                                        KETERANGAN :
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: '#0f172a',
                                                            fontWeight: 700,
                                                            lineHeight: 1.2,
                                                            wordBreak: 'break-word',
                                                            fontSize: adaptivePt(konsesiKeterangan, 8.2, 6.5, 28),
                                                        }}
                                                    >
                                                        {konsesiKeterangan}
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* BAND 2: 4. SERVICE, ASURANSI, PEMBAYARAN | 5. KOLI - BERAT - VOLUME & HARGA */}
                                    <div className="sj-band2-wrap">
                                        <div className="sj-band2-hdr">
                                            <div className="sj-sec-th">4. SERVICE, ASURANSI, PEMBAYARAN</div>
                                            <div className="sj-sec-th">5. KOLI - BERAT - VOLUME &amp; HARGA</div>
                                        </div>

                                        <div className="sj-band2-body">
                                            {/* 4. SERVICE, ASURANSI, PEMBAYARAN */}
                                            <div className="sj-band2-left">
                                                <div style={{ display: 'grid', gridTemplateColumns: '48% 52%', gap: '1.5mm', height: '100%' }}>
                                                    {/* Left Sub-column: SERVICE + CARA PEMBAYARAN */}
                                                    <div>
                                                        <div style={{ fontSize: '7.3pt', fontWeight: 800, marginBottom: '1mm' }}>SERVICE</div>
                                                        <div className="sj-check-item">
                                                            <SuratJalanCheckbox checked={serviceUdara} />
                                                            <span>UDARA</span>
                                                        </div>
                                                        <div className="sj-check-item">
                                                            <SuratJalanCheckbox checked={serviceDarat} />
                                                            <span>DARAT</span>
                                                        </div>
                                                        <div className="sj-check-item">
                                                            <SuratJalanCheckbox checked={serviceLaut} />
                                                            <span>LAUT</span>
                                                        </div>
                                                        <div className="sj-check-item" style={{ marginBottom: '2mm' }}>
                                                            <SuratJalanCheckbox checked={false} />
                                                            <span></span>
                                                        </div>

                                                        <div style={{ fontSize: '7.3pt', fontWeight: 800, marginBottom: '1mm' }}>CARA PEMBAYARAN</div>
                                                        <div className="sj-check-item">
                                                            <SuratJalanCheckbox checked={bayarTunai} />
                                                            <span>TUNAI</span>
                                                        </div>
                                                        <div className="sj-check-item">
                                                            <SuratJalanCheckbox checked={bayarInvoice} />
                                                            <span>INVOICE</span>
                                                        </div>
                                                        <div className="sj-check-item" style={{ marginBottom: 0 }}>
                                                            <SuratJalanCheckbox checked={bayarTujuan} />
                                                            <span>BAYAR TUJUAN</span>
                                                        </div>
                                                    </div>

                                                    {/* Right Sub-column: ASURANSI + CATATAN KHUSUS */}
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ fontSize: '7.3pt', fontWeight: 800, marginBottom: '1mm', textAlign: 'center' }}>
                                                            ASURANSI
                                                        </div>
                                                        <div style={{ paddingLeft: '2mm', marginBottom: '2.5mm' }}>
                                                            <div className="sj-check-item">
                                                                <SuratJalanCheckbox checked={asuransiChecked === true} />
                                                                <span>YA</span>
                                                            </div>
                                                            <div className="sj-check-item">
                                                                <SuratJalanCheckbox checked={asuransiChecked === false} />
                                                                <span>TIDAK</span>
                                                            </div>
                                                        </div>

                                                        <div style={{ fontSize: '7.3pt', fontWeight: 800, textAlign: 'center', marginBottom: '1mm' }}>
                                                            CATATAN KHUSUS
                                                        </div>
                                                        <div
                                                            style={{
                                                                flex: 1,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                justifyContent: 'space-between',
                                                                paddingTop: '0.5mm',
                                                            }}
                                                        >
                                                            {catatanKhusus ? (
                                                                <div
                                                                    style={{
                                                                        color: '#0f172a',
                                                                        fontWeight: 700,
                                                                        lineHeight: 1.3,
                                                                        wordBreak: 'break-word',
                                                                        fontSize: adaptivePt(catatanKhusus, 8, 6.4, 34),
                                                                        borderBottom: '1px solid #164486',
                                                                        paddingBottom: '0.8mm',
                                                                    }}
                                                                >
                                                                    {catatanKhusus}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div style={{ borderBottom: '1px solid #164486', height: '4.5mm' }} />
                                                                    <div style={{ borderBottom: '1px solid #164486', height: '4.5mm' }} />
                                                                    <div style={{ borderBottom: '1px solid #164486', height: '4.5mm' }} />
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 5. KOLI - BERAT - VOLUME & HARGA */}
                                            <div className="sj-band2-right">
                                                {/* Upper Row: TOTAL KOLI | BERAT | P x L x T | BERAT VOLUME | HARGA */}
                                                <div className="sj-koli-top">
                                                    <div>
                                                        <div className="sj-sub-hdr">TOTAL KOLI</div>
                                                        <div
                                                            style={{
                                                                color: '#0f172a',
                                                                fontWeight: 900,
                                                                marginTop: '3mm',
                                                                fontSize: adaptivePt(totalKoli, 13, 9.5, 4),
                                                            }}
                                                        >
                                                            {totalKoli > 0 ? totalKoli : ''}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                                        <div className="sj-sub-hdr">BERAT</div>
                                                        <div
                                                            style={{
                                                                color: '#0f172a',
                                                                fontWeight: 800,
                                                                fontSize: adaptivePt(displayBerat, 10, 7.2, 8),
                                                                wordBreak: 'break-word',
                                                            }}
                                                        >
                                                            {displayBerat}
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: '7pt',
                                                                fontWeight: 800,
                                                                color: '#164486',
                                                            }}
                                                        >
                                                            M3 / KG
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="sj-sub-hdr">PANJANG X LEBAR X TINGGI</div>
                                                        <div
                                                            style={{
                                                                color: '#0f172a',
                                                                fontWeight: 700,
                                                                marginTop: '2.8mm',
                                                                fontSize: adaptivePt(dimensiDisplay, 9, 7, 14),
                                                                wordBreak: 'break-word',
                                                            }}
                                                        >
                                                            {dimensiDisplay}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="sj-sub-hdr">BERAT VOLUME</div>
                                                        <div
                                                            style={{
                                                                color: '#0f172a',
                                                                fontWeight: 800,
                                                                marginTop: '2.8mm',
                                                                fontSize: adaptivePt(beratVolumeDisplay, 9.5, 7, 10),
                                                            }}
                                                        >
                                                            {beratVolumeDisplay}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="sj-sub-hdr">HARGA</div>
                                                        <div
                                                            style={{
                                                                color: '#0f172a',
                                                                fontWeight: 800,
                                                                marginTop: '2.8mm',
                                                                fontSize: adaptivePt(displayHarga, 9.2, 7, 11),
                                                                fontFamily: 'monospace',
                                                            }}
                                                        >
                                                            {displayHarga}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Lower Row: KETERANGAN ISI BARANG (78%) | JUMLAH (22%) */}
                                                <div className="sj-koli-bottom">
                                                    <div>
                                                        <div className="sj-sub-hdr" style={{ marginBottom: '1.2mm' }}>
                                                            KETERANGAN ISI BARANG
                                                        </div>
                                                        <div
                                                            style={{
                                                                color: '#0f172a',
                                                                fontWeight: 800,
                                                                textAlign: 'center',
                                                                lineHeight: 1.25,
                                                                wordBreak: 'break-word',
                                                                fontSize: adaptivePt(isiBarangDisplay, 10.5, 7.5, 36),
                                                            }}
                                                        >
                                                            {isiBarangDisplay}
                                                        </div>
                                                    </div>

                                                    <div style={{ textAlign: 'center' }}>
                                                        <div className="sj-sub-hdr">JUMLAH</div>
                                                        <div
                                                            style={{
                                                                color: '#0f172a',
                                                                fontWeight: 900,
                                                                marginTop: '2.5mm',
                                                                fontSize: adaptivePt(displayJumlah, 9.5, 7, 12),
                                                                fontFamily: 'monospace',
                                                            }}
                                                        >
                                                            {displayJumlah}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BAND 3: 6. PENGIRIM | 7. PENERIMA | 8. DIAMBIL OLEH */}
                                    <table className="sj-band" style={{ borderBottom: 'none' }}>
                                        <colgroup>
                                            <col style={{ width: '39%' }} />
                                            <col style={{ width: '36%' }} />
                                            <col style={{ width: '25%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th className="sj-sec-th">6. PENGIRIM</th>
                                                <th className="sj-sec-th">7. PENERIMA</th>
                                                <th className="sj-sec-th">8. DIAMBIL OLEH</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: 0, borderBottom: 'none' }}>
                                                    <div className="sj-sig-cell">
                                                        <div className="sj-sig-top">
                                                            <span>Tgl :</span>
                                                            <span style={{ marginRight: '5mm' }}>Stempel &amp; Nama Terang</span>
                                                        </div>
                                                        <div className="sj-sig-bottom">Jam :</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: 0, borderBottom: 'none' }}>
                                                    <div className="sj-sig-cell">
                                                        <div className="sj-sig-top">
                                                            <span>Tgl :</span>
                                                            <span style={{ marginRight: '4mm' }}>Stempel &amp; Nama Terang</span>
                                                        </div>
                                                        <div className="sj-sig-bottom">Jam :</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: 0, borderBottom: 'none' }}>
                                                    <div className="sj-sig-cell">
                                                        <div className="sj-sig-top">
                                                            <span>Tgl :</span>
                                                        </div>
                                                        <div className="sj-sig-bottom">Jam :</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export default function PrintSuratJalanPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen bg-slate-100">
                    <p className="text-sm font-semibold text-slate-600">Memuat Surat Jalan...</p>
                </div>
            }
        >
            <PrintSuratJalanContent />
        </Suspense>
    );
}
