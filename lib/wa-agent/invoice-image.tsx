import 'server-only';
import fs from 'fs';
import path from 'path';
import { ImageResponse } from 'next/og';
import { adminDb } from '@/lib/firebase-admin';
import { COMPANY_INFO } from '@/lib/company-config';
import { terbilang } from '@/lib/currency';

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
}

const imageDataUriCache = new Map<string, string>();

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
            });
        }
    }

    txs.sort((a, b) => {
        const numA = parseInt(a.noSTT.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.noSTT.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
    });

    const invoiceNumber = String(inv.invoiceNumber || invoiceId);
    const clientName =
        (txs.length > 0 && txs[0].pengirimName) || String(inv.clientName || 'Client Umum');
    const clientAddress =
        (txs.length > 0 && txs[0].pengirimAddress) || String(inv.clientAddress || '');
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

    if (isTaxableInvoice) {
        const minRows = 8;
        const emptyCount = Math.max(0, minRows - txs.length);
        const totalRows = 2 + txs.length + 2 + emptyCount + 1;
        const width = 1100;
        const height = Math.max(1460, 560 + totalRows * 42);

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
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Header PKP */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            borderBottom: '3px solid #000000',
                            paddingBottom: 14,
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
                        {/* Header Row */}
                        <div
                            style={{
                                display: 'flex',
                                backgroundColor: '#f8fafc',
                                fontWeight: 700,
                                borderBottom: '2px solid #000000',
                            }}
                        >
                            <div style={{ display: 'flex', width: '6%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>NO</div>
                            <div style={{ display: 'flex', width: '50%', justifyContent: 'center', padding: '8px 6px', borderRight: '1.5px solid #000000' }}>KETERANGAN</div>
                            <div style={{ display: 'flex', width: '8%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>KOLI</div>
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>{hasKgVolume ? 'KG VOL' : 'KG/M3'}</div>
                            <div style={{ display: 'flex', width: '10%', justifyContent: 'center', padding: '8px 4px', borderRight: '1.5px solid #000000' }}>HARGA</div>
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'center', padding: '8px 6px', borderRight: '2px solid #000000' }}>JUMLAH</div>
                        </div>

                        {/* Deskripsi */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 36 }}>
                            <div style={{ display: 'flex', width: '6%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '50%', padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #000000' }}>{desc1}</div>
                            <div style={{ display: 'flex', width: '8%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '12%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '10%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', padding: '6px 8px', fontWeight: 700, borderRight: '2px solid #000000' }}>-</div>
                        </div>

                        {/* Data Rows */}
                        {txs.map((t, idx) => (
                            <div key={t.id} style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 38 }}>
                                <div style={{ display: 'flex', width: '6%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>{idx + 1}.</div>
                                <div style={{ display: 'flex', width: '50%', alignItems: 'center', padding: '6px 8px', borderRight: '1px solid #000000' }}>
                                    {`${t.penerimaName.toUpperCase()} - ${t.tujuan.toUpperCase()}`}
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
                                <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, fontWeight: 700, borderRight: '2px solid #000000' }}>
                                    {t.jumlah > 0 ? fmtAngka(t.jumlah) : ''}
                                </div>
                            </div>
                        ))}

                        {/* TOTAL TAGIHAN Row */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 38, fontWeight: 700 }}>
                            <div style={{ display: 'flex', width: '56%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>TOTAL TAGIHAN</div>
                            <div style={{ display: 'flex', width: '8%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>
                                {totalKoli > 0 ? fmtAngka(totalKoli) : ''}
                            </div>
                            <div style={{ display: 'flex', width: '12%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1px solid #000000' }}>
                                {totalBerat > 0 ? fmtAngka(totalBerat) : ''}
                            </div>
                            <div style={{ display: 'flex', width: '10%', borderRight: '1px solid #000000' }} />
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '2px solid #000000' }}>
                                {fmtAngka(subtotal)}
                            </div>
                        </div>

                        {/* PPN Row */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: 38 }}>
                            <div style={{ display: 'flex', width: '6%', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #000000' }}>{txs.length + 1}.</div>
                            <div style={{ display: 'flex', width: '80%', alignItems: 'center', paddingLeft: 8, borderRight: '1px solid #000000' }}>PPN 1.1%</div>
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '2px solid #000000' }}>
                                {fmtAngka(totalPPN)}
                            </div>
                        </div>

                        {/* Empty Rows */}
                        {Array.from({ length: emptyCount }).map((_, idx) => (
                            <div key={`ep-${idx}`} style={{ display: 'flex', borderBottom: '1px solid #000000', height: 34 }}>
                                <div style={{ display: 'flex', width: '6%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '50%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '8%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '12%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '10%', borderRight: '1px solid #000000' }} />
                                <div style={{ display: 'flex', width: '14%', borderRight: '2px solid #000000' }} />
                            </div>
                        ))}

                        {/* Terbilang + TOTAL */}
                        <div style={{ display: 'flex', borderBottom: '2px solid #000000', minHeight: 44 }}>
                            <div style={{ display: 'flex', width: '76%', alignItems: 'center', padding: '6px 8px', fontSize: 14, fontStyle: 'italic' }}>
                                {`Terbilang : # ${terbilang(totalAkhir)} #`}
                            </div>
                            <div style={{ display: 'flex', width: '10%', justifyContent: 'center', alignItems: 'center', fontWeight: 700, fontSize: 17, borderRight: '2px solid #000000' }}>
                                TOTAL
                            </div>
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, fontWeight: 700, fontSize: 19, borderRight: '2px solid #000000' }}>
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
            { width, height }
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
    // LAYOUT STANDAR (NON-PKP, A5 LANDSCAPE PROPORSIONAL)
    // ====================================================
    const minRowsStd = 6;
    const emptyCountStd = Math.max(0, minRowsStd - txs.length);
    const totalRowsStd = txs.length + emptyCountStd;
    const width = 1240;
    const height = Math.max(874, 510 + totalRowsStd * 42);

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
                    padding: '32px 46px',
                    fontFamily: 'sans-serif',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 14,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {logoUri && <img src={logoUri} width={88} height={76} alt="Logo" />}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', fontSize: 21, fontWeight: 700, lineHeight: 1.3 }}>
                                {COMPANY_INFO.name}
                            </div>
                            <div style={{ display: 'flex', fontSize: 15, lineHeight: 1.4 }}>{COMPANY_INFO.address}</div>
                            <div style={{ display: 'flex', fontSize: 15, lineHeight: 1.4 }}>{COMPANY_INFO.city}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 16, lineHeight: 1.65 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ display: 'flex', width: 92 }}>Nomer</div>
                            <div style={{ display: 'flex' }}>:</div>
                            <div style={{ display: 'flex', fontWeight: 700 }}>{invoiceNumber}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ display: 'flex', width: 92 }}>Tanggal</div>
                            <div style={{ display: 'flex' }}>:</div>
                            <div style={{ display: 'flex', fontWeight: 700 }}>{issueDateStr}</div>
                        </div>
                    </div>
                </div>

                {/* Judul */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <div
                        style={{
                            display: 'flex',
                            fontSize: 25,
                            fontWeight: 700,
                            letterSpacing: 7,
                            textDecoration: 'underline',
                        }}
                    >
                        I N V O I C E
                    </div>
                </div>

                {/* Kepada Yth */}
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
                    <div style={{ display: 'flex', fontSize: 15 }}>Kepada Yth,</div>
                    <div style={{ display: 'flex', fontSize: 18, fontWeight: 700 }}>
                        {clientName.toUpperCase()}
                    </div>
                    {clientAddress ? (
                        <div style={{ display: 'flex', fontSize: 16, fontWeight: 700 }}>
                            {clientAddress.toUpperCase()}
                        </div>
                    ) : null}
                    {notes ? (
                        <div style={{ display: 'flex', fontSize: 14, fontStyle: 'italic', marginTop: 2 }}>{notes}</div>
                    ) : null}
                </div>

                {/* Tabel 7 Kolom */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderTop: '1.5px solid #000000',
                        borderLeft: '1.5px solid #000000',
                        fontSize: 16,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            backgroundColor: '#f8fafc',
                            fontWeight: 700,
                            borderBottom: '1.5px solid #000000',
                        }}
                    >
                        <div style={{ display: 'flex', width: '5%', justifyContent: 'center', padding: '7px 4px', borderRight: '1.5px solid #000000' }}>NO</div>
                        <div style={{ display: 'flex', width: '43%', justifyContent: 'center', padding: '7px 6px', borderRight: '1.5px solid #000000' }}>KETERANGAN</div>
                        <div style={{ display: 'flex', width: '10%', justifyContent: 'center', padding: '7px 4px', borderRight: '1.5px solid #000000' }}>NO STT</div>
                        <div style={{ display: 'flex', width: '7%', justifyContent: 'center', padding: '7px 4px', borderRight: '1.5px solid #000000' }}>KOLI</div>
                        <div style={{ display: 'flex', width: '11%', justifyContent: 'center', padding: '7px 4px', borderRight: '1.5px solid #000000' }}>{hasKgVolume ? 'KG VOL' : 'KG/M3'}</div>
                        <div style={{ display: 'flex', width: '10%', justifyContent: 'center', padding: '7px 4px', borderRight: '1.5px solid #000000' }}>HARGA</div>
                        <div style={{ display: 'flex', width: '14%', justifyContent: 'center', padding: '7px 6px', borderRight: '1.5px solid #000000' }}>JUMLAH</div>
                    </div>

                    {txs.map((t, idx) => (
                        <div key={t.id} style={{ display: 'flex', borderBottom: '1.5px solid #000000', minHeight: 38 }}>
                            <div style={{ display: 'flex', width: '5%', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #000000' }}>{idx + 1}.</div>
                            <div style={{ display: 'flex', width: '43%', alignItems: 'center', padding: '5px 8px', borderRight: '1.5px solid #000000' }}>
                                {`${t.penerimaName.toUpperCase()} - ${t.tujuan.toUpperCase()}`}
                            </div>
                            <div style={{ display: 'flex', width: '10%', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #000000' }}>
                                {t.noSTT.replace(/^STT/i, '')}
                            </div>
                            <div style={{ display: 'flex', width: '7%', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #000000' }}>
                                {t.koli}
                            </div>
                            <div style={{ display: 'flex', width: '11%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1.5px solid #000000' }}>
                                {t.berat}
                            </div>
                            <div style={{ display: 'flex', width: '10%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1.5px solid #000000' }}>
                                {t.tipeTransaksi === 'regular' ? fmtAngka(t.harga) : '-'}
                            </div>
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1.5px solid #000000' }}>
                                {fmtAngka(t.jumlah)}
                            </div>
                        </div>
                    ))}

                    {Array.from({ length: emptyCountStd }).map((_, idx) => (
                        <div key={`es-${idx}`} style={{ display: 'flex', borderBottom: '1.5px solid #000000', height: 34 }}>
                            <div style={{ display: 'flex', width: '5%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '43%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '10%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '7%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '11%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '10%', borderRight: '1.5px solid #000000' }} />
                            <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, borderRight: '1.5px solid #000000' }}>
                                -
                            </div>
                        </div>
                    ))}

                    {/* Terbilang + TOTAL */}
                    <div style={{ display: 'flex', borderBottom: '1.5px solid #000000', minHeight: 44 }}>
                        <div style={{ display: 'flex', width: '65%', alignItems: 'center', padding: '6px 8px', fontSize: 14, fontStyle: 'italic', borderRight: '1.5px solid #000000' }}>
                            {`Terbilang : # ${terbilang(totalAkhir)} #`}
                        </div>
                        <div style={{ display: 'flex', width: '21%', justifyContent: 'center', alignItems: 'center', fontWeight: 700, fontSize: 16, letterSpacing: 2, borderRight: '1.5px solid #000000' }}>
                            T O T A L
                        </div>
                        <div style={{ display: 'flex', width: '14%', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8, fontWeight: 700, fontSize: 18, borderRight: '1.5px solid #000000' }}>
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
                        marginTop: 22,
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 18, fontWeight: 700, lineHeight: 1.55 }}>
                        <div style={{ display: 'flex', textDecoration: 'underline', marginBottom: 4 }}>TRANSFER :</div>
                        {COMPANY_INFO.bankAccounts.map((acc, i) => (
                            <div key={i} style={{ display: 'flex' }}>
                                {`${acc.bank} ${acc.accountNumber}  an ${acc.accountName}`}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
                        {ttdUri ? <img src={ttdUri} width={152} height={136} alt="TTD" /> : null}
                    </div>
                </div>
            </div>
        ),
        { width, height }
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
