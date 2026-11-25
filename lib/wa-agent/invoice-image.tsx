import 'server-only';
import fs from 'fs';
import path from 'path';
import { ImageResponse } from 'next/og';
import { adminDb } from '@/lib/firebase-admin';
import { COMPANY_INFO } from '@/lib/company-config';
import { terbilang } from '@/lib/currency';
import { formatInvoiceRowKeterangan, resolveInvoiceClientIdentity } from '@/lib/invoice-reconciliation';

export interface RenderedInvoiceImage {
    base64: string;
    mimeType: 'image/png';
    filename: string;
    invoiceNumber: string;
    clientName: string;
    totalAmount: number;
    sttCount: number;
}

interface InvoiceTxRow {
    id: string;
    noSTT: string;
    branch: string;
    penerimaName: string;
    tujuan: string;
    koli: number;
    berat: number;
    beratUnit: string;
    tipeTransaksi: string;
    harga: number;
    jumlah: number;
    isTaxable: boolean;
    ppn: number;
    pengirimName: string;
    pengirimAddress: string;
    penerimaAddress: string;
}

interface OgFontSpec {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: 'normal' | 'italic';
}

const imageDataUriCache = new Map<string, string>();
let cachedArialFonts: OgFontSpec[] | null = null;

function loadArialFonts(): OgFontSpec[] {
    if (cachedArialFonts) return cachedArialFonts;
    const candidates: Array<{ file: string; weight: 400 | 700; style: 'normal' | 'italic' }> = [
        { file: 'C:\\Windows\\Fonts\\arial.ttf', weight: 400, style: 'normal' },
        { file: 'C:\\Windows\\Fonts\\arialbd.ttf', weight: 700, style: 'normal' },
        { file: 'C:\\Windows\\Fonts\\ariali.ttf', weight: 400, style: 'italic' },
        { file: 'C:\\Windows\\Fonts\\arialbi.ttf', weight: 700, style: 'italic' },
    ];
    const loaded: OgFontSpec[] = [];
    for (const c of candidates) {
        try {
            if (fs.existsSync(c.file)) {
                const buf = fs.readFileSync(c.file);
                const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                loaded.push({ name: 'Arial', data: ab, weight: c.weight, style: c.style });
            }
        } catch {
            // Skip missing font safely
        }
    }
    cachedArialFonts = loaded;
    return loaded;
}

function loadPublicImageDataUri(relPath: string): string | null {
    if (imageDataUriCache.has(relPath)) {
        return imageDataUriCache.get(relPath)!;
    }
    try {
        const abs = path.join(process.cwd(), 'public', relPath);
        if (!fs.existsSync(abs)) return null;
        const buf = fs.readFileSync(abs);
        let mime = 'image/png';
        if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
            mime = 'image/jpeg';
        } else if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
            mime = 'image/webp';
        }
        const uri = `data:${mime};base64,${buf.toString('base64')}`;
        imageDataUriCache.set(relPath, uri);
        return uri;
    } catch {
        return null;
    }
}

function toDateSafe(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function fmtAngka(num: number): string {
    return Math.round(num || 0).toLocaleString('id-ID');
}

function fmtTanggalUpper(value: any): string {
    return toDateSafe(value)
        .toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        .toUpperCase();
}

function buildFilename(invoiceNumber: string, clientName: string): string {
    const safeNum = (invoiceNumber || 'Invoice')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const safeClient = (clientName || 'Client')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);
    return `Invoice-${safeNum || 'CCE'}${safeClient ? `-${safeClient}` : ''}.png`;
}

interface A5ScaledLayout {
    pad: string;
    headerMb: number;
    logoW: number;
    logoH: number;
    companyFs: number;
    addrFs: number;
    metaFs: number;
    metaLabelW: number;
    titleFs: number;
    titleMb: number;
    kepadaMb: number;
    kepadaFs: number;
    clientFs: number;
    tableFs: number;
    cellPadV: number;
    cellPadH: number;
    rowMinH: number;
    terbilangFs: number;
    totalLabelFs: number;
    footerMt: number;
    bankTitleFs: number;
    bankFs: number;
    ttdW: number;
    ttdH: number;
    ttdPt: number;
}

function getA5ScaledLayout(itemCount: number): A5ScaledLayout {
    if (itemCount >= 12) {
        return {
            pad: '21px 50px 21px 50px',
            headerMb: 6,
            logoW: 74,
            logoH: 64,
            companyFs: 20,
            addrFs: 14.5,
            metaFs: 15.5,
            metaLabelW: 78,
            titleFs: 22,
            titleMb: 7,
            kepadaMb: 9,
            kepadaFs: 15.5,
            clientFs: 17,
            tableFs: 16,
            cellPadV: 3,
            cellPadH: 7,
            rowMinH: 27,
            terbilangFs: 14,
            totalLabelFs: 16.5,
            footerMt: 12,
            bankTitleFs: 17.5,
            bankFs: 17,
            ttdW: 118,
            ttdH: 105,
            ttdPt: 3,
        };
    }
    if (itemCount >= 9) {
        return {
            pad: '26px 53px 26px 53px',
            headerMb: 9,
            logoW: 86,
            logoH: 74,
            companyFs: 22,
            addrFs: 15.5,
            metaFs: 17,
            metaLabelW: 84,
            titleFs: 24,
            titleMb: 9,
            kepadaMb: 11,
            kepadaFs: 16.5,
            clientFs: 18,
            tableFs: 17.5,
            cellPadV: 4,
            cellPadH: 8,
            rowMinH: 31,
            terbilangFs: 15,
            totalLabelFs: 17.5,
            footerMt: 15,
            bankTitleFs: 18.5,
            bankFs: 18.5,
            ttdW: 140,
            ttdH: 125,
            ttdPt: 5,
        };
    }
    return {
        pad: '35px 59px 32px 59px',
        headerMb: 14,
        logoW: 100,
        logoH: 86,
        companyFs: 23,
        addrFs: 17,
        metaFs: 18,
        metaLabelW: 92,
        titleFs: 27,
        titleMb: 14,
        kepadaMb: 14,
        kepadaFs: 18,
        clientFs: 20,
        tableFs: 19.5,
        cellPadV: 5,
        cellPadH: 8,
        rowMinH: 36,
        terbilangFs: 16,
        totalLabelFs: 19,
        footerMt: 20,
        bankTitleFs: 21,
        bankFs: 21,
        ttdW: 172,
        ttdH: 154,
        ttdPt: 8,
    };
}

