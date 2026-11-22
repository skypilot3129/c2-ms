'use client';

import { use, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getClientById } from '@/lib/firestore';
import { getInvoiceById } from '@/lib/firestore-invoices';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';
import { toBlob, toJpeg, toPng } from 'html-to-image';

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

const MIN_ROWS_A4 = 10;

interface StdLayoutConfig {
    pagePad: string;
    headerMb: string;
    logoSize: string;
    companyPt: string;
    addrPt: string;
    addrLh: number;
    metaPt: string;
    metaLh: number;
    metaLabelW: string;
    titlePt: string;
    titleSpacing: string;
    titleMb: string;
    kepadaMb: string;
    kepadaPt: string;
    clientPt: string;
    tableFontPt: string;
    tableCellPad: string;
    terbilangPt: string;
    totalLabelPt: string;
    footerMt: string;
    bankTitlePt: string;
    bankPt: string;
    bankLh: number;
    ttdWidth: string;
    ttdMaxHeight: string;
    ttdPt: string;
}

function getStdInvoiceLayout(isCompactA5: boolean, itemRowCount: number): StdLayoutConfig {
    if (!isCompactA5) {
        return {
            pagePad: '8mm 12mm 6mm 12mm',
            headerMb: '4mm',
            logoSize: '18mm',
            companyPt: '11pt',
            addrPt: '8pt',
            addrLh: 1.5,
            metaPt: '8.5pt',
            metaLh: 1.8,
            metaLabelW: '75px',
            titlePt: '13pt',
            titleSpacing: '8px',
            titleMb: '3mm',
            kepadaMb: '3mm',
            kepadaPt: '8.5pt',
            clientPt: '9.5pt',
            tableFontPt: '9.5pt',
            tableCellPad: '3px 4px',
            terbilangPt: '7.5pt',
            totalLabelPt: '9pt',
            footerMt: '4mm',
            bankTitlePt: '10.5pt',
            bankPt: '10.5pt',
            bankLh: 1.8,
            ttdWidth: '45mm',
            ttdMaxHeight: 'none',
            ttdPt: '4mm',
        };
    }

    if (itemRowCount >= 12) {
        return {
            pagePad: '3.5mm 8.5mm 3.5mm 8.5mm',
            headerMb: '1mm',
            logoSize: '12.5mm',
            companyPt: '9.8pt',
            addrPt: '7pt',
            addrLh: 1.25,
            metaPt: '7.6pt',
            metaLh: 1.35,
            metaLabelW: '58px',
            titlePt: '10.5pt',
            titleSpacing: '5px',
            titleMb: '1.2mm',
            kepadaMb: '1.5mm',
            kepadaPt: '7.6pt',
            clientPt: '8.2pt',
            tableFontPt: '7.8pt',
            tableCellPad: '1.5px 3.5px',
            terbilangPt: '7pt',
            totalLabelPt: '8pt',
            footerMt: '2mm',
            bankTitlePt: '8.5pt',
            bankPt: '8.2pt',
            bankLh: 1.3,
            ttdWidth: '30mm',
            ttdMaxHeight: '18mm',
            ttdPt: '0.5mm',
        };
    }

    if (itemRowCount >= 9) {
        return {
            pagePad: '4.5mm 9mm 4.5mm 9mm',
            headerMb: '1.5mm',
            logoSize: '14.5mm',
            companyPt: '10.5pt',
            addrPt: '7.5pt',
            addrLh: 1.3,
            metaPt: '8.2pt',
            metaLh: 1.45,
            metaLabelW: '62px',
            titlePt: '11.5pt',
            titleSpacing: '6px',
            titleMb: '1.5mm',
            kepadaMb: '1.8mm',
            kepadaPt: '8pt',
            clientPt: '8.8pt',
            tableFontPt: '8.5pt',
            tableCellPad: '2px 4px',
            terbilangPt: '7.2pt',
            totalLabelPt: '8.5pt',
            footerMt: '2.5mm',
            bankTitlePt: '9pt',
            bankPt: '9pt',
            bankLh: 1.4,
            ttdWidth: '35mm',
            ttdMaxHeight: '21mm',
            ttdPt: '1mm',
        };
    }

    return {
        pagePad: '6mm 10mm 5.5mm 10mm',
        headerMb: '2.5mm',
        logoSize: '17mm',
        companyPt: '11pt',
        addrPt: '8.2pt',
        addrLh: 1.4,
        metaPt: '8.8pt',
        metaLh: 1.65,
        metaLabelW: '68px',
        titlePt: '13pt',
        titleSpacing: '8px',
        titleMb: '2.5mm',
        kepadaMb: '2.5mm',
        kepadaPt: '8.5pt',
        clientPt: '9.5pt',
        tableFontPt: '9.5pt',
        tableCellPad: '3px 4px',
        terbilangPt: '7.8pt',
        totalLabelPt: '9pt',
        footerMt: '3.5mm',
        bankTitlePt: '10pt',
        bankPt: '10pt',
        bankLh: 1.55,
        ttdWidth: '42mm',
        ttdMaxHeight: '26mm',
        ttdPt: '1.5mm',
    };
}

function normalizeWaPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
}

function dataUrlToFile(dataUrl: string, filename: string, mimeType: string): File {
    const parts = dataUrl.split(',');
    const byteString = atob(parts[1] || '');
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new File([ab], filename, { type: mimeType });
}

function PrintInvoiceContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();
    const invoiceRef = useRef<HTMLDivElement | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [keteranganPerSTT, setKeteranganPerSTT] = useState<{ [key: string]: string }>({});

    // Print & export states
    const [paperMode, setPaperMode] = useState<'a5-landscape' | 'a4-portrait'>('a5-landscape');
    const [whatsappPhone, setWhatsappPhone] = useState<string>('');
    const [exportingAction, setExportingAction] = useState<'png' | 'jpg' | 'copy' | 'wa' | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // States for custom edit date and additional manual fee
    const [issueDate, setIssueDate] = useState<string>('');
    const [additionalFee, setAdditionalFee] = useState<number>(0);
    const [feeLabel, setFeeLabel] = useState<string>('BIAYA TAMBAHAN');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 6000);
    };

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

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

                // Default A5 Landscape for standard invoice, A4 Portrait for Taxable/PKP invoice
                const taxable = Boolean(inv.isTaxable) || loaded.some(t => t.isTaxable || (t.ppn && t.ppn > 0));
                setPaperMode(taxable ? 'a4-portrait' : 'a5-landscape');

                // Auto-populate WhatsApp phone from linked transaction or client profile
                let resolvedPhone = loaded.find(t => t.pengirimPhone?.trim())?.pengirimPhone?.trim() || '';
                if (!resolvedPhone && inv.clientId && inv.clientId !== 'manual') {
                    try {
                        const clientDoc = await getClientById(inv.clientId);
                        if (clientDoc?.phone) {
                            resolvedPhone = clientDoc.phone.trim();
                        }
                    } catch (err) {
                        console.warn('Could not load client phone:', err);
                    }
                }
                setWhatsappPhone(resolvedPhone);

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

    const isTaxableInvoice = Boolean(invoice.isTaxable) || transactions.some(t => t.isTaxable || (t.ppn && t.ppn > 0));
    const isCompactA5 = !isTaxableInvoice && paperMode === 'a5-landscape';
    const itemRowCount = transactions.length + (additionalFee > 0 ? 1 : 0);
    const stdLayout = getStdInvoiceLayout(isCompactA5, itemRowCount);
    const hasExtraKepada = Boolean(invoice.clientAddress) || Boolean(invoice.notes);
    const a5MinRows = hasExtraKepada ? 7 : 8;
    const emptyRowsCount = isCompactA5
        ? Math.max(0, a5MinRows - itemRowCount)
        : Math.max(0, MIN_ROWS_A4 - transactions.length);
    const hasKgVolume = transactions.some(t => t.beratUnit === 'KG/VOLUME');

    // Calculate totals for tax layout dynamically to enforce 1.1% PPN rule on all invoices (including historical)
    const subtotalTagihan = transactions.reduce((acc, t) => acc + t.jumlah, 0);
    const subtotalWithFee = subtotalTagihan + additionalFee;
    const totalPPN = isTaxableInvoice ? Math.round(subtotalWithFee * 0.011) : 0;
    const totalAkhirDisplay = subtotalWithFee + totalPPN;

    const totalKoli = transactions.reduce((acc, t) => acc + (t.koli || 0), 0);
    const totalBerat = transactions.reduce((acc, t) => acc + (t.berat || 0), 0);

    const buildFilename = (ext: 'png' | 'jpg') => {
        const safeNum = (invoice.invoiceNumber || id || 'Invoice')
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const safeClient = (invoice.clientName || 'Client')
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 32);
        return `Invoice-${safeNum || 'CCE'}${safeClient ? `-${safeClient}` : ''}.${ext}`;
    };

    const waitForImages = async (node: HTMLElement) => {
        const images = Array.from(node.querySelectorAll('img'));
        await Promise.all(
            images.map((img) => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    const done = () => resolve();
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                });
            })
        );
    };

    const buildCaptureOptions = async (isJpeg: boolean) => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        if (invoiceRef.current) {
            await waitForImages(invoiceRef.current);
        }
        return {
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
            cacheBust: true,
            skipFonts: true,
            ...(isJpeg ? { quality: 0.95 } : {}),
            style: {
                margin: '0',
                boxShadow: 'none',
            },
        };
    };

    const triggerDownload = (dataUrl: string, filename: string) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadImage = async (format: 'png' | 'jpg') => {
        if (!invoiceRef.current || exportingAction) return;
        setExportingAction(format);
        try {
            const options = await buildCaptureOptions(format === 'jpg');
            const dataUrl = format === 'png'
                ? await toPng(invoiceRef.current, options)
                : await toJpeg(invoiceRef.current, options);
            const filename = buildFilename(format);
            triggerDownload(dataUrl, filename);
            showToast(`Invoice berhasil didownload (${filename})`);
        } catch (err) {
            console.error('Failed exporting invoice image:', err);
            showToast(`Gagal mengekspor gambar ${format.toUpperCase()}. Coba ulangi atau gunakan Cetak.`);
        } finally {
            setExportingAction(null);
        }
    };

    const handleCopyImage = async () => {
        if (!invoiceRef.current || exportingAction) return;
        setExportingAction('copy');
        try {
            const options = await buildCaptureOptions(false);
            const blob = await toBlob(invoiceRef.current, options);
            if (!blob) throw new Error('Blob kosong');
            if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
                throw new Error('Clipboard API tidak didukung di browser ini');
            }
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Gambar invoice disalin ke Clipboard — tinggal Ctrl+V di WhatsApp!');
        } catch (err) {
            console.error('Failed copying invoice image:', err);
            showToast('Browser memblokir salin gambar otomatis. Gunakan tombol PNG / JPG lalu lampirkan di WhatsApp.');
        } finally {
            setExportingAction(null);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!invoiceRef.current || exportingAction) return;
        setExportingAction('wa');
        try {
            const caption = `Halo Bapak/Ibu ${invoice.clientName},\nBerikut kami kirimkan Invoice *${invoice.invoiceNumber}* (${formatTanggal(issueDate)}) dengan total tagihan *Rp ${fmtAngka(totalAkhirDisplay)}*.\nTerima kasih — ${COMPANY_INFO.name}.`;

            const jpgOptions = await buildCaptureOptions(true);
            const jpgDataUrl = await toJpeg(invoiceRef.current, jpgOptions);
            const jpgFilename = buildFilename('jpg');
            const jpgFile = dataUrlToFile(jpgDataUrl, jpgFilename, 'image/jpeg');

            // Mobile Web Share path (directly attaches invoice image into WhatsApp)
            if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [jpgFile] })) {
                try {
                    await navigator.share({
                        files: [jpgFile],
                        title: `Invoice ${invoice.invoiceNumber}`,
                        text: caption,
                    });
                    showToast('Invoice siap dikirim melalui aplikasi WhatsApp.');
                    return;
                } catch (shareErr) {
                    if ((shareErr as Error)?.name === 'AbortError') {
                        return;
                    }
                    console.warn('Web Share API failed, falling back to desktop flow:', shareErr);
                }
            }

            // Desktop path: copy PNG to clipboard + download JPG backup + open wa.me
            let copiedToClipboard = false;
            try {
                if (typeof navigator !== 'undefined' && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
                    const pngOptions = await buildCaptureOptions(false);
                    const pngBlob = await toBlob(invoiceRef.current, pngOptions);
                    if (pngBlob) {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
                        copiedToClipboard = true;
                    }
                }
            } catch (clipErr) {
                console.warn('Clipboard copy during WA share failed:', clipErr);
            }

            triggerDownload(jpgDataUrl, jpgFilename);

            const cleanPhone = normalizeWaPhone(whatsappPhone);
            const waUrl = cleanPhone
                ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(caption)}`
                : `https://wa.me/?text=${encodeURIComponent(caption)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');

            showToast(
                copiedToClipboard
                    ? 'Gambar invoice disalin ke Clipboard & diunduh (.jpg) — di WhatsApp tinggal tekan Ctrl+V lalu kirim!'
                    : 'Invoice (.jpg) berhasil diunduh — silakan lampirkan file tersebut di chat WhatsApp.'
            );
        } catch (err) {
            console.error('Failed preparing invoice for WhatsApp:', err);
            showToast('Gagal menyiapkan gambar invoice untuk WhatsApp.');
        } finally {
            setExportingAction(null);
        }
    };

    const pageSizeRule = paperMode === 'a5-landscape'
        ? `@page { size: A5 landscape; margin: 0 !important; }`
        : `@page { size: A4 portrait; margin: 0 !important; }`;
    const pageClassName = paperMode === 'a5-landscape' ? 'invoice-page-a5' : 'invoice-page-a4';

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                ${pageSizeRule}

                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    font-family: Arial, sans-serif;
                    background: #d1d5db;
                }

                .invoice-stage {
                    width: 100%;
                    overflow-x: auto;
                    padding: 0 12px 32px 12px;
                }

                .invoice-page-a5 {
                    width: 210mm;
                    min-height: 147.6mm;
                    background: #ffffff;
                    margin: 0 auto 24px auto;
                    padding: ${isCompactA5 ? stdLayout.pagePad : '6mm 10mm 5.5mm 10mm'};
                    font-size: 8.5pt;
                    color: #000000;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                }

                .invoice-table-area-a5 {
                    flex: 1 0 auto;
                    display: flex;
                    flex-direction: column;
                }

                .invoice-page-a4 {
                    width: 210mm;
                    min-height: 296.6mm;
                    background: #ffffff;
                    margin: 0 auto 24px auto;
                    padding: 8mm 12mm 6mm 12mm;
                    font-size: 8.5pt;
                    color: #000000;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
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

                .invoice-table.compact-a5 {
                    flex: 1 0 auto;
                    height: 100%;
                    font-size: ${stdLayout.tableFontPt};
                }
                .invoice-table.compact-a5 th,
                .invoice-table.compact-a5 td {
                    padding: ${stdLayout.tableCellPad};
                    font-size: ${stdLayout.tableFontPt};
                }

                @media print {
                    html, body {
                        width: 210mm !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    .invoice-stage {
                        overflow: visible !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .invoice-page-a5,
                    .invoice-page-a4 {
                        margin: 0 !important;
                        box-shadow: none !important;
                    }
                    .no-print { display: none !important; }
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}} />

            {/* Sticky Control Panel (tidak tercetak / tidak ikut diekspor) */}
            <div className="no-print" style={{
                position: 'sticky',
                top: 0,
                background: '#1e293b',
                color: 'white',
                padding: '10px 20px',
                marginBottom: '16px',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.15)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: '#94a3b8' }}>Tanggal:</span>
                        <input
                            type="date"
                            value={issueDate}
                            onChange={e => setIssueDate(e.target.value)}
                            style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '5px 8px', borderRadius: '6px', outline: 'none', fontSize: '12px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: '#94a3b8' }}>Biaya Tambahan:</span>
                        <input
                            type="text"
                            placeholder="Mis: Biaya Packing"
                            value={feeLabel}
                            onChange={e => setFeeLabel(e.target.value)}
                            style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '5px 8px', borderRadius: '6px', outline: 'none', width: '150px', fontSize: '12px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '11px' }}>Rp</span>
                            <input
                                type="number"
                                placeholder="0"
                                value={additionalFee || ''}
                                onChange={e => setAdditionalFee(Math.max(0, Number(e.target.value) || 0))}
                                style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '5px 8px 5px 24px', borderRadius: '6px', outline: 'none', width: '105px', fontSize: '12px' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: '#94a3b8' }}>No. WA Tujuan:</span>
                        <input
                            type="text"
                            placeholder="08xxx (opsional)"
                            value={whatsappPhone}
                            onChange={e => setWhatsappPhone(e.target.value)}
                            style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '5px 8px', borderRadius: '6px', outline: 'none', width: '140px', fontSize: '12px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid #334155', gap: '2px' }}>
                        <button
                            type="button"
                            onClick={() => setPaperMode('a5-landscape')}
                            style={{
                                background: paperMode === 'a5-landscape' ? '#2563eb' : 'transparent',
                                color: paperMode === 'a5-landscape' ? '#ffffff' : '#cbd5e1',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '11.5px',
                            }}
                        >
                            A5 Landscape
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaperMode('a4-portrait')}
                            style={{
                                background: paperMode === 'a4-portrait' ? '#2563eb' : 'transparent',
                                color: paperMode === 'a4-portrait' ? '#ffffff' : '#cbd5e1',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '11.5px',
                            }}
                        >
                            A4 Portrait
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{ background: '#2563eb', color: 'white', padding: '7px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                        🖨️ Cetak
                    </button>
                    <button
                        type="button"
                        disabled={exportingAction !== null}
                        onClick={() => handleDownloadImage('png')}
                        style={{ background: '#4f46e5', color: 'white', padding: '7px 11px', borderRadius: '6px', border: 'none', cursor: exportingAction ? 'wait' : 'pointer', opacity: exportingAction ? 0.65 : 1, fontWeight: 'bold', fontSize: '12px' }}
                    >
                        {exportingAction === 'png' ? '⏳ PNG...' : '🖼️ PNG'}
                    </button>
                    <button
                        type="button"
                        disabled={exportingAction !== null}
                        onClick={() => handleDownloadImage('jpg')}
                        style={{ background: '#7c3aed', color: 'white', padding: '7px 11px', borderRadius: '6px', border: 'none', cursor: exportingAction ? 'wait' : 'pointer', opacity: exportingAction ? 0.65 : 1, fontWeight: 'bold', fontSize: '12px' }}
                    >
                        {exportingAction === 'jpg' ? '⏳ JPG...' : '🖼️ JPG'}
                    </button>
                    <button
                        type="button"
                        disabled={exportingAction !== null}
                        onClick={handleCopyImage}
                        style={{ background: '#0284c7', color: 'white', padding: '7px 11px', borderRadius: '6px', border: 'none', cursor: exportingAction ? 'wait' : 'pointer', opacity: exportingAction ? 0.65 : 1, fontWeight: 'bold', fontSize: '12px' }}
                    >
                        {exportingAction === 'copy' ? '⏳ Menyalin...' : '📋 Salin Gambar'}
                    </button>
                    <button
                        type="button"
                        disabled={exportingAction !== null}
                        onClick={handleSendWhatsApp}
                        style={{ background: '#16a34a', color: 'white', padding: '7px 13px', borderRadius: '6px', border: 'none', cursor: exportingAction ? 'wait' : 'pointer', opacity: exportingAction ? 0.65 : 1, fontWeight: 'bold', fontSize: '12px' }}
                    >
                        {exportingAction === 'wa' ? '⏳ Menyiapkan...' : '💬 Kirim WA'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (window.opener) window.close();
                            else router.push('/finance/invoices');
                        }}
                        style={{ background: '#475569', color: 'white', padding: '7px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                        ✕ Tutup
                    </button>
                </div>
            </div>

            {toastMessage && (
                <div
                    className="no-print"
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        maxWidth: '420px',
                        background: '#0f172a',
                        color: '#ffffff',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid #334155',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
                        zIndex: 10000,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontSize: '12.5px',
                        lineHeight: 1.45,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                    }}
                >
                    <span>{toastMessage}</span>
                    <button
                        type="button"
                        onClick={() => setToastMessage(null)}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="invoice-stage">
            <div ref={invoiceRef} className={pageClassName}>
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
                    // LAYOUT INVOICE STANDAR (Non-PKP) — A4 & A5 FLEXIBLE
                    // ==========================================
                    <>
                        {/* HEADER STANDAR (Desain tetap seperti A4, ukuran fleksibel) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: stdLayout.headerMb, flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: isCompactA5 ? '2.5mm' : '3mm' }}>
                                <img src="/logo.png" alt="Logo" style={{ width: stdLayout.logoSize, height: stdLayout.logoSize, objectFit: 'contain' }} />
                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: stdLayout.companyPt, lineHeight: 1.3 }}>{COMPANY_INFO.name}</p>
                                    <p style={{ fontSize: stdLayout.addrPt, lineHeight: stdLayout.addrLh }}>{COMPANY_INFO.address}</p>
                                    <p style={{ fontSize: stdLayout.addrPt, lineHeight: stdLayout.addrLh }}>{COMPANY_INFO.city}</p>
                                </div>
                            </div>
                            <div style={{ fontSize: stdLayout.metaPt, lineHeight: stdLayout.metaLh }}>
                                <div style={{ display: 'flex', gap: isCompactA5 ? '2.5mm' : '3mm' }}>
                                    <span style={{ minWidth: stdLayout.metaLabelW }}>Nomer</span>
                                    <span>:</span>
                                    <span contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', outline: 'none' }}>{invoice.invoiceNumber}</span>
                                </div>
                                <div style={{ display: 'flex', gap: isCompactA5 ? '2.5mm' : '3mm' }}>
                                    <span style={{ minWidth: stdLayout.metaLabelW }}>Tanggal</span>
                                    <span>:</span>
                                    <span contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', outline: 'none' }}>{formatTanggal(issueDate)}</span>
                                </div>
                            </div>
                        </div>

                        {/* JUDUL */}
                        <div style={{ textAlign: 'center', marginBottom: stdLayout.titleMb, flexShrink: 0 }}>
                            <span style={{ fontSize: stdLayout.titlePt, fontWeight: 'bold', letterSpacing: stdLayout.titleSpacing, textDecoration: 'underline' }}>
                                I N V O I C E
                            </span>
                        </div>

                        {/* KEPADA YTH */}
                        <div style={{ marginBottom: stdLayout.kepadaMb, flexShrink: 0 }}>
                            <p style={{ fontSize: stdLayout.kepadaPt }}>Kepada Yth,</p>
                            <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: stdLayout.clientPt, textTransform: 'uppercase', outline: 'none' }}>{invoice.clientName}</p>
                            {invoice.clientAddress && (
                                <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', fontSize: stdLayout.clientPt, textTransform: 'uppercase', outline: 'none' }}>{invoice.clientAddress}</p>
                            )}
                            {invoice.notes && (
                                <p style={{ fontSize: stdLayout.terbilangPt, fontStyle: 'italic', marginTop: '0.5mm' }}>{invoice.notes}</p>
                            )}
                        </div>

                        {/* TABEL STANDAR (di mode A5 otomatis terisi baris kosong hingga pas 1 halaman penuh) */}
                        <div className={isCompactA5 ? 'invoice-table-area-a5' : undefined}>
                        <table className={isCompactA5 ? 'invoice-table compact-a5' : 'invoice-table'}>
                            <thead>
                                <tr style={isCompactA5 ? { height: itemRowCount >= 12 ? '6mm' : '7mm' } : undefined}>
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
                                    <tr key={t.id} style={isCompactA5 && itemRowCount <= 8 ? { height: '6.4mm' } : undefined}>
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
                                    <tr style={isCompactA5 && itemRowCount <= 8 ? { height: '6.4mm' } : undefined}>
                                        <td style={{ textAlign: 'center' }}>{transactions.length + 1}.</td>
                                        <td colSpan={5} style={{ paddingLeft: 4, textTransform: 'uppercase', fontWeight: 'bold' }}>
                                            <span contentEditable suppressContentEditableWarning style={{ outline: 'none' }}>
                                                {feeLabel.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: 4, fontWeight: 'bold' }}>{fmtAngka(additionalFee)}</td>
                                    </tr>
                                )}

                                {/* Baris kosong agar tabel pas penuh ke bawah di A5 dan A4 */}
                                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ height: isCompactA5 ? 'auto' : '6mm', minHeight: isCompactA5 ? '5.5mm' : undefined }}>
                                        <td></td><td></td><td></td><td></td><td></td><td></td>
                                        <td style={{ textAlign: 'right', paddingRight: 4 }}>-</td>
                                    </tr>
                                ))}

                                {/* Terbilang + TOTAL */}
                                <tr style={isCompactA5 ? { height: '7.2mm' } : undefined}>
                                    <td colSpan={4} style={{ fontSize: stdLayout.terbilangPt, fontStyle: 'italic', paddingLeft: 4 }}>
                                        Terbilang : # {terbilang(totalAkhirDisplay)} #
                                    </td>
                                    <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', letterSpacing: '2px', fontSize: stdLayout.totalLabelPt }}>
                                        T O T A L
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }}>
                                        {fmtAngka(totalAkhirDisplay)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        </div>

                        {/* FOOTER STANDAR */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: stdLayout.footerMt, flexShrink: 0 }}>
                            <div style={{ fontSize: stdLayout.addrPt, lineHeight: stdLayout.bankLh }}>
                                <p contentEditable suppressContentEditableWarning style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '0.8mm', fontSize: stdLayout.bankTitlePt, outline: 'none' }}>TRANSFER :</p>
                                {COMPANY_INFO.bankAccounts.map((acc, i) => (
                                    <p
                                        key={i}
                                        contentEditable
                                        suppressContentEditableWarning
                                        style={{ outline: 'none', fontSize: stdLayout.bankPt, fontWeight: 'bold' }}
                                    >
                                        {acc.bank} {acc.accountNumber}  an {acc.accountName}
                                    </p>
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', minWidth: stdLayout.ttdWidth, paddingTop: stdLayout.ttdPt }}>
                                <img
                                    src="/ttd.png"
                                    alt="Tanda Tangan & Stempel"
                                    style={{
                                        width: stdLayout.ttdWidth,
                                        maxHeight: stdLayout.ttdMaxHeight,
                                        height: 'auto',
                                        objectFit: 'contain',
                                        display: 'block',
                                        margin: '0 auto',
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
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