export async function renderInvoicePngById(invoiceId: string): Promise<RenderedInvoiceImage> {
    const invSnap = await adminDb.collection('invoices').doc(invoiceId).get();
    if (!invSnap.exists) {
        throw new Error(`Invoice ${invoiceId} tidak ditemukan.`);
    }
    const inv = invSnap.data() || {};

    const txIds: string[] = Array.isArray(inv.transactionIds) ? inv.transactionIds.filter(Boolean) : [];
    const txs: InvoiceTxRow[] = [];

    if (txIds.length > 0) {
        const refs = txIds.map((tid) => adminDb.collection('transactions').doc(tid));
        const txSnaps = await adminDb.getAll(...refs);
        for (const s of txSnaps) {
            if (!s.exists) continue;
            const d = s.data() || {};
            txs.push({
                id: s.id,
                noSTT: String(d.noSTT || ''),
                branch: String(d.branch || 'surabaya'),
                penerimaName: String(d.penerimaName || ''),
                tujuan: String(d.tujuan || ''),
                koli: Number(d.koli) || 0,
                berat: Number(d.berat) || 0,
                beratUnit: String(d.beratUnit || 'KG'),
                tipeTransaksi: String(d.tipeTransaksi || 'regular'),
                harga: Number(d.harga) || 0,
                jumlah: Number(d.jumlah) || 0,
                isTaxable: Boolean(d.isTaxable),
                ppn: Number(d.ppn) || 0,
                pengirimName: String(d.pengirimName || ''),
                pengirimAddress: String(d.pengirimAddress || ''),
                penerimaAddress: String(d.penerimaAddress || ''),
            });
        }
    }

    txs.sort((a, b) => {
        const numA = parseInt(a.noSTT.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.noSTT.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
    });

    const invoiceNumber = String(inv.invoiceNumber || invoiceId);
    const resolvedIdentity = resolveInvoiceClientIdentity(
        {
            clientName: String(inv.clientName || ''),
            clientAddress: String(inv.clientAddress || ''),
        },
        txs
    );
    const clientName = resolvedIdentity.clientName;
    const clientAddress = resolvedIdentity.clientAddress;
    const hasMultipleSenders = resolvedIdentity.hasMultipleSenders;
    const notes = String(inv.notes || '').trim();
    const issueDateStr = fmtTanggalUpper(inv.issueDate || inv.createdAt);

    const isTaxableInvoice =
        Boolean(inv.isTaxable) || txs.some((t) => t.isTaxable || t.ppn > 0);
    const hasKgVolume = txs.some((t) => t.beratUnit === 'KG/VOLUME');

    const subtotal =
        txs.length > 0
            ? txs.reduce((sum, t) => sum + t.jumlah, 0)
            : Number(inv.totalAmount) || 0;
    const totalPPN = isTaxableInvoice ? Math.round(subtotal * 0.011) : 0;
    const totalAkhir = subtotal + totalPPN;
    const totalKoli = txs.reduce((sum, t) => sum + t.koli, 0);
    const totalBerat = txs.reduce((sum, t) => sum + t.berat, 0);

    const logoUri = loadPublicImageDataUri('logo.png');
    const ttdUri = loadPublicImageDataUri('ttd.png');
    const fonts = loadArialFonts();
    const fontFamily = fonts.length > 0 ? 'Arial, sans-serif' : 'sans-serif';

    if (isTaxableInvoice) {
        const minRows = 10;
        const emptyCount = Math.max(0, minRows - txs.length);
        const totalRows = 2 + txs.length + 2 + emptyCount + 1;
        const width = 1100;
        const height = Math.max(1554, 560 + totalRows * 42);

        const desc1 = notes
            ? notes.toUpperCase()
            : txs.length > 0
              ? `PENGIRIMAN BARANG DARI ${txs[0].branch.toUpperCase()} KE ${txs[0].tujuan.toUpperCase()}`
              : 'PENGIRIMAN BARANG';

        const img = new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        padding: '38px 46px',
                        fontFamily,
                    }}
                >
                    {/* Header PKP */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            borderBottom: '2.5px solid #000000',
                            paddingBottom: 12,
                            marginBottom: 22,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            {logoUri && <img src={logoUri} width={100} height={86} alt="Logo" />}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                                    CV. CAHAYA CARGO EXPRESS
                                </div>
                                <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
                                    Jl. KEMUDI NO. 4 - SURABAYA
                                </div>
                                <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
                                    Jl. IRIAN NO. 245 B - MAKASSAR
                                </div>
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                fontSize: 34,
                                fontWeight: 700,
                                letterSpacing: 6,
                                paddingBottom: 4,
                            }}
                        >
                            INVOICE
                        </div>
                    </div>

                    {/* Kepada Yth & Metadata */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 20,
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 17, lineHeight: 1.5, maxWidth: 540 }}>
                            <div style={{ display: 'flex' }}>Kepada Yth,</div>
                            <div style={{ display: 'flex', fontWeight: 700, fontSize: 18 }}>
                                {clientName.toUpperCase()}
                            </div>
                            {clientAddress ? (
                                <div style={{ display: 'flex', fontWeight: 700, fontSize: 17 }}>
                                    {clientAddress.toUpperCase()}
                                </div>
                            ) : null}
                            <div style={{ display: 'flex', fontWeight: 700, fontSize: 17 }}>UP BP. FARHAN</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 17, lineHeight: 1.6, minWidth: 380 }}>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ display: 'flex', width: 110, fontWeight: 700 }}>Nomer</div>
                                <div style={{ display: 'flex', fontWeight: 700 }}>:</div>
                                <div style={{ display: 'flex', fontWeight: 700 }}>{invoiceNumber}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ display: 'flex', width: 110, fontWeight: 700 }}>Tanggal</div>
                                <div style={{ display: 'flex', fontWeight: 700 }}>:</div>
                                <div style={{ display: 'flex', fontWeight: 700 }}>{issueDateStr}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ display: 'flex', width: 110, fontWeight: 700 }}>No. NPWP</div>
                                <div style={{ display: 'flex', fontWeight: 700 }}>:</div>
                                <div style={{ display: 'flex', fontWeight: 700 }}>076.049.538.2-618.000</div>
                            </div>
                        </div>
                    </div>

                    {/* Tabel PKP */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            borderTop: '2px solid #000000',
                            borderLeft: '2px solid #000000',
                            fontSize: 16,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                backgroundColor: '#ffffff',
                                fontWeight: 700,
                                borderBottom: '2px solid #000000',
                            }}
                        >
                            <div style={{ display: 'flex', width: '5%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>NO</div>
                            <div style={{ display: 'flex', width: '53%', justifyContent: 'center', padding: '8px 6px', borderRight: '1.5px solid #000000' }}>KETERANGAN</div>
                            <div style={{ display: 'flex', width: '8%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>KOLI</div>
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>{hasKgVolume ? 'KG VOLUME' : 'KG/M3'}</div>
                            <div style={{ display: 'flex', width: '10%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>HARGA</div>
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'center', padding: '8px 6px', borderRight: '2px solid #000000' }}>JUMLAH</div>
                        </div>

                        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 36 }}>
                            <div style={{ display: 'flex', width: '5%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '53%', padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #000000' }}>{desc1}</div>
                            <div style={{ display: 'flex', width: '8%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '12%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '10%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', padding: '6px 8px', fontWeight: 700, borderRight: '2px solid #000000' }}>-</div>
                        </div>

                        {txs.map((t, idx) => (
                            <div key={t.id} style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 38 }}>
                                <div style={{ display: 'flex', width: '5%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>{idx + 1}.</div>
                                <div style={{ display: 'flex', width: '53%', alignItems: 'center', padding: '6px 8px', borderRight: '1px solid #000000' }}>
                                    {formatInvoiceRowKeterangan(t, hasMultipleSenders)}
                                </div>
                                <div style={{ display: 'flex', width: '8%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>
                                    {t.koli > 0 ? fmtAngka(t.koli) : ''}
                                </div>
                                <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1px solid #000000' }}>
                                    {t.berat > 0 ? fmtAngka(t.berat) : ''}
                                </div>
                                <div style={{ display: 'flex', width: '10%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1px solid #000000' }}>
                                    {t.tipeTransaksi === 'regular' && t.harga > 0 ? fmtAngka(t.harga) : ''}
                                </div>
                                <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, fontWeight: 700, borderRight: '2px solid #000000' }}>
                                    {t.jumlah > 0 ? fmtAngka(t.jumlah) : ''}
                                </div>
                            </div>
                        ))}

                        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 38, fontWeight: 700 }}>
                            <div style={{ display: 'flex', width: '58%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>TOTAL TAGIHAN</div>
                            <div style={{ display: 'flex', width: '8%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>
                                {totalKoli > 0 ? fmtAngka(totalKoli) : ''}
                            </div>
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1px solid #000000' }}>
                                {totalBerat > 0 ? fmtAngka(totalBerat) : ''}
                            </div>
                            <div style={{ display: 'flex', width: '10%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '2px solid #000000' }}>
                                {fmtAngka(subtotal)}
                            </div>
                        </div>

                        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 38 }}>
                            <div style={{ display: 'flex', width: '5%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>{txs.length + 1}.</div>
                            <div style={{ display: 'flex', width: '83%', alignItems: 'center', paddingLeft: 8, borderRight: '1px solid #000000' }}>PPN 1.1%</div>
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '2px solid #000000' }}>
                                {fmtAngka(totalPPN)}
                            </div>
                        </div>

                        {Array.from({ length: emptyCount }).map((_, idx) => (
                            <div key={`ep-${idx}`} style={{ display: 'flex', borderBottom: '1px solid #000000', height: 34 }}>
                                <div style={{ display: 'flex', width: '5%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '53%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '8%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '12%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '10%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '12%', borderRight: '2px solid #000000' }} />
                            </div>
                        ))}

                        <div style={{ display: 'flex', borderBottom: '2px solid #000000', minHeight: 44 }}>
                            <div style={{ display: 'flex', width: '78%', alignItems: 'center', padding: '6px 8px', fontSize: 14, fontStyle: 'italic' }}>
                                {`Terbilang : # ${terbilang(totalAkhir)} #`}
                            </div>
                            <div style={{ display: 'flex', width: '10%', justifyContent: 'center', alignItems: 'center', fontWeight: 700, fontSize: 17, borderRight: '2px solid #000000' }}>
                                TOTAL
                            </div>
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, fontWeight: 700, fontSize: 19, borderRight: '2px solid #000000' }}>
                                {fmtAngka(totalAkhir)}
                            </div>
                        </div>
                    </div>

                    {/* Footer PKP */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginTop: 28,
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 17, fontWeight: 700, lineHeight: 1.6 }}>
                            <div style={{ display: 'flex', textDecoration: 'underline', marginBottom: 4 }}>TRANSFER :</div>
                            <div style={{ display: 'flex' }}>BCA 187 1414 187 a/n CAHAYA CARGO EXPRESS CV</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 220 }}>
                            <div style={{ display: 'flex', fontSize: 17, marginBottom: 8 }}>Hormat Kami,</div>
                            {ttdUri ? (
                                <img src={ttdUri} width={150} height={134} alt="TTD" />
                            ) : (
                                <div style={{ display: 'flex', height: 90 }} />
                            )}
                            <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, marginTop: 4 }}>HILAL BAFAGIH</div>
                        </div>
                    </div>
                </div>
            ),
            { width, height, ...(fonts.length > 0 ? { fonts } : {}) }
        );

        const buf = Buffer.from(await img.arrayBuffer());
        return {
            base64: buf.toString('base64'),
            mimeType: 'image/png',
            filename: buildFilename(invoiceNumber, clientName),
            invoiceNumber,
            clientName,
            totalAmount: totalAkhir,
            sttCount: txs.length,
        };
    }

    // ====================================================
    // LAYOUT INVOICE STANDAR — IDENTIK A5 LANDSCAPE (210mm x 147.6mm)
    // ====================================================
    const lay = getA5ScaledLayout(txs.length);
    const hasExtraKepada = Boolean(clientAddress) || Boolean(notes);
    const a5MinRows = hasExtraKepada ? 7 : 8;
    const emptyCountStd = Math.max(0, a5MinRows - txs.length);
    const width = 1240;
    const height = txs.length > 14 ? 872 + (txs.length - 14) * 32 : 872;

    const img = new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    padding: lay.pad,
                    fontFamily,
                }}
            >
                {/* Header Standar */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: lay.headerMb,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                        {logoUri && <img src={logoUri} width={lay.logoW} height={lay.logoH} alt="Logo" />}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', fontSize: lay.companyFs, fontWeight: 700, lineHeight: 1.28 }}>
                                {COMPANY_INFO.name}
                            </div>
                            <div style={{ display: 'flex', fontSize: lay.addrFs, lineHeight: 1.38 }}>{COMPANY_INFO.address}</div>
                            <div style={{ display: 'flex', fontSize: lay.addrFs, lineHeight: 1.38 }}>{COMPANY_INFO.city}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: lay.metaFs, lineHeight: 1.55 }}>
                        <div style={{ display: 'flex', gap: 14 }}>
                            <div style={{ display: 'flex', width: lay.metaLabelW }}>Nomer</div>
                            <div style={{ display: 'flex' }}>:</div>
                            <div style={{ display: 'flex', fontWeight: 700 }}>{invoiceNumber}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 14 }}>
                            <div style={{ display: 'flex', width: lay.metaLabelW }}>Tanggal</div>
                            <div style={{ display: 'flex' }}>:</div>
                            <div style={{ display: 'flex', fontWeight: 700 }}>{issueDateStr}</div>
                        </div>
                    </div>
                </div>

                {/* Judul */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: lay.titleMb }}>
                    <div
                        style={{
                            display: 'flex',
                            fontSize: lay.titleFs,
                            fontWeight: 700,
                            letterSpacing: 10,
                            textDecoration: 'underline',
                        }}
                    >
                        I N V O I C E
                    </div>
                </div>

                {/* Kepada Yth */}
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: lay.kepadaMb }}>
                    <div style={{ display: 'flex', fontSize: lay.kepadaFs, lineHeight: 1.35 }}>Kepada Yth,</div>
                    <div style={{ display: 'flex', fontSize: lay.clientFs, fontWeight: 700, lineHeight: 1.35 }}>
                        {clientName.toUpperCase()}
                    </div>
                    {clientAddress ? (
                        <div style={{ display: 'flex', fontSize: lay.clientFs, fontWeight: 700, lineHeight: 1.35 }}>
                            {clientAddress.toUpperCase()}
                        </div>
                    ) : null}
                    {notes ? (
                        <div style={{ display: 'flex', fontSize: lay.terbilangFs, fontStyle: 'italic', marginTop: 2 }}>{notes}</div>
                    ) : null}
                </div>

                {/* Area Tabel A5 (flex: 1 memenuhi sisa ruang hingga footer persis seperti versi cetak A5) */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        borderTop: '1.5px solid #000000',
                        borderLeft: '1.5px solid #000000',
                        fontSize: lay.tableFs,
                    }}
                >
                    {/* Header Tabel: background putih murni, persentase kolom persis print/page.tsx */}
                    <div
                        style={{
                            display: 'flex',
                            backgroundColor: '#ffffff',
                            fontWeight: 700,
                            borderBottom: '1.5px solid #000000',
                            minHeight: lay.rowMinH + 2,
                        }}
                    >
                        <div style={{ display: 'flex', width: '5%', justifyContent: 'center', alignItems: 'center', padding: `${lay.cellPadV}px 4px`, borderRight: '1.5px solid #000000' }}>NO</div>
                        <div style={{ display: 'flex', width: '45%', justifyContent: 'center', alignItems: 'center', padding: `${lay.cellPadV}px ${lay.cellPadH}px`, borderRight: '1.5px solid #000000' }}>KETERANGAN</div>
                        <div style={{ display: 'flex', width: '9%', justifyContent: 'center', alignItems: 'center', padding: `${lay.cellPadV}px 4px`, borderRight: '1.5px solid #000000' }}>NO STT</div>
                        <div style={{ display: 'flex', width: '6%', justifyContent: 'center', alignItems: 'center', padding: `${lay.cellPadV}px 4px`, borderRight: '1.5px solid #000000' }}>KOLI</div>
                        <div style={{ display: 'flex', width: '11%', justifyContent: 'center', alignItems: 'center', padding: `${lay.cellPadV}px 4px`, borderRight: '1.5px solid #000000' }}>{hasKgVolume ? 'KG VOLUME' : 'KG/M3'}</div>
                        <div style={{ display: 'flex', width: '10%', justifyContent: 'center', alignItems: 'center', padding: `${lay.cellPadV}px 4px`, borderRight: '1.5px solid #000000' }}>HARGA</div>
                        <div style={{ display: 'flex', width: '14%', justifyContent: 'center', alignItems: 'center', padding: `${lay.cellPadV}px ${lay.cellPadH}px`, borderRight: '1.5px solid #000000' }}>JUMLAH</div>
                    </div>

                    {/* Baris Data STT */}
                    {txs.map((t, idx) => (
                        <div key={t.id} style={{ display: 'flex', borderBottom: '1.5px solid #000000', minHeight: lay.rowMinH }}>
                            <div style={{ display: 'flex', width: '5%', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #000000' }}>{idx + 1}.</div>
                            <div style={{ display: 'flex', width: '45%', alignItems: 'center', padding: `${lay.cellPadV}px ${lay.cellPadH}px`, borderRight: '1.5px solid #000000' }}>
                                {formatInvoiceRowKeterangan(t, hasMultipleSenders)}
                            </div>
                            <div style={{ display: 'flex', width: '9%', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #000000' }}>
                                {t.noSTT.replace(/^STT/i, '')}
                            </div>
                            <div style={{ display: 'flex', width: '6%', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #000000' }}>
                                {t.koli}
                            </div>
                            <div style={{ display: 'flex', width: '11%', justifyContent: 'flex-end', alignItems: 'center', padding: `${lay.cellPadV}px ${lay.cellPadH}px`, borderRight: '1.5px solid #000000' }}>
                                {t.berat}
                            </div>
                            <div style={{ display: 'flex', width: '10%', justifyContent: 'flex-end', alignItems: 'center', padding: `${lay.cellPadV}px ${lay.cellPadH}px`, borderRight: '1.5px solid #000000' }}>
                                {t.tipeTransaksi === 'regular' ? fmtAngka(t.harga) : '-'}
                            </div>
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', padding: `${lay.cellPadV}px ${lay.cellPadH}px`, borderRight: '1.5px solid #000000' }}>
                                {fmtAngka(t.jumlah)}
                            </div>
                        </div>
                    ))}

                    {/* Baris Kosong Penyeimbang (flex: 1 memenuhi tinggi kertas A5) */}
                    {Array.from({ length: emptyCountStd }).map((_, idx) => (
                        <div key={`es-${idx}`} style={{ display: 'flex', flex: 1, minHeight: 26, borderBottom: '1.5px solid #000000' }}>
                            <div style={{ display: 'flex', width: '5%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '45%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '9%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '6%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '11%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '10%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: lay.cellPadH, borderRight: '1.5px solid #000000' }}>
                                -
                            </div>
                        </div>
                    ))}

                    {/* Baris Terbilang + TOTAL */}
                    <div style={{ display: 'flex', borderBottom: '1.5px solid #000000', minHeight: 40 }}>
                        <div style={{ display: 'flex', width: '65%', alignItems: 'center', padding: `6px ${lay.cellPadH}px`, fontSize: lay.terbilangFs, fontStyle: 'italic', borderRight: '1.5px solid #000000' }}>
                            {`Terbilang : # ${terbilang(totalAkhir)} #`}
                        </div>
                        <div style={{ display: 'flex', width: '21%', justifyContent: 'center', alignItems: 'center', fontWeight: 700, fontSize: lay.totalLabelFs, letterSpacing: 3, borderRight: '1.5px solid #000000' }}>
                            T O T A L
                        </div>
                        <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: lay.cellPadH, fontWeight: 700, fontSize: lay.tableFs + 1, borderRight: '1.5px solid #000000' }}>
                            {fmtAngka(totalAkhir)}
                        </div>
                    </div>
                </div>

                {/* Footer Standar */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginTop: lay.footerMt,
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.48 }}>
                        <div style={{ display: 'flex', fontWeight: 700, textDecoration: 'underline', marginBottom: 4, fontSize: lay.bankTitleFs }}>
                            TRANSFER :
                        </div>
                        {COMPANY_INFO.bankAccounts.map((acc, i) => (
                            <div key={i} style={{ display: 'flex', fontWeight: 700, fontSize: lay.bankFs }}>
                                {`${acc.bank} ${acc.accountNumber}  an ${acc.accountName}`}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: lay.ttdPt, minWidth: lay.ttdW }}>
                        {ttdUri ? <img src={ttdUri} width={lay.ttdW} height={lay.ttdH} alt="TTD" /> : null}
                    </div>
                </div>
            </div>
        ),
        { width, height, ...(fonts.length > 0 ? { fonts } : {}) }
    );

    const buf = Buffer.from(await img.arrayBuffer());
    return {
        base64: buf.toString('base64'),
        mimeType: 'image/png',
        filename: buildFilename(invoiceNumber, clientName),
        invoiceNumber,
        clientName,
        totalAmount: totalAkhir,
        sttCount: txs.length,
    };
}

export interface RenderRekapInvoiceOptions {
    invoiceNumbers?: string[];
    invoiceIds?: string[];
    clientName?: string;
    notes?: string;
}

export interface RenderedRekapInvoiceImage {
    base64: string;
    mimeType: 'image/png';
    filename: string;
    clientName: string;
    invoiceCount: number;
    invoiceNumbers: string[];
    notFoundInvoiceNumbers: string[];
    totalAmount: number;
}

function parseRekapInvoiceTokens(rawList?: string[]): string[] {
    if (!Array.isArray(rawList)) return [];
    const tokens: string[] = [];
    const seen = new Set<string>();
    for (const item of rawList) {
        const parts = String(item || '')
            .split(/[,;\n]+/)
            .map((p) => p.trim())
            .filter(Boolean);
        for (const part of parts) {
            const key = part.toUpperCase();
            if (!seen.has(key)) {
                seen.add(key);
                tokens.push(part);
            }
        }
    }
    return tokens;
}

function buildRekapFilename(clientName: string, invoiceCount: number): string {
    const safeClient = (clientName || 'Client')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);
    return `Rekap-Invoice-${safeClient || 'CCE'}-${invoiceCount}Inv.png`;
}

export async function renderRekapInvoicePng(
    options: RenderRekapInvoiceOptions
): Promise<RenderedRekapInvoiceImage> {
    const reqTokens = parseRekapInvoiceTokens(options.invoiceNumbers);
    const reqIds = Array.isArray(options.invoiceIds)
        ? Array.from(new Set(options.invoiceIds.map((id) => String(id || '').trim()).filter(Boolean)))
        : [];
    const reqClient = String(options.clientName || '').trim();
    const reqClientLower = reqClient.toLowerCase();
    const notes = String(options.notes || '').trim();

    if (reqTokens.length === 0 && reqIds.length === 0 && !reqClientLower) {
        throw new Error('Sebutkan daftar nomor invoice atau nama client untuk membuat gambar rekap invoice.');
    }

    const [invoicesSnap, txSnap] = await Promise.all([
        adminDb.collection('invoices').get(),
        adminDb.collection('transactions').get(),
    ]);

    const txById = new Map<string, { id: string; data: Record<string, any> }>();
    const txByInvoiceId = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
    for (const doc of txSnap.docs) {
        const data = doc.data() || {};
        txById.set(doc.id, { id: doc.id, data });
        const invId = String(data.invoiceId || '').trim();
        if (invId) {
            const arr = txByInvoiceId.get(invId) || [];
            arr.push({ id: doc.id, data });
            txByInvoiceId.set(invId, arr);
        }
    }

    const activeInvoices = invoicesSnap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .filter(({ data }) => String(data.status || '') !== 'Cancelled');

    const selectedDocs: Array<{ id: string; data: Record<string, any> }> = [];
    const selectedIdSet = new Set<string>();
    const notFoundInvoiceNumbers: string[] = [];

    if (reqIds.length > 0 || reqTokens.length > 0) {
        for (const id of reqIds) {
            const hit = activeInvoices.find((inv) => inv.id === id);
            if (hit && !selectedIdSet.has(hit.id)) {
                selectedIdSet.add(hit.id);
                selectedDocs.push(hit);
            }
        }
        for (const token of reqTokens) {
            const tokUpper = token.toUpperCase();
            const tokDigits = tokUpper.replace(/\D/g, '');
            const hit =
                activeInvoices.find(
                    (inv) => String(inv.data.invoiceNumber || '').trim().toUpperCase() === tokUpper
                ) ||
                activeInvoices.find((inv) => {
                    const invDigits = String(inv.data.invoiceNumber || '').trim().toUpperCase().replace(/\D/g, '');
                    return Boolean(tokDigits && invDigits && invDigits === tokDigits);
                });
            if (hit) {
                if (!selectedIdSet.has(hit.id)) {
                    selectedIdSet.add(hit.id);
                    selectedDocs.push(hit);
                }
            } else {
                notFoundInvoiceNumbers.push(token);
            }
        }
    } else {
        // Fallback by clientName: select all Unpaid invoices matching clientName
        const sortedUnpaid = activeInvoices
            .filter(({ data }) => String(data.status || 'Unpaid') !== 'Paid')
            .sort(
                (a, b) =>
                    toDateSafe(a.data.issueDate || a.data.createdAt).getTime() -
                    toDateSafe(b.data.issueDate || b.data.createdAt).getTime()
            );

        for (const invDoc of sortedUnpaid) {
            const declaredIds: unknown[] = Array.isArray(invDoc.data.transactionIds)
                ? invDoc.data.transactionIds
                : [];
            const idSet = new Set<string>();
            for (const tid of declaredIds) {
                if (typeof tid === 'string' && tid.trim()) idSet.add(tid.trim());
            }
            for (const t of txByInvoiceId.get(invDoc.id) || []) {
                idSet.add(t.id);
            }
            const linked = Array.from(idSet)
                .map((tid) => txById.get(tid))
                .filter((x): x is { id: string; data: Record<string, any> } => Boolean(x && x.data.status !== 'dibatalkan'))
                .map(({ data }) => ({
                    pengirimName: String(data.pengirimName || ''),
                    pengirimAddress: String(data.pengirimAddress || ''),
                    penerimaName: String(data.penerimaName || ''),
                    penerimaAddress: String(data.penerimaAddress || ''),
                }));
            const identity = resolveInvoiceClientIdentity(
                {
                    clientName: String(invDoc.data.clientName || ''),
                    clientAddress: String(invDoc.data.clientAddress || ''),
                },
                linked
            );
            if (identity.clientName.toLowerCase().includes(reqClientLower)) {
                selectedIdSet.add(invDoc.id);
                selectedDocs.push(invDoc);
            }
        }
    }

    if (selectedDocs.length === 0) {
        throw new Error(
            notFoundInvoiceNumbers.length > 0
                ? `Nomor invoice tidak ditemukan: ${notFoundInvoiceNumbers.join(', ')}`
                : `Tidak ditemukan data invoice yang sesuai untuk direkap.`
        );
    }

    interface RekapRowItem {
        id: string;
        invoiceNumber: string;
        issueDateStr: string;
        sttNumbers: string;
        clientName: string;
        clientAddress: string;
        totalAmount: number;
        isTaxable: boolean;
    }

    const rows: RekapRowItem[] = selectedDocs.map((invDoc) => {
        const inv = invDoc.data;
        const declaredIds: unknown[] = Array.isArray(inv.transactionIds) ? inv.transactionIds : [];
        const txIdSet = new Set<string>();
        for (const tid of declaredIds) {
            if (typeof tid === 'string' && tid.trim()) txIdSet.add(tid.trim());
        }
        for (const t of txByInvoiceId.get(invDoc.id) || []) {
            txIdSet.add(t.id);
        }

        const linkedTxs = Array.from(txIdSet)
            .map((tid) => txById.get(tid))
            .filter((x): x is { id: string; data: Record<string, any> } => Boolean(x && x.data.status !== 'dibatalkan'))
            .sort((a, b) => {
                const na = parseInt(String(a.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
                const nb = parseInt(String(b.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
                return na - nb;
            });

        const identity = resolveInvoiceClientIdentity(
            {
                clientName: String(inv.clientName || ''),
                clientAddress: String(inv.clientAddress || ''),
            },
            linkedTxs.map(({ data }) => ({
                pengirimName: String(data.pengirimName || ''),
                pengirimAddress: String(data.pengirimAddress || ''),
                penerimaName: String(data.penerimaName || ''),
                penerimaAddress: String(data.penerimaAddress || ''),
            }))
        );

        const subtotal = linkedTxs.reduce((s, { data }) => s + (Number(data.jumlah) || 0), 0);
        const isTaxable =
            Boolean(inv.isTaxable) ||
            linkedTxs.some(({ data }) => Boolean(data.isTaxable) || (Number(data.ppn) || 0) > 0);
        const totalAmount =
            linkedTxs.length > 0
                ? subtotal + (isTaxable ? Math.round(subtotal * 0.011) : 0)
                : Number(inv.totalAmount) || 0;

        const sttNumbers =
            linkedTxs
                .map(({ data }) => String(data.noSTT || '').replace(/^STT/i, '').trim())
                .filter(Boolean)
                .join(', ') || '-';

        const issueDateStr = toDateSafe(inv.issueDate || inv.createdAt).toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        return {
            id: invDoc.id,
            invoiceNumber: String(inv.invoiceNumber || invDoc.id),
            issueDateStr,
            sttNumbers,
            clientName: identity.clientName || 'CLIENT',
            clientAddress: identity.clientAddress || '',
            totalAmount,
            isTaxable,
        };
    });

    const uniqueClientNames = Array.from(new Set(rows.map((r) => r.clientName.trim()).filter(Boolean)));
    let recipientName = '';
    if (reqClient && (reqTokens.length > 0 || reqIds.length > 0)) {
        recipientName = reqClient;
    } else if (uniqueClientNames.length === 1) {
        recipientName = uniqueClientNames[0];
    } else if (uniqueClientNames.length > 1) {
        recipientName =
            uniqueClientNames.slice(0, 3).join(' / ') +
            (uniqueClientNames.length > 3 ? ` (+${uniqueClientNames.length - 3} lainnya)` : '');
    } else {
        recipientName = 'PELANGGAN CCE';
    }

    const recipientAddress =
        uniqueClientNames.length === 1 ? rows.find((r) => r.clientAddress)?.clientAddress || '' : '';
    const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);
    const hasTaxable = rows.some((r) => r.isTaxable);
    const hasNonTaxable = rows.some((r) => !r.isTaxable);

    const minEmptyRows = Math.max(0, 5 - rows.length);
    const extraSttWrapPx = rows.reduce((sum, r) => {
        const extraLines = Math.max(0, Math.ceil(r.sttNumbers.length / 28) - 1);
        return sum + extraLines * 24;
    }, 0);
    const width = 1100;
    const height = Math.max(1554, 700 + (rows.length + minEmptyRows) * 52 + extraSttWrapPx);

    const logoUri = loadPublicImageDataUri('logo.png');
    const ttdUri = loadPublicImageDataUri('ttd.png');
    const fonts = loadArialFonts();
    const fontFamily = fonts.length > 0 ? 'Arial, sans-serif' : 'sans-serif';
    const printDateStr = fmtTanggalUpper(new Date());

    const img = new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    padding: '44px 52px',
                    fontFamily,
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        borderBottom: '3px solid #000000',
                        paddingBottom: 18,
                        marginBottom: 24,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        {logoUri ? <img src={logoUri} width={96} height={96} alt="Logo" /> : null}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, letterSpacing: 0.5 }}>
                                {COMPANY_INFO.name}
                            </div>
                            <div style={{ display: 'flex', fontSize: 15, marginTop: 4, color: '#1e293b' }}>
                                {`${COMPANY_INFO.address}, ${COMPANY_INFO.city}`}
                            </div>
                            <div style={{ display: 'flex', fontSize: 15, marginTop: 2, color: '#1e293b' }}>
                                {`Telp: ${COMPANY_INFO.phone}`}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: 4, color: '#0f172a' }}>
                            REKAPITULASI
                        </div>
                        <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, marginTop: 4, color: '#475569' }}>
                            TAGIHAN PELANGGAN
                        </div>
                    </div>
                </div>

                {/* Meta Info */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 22,
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 560 }}>
                        <div style={{ display: 'flex', fontSize: 16, color: '#475569', marginBottom: 4 }}>
                            Kepada Yth,
                        </div>
                        <div style={{ display: 'flex', fontSize: 21, fontWeight: 700, lineHeight: 1.3 }}>
                            {recipientName.toUpperCase()}
                        </div>
                        {recipientAddress ? (
                            <div style={{ display: 'flex', fontSize: 16, marginTop: 4, color: '#1e293b' }}>
                                {recipientAddress.toUpperCase()}
                            </div>
                        ) : null}
                        {notes ? (
                            <div style={{ display: 'flex', fontSize: 14, fontStyle: 'italic', marginTop: 6, color: '#334155' }}>
                                {`Catatan: ${notes}`}
                            </div>
                        ) : null}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 16, lineHeight: 1.65 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ display: 'flex', width: 130, color: '#475569' }}>Tanggal Cetak</div>
                            <div style={{ display: 'flex' }}>:</div>
                            <div style={{ display: 'flex', fontWeight: 700 }}>{printDateStr}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ display: 'flex', width: 130, color: '#475569' }}>Total Invoice</div>
                            <div style={{ display: 'flex' }}>:</div>
                            <div style={{ display: 'flex', fontWeight: 700 }}>{`${rows.length} Dokumen`}</div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderTop: '2px solid #000000',
                        borderLeft: '2px solid #000000',
                        marginBottom: 22,
                        fontSize: 16,
                    }}
                >
                    {/* Header Row */}
                    <div
                        style={{
                            display: 'flex',
                            backgroundColor: '#f8fafc',
                            fontWeight: 700,
                            borderBottom: '2px solid #000000',
                            minHeight: 44,
                        }}
                    >
                        <div style={{ display: 'flex', width: '6%', justifyContent: 'center', alignItems: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>NO</div>
                        <div style={{ display: 'flex', width: '21%', justifyContent: 'center', alignItems: 'center', padding: '8px 6px', borderRight: '1.5px solid #000000' }}>NO. INVOICE</div>
                        <div style={{ display: 'flex', width: '16%', justifyContent: 'center', alignItems: 'center', padding: '8px 6px', borderRight: '1.5px solid #000000' }}>TGL INVOICE</div>
                        <div style={{ display: 'flex', width: '35%', justifyContent: 'center', alignItems: 'center', padding: '8px 8px', borderRight: '1.5px solid #000000' }}>NOMOR STT</div>
                        <div style={{ display: 'flex', width: '22%', justifyContent: 'center', alignItems: 'center', padding: '8px 8px', borderRight: '2px solid #000000' }}>TOTAL TAGIHAN</div>
                    </div>

                    {/* Data Rows */}
                    {rows.map((row, idx) => (
                        <div
                            key={row.id}
                            style={{
                                display: 'flex',
                                borderBottom: '1.5px solid #000000',
                                minHeight: 44,
                                backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                            }}
                        >
                            <div style={{ display: 'flex', width: '6%', justifyContent: 'center', alignItems: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>
                                {idx + 1}
                            </div>
                            <div style={{ display: 'flex', width: '21%', justifyContent: 'center', alignItems: 'center', padding: '8px 6px', fontWeight: 700, borderRight: '1.5px solid #000000' }}>
                                {row.invoiceNumber}
                            </div>
                            <div style={{ display: 'flex', width: '16%', justifyContent: 'center', alignItems: 'center', padding: '8px 6px', borderRight: '1.5px solid #000000' }}>
                                {row.issueDateStr}
                            </div>
                            <div style={{ display: 'flex', width: '35%', alignItems: 'center', padding: '8px 10px', fontSize: 15, lineHeight: 1.35, borderRight: '1.5px solid #000000' }}>
                                {row.sttNumbers}
                            </div>
                            <div style={{ display: 'flex', width: '22%', justifyContent: 'flex-end', alignItems: 'center', padding: '8px 12px', fontWeight: 700, borderRight: '2px solid #000000' }}>
                                {`Rp ${fmtAngka(row.totalAmount)}`}
                            </div>
                        </div>
                    ))}

                    {/* Empty padding rows when < 5 */}
                    {Array.from({ length: minEmptyRows }).map((_, idx) => (
                        <div key={`emp-${idx}`} style={{ display: 'flex', borderBottom: '1.5px solid #000000', height: 40 }}>
                            <div style={{ display: 'flex', width: '6%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '21%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '16%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '35%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '22%', borderRight: '2px solid #000000' }} />
                        </div>
                    ))}

                    {/* Grand Total Row */}
                    <div
                        style={{
                            display: 'flex',
                            backgroundColor: '#f1f5f9',
                            borderTop: '1px solid #000000',
                            borderBottom: '2px solid #000000',
                            minHeight: 54,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                width: '78%',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                padding: '10px 16px',
                                fontWeight: 700,
                                fontStyle: 'italic',
                                fontSize: 18,
                                borderRight: '1.5px solid #000000',
                            }}
                        >
                            GRAND TOTAL :
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                width: '22%',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                padding: '10px 12px',
                                fontWeight: 700,
                                fontSize: 21,
                                borderRight: '2px solid #000000',
                            }}
                        >
                            {`Rp ${fmtAngka(grandTotal)}`}
                        </div>
                    </div>
                </div>

                {/* Terbilang */}
                <div
                    style={{
                        display: 'flex',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        padding: '12px 16px',
                        marginBottom: 28,
                        fontSize: 16,
                        fontStyle: 'italic',
                    }}
                >
                    <div style={{ display: 'flex', fontWeight: 700, fontStyle: 'normal', marginRight: 8 }}>
                        Terbilang:
                    </div>
                    <div style={{ display: 'flex' }}>{`# ${terbilang(grandTotal)} #`}</div>
                </div>

                {/* Footer & Signature */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginTop: 'auto',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.55, fontSize: 16 }}>
                        <div style={{ display: 'flex', fontWeight: 700, textDecoration: 'underline', marginBottom: 6 }}>
                            PEMBAYARAN DITRANSFER KE :
                        </div>
                        {hasNonTaxable &&
                            COMPANY_INFO.bankAccounts.map((acc, i) => (
                                <div key={i} style={{ display: 'flex', fontWeight: 700 }}>
                                    {`${acc.bank} ${acc.accountNumber} a/n ${acc.accountName}`}
                                </div>
                            ))}
                        {hasTaxable ? (
                            <div style={{ display: 'flex', fontWeight: 700, marginTop: hasNonTaxable ? 4 : 0 }}>
                                BCA 187 1414 187 a/n CAHAYA CARGO EXPRESS CV (PKP)
                            </div>
                        ) : null}
                        <div style={{ display: 'flex', fontSize: 13, fontStyle: 'italic', color: '#475569', marginTop: 10 }}>
                            * Mohon cantumkan nama perusahaan / nomor invoice saat melakukan transfer.
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 210 }}>
                        {ttdUri ? <img src={ttdUri} width={160} height={142} alt="TTD" /> : null}
                    </div>
                </div>
            </div>
        ),
        { width, height, ...(fonts.length > 0 ? { fonts } : {}) }
    );

    const buf = Buffer.from(await img.arrayBuffer());
    return {
        base64: buf.toString('base64'),
        mimeType: 'image/png',
        filename: buildRekapFilename(recipientName, rows.length),
        clientName: recipientName,
        invoiceCount: rows.length,
        invoiceNumbers: rows.map((r) => r.invoiceNumber),
        notFoundInvoiceNumbers,
        totalAmount: grandTotal,
    };
}
