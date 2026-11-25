import 'server-only';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { adminDb } from '@/lib/firebase-admin';
import { COMPANY_INFO } from '@/lib/company-config';
import { terbilang } from '@/lib/currency';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/types/voyage';
import { resolveInvoiceClientIdentity } from '@/lib/invoice-reconciliation';

export interface GeneratedPdfReport {
    base64: string;
    mimeType: 'application/pdf';
    filename: string;
    summary: Record<string, unknown>;
}

export interface ReceivablesPdfArgs {
    clientName?: string;
    invoiceNumbers?: string[];
    month?: string;
    startDate?: string;
    endDate?: string;
    voyageQuery?: string;
    onlyOverdue?: boolean;
}

export interface ShipManifestPdfArgs {
    voyageId?: string;
    voyageNumber?: string;
    manifestId?: string;
    shipName?: string;
    departureDate?: string;
    nopolOrDriver?: string;
    source?: 'auto' | 'voyage' | 'cargo_manifest';
}

export interface VoyageProfitLossPdfArgs {
    voyageId?: string;
    voyageNumber?: string;
    searchQuery?: string;
    shipName?: string;
    departureDate?: string;
    startDate?: string;
    endDate?: string;
    month?: string;
    period?: string;
    includeCargoDetail?: boolean;
}

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

const COLOR_TEXT = rgb(0.08, 0.1, 0.14);
const COLOR_MUTED = rgb(0.38, 0.42, 0.48);
const COLOR_BORDER = rgb(0.55, 0.6, 0.67);
const COLOR_DARK = rgb(0.11, 0.15, 0.23);
const COLOR_HEADER_BG = rgb(0.92, 0.94, 0.97);
const COLOR_ROW_ALT = rgb(0.975, 0.98, 0.988);
const COLOR_BLUE = rgb(0.09, 0.34, 0.72);
const COLOR_BLUE_BG = rgb(0.93, 0.96, 1);
const COLOR_RED = rgb(0.75, 0.14, 0.18);
const COLOR_RED_BG = rgb(0.99, 0.94, 0.94);
const COLOR_GREEN = rgb(0.06, 0.48, 0.28);
const COLOR_GREEN_BG = rgb(0.92, 0.98, 0.94);
const COLOR_AMBER = rgb(0.68, 0.38, 0.04);
const COLOR_AMBER_BG = rgb(0.99, 0.96, 0.89);

/**
 * Strip/normalize non-WinAnsi characters so StandardFonts in pdf-lib never throw.
 */
export function sanitizePdfText(input: unknown): string {
    const raw = String(input ?? '')
        .replace(/[➔→➜➝➞]/g, ' -> ')
        .replace(/☎/g, 'Telp:')
        .replace(/[•●◦▪▫]/g, '-')
        .replace(/[–—]/g, '-')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\u00a0/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');

    let out = '';
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (code === 10 || code === 13 || code === 9) {
            out += ' ';
        } else if (code >= 32 && code <= 126) {
            out += raw[i];
        } else if (code >= 160 && code <= 255) {
            out += raw[i];
        }
    }
    return out.replace(/\s+/g, ' ').trim();
}

function safeFilenameToken(val: string, fallback: string): string {
    const cleaned = sanitizePdfText(val)
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 36);
    return cleaned || fallback;
}

function toDateSafe(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toWibDateIso(value: any): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(toDateSafe(value));
}

function fmtDateShortId(value: any): string {
    return toDateSafe(value).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    });
}

function fmtDateLongId(value: any): string {
    return toDateSafe(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    });
}

function fmtWibTimestampNow(): string {
    return (
        new Date().toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }) + ' WIB'
    );
}

function fmtRp(num: number): string {
    const rounded = Math.round(num || 0);
    const absStr = Math.abs(rounded).toLocaleString('id-ID');
    return rounded < 0 ? `-Rp ${absStr}` : `Rp ${absStr}`;
}

function fmtNum(num: number): string {
    return Math.round(num || 0).toLocaleString('id-ID');
}

function parseInvoiceNumbersInput(rawList?: string[]): string[] {
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

function invoiceNumberMatchesToken(invoiceNumber: string, token: string): boolean {
    const invUpper = invoiceNumber.trim().toUpperCase();
    const tokUpper = token.trim().toUpperCase();
    if (!invUpper || !tokUpper) return false;
    if (invUpper === tokUpper) return true;
    const invDigits = invUpper.replace(/\D/g, '');
    const tokDigits = tokUpper.replace(/\D/g, '');
    return Boolean(tokDigits && invDigits && invDigits === tokDigits);
}

function resolveWibPeriodRange(period?: string): { startIso?: string; endIso?: string } {
    const p = (period || '').trim().toLowerCase();
    if (!p || p === 'all') return {};

    const todayStr = toWibDateIso(new Date());
    const [y, m, d] = todayStr.split('-').map(Number);
    const utcMid = new Date(Date.UTC(y, m - 1, d));

    if (p === 'today' || p === 'hari_ini') {
        return { startIso: todayStr, endIso: todayStr };
    }
    if (p === 'last_7_days' || p === '7_hari') {
        const start = new Date(utcMid.getTime() - 6 * 86400000);
        return { startIso: start.toISOString().slice(0, 10), endIso: todayStr };
    }
    if (p === 'this_week' || p === 'minggu_ini') {
        const dow = utcMid.getUTCDay();
        const offsetFromMonday = dow === 0 ? 6 : dow - 1;
        const mon = new Date(utcMid.getTime() - offsetFromMonday * 86400000);
        const sun = new Date(mon.getTime() + 6 * 86400000);
        return { startIso: mon.toISOString().slice(0, 10), endIso: sun.toISOString().slice(0, 10) };
    }
    if (p === 'this_month' || p === 'bulan_ini') {
        const firstDay = new Date(Date.UTC(y, m - 1, 1));
        const lastDay = new Date(Date.UTC(y, m, 0));
        return { startIso: firstDay.toISOString().slice(0, 10), endIso: lastDay.toISOString().slice(0, 10) };
    }
    return {};
}

async function embedPublicImage(pdfDoc: PDFDocument, relPath: string): Promise<PDFImage | null> {
    try {
        const abs = path.join(process.cwd(), 'public', relPath);
        if (!fs.existsSync(abs)) return null;
        const buf = fs.readFileSync(abs);
        if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
            return await pdfDoc.embedJpg(buf);
        }
        return await pdfDoc.embedPng(buf);
    } catch {
        return null;
    }
}

interface PdfFonts {
    regular: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
    monoBold: PDFFont;
}

async function createBasePdfDocument(): Promise<{ pdfDoc: PDFDocument; fonts: PdfFonts }> {
    const pdfDoc = await PDFDocument.create();
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const monoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
    return { pdfDoc, fonts: { regular, bold, italic, monoBold } };
}

function safeWidth(font: PDFFont, text: string, size: number): number {
    const cleaned = sanitizePdfText(text);
    if (!cleaned) return 0;
    try {
        return font.widthOfTextAtSize(cleaned, size);
    } catch {
        return cleaned.length * size * 0.52;
    }
}

function drawSafeText(
    page: PDFPage,
    text: string,
    opts: {
        x: number;
        y: number;
        font: PDFFont;
        size: number;
        color?: ReturnType<typeof rgb>;
    }
) {
    const cleaned = sanitizePdfText(text);
    if (!cleaned) return;
    try {
        page.drawText(cleaned, {
            x: opts.x,
            y: opts.y,
            font: opts.font,
            size: opts.size,
            color: opts.color || COLOR_TEXT,
        });
    } catch {
        const asciiFallback = cleaned.replace(/[^\x20-\x7e]/g, '?');
        page.drawText(asciiFallback, {
            x: opts.x,
            y: opts.y,
            font: opts.font,
            size: opts.size,
            color: opts.color || COLOR_TEXT,
        });
    }
}

function wrapTextToLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const cleaned = sanitizePdfText(text);
    if (!cleaned) return [''];
    if (maxWidth <= 8) return [cleaned];

    const words = cleaned.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (safeWidth(font, candidate, fontSize) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) {
            lines.push(current);
            current = '';
        }
        if (safeWidth(font, word, fontSize) <= maxWidth) {
            current = word;
        } else {
            // Break overlong unbroken token (e.g., long STT list without spaces)
            let chunk = '';
            for (const ch of word) {
                if (safeWidth(font, chunk + ch, fontSize) > maxWidth && chunk) {
                    lines.push(chunk);
                    chunk = ch;
                } else {
                    chunk += ch;
                }
            }
            current = chunk;
        }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
}

function drawCompanyHeader(
    page: PDFPage,
    fonts: PdfFonts,
    logo: PDFImage | null,
    opts: {
        marginX: number;
        title: string;
        subtitle?: string;
        rightBadge?: string;
        compact?: boolean;
    }
): number {
    const { width, height } = page.getSize();
    const topY = height - 28;
    const rightX = width - opts.marginX;

    if (opts.compact) {
        drawSafeText(page, `${COMPANY_INFO.name} - ${opts.title}`, {
            x: opts.marginX,
            y: topY,
            font: fonts.bold,
            size: 10,
            color: COLOR_DARK,
        });
        if (opts.subtitle) {
            const subW = safeWidth(fonts.regular, opts.subtitle, 8.5);
            drawSafeText(page, opts.subtitle, {
                x: Math.max(opts.marginX + 200, rightX - subW),
                y: topY,
                font: fonts.regular,
                size: 8.5,
                color: COLOR_MUTED,
            });
        }
        const lineY = topY - 8;
        page.drawLine({
            start: { x: opts.marginX, y: lineY },
            end: { x: rightX, y: lineY },
            thickness: 1.2,
            color: COLOR_DARK,
        });
        return lineY - 12;
    }

    const logoBoxSize = 40;
    let textStartX = opts.marginX;
    if (logo) {
        const dims = logo.scale(1);
        const scale = Math.min(logoBoxSize / dims.width, logoBoxSize / dims.height);
        const drawW = dims.width * scale;
        const drawH = dims.height * scale;
        page.drawImage(logo, {
            x: opts.marginX,
            y: topY - drawH + 8,
            width: drawW,
            height: drawH,
        });
        textStartX = opts.marginX + drawW + 10;
    }

    drawSafeText(page, COMPANY_INFO.name, {
        x: textStartX,
        y: topY,
        font: fonts.bold,
        size: 13.5,
        color: COLOR_DARK,
    });
    drawSafeText(page, `${COMPANY_INFO.address}, ${COMPANY_INFO.city}`, {
        x: textStartX,
        y: topY - 13,
        font: fonts.regular,
        size: 8.5,
        color: COLOR_MUTED,
    });
    drawSafeText(page, `Telp/WA: ${COMPANY_INFO.phone} | Makassar: ${COMPANY_INFO.branchPhone}`, {
        x: textStartX,
        y: topY - 24,
        font: fonts.regular,
        size: 8.5,
        color: COLOR_MUTED,
    });

    if (opts.rightBadge) {
        const badgeText = sanitizePdfText(opts.rightBadge).toUpperCase();
        const badgeW = safeWidth(fonts.bold, badgeText, 7.5) + 12;
        page.drawRectangle({
            x: rightX - badgeW,
            y: topY - 2,
            width: badgeW,
            height: 14,
            color: COLOR_DARK,
        });
        drawSafeText(page, badgeText, {
            x: rightX - badgeW + 6,
            y: topY + 2,
            font: fonts.bold,
            size: 7.5,
            color: rgb(1, 1, 1),
        });
    }

    const titleY = opts.rightBadge ? topY - 17 : topY;
    const titleLines = wrapTextToLines(opts.title.toUpperCase(), fonts.bold, 11.5, width * 0.45);
    titleLines.forEach((line, idx) => {
        const lw = safeWidth(fonts.bold, line, 11.5);
        drawSafeText(page, line, {
            x: rightX - lw,
            y: titleY - idx * 13,
            font: fonts.bold,
            size: 11.5,
            color: COLOR_DARK,
        });
    });

    if (opts.subtitle) {
        const subY = titleY - titleLines.length * 13 - 1;
        const sw = safeWidth(fonts.bold, opts.subtitle, 8.5);
        drawSafeText(page, opts.subtitle, {
            x: rightX - sw,
            y: subY,
            font: fonts.bold,
            size: 8.5,
            color: COLOR_BLUE,
        });
    }

    const dividerY = topY - 40;
    page.drawLine({
        start: { x: opts.marginX, y: dividerY },
        end: { x: rightX, y: dividerY },
        thickness: 1.6,
        color: COLOR_DARK,
    });

    return dividerY - 14;
}

interface TableColumn {
    header: string;
    width: number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    mono?: boolean;
}

interface TableCellInput {
    text: string;
    bold?: boolean;
    mono?: boolean;
    color?: ReturnType<typeof rgb>;
    bgColor?: ReturnType<typeof rgb>;
    align?: 'left' | 'center' | 'right';
    drawCheckbox?: boolean;
}

interface TableRowInput {
    cells: Array<string | TableCellInput>;
    isFooter?: boolean;
    bgColor?: ReturnType<typeof rgb>;
}

function drawPaginatedTable(
    pdfDoc: PDFDocument,
    initialPage: PDFPage,
    startY: number,
    fonts: PdfFonts,
    logo: PDFImage | null,
    opts: {
        pageSize: [number, number];
        marginX: number;
        bottomMargin?: number;
        continuationTitle: string;
        continuationSubtitle?: string;
        columns: TableColumn[];
        rows: TableRowInput[];
        fontSize?: number;
        headerFontSize?: number;
        padH?: number;
        padV?: number;
        sectionTitle?: string;
    }
): { page: PDFPage; cursorY: number } {
    let page = initialPage;
    let cursorY = startY;
    const bottomMargin = opts.bottomMargin ?? 42;
    const fontSize = opts.fontSize ?? 7.5;
    const headerFontSize = opts.headerFontSize ?? 7.5;
    const padH = opts.padH ?? 4;
    const padV = opts.padV ?? 4;
    const lineH = fontSize + 2.2;
    const totalW = opts.columns.reduce((s, c) => s + c.width, 0);

    const drawHeaderRow = () => {
        const headerLinesList = opts.columns.map((col) =>
            wrapTextToLines(col.header, fonts.bold, headerFontSize, Math.max(8, col.width - padH * 2))
        );
        const maxLines = Math.max(1, ...headerLinesList.map((l) => l.length));
        const rowH = padV * 2 + maxLines * (headerFontSize + 2);

        if (cursorY - rowH < bottomMargin) {
            page = pdfDoc.addPage(opts.pageSize);
            cursorY = drawCompanyHeader(page, fonts, logo, {
                marginX: opts.marginX,
                title: opts.continuationTitle,
                subtitle: opts.continuationSubtitle,
                compact: true,
            });
        }

        let x = opts.marginX;
        for (let i = 0; i < opts.columns.length; i++) {
            const col = opts.columns[i];
            const lines = headerLinesList[i];
            page.drawRectangle({
                x,
                y: cursorY - rowH,
                width: col.width,
                height: rowH,
                color: COLOR_HEADER_BG,
                borderColor: COLOR_DARK,
                borderWidth: 0.7,
            });
            lines.forEach((line, li) => {
                const textW = safeWidth(fonts.bold, line, headerFontSize);
                const align = col.align || 'left';
                let tx = x + padH;
                if (align === 'center') tx = x + (col.width - textW) / 2;
                else if (align === 'right') tx = x + col.width - padH - textW;
                drawSafeText(page, line, {
                    x: tx,
                    y: cursorY - padV - headerFontSize + 1 - li * (headerFontSize + 2),
                    font: fonts.bold,
                    size: headerFontSize,
                    color: COLOR_DARK,
                });
            });
            x += col.width;
        }
        cursorY -= rowH;
    };

    if (opts.sectionTitle) {
        if (cursorY - 40 < bottomMargin) {
            page = pdfDoc.addPage(opts.pageSize);
            cursorY = drawCompanyHeader(page, fonts, logo, {
                marginX: opts.marginX,
                title: opts.continuationTitle,
                subtitle: opts.continuationSubtitle,
                compact: true,
            });
        }
        drawSafeText(page, opts.sectionTitle, {
            x: opts.marginX,
            y: cursorY,
            font: fonts.bold,
            size: 9.5,
            color: COLOR_DARK,
        });
        cursorY -= 12;
    }

    drawHeaderRow();

    opts.rows.forEach((row, rIdx) => {
        const normalizedCells: TableCellInput[] = row.cells.map((c) =>
            typeof c === 'string' ? { text: c } : c
        );

        const cellWrapped = normalizedCells.map((cell, ci) => {
            const col = opts.columns[ci];
            if (cell.drawCheckbox) return [''];
            const cellFont =
                cell.mono || col.mono
                    ? fonts.monoBold
                    : cell.bold || col.bold || row.isFooter
                      ? fonts.bold
                      : fonts.regular;
            return wrapTextToLines(cell.text, cellFont, fontSize, Math.max(8, col.width - padH * 2));
        });

        const maxLines = Math.max(1, ...cellWrapped.map((l) => l.length));
        const rowH = Math.max(cellWrapped.some((c) => c[0] === '') ? 16 : 0, padV * 2 + maxLines * lineH);

        if (cursorY - rowH < bottomMargin) {
            page = pdfDoc.addPage(opts.pageSize);
            cursorY = drawCompanyHeader(page, fonts, logo, {
                marginX: opts.marginX,
                title: opts.continuationTitle,
                subtitle: opts.continuationSubtitle,
                compact: true,
            });
            if (opts.sectionTitle) {
                drawSafeText(page, `${opts.sectionTitle} (Lanjutan)`, {
                    x: opts.marginX,
                    y: cursorY,
                    font: fonts.bold,
                    size: 9,
                    color: COLOR_MUTED,
                });
                cursorY -= 11;
            }
            drawHeaderRow();
        }

        const defaultRowBg = row.isFooter
            ? COLOR_HEADER_BG
            : rIdx % 2 === 1
              ? COLOR_ROW_ALT
              : rgb(1, 1, 1);

        let x = opts.marginX;
        for (let ci = 0; ci < opts.columns.length; ci++) {
            const col = opts.columns[ci];
            const cell = normalizedCells[ci] || { text: '' };
            const lines = cellWrapped[ci];
            const bg = cell.bgColor || row.bgColor || defaultRowBg;

            page.drawRectangle({
                x,
                y: cursorY - rowH,
                width: col.width,
                height: rowH,
                color: bg,
                borderColor: row.isFooter ? COLOR_DARK : COLOR_BORDER,
                borderWidth: row.isFooter ? 0.8 : 0.45,
            });

            if (cell.drawCheckbox) {
                const boxSize = 8.5;
                page.drawRectangle({
                    x: x + (col.width - boxSize) / 2,
                    y: cursorY - rowH / 2 - boxSize / 2,
                    width: boxSize,
                    height: boxSize,
                    color: rgb(1, 1, 1),
                    borderColor: COLOR_DARK,
                    borderWidth: 0.9,
                });
            } else {
                const cellFont =
                    cell.mono || col.mono
                        ? fonts.monoBold
                        : cell.bold || col.bold || row.isFooter
                          ? fonts.bold
                          : fonts.regular;
                const align = cell.align || col.align || 'left';
                lines.forEach((line, li) => {
                    const textW = safeWidth(cellFont, line, fontSize);
                    let tx = x + padH;
                    if (align === 'center') tx = x + (col.width - textW) / 2;
                    else if (align === 'right') tx = x + col.width - padH - textW;
                    drawSafeText(page, line, {
                        x: tx,
                        y: cursorY - padV - fontSize + 1 - li * lineH,
                        font: cellFont,
                        size: fontSize,
                        color: cell.color || COLOR_TEXT,
                    });
                });
            }
            x += col.width;
        }

        if (row.isFooter) {
            page.drawLine({
                start: { x: opts.marginX, y: cursorY },
                end: { x: opts.marginX + totalW, y: cursorY },
                thickness: 1.1,
                color: COLOR_DARK,
            });
        }

        cursorY -= rowH;
    });

    return { page, cursorY };
}

function drawKpiCards(
    page: PDFPage,
    fonts: PdfFonts,
    marginX: number,
    cursorY: number,
    cards: Array<{
        label: string;
        value: string;
        sub?: string;
        fgColor: ReturnType<typeof rgb>;
        bgColor: ReturnType<typeof rgb>;
    }>
): number {
    const { width } = page.getSize();
    const usableW = width - marginX * 2;
    const gap = 8;
    const cardW = (usableW - gap * (cards.length - 1)) / cards.length;
    const cardH = 44;

    cards.forEach((c, idx) => {
        const cx = marginX + idx * (cardW + gap);
        page.drawRectangle({
            x: cx,
            y: cursorY - cardH,
            width: cardW,
            height: cardH,
            color: c.bgColor,
            borderColor: c.fgColor,
            borderWidth: 0.9,
        });
        drawSafeText(page, c.label.toUpperCase(), {
            x: cx + 7,
            y: cursorY - 12,
            font: fonts.bold,
            size: 7,
            color: c.fgColor,
        });
        drawSafeText(page, c.value, {
            x: cx + 7,
            y: cursorY - 27,
            font: fonts.bold,
            size: 10.5,
            color: COLOR_DARK,
        });
        if (c.sub) {
            drawSafeText(page, c.sub, {
                x: cx + 7,
                y: cursorY - 38,
                font: fonts.regular,
                size: 6.8,
                color: COLOR_MUTED,
            });
        }
    });

    return cursorY - cardH - 12;
}

function finalizeFooters(pdfDoc: PDFDocument, fonts: PdfFonts, marginX: number) {
    const pages = pdfDoc.getPages();
    const printedAt = fmtWibTimestampNow();
    pages.forEach((p, idx) => {
        const { width } = p.getSize();
        p.drawLine({
            start: { x: marginX, y: 26 },
            end: { x: width - marginX, y: 26 },
            thickness: 0.5,
            color: COLOR_BORDER,
        });
        drawSafeText(p, `Dicetak otomatis oleh Sistem CCE | ${printedAt}`, {
            x: marginX,
            y: 15,
            font: fonts.regular,
            size: 7,
            color: COLOR_MUTED,
        });
        const pageStr = `Halaman ${idx + 1} dari ${pages.length}`;
        const pw = safeWidth(fonts.bold, pageStr, 7.5);
        drawSafeText(p, pageStr, {
            x: width - marginX - pw,
            y: 15,
            font: fonts.bold,
            size: 7.5,
            color: COLOR_MUTED,
        });
    });
}

// =====================================================================
// 1. LAPORAN PDF REKAP TAGIHAN PIUTANG CLIENT
// =====================================================================

export async function generateReceivablesPdf(args: ReceivablesPdfArgs = {}): Promise<GeneratedPdfReport> {
    const [invoicesSnap, txSnap, voyagesSnap] = await Promise.all([
        adminDb.collection('invoices').get(),
        adminDb.collection('transactions').get(),
        adminDb.collection('voyages').get(),
    ]);

    const txById = new Map<string, { id: string; data: Record<string, any> }>();
    const txByInvoiceId = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
    for (const d of txSnap.docs) {
        const data = d.data() || {};
        txById.set(d.id, { id: d.id, data });
        const invId = String(data.invoiceId || '').trim();
        if (invId) {
            const arr = txByInvoiceId.get(invId) || [];
            arr.push({ id: d.id, data });
            txByInvoiceId.set(invId, arr);
        }
    }

    const voyageByTxId = new Map<string, { voyageNumber: string; shipName: string; route: string }>();
    for (const vd of voyagesSnap.docs) {
        const vData = vd.data() || {};
        if (String(vData.status || '').toLowerCase() === 'cancelled') continue;
        const info = {
            voyageNumber: String(vData.voyageNumber || ''),
            shipName: String(vData.shipName || ''),
            route: String(vData.route || ''),
        };
        const tids: unknown[] = Array.isArray(vData.transactionIds) ? vData.transactionIds : [];
        for (const tid of tids) {
            if (typeof tid === 'string' && tid && !voyageByTxId.has(tid)) {
                voyageByTxId.set(tid, info);
            }
        }
    }

    const reqClientQ = (args.clientName || '').trim().toLowerCase();
    const reqMonth = (args.month || '').trim();
    const reqStart = (args.startDate || '').trim();
    const reqEnd = (args.endDate || '').trim();
    const reqVoyageQ = (args.voyageQuery || '').trim().toLowerCase();
    const reqInvoiceTokens = parseInvoiceNumbersInput(args.invoiceNumbers);
    const onlyOverdue = Boolean(args.onlyOverdue);

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    interface UnpaidInvRow {
        id: string;
        invoiceNumber: string;
        clientName: string;
        clientAddress: string;
        issueDate: Date;
        issueIso: string;
        dueDate: Date;
        dueIso: string;
        overdueDays: number;
        sttList: string;
        totalAmount: number;
        isTaxable: boolean;
        voyageLabel: string;
    }

    const matched: UnpaidInvRow[] = [];

    for (const invDoc of invoicesSnap.docs) {
        const inv = invDoc.data() || {};
        const statusStr = String(inv.status || 'Unpaid');
        if (statusStr === 'Paid' || statusStr === 'Cancelled') continue;

        const invNo = String(inv.invoiceNumber || invDoc.id).trim();
        if (reqInvoiceTokens.length > 0 && !reqInvoiceTokens.some((tok) => invoiceNumberMatchesToken(invNo, tok))) {
            continue;
        }

        const declaredIds: unknown[] = Array.isArray(inv.transactionIds) ? inv.transactionIds : [];
        const txIdSet = new Set<string>();
        for (const tid of declaredIds) {
            if (typeof tid === 'string' && tid.trim()) txIdSet.add(tid.trim());
        }
        for (const t of txByInvoiceId.get(invDoc.id) || []) {
            txIdSet.add(t.id);
        }

        const linkedTxs: Array<
            Record<string, any> & {
                id: string;
                pengirimName?: string;
                pengirimAddress?: string;
                penerimaName?: string;
                penerimaAddress?: string;
                tujuan?: string;
            }
        > = [];
        let voyageInfo: { voyageNumber: string; shipName: string; route: string } | null = null;
        for (const tid of txIdSet) {
            const foundTx = txById.get(tid);
            if (!foundTx || foundTx.data.status === 'dibatalkan') continue;
            linkedTxs.push({
                id: tid,
                pengirimName: String(foundTx.data.pengirimName || ''),
                pengirimAddress: String(foundTx.data.pengirimAddress || ''),
                penerimaName: String(foundTx.data.penerimaName || ''),
                penerimaAddress: String(foundTx.data.penerimaAddress || ''),
                ...foundTx.data,
            });
            if (!voyageInfo) {
                voyageInfo = voyageByTxId.get(tid) || null;
            }
        }

        linkedTxs.sort((a, b) => {
            const na = parseInt(String(a.noSTT || '').replace(/\D/g, ''), 10) || 0;
            const nb = parseInt(String(b.noSTT || '').replace(/\D/g, ''), 10) || 0;
            return na - nb;
        });

        const identity = resolveInvoiceClientIdentity(
            {
                clientName: String(inv.clientName || ''),
                clientAddress: String(inv.clientAddress || ''),
            },
            linkedTxs
        );

        if (reqClientQ && !identity.clientName.toLowerCase().includes(reqClientQ)) {
            continue;
        }

        const issueDate = toDateSafe(inv.issueDate || inv.createdAt);
        const issueIso = toWibDateIso(issueDate);
        const dueDate = toDateSafe(inv.dueDate || issueDate);
        const dueIso = toWibDateIso(dueDate);
        const dueDay = new Date(dueDate);
        dueDay.setHours(0, 0, 0, 0);
        const overdueDays =
            dueDay.getTime() < todayMidnight.getTime()
                ? Math.max(1, Math.ceil((todayMidnight.getTime() - dueDay.getTime()) / 86400000))
                : 0;

        if (reqMonth && !issueIso.startsWith(reqMonth)) continue;
        if (reqStart && issueIso < reqStart) continue;
        if (reqEnd && issueIso > reqEnd) continue;
        if (onlyOverdue && overdueDays <= 0) continue;

        const voyageLabel = voyageInfo
            ? [voyageInfo.shipName, voyageInfo.voyageNumber].filter(Boolean).join(' ')
            : '';
        if (reqVoyageQ) {
            const hay = `${voyageInfo?.shipName || ''} ${voyageInfo?.voyageNumber || ''} ${voyageInfo?.route || ''}`.toLowerCase();
            if (!hay.includes(reqVoyageQ)) continue;
        }

        const subtotal = linkedTxs.reduce((s, t) => s + (Number(t.jumlah) || 0), 0);
        const isTaxable =
            Boolean(inv.isTaxable) ||
            linkedTxs.some((t) => Boolean(t.isTaxable) || (Number(t.ppn) || 0) > 0);
        const totalAmount =
            linkedTxs.length > 0
                ? subtotal + (isTaxable ? Math.round(subtotal * 0.011) : 0)
                : Number(inv.totalAmount) || 0;
        const sttList =
            linkedTxs.map((t) => String(t.noSTT || '').replace(/^STT/i, '')).filter(Boolean).join(', ') || '-';

        matched.push({
            id: invDoc.id,
            invoiceNumber: invNo,
            clientName: identity.clientName || 'TANPA NAMA',
            clientAddress: identity.clientAddress || '',
            issueDate,
            issueIso,
            dueDate,
            dueIso,
            overdueDays,
            sttList,
            totalAmount,
            isTaxable,
            voyageLabel,
        });
    }

    if (matched.length === 0) {
        throw new Error('Tidak ditemukan data invoice tagihan piutang belum lunas sesuai filter tersebut.');
    }

    matched.sort((a, b) => {
        const diff = a.issueDate.getTime() - b.issueDate.getTime();
        if (diff !== 0) return diff;
        return a.invoiceNumber.localeCompare(b.invoiceNumber);
    });

    const uniqueClients = Array.from(new Set(matched.map((m) => m.clientName.toUpperCase())));
    const isSingleClient = uniqueClients.length === 1;
    const totalPiutang = matched.reduce((s, m) => s + m.totalAmount, 0);
    const overdueCount = matched.filter((m) => m.overdueDays > 0).length;

    const { pdfDoc, fonts } = await createBasePdfDocument();
    const logo = await embedPublicImage(pdfDoc, 'logo.png');
    const ttd = await embedPublicImage(pdfDoc, 'ttd.png');

    const marginX = 32;
    let page = pdfDoc.addPage(A4_PORTRAIT);
    const { width } = page.getSize();
    const usableW = width - marginX * 2;

    const filterLabel = reqClientQ
        ? `Client: ${matched[0].clientName}`
        : reqMonth
          ? `Periode: ${reqMonth}`
          : reqStart || reqEnd
            ? `Periode: ${reqStart || '...'} s/d ${reqEnd || '...'}`
            : onlyOverdue
              ? 'Filter: Jatuh Tempo'
              : 'Rekapitulasi Piutang Belum Lunas';

    if (isSingleClient) {
        const clientTitle = matched[0].clientName.toUpperCase();
        const clientAddress = matched.find((m) => m.clientAddress)?.clientAddress || '';
        let cursorY = drawCompanyHeader(page, fonts, logo, {
            marginX,
            title: 'REKAPITULASI TAGIHAN PELANGGAN',
            subtitle: `Tgl Cetak: ${fmtDateLongId(new Date())}`,
            rightBadge: 'PIUTANG CLIENT',
        });

        // Kepada Yth & Meta Info Box
        const infoBoxH = clientAddress ? 50 : 38;
        page.drawRectangle({
            x: marginX,
            y: cursorY - infoBoxH,
            width: usableW,
            height: infoBoxH,
            color: COLOR_ROW_ALT,
            borderColor: COLOR_BORDER,
            borderWidth: 0.7,
        });
        drawSafeText(page, 'Kepada Yth,', {
            x: marginX + 10,
            y: cursorY - 13,
            font: fonts.regular,
            size: 8.5,
            color: COLOR_MUTED,
        });
        drawSafeText(page, clientTitle, {
            x: marginX + 10,
            y: cursorY - 26,
            font: fonts.bold,
            size: 11,
            color: COLOR_DARK,
        });
        if (clientAddress) {
            drawSafeText(page, clientAddress, {
                x: marginX + 10,
                y: cursorY - 39,
                font: fonts.regular,
                size: 8.5,
                color: COLOR_TEXT,
            });
        }

        drawSafeText(page, `Jumlah Invoice : ${matched.length} Dokumen`, {
            x: width - marginX - 185,
            y: cursorY - 15,
            font: fonts.bold,
            size: 8.5,
            color: COLOR_DARK,
        });
        drawSafeText(page, `Jatuh Tempo    : ${overdueCount} Invoice`, {
            x: width - marginX - 185,
            y: cursorY - 28,
            font: fonts.bold,
            size: 8.5,
            color: overdueCount > 0 ? COLOR_RED : COLOR_GREEN,
        });
        drawSafeText(page, `Total Tagihan  : ${fmtRp(totalPiutang)}`, {
            x: width - marginX - 185,
            y: cursorY - 41,
            font: fonts.bold,
            size: 9,
            color: COLOR_BLUE,
        });

        cursorY -= infoBoxH + 12;

        const columns: TableColumn[] = [
            { header: 'NO', width: 26, align: 'center' },
            { header: 'NO. INVOICE', width: 86, align: 'center', mono: true },
            { header: 'TGL INVOICE', width: 70, align: 'center' },
            { header: 'JATUH TEMPO', width: 74, align: 'center' },
            { header: 'NOMOR STT (RESI)', width: usableW - (26 + 86 + 70 + 74 + 98), align: 'left' },
            { header: 'TOTAL TAGIHAN', width: 98, align: 'right', bold: true },
        ];

        const tableRows: TableRowInput[] = matched.map((m, i) => ({
            cells: [
                String(i + 1),
                m.invoiceNumber,
                fmtDateShortId(m.issueDate),
                {
                    text: m.overdueDays > 0 ? `${fmtDateShortId(m.dueDate)} (+${m.overdueDays} hr)` : fmtDateShortId(m.dueDate),
                    color: m.overdueDays > 0 ? COLOR_RED : COLOR_TEXT,
                    bold: m.overdueDays > 0,
                },
                m.sttList,
                { text: fmtRp(m.totalAmount), bold: true, align: 'right' },
            ],
        }));

        tableRows.push({
            isFooter: true,
            cells: [
                '',
                '',
                '',
                '',
                { text: 'GRAND TOTAL TAGIHAN :', bold: true, align: 'right' },
                { text: fmtRp(totalPiutang), bold: true, align: 'right', color: COLOR_BLUE },
            ],
        });

        const tblRes = drawPaginatedTable(pdfDoc, page, cursorY, fonts, logo, {
            pageSize: A4_PORTRAIT,
            marginX,
            continuationTitle: `REKAPITULASI TAGIHAN - ${clientTitle}`,
            continuationSubtitle: fmtDateLongId(new Date()),
            columns,
            rows: tableRows,
            fontSize: 8,
            headerFontSize: 8,
        });
        page = tblRes.page;
        cursorY = tblRes.cursorY - 10;

        // Terbilang Box
        const terbilangStr = `Terbilang : # ${terbilang(totalPiutang)} #`;
        const terbLines = wrapTextToLines(terbilangStr, fonts.italic, 8.5, usableW - 16);
        const terbH = 12 + terbLines.length * 11;
        if (cursorY - terbH - 110 < 40) {
            page = pdfDoc.addPage(A4_PORTRAIT);
            cursorY = drawCompanyHeader(page, fonts, logo, {
                marginX,
                title: `REKAPITULASI TAGIHAN - ${clientTitle}`,
                compact: true,
            });
        }
        page.drawRectangle({
            x: marginX,
            y: cursorY - terbH,
            width: usableW,
            height: terbH,
            color: COLOR_ROW_ALT,
            borderColor: COLOR_BORDER,
            borderWidth: 0.7,
        });
        terbLines.forEach((line, li) => {
            drawSafeText(page, line, {
                x: marginX + 8,
                y: cursorY - 13 - li * 11,
                font: fonts.italic,
                size: 8.5,
                color: COLOR_TEXT,
            });
        });
        cursorY -= terbH + 16;

        // Payment instructions + Signature
        const hasTaxable = matched.some((m) => m.isTaxable);
        const hasNonTaxable = matched.some((m) => !m.isTaxable);
        drawSafeText(page, 'PEMBAYARAN DITRANSFER KE :', {
            x: marginX,
            y: cursorY,
            font: fonts.bold,
            size: 8.5,
            color: COLOR_DARK,
        });
        let bankY = cursorY - 13;
        if (hasNonTaxable) {
            for (const acc of COMPANY_INFO.bankAccounts) {
                drawSafeText(page, `- ${acc.bank} ${acc.accountNumber} a/n ${acc.accountName}`, {
                    x: marginX,
                    y: bankY,
                    font: fonts.bold,
                    size: 8.5,
                    color: COLOR_TEXT,
                });
                bankY -= 12;
            }
        }
        if (hasTaxable) {
            drawSafeText(page, '- BCA 187 1414 187 a/n CAHAYA CARGO EXPRESS CV (Rekening PKP / PPN)', {
                x: marginX,
                y: bankY,
                font: fonts.bold,
                size: 8.5,
                color: COLOR_BLUE,
            });
            bankY -= 12;
        }
        drawSafeText(page, '* Mohon cantumkan nama perusahaan / nomor invoice saat melakukan transfer.', {
            x: marginX,
            y: bankY - 2,
            font: fonts.italic,
            size: 7.5,
            color: COLOR_MUTED,
        });

        const signCenterX = width - marginX - 75;
        drawSafeText(page, 'Hormat Kami,', {
            x: signCenterX - 24,
            y: cursorY,
            font: fonts.regular,
            size: 8.5,
            color: COLOR_TEXT,
        });
        if (ttd) {
            const td = ttd.scale(1);
            const scale = Math.min(92 / td.width, 78 / td.height);
            page.drawImage(ttd, {
                x: signCenterX - (td.width * scale) / 2,
                y: cursorY - 78,
                width: td.width * scale,
                height: td.height * scale,
            });
        }
        drawSafeText(page, COMPANY_INFO.signatureName, {
            x: signCenterX - safeWidth(fonts.bold, COMPANY_INFO.signatureName, 8.5) / 2,
            y: cursorY - 88,
            font: fonts.bold,
            size: 8.5,
            color: COLOR_DARK,
        });
    } else {
        // Multi-client receivables report
        let cursorY = drawCompanyHeader(page, fonts, logo, {
            marginX,
            title: 'LAPORAN REKAPITULASI PIUTANG CLIENT',
            subtitle: filterLabel,
            rightBadge: 'BELUM LUNAS',
        });

        cursorY = drawKpiCards(page, fonts, marginX, cursorY, [
            {
                label: 'Total Piutang Belum Lunas',
                value: fmtRp(totalPiutang),
                sub: 'Tagihan berjalan belum lunas',
                fgColor: COLOR_RED,
                bgColor: COLOR_RED_BG,
            },
            {
                label: 'Jumlah Invoice Unpaid',
                value: `${matched.length} Dokumen`,
                sub: 'Invoice aktif belum terbayar',
                fgColor: COLOR_BLUE,
                bgColor: COLOR_BLUE_BG,
            },
            {
                label: 'Jatuh Tempo (Overdue)',
                value: `${overdueCount} Invoice`,
                sub: overdueCount > 0 ? 'Perlu prioritas penagihan' : 'Belum ada yang lewat tempo',
                fgColor: COLOR_AMBER,
                bgColor: COLOR_AMBER_BG,
            },
            {
                label: 'Total Client Tertagih',
                value: `${uniqueClients.length} Client`,
                sub: 'Akumulasi per pelanggan',
                fgColor: COLOR_GREEN,
                bgColor: COLOR_GREEN_BG,
            },
        ]);

        // Aggregate per client
        const byClientMap = new Map<
            string,
            { clientName: string; count: number; overdueCount: number; total: number }
        >();
        for (const m of matched) {
            const key = m.clientName.toUpperCase();
            const cur = byClientMap.get(key) || {
                clientName: m.clientName,
                count: 0,
                overdueCount: 0,
                total: 0,
            };
            cur.count += 1;
            if (m.overdueDays > 0) cur.overdueCount += 1;
            cur.total += m.totalAmount;
            byClientMap.set(key, cur);
        }
        const clientSummary = Array.from(byClientMap.values()).sort((a, b) => b.total - a.total);

        const summaryCols: TableColumn[] = [
            { header: 'NO', width: 28, align: 'center' },
            { header: 'NAMA CLIENT / TERTAGIH', width: usableW - (28 + 75 + 80 + 115), align: 'left', bold: true },
            { header: 'JML INV', width: 75, align: 'center' },
            { header: 'OVERDUE', width: 80, align: 'center' },
            { header: 'TOTAL PIUTANG', width: 115, align: 'right', bold: true },
        ];
        const summaryRows: TableRowInput[] = clientSummary.map((c, idx) => ({
            cells: [
                String(idx + 1),
                c.clientName.toUpperCase(),
                `${c.count} Inv`,
                {
                    text: c.overdueCount > 0 ? `${c.overdueCount} Inv` : '-',
                    color: c.overdueCount > 0 ? COLOR_RED : COLOR_MUTED,
                    bold: c.overdueCount > 0,
                },
                { text: fmtRp(c.total), bold: true, align: 'right' },
            ],
        }));
        summaryRows.push({
            isFooter: true,
            cells: [
                '',
                { text: `TOTAL KESELURUHAN (${clientSummary.length} CLIENT)`, bold: true, align: 'right' },
                `${matched.length} Inv`,
                `${overdueCount} Inv`,
                { text: fmtRp(totalPiutang), bold: true, align: 'right', color: COLOR_RED },
            ],
        });

        const sec1 = drawPaginatedTable(pdfDoc, page, cursorY, fonts, logo, {
            pageSize: A4_PORTRAIT,
            marginX,
            continuationTitle: 'REKAPITULASI PIUTANG CLIENT',
            continuationSubtitle: filterLabel,
            sectionTitle: '1. RINGKASAN PIUTANG PER CLIENT',
            columns: summaryCols,
            rows: summaryRows,
            fontSize: 7.5,
            headerFontSize: 7.5,
        });
        page = sec1.page;
        cursorY = sec1.cursorY - 16;

        // Section 2: Detailed unpaid invoice list with checklist box
        const detailCols: TableColumn[] = [
            { header: 'CEK', width: 24, align: 'center' },
            { header: 'NO', width: 22, align: 'center' },
            { header: 'NO. INVOICE', width: 74, align: 'center', mono: true },
            { header: 'JATUH TEMPO', width: 72, align: 'center' },
            { header: 'CLIENT / TERTAGIH', width: 125, align: 'left', bold: true },
            { header: 'NOMOR STT', width: usableW - (24 + 22 + 74 + 72 + 125 + 88), align: 'left' },
            { header: 'TAGIHAN', width: 88, align: 'right', bold: true },
        ];

        const detailRows: TableRowInput[] = matched.map((m, idx) => ({
            cells: [
                { text: '', drawCheckbox: true },
                String(idx + 1),
                m.invoiceNumber,
                {
                    text:
                        m.overdueDays > 0
                            ? `${fmtDateShortId(m.dueDate)} (+${m.overdueDays} hr)`
                            : fmtDateShortId(m.dueDate),
                    color: m.overdueDays > 0 ? COLOR_RED : COLOR_TEXT,
                    bold: m.overdueDays > 0,
                },
                m.clientName.toUpperCase(),
                m.sttList,
                { text: fmtRp(m.totalAmount), bold: true, align: 'right' },
            ],
        }));
        detailRows.push({
            isFooter: true,
            cells: [
                '',
                '',
                '',
                '',
                '',
                { text: 'GRAND TOTAL SISA PIUTANG UNPAID :', bold: true, align: 'right' },
                { text: fmtRp(totalPiutang), bold: true, align: 'right', color: COLOR_RED },
            ],
        });

        const sec2 = drawPaginatedTable(pdfDoc, page, cursorY, fonts, logo, {
            pageSize: A4_PORTRAIT,
            marginX,
            continuationTitle: 'DAFTAR RINCIAN INVOICE PIUTANG BELUM LUNAS',
            continuationSubtitle: filterLabel,
            sectionTitle: '2. DAFTAR RINCIAN INVOICE BELUM LUNAS',
            columns: detailCols,
            rows: detailRows,
            fontSize: 7.2,
            headerFontSize: 7.2,
            padH: 3,
            padV: 3.5,
        });
        page = sec2.page;
        cursorY = sec2.cursorY - 10;

        const terbStr = `Terbilang Total Piutang : # ${terbilang(totalPiutang)} #`;
        const terbLines = wrapTextToLines(terbStr, fonts.italic, 8, usableW - 14);
        const terbH = 10 + terbLines.length * 10;
        if (cursorY - terbH < 36) {
            page = pdfDoc.addPage(A4_PORTRAIT);
            cursorY = drawCompanyHeader(page, fonts, logo, {
                marginX,
                title: 'LAPORAN REKAPITULASI PIUTANG CLIENT',
                compact: true,
            });
        }
        page.drawRectangle({
            x: marginX,
            y: cursorY - terbH,
            width: usableW,
            height: terbH,
            color: COLOR_ROW_ALT,
            borderColor: COLOR_BORDER,
            borderWidth: 0.6,
        });
        terbLines.forEach((line, li) => {
            drawSafeText(page, line, {
                x: marginX + 7,
                y: cursorY - 11 - li * 10,
                font: fonts.italic,
                size: 8,
            });
        });
    }

    finalizeFooters(pdfDoc, fonts, marginX);
    const bytes = await pdfDoc.save();
    const todayIso = toWibDateIso(new Date());
    const nameToken = isSingleClient ? safeFilenameToken(matched[0].clientName, 'Client') : 'SemuaClient';

    return {
        base64: Buffer.from(bytes).toString('base64'),
        mimeType: 'application/pdf',
        filename: `Rekap-Piutang-${nameToken}-${todayIso}.pdf`,
        summary: {
            mode: isSingleClient ? 'single_client' : 'multi_client',
            clientCount: uniqueClients.length,
            invoiceCount: matched.length,
            overdueCount,
            totalPiutang,
            clients: uniqueClients.slice(0, 15),
        },
    };
}

// =====================================================================
// 2. LAPORAN PDF MANIFEST KAPAL
// =====================================================================

export async function generateShipManifestPdf(args: ShipManifestPdfArgs = {}): Promise<GeneratedPdfReport> {
    const reqSource = args.source || 'auto';
    const reqVoyageId = (args.voyageId || '').trim();
    const reqVoyageNo = (args.voyageNumber || '').trim().toLowerCase();
    const reqVoyageDigits = reqVoyageNo.replace(/\D/g, '');
    const reqManifestId = (args.manifestId || '').trim();
    const reqShip = (args.shipName || '').trim().toLowerCase();
    const reqDepDate = (args.departureDate || '').trim();
    const reqNopol = (args.nopolOrDriver || '').trim().toLowerCase();

    const [voyagesSnap, manifestsSnap, txSnap] = await Promise.all([
        adminDb.collection('voyages').get(),
        adminDb.collection('cargo_manifests').get(),
        adminDb.collection('transactions').get(),
    ]);

    const txById = new Map<string, { id: string; data: Record<string, any> }>();
    const txByNoStt = new Map<string, { id: string; data: Record<string, any> }>();
    for (const d of txSnap.docs) {
        const data = d.data() || {};
        txById.set(d.id, { id: d.id, data });
        const rawNo = String(data.noSTT || '').trim().toUpperCase();
        if (rawNo) txByNoStt.set(rawNo, { id: d.id, data });
        const digits = rawNo.replace(/\D/g, '');
        if (digits) txByNoStt.set(digits, { id: d.id, data });
    }

    interface ManifestCargoRow {
        noSTT: string;
        pengirim: string;
        pengirimPhone: string;
        penerima: string;
        tujuan: string;
        koli: number;
        berat: number;
        beratUnit: string;
        isiBarang: string;
        alamat: string;
        penerimaPhone: string;
        keterangan: string;
    }

    let docMeta: {
        sourceType: 'voyage' | 'cargo_manifest';
        titleLabel: string;
        shipName: string;
        voyageNumber: string;
        route: string;
        departureDateStr: string;
        departureIso: string;
        vehicles: string;
        driver: string;
        kepadaYth: string;
        statusLabel: string;
    } | null = null;
    const rows: ManifestCargoRow[] = [];

    const hasAnyFilter = Boolean(reqVoyageId || reqVoyageNo || reqManifestId || reqShip || reqDepDate || reqNopol);

    if (reqSource !== 'cargo_manifest' && !reqManifestId) {
        const voyages = voyagesSnap.docs
            .map((d) => {
                const data = d.data() || {};
                const depDate = toDateSafe(data.departureDate);
                return {
                    id: d.id,
                    data,
                    depDate,
                    depIso: toWibDateIso(depDate),
                };
            })
            .filter((v) => String(v.data.status || '').toLowerCase() !== 'cancelled')
            .sort((a, b) => b.depDate.getTime() - a.depDate.getTime());

        const matchedVoyages = voyages.filter((v) => {
            if (reqVoyageId && v.id !== reqVoyageId) return false;
            if (reqVoyageNo) {
                const vn = String(v.data.voyageNumber || '').trim().toLowerCase();
                const vnDigits = vn.replace(/\D/g, '');
                if (!vn.includes(reqVoyageNo) && !(reqVoyageDigits && vnDigits === reqVoyageDigits)) return false;
            }
            if (reqShip) {
                const hay = `${v.data.shipName || ''} ${v.data.route || ''}`.toLowerCase();
                if (!hay.includes(reqShip)) return false;
            }
            if (reqDepDate && v.depIso !== reqDepDate) return false;
            if (reqNopol) {
                const vehicles = Array.isArray(v.data.vehicleNumbers)
                    ? v.data.vehicleNumbers.join(' ')
                    : String(v.data.vehicleNumber || '');
                if (!vehicles.toLowerCase().includes(reqNopol)) return false;
            }
            return true;
        });

        const chosen = hasAnyFilter
            ? matchedVoyages[0]
            : matchedVoyages.find((v) => Array.isArray(v.data.transactionIds) && v.data.transactionIds.length > 0) ||
              matchedVoyages[0];

        if (chosen) {
            const vData = chosen.data;
            const vehicleArr: string[] = Array.isArray(vData.vehicleNumbers)
                ? vData.vehicleNumbers.filter(Boolean).map(String)
                : vData.vehicleNumber
                  ? [String(vData.vehicleNumber)]
                  : [];
            const vStatus = String(vData.status || 'planned');
            const statusText =
                vStatus === 'in-progress'
                    ? 'Dalam Perjalanan'
                    : vStatus === 'completed'
                      ? 'Selesai'
                      : 'Direncanakan';

            docMeta = {
                sourceType: 'voyage',
                titleLabel: String(vData.voyageNumber || chosen.id),
                shipName: String(vData.shipName || '-'),
                voyageNumber: String(vData.voyageNumber || '-'),
                route: String(vData.route || '-'),
                departureDateStr: fmtDateLongId(chosen.depDate),
                departureIso: chosen.depIso,
                vehicles: vehicleArr.length > 0 ? vehicleArr.join(', ') : '-',
                driver: '',
                kepadaYth: 'CAHAYA CARGO EXP',
                statusLabel: statusText,
            };

            const tids: unknown[] = Array.isArray(vData.transactionIds) ? vData.transactionIds : [];
            for (const tid of tids) {
                if (typeof tid !== 'string' || !tid) continue;
                const found = txById.get(tid);
                if (!found || found.data.status === 'dibatalkan') continue;
                const t = found.data;
                const addrParts = [String(t.penerimaAddress || '').trim()];
                const city = String(t.penerimaCity || '').trim();
                if (city && city.toLowerCase() !== String(t.tujuan || '').trim().toLowerCase()) {
                    addrParts.push(city);
                }
                rows.push({
                    noSTT: String(t.noSTT || '').replace(/^STT0*/i, '') || String(t.noSTT || ''),
                    pengirim: String(t.pengirimName || '-'),
                    pengirimPhone: String(t.pengirimPhone || ''),
                    penerima: String(t.penerimaName || '-'),
                    tujuan: String(t.tujuan || '-'),
                    koli: Number(t.koli) || 0,
                    berat: Number(t.berat) || 0,
                    beratUnit: String(t.beratUnit || 'KG'),
                    isiBarang: String(t.isiBarang || '-'),
                    alamat: addrParts.filter(Boolean).join(', '),
                    penerimaPhone: String(t.penerimaPhone || ''),
                    keterangan: String(t.keterangan || ''),
                });
            }
        }
    }

    if (!docMeta && reqSource !== 'voyage') {
        const manifests = manifestsSnap.docs
            .map((d) => {
                const data = d.data() || {};
                return {
                    id: d.id,
                    data,
                    createdAt: toDateSafe(data.createdAt),
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const matchedManifests = manifests.filter((m) => {
            if (reqManifestId && m.id !== reqManifestId) return false;
            if (reqShip && !String(m.data.kapal || '').toLowerCase().includes(reqShip)) return false;
            if (reqDepDate) {
                const tglStr = String(m.data.tanggal || '');
                if (!tglStr.includes(reqDepDate)) return false;
            }
            if (reqNopol) {
                const hay = `${m.data.nopol || ''} ${m.data.sopir || ''}`.toLowerCase();
                if (!hay.includes(reqNopol)) return false;
            }
            return true;
        });

        const chosen = matchedManifests[0];
        if (chosen) {
            const md = chosen.data;
            docMeta = {
                sourceType: 'cargo_manifest',
                titleLabel: String(md.kapal || chosen.id),
                shipName: String(md.kapal || '-'),
                voyageNumber: 'MANIFEST MANUAL',
                route: String(md.kepadaYth || 'CAHAYA CARGO EXP MKS'),
                departureDateStr: String(md.tanggal || fmtDateLongId(chosen.createdAt)),
                departureIso: toWibDateIso(chosen.createdAt),
                vehicles: String(md.nopol || '-'),
                driver: String(md.sopir || ''),
                kepadaYth: String(md.kepadaYth || 'CAHAYA CARGO EXP MKS'),
                statusLabel: 'Cargo Manifest',
            };

            const items: any[] = Array.isArray(md.items) ? md.items : [];
            for (const it of items) {
                const txId = String(it?.transactionId || '').trim();
                const rawStt = String(it?.noSTT || '').trim();
                const sttDigits = rawStt.replace(/\D/g, '');
                const liveTx =
                    (txId ? txById.get(txId) : undefined) ||
                    (rawStt ? txByNoStt.get(rawStt.toUpperCase()) : undefined) ||
                    (sttDigits ? txByNoStt.get(sttDigits) : undefined);

                if (liveTx && liveTx.data.status === 'dibatalkan') continue;
                const t = liveTx?.data;
                rows.push({
                    noSTT: (t ? String(t.noSTT || rawStt) : rawStt).replace(/^STT0*/i, '') || rawStt || '-',
                    pengirim: String(t?.pengirimName || it?.pengirim || '-'),
                    pengirimPhone: String(t?.pengirimPhone || ''),
                    penerima: String(t?.penerimaName || it?.penerima || '-'),
                    tujuan: String(t?.tujuan || '-'),
                    koli: Number(t?.koli ?? it?.koli) || 0,
                    berat: parseFloat(String(t?.berat ?? it?.berat ?? '0').replace(',', '.')) || 0,
                    beratUnit: String(t?.beratUnit || 'KG'),
                    isiBarang: String(t?.isiBarang || it?.isiBarang || '-'),
                    alamat: String(t?.penerimaAddress || it?.alamat || ''),
                    penerimaPhone: String(t?.penerimaPhone || ''),
                    keterangan: String(t?.keterangan || it?.keterangan || ''),
                });
            }
        }
    }

    if (!docMeta) {
        throw new Error('Data pemberangkatan atau manifest kapal tidak ditemukan sesuai filter tersebut.');
    }

    rows.sort((a, b) => a.noSTT.localeCompare(b.noSTT, 'id', { numeric: true, sensitivity: 'base' }));

    const totalKoli = rows.reduce((s, r) => s + r.koli, 0);
    const totalBerat = rows.reduce((s, r) => s + r.berat, 0);

    const { pdfDoc, fonts } = await createBasePdfDocument();
    const logo = await embedPublicImage(pdfDoc, 'logo.png');

    const marginX = 26;
    let page = pdfDoc.addPage(A4_LANDSCAPE);
    const { width } = page.getSize();
    const usableW = width - marginX * 2;

    let cursorY = drawCompanyHeader(page, fonts, logo, {
        marginX,
        title: 'MANIFEST MUATAN KAPAL',
        subtitle: `${docMeta.shipName} (${docMeta.voyageNumber})`,
        rightBadge: docMeta.statusLabel,
    });

    // Metadata box (2 columns)
    const metaH = 44;
    page.drawRectangle({
        x: marginX,
        y: cursorY - metaH,
        width: usableW,
        height: metaH,
        color: COLOR_ROW_ALT,
        borderColor: COLOR_BORDER,
        borderWidth: 0.7,
    });
    const col2X = marginX + usableW * 0.52;
    drawSafeText(page, `Nama Kapal     : ${docMeta.shipName}`, {
        x: marginX + 8,
        y: cursorY - 13,
        font: fonts.bold,
        size: 8.5,
        color: COLOR_DARK,
    });
    drawSafeText(page, `No. Voyage     : ${docMeta.voyageNumber}`, {
        x: marginX + 8,
        y: cursorY - 25,
        font: fonts.regular,
        size: 8.5,
        color: COLOR_TEXT,
    });
    drawSafeText(
        page,
        `Armada / Nopol : ${docMeta.vehicles}${docMeta.driver ? ` (Sopir: ${docMeta.driver})` : ''}`,
        {
            x: marginX + 8,
            y: cursorY - 37,
            font: fonts.regular,
            size: 8.5,
            color: COLOR_TEXT,
        }
    );

    drawSafeText(page, `Rute / Tujuan  : ${docMeta.route}`, {
        x: col2X,
        y: cursorY - 13,
        font: fonts.bold,
        size: 8.5,
        color: COLOR_BLUE,
    });
    drawSafeText(page, `Tgl. Berangkat : ${docMeta.departureDateStr}`, {
        x: col2X,
        y: cursorY - 25,
        font: fonts.regular,
        size: 8.5,
        color: COLOR_TEXT,
    });
    drawSafeText(
        page,
        `Ringkasan      : ${rows.length} Resi | ${fmtNum(totalKoli)} Koli | ${totalBerat.toLocaleString('id-ID')} Kg`,
        {
            x: col2X,
            y: cursorY - 37,
            font: fonts.bold,
            size: 8.5,
            color: COLOR_DARK,
        }
    );

    cursorY -= metaH + 10;

    // 10-column landscape table summing exactly to usableW (~789.89pt)
    const fixedCols = 24 + 54 + 106 + 96 + 68 + 36 + 52 + 95 + 62;
    const addrColW = usableW - fixedCols;
    const columns: TableColumn[] = [
        { header: 'NO', width: 24, align: 'center' },
        { header: 'NO. STT', width: 54, align: 'center', mono: true },
        { header: 'PENGIRIM', width: 106, align: 'left', bold: true },
        { header: 'PENERIMA', width: 96, align: 'left', bold: true },
        { header: 'TUJUAN', width: 68, align: 'left' },
        { header: 'KOLI', width: 36, align: 'center', bold: true },
        { header: 'BERAT', width: 52, align: 'right', bold: true },
        { header: 'ISI BARANG', width: 95, align: 'left' },
        { header: 'ALAMAT & TELP', width: addrColW, align: 'left' },
        { header: 'KET.', width: 62, align: 'center' },
    ];

    const tableRows: TableRowInput[] =
        rows.length > 0
            ? rows.map((r, idx) => {
                  const senderFull = r.pengirimPhone ? `${r.pengirim} (Telp: ${r.pengirimPhone})` : r.pengirim;
                  const addrFull = [r.alamat, r.penerimaPhone ? `Telp: ${r.penerimaPhone}` : '']
                      .filter(Boolean)
                      .join(' | ');
                  return {
                      cells: [
                          String(idx + 1),
                          r.noSTT,
                          senderFull,
                          r.penerima,
                          r.tujuan,
                          fmtNum(r.koli),
                          `${r.berat.toLocaleString('id-ID')} ${r.beratUnit === 'M3' ? 'M3' : 'Kg'}`,
                          r.isiBarang,
                          addrFull || '-',
                          r.keterangan || '-',
                      ],
                  };
              })
            : [
                  {
                      cells: ['-', '-', 'Belum ada muatan STT di manifest ini', '', '', '0', '0', '', '', ''],
                  },
              ];

    tableRows.push({
        isFooter: true,
        cells: [
            '',
            '',
            '',
            '',
            { text: 'TOTAL MUATAN :', bold: true, align: 'right' },
            { text: fmtNum(totalKoli), bold: true, align: 'center' },
            { text: `${totalBerat.toLocaleString('id-ID')} Kg`, bold: true, align: 'right' },
            `${rows.length} STT`,
            '',
            '',
        ],
    });

    const tblRes = drawPaginatedTable(pdfDoc, page, cursorY, fonts, logo, {
        pageSize: A4_LANDSCAPE,
        marginX,
        bottomMargin: 42,
        continuationTitle: `MANIFEST MUATAN KAPAL - ${docMeta.shipName}`,
        continuationSubtitle: `${docMeta.voyageNumber} | ${docMeta.departureDateStr}`,
        columns,
        rows: tableRows,
        fontSize: 7.2,
        headerFontSize: 7.2,
        padH: 3.5,
        padV: 3.5,
    });
    page = tblRes.page;
    cursorY = tblRes.cursorY - 16;

    // 4-column signatures
    if (cursorY - 62 < 34) {
        page = pdfDoc.addPage(A4_LANDSCAPE);
        cursorY = drawCompanyHeader(page, fonts, logo, {
            marginX,
            title: `MANIFEST MUATAN KAPAL - ${docMeta.shipName}`,
            compact: true,
        });
    }
    const sigLabels = ['Pengurus Barang', 'Kepala Gudang', 'Supir / Nahkoda', 'Mengetahui'];
    const sigColW = usableW / 4;
    sigLabels.forEach((lbl, idx) => {
        const cx = marginX + idx * sigColW + sigColW / 2;
        const lw = safeWidth(fonts.bold, lbl, 8);
        drawSafeText(page, lbl, {
            x: cx - lw / 2,
            y: cursorY,
            font: fonts.bold,
            size: 8,
            color: COLOR_DARK,
        });
        page.drawLine({
            start: { x: cx - 55, y: cursorY - 40 },
            end: { x: cx + 55, y: cursorY - 40 },
            thickness: 0.8,
            color: COLOR_DARK,
        });
        const holder = '( .............................. )';
        const hw = safeWidth(fonts.regular, holder, 7.5);
        drawSafeText(page, holder, {
            x: cx - hw / 2,
            y: cursorY - 50,
            font: fonts.regular,
            size: 7.5,
            color: COLOR_MUTED,
        });
    });

    finalizeFooters(pdfDoc, fonts, marginX);
    const bytes = await pdfDoc.save();
    const shipToken = safeFilenameToken(docMeta.shipName !== '-' ? docMeta.shipName : docMeta.voyageNumber, 'Kapal');

    return {
        base64: Buffer.from(bytes).toString('base64'),
        mimeType: 'application/pdf',
        filename: `Manifest-Kapal-${shipToken}-${docMeta.departureIso}.pdf`,
        summary: {
            sourceType: docMeta.sourceType,
            voyageNumber: docMeta.voyageNumber,
            shipName: docMeta.shipName,
            route: docMeta.route,
            departureDate: docMeta.departureDateStr,
            sttCount: rows.length,
            totalKoli,
            totalBerat,
        },
    };
}

// =====================================================================
// 3. LAPORAN PDF OMZET & LABA BIAYA KAPAL DARI PEMBERANGKATAN
// =====================================================================

export async function generateVoyageProfitLossPdf(
    args: VoyageProfitLossPdfArgs = {}
): Promise<GeneratedPdfReport> {
    const q = (args.searchQuery || args.voyageNumber || args.shipName || '').trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const reqVoyageId = (args.voyageId || '').trim();
    const reqDepDate = (args.departureDate || '').trim();
    const reqMonth = (args.month || '').trim();
    const hasExplicitFilter = Boolean(
        reqVoyageId || q || reqDepDate || reqMonth || args.startDate || args.endDate || args.period
    );
    const effectivePeriod = args.period || (!hasExplicitFilter ? 'this_month' : '');
    const periodRange = resolveWibPeriodRange(effectivePeriod);
    const startIso = (args.startDate || '').trim() || periodRange.startIso || '';
    const endIso = (args.endDate || '').trim() || periodRange.endIso || '';

    const [voyagesSnap, shipExpSnap, expensesSnap, invoicesSnap] = await Promise.all([
        adminDb.collection('voyages').get(),
        adminDb.collection('owner_ship_expenses').get(),
        adminDb.collection('expenses').get(),
        adminDb.collection('invoices').get(),
    ]);

    const shipExpMap = new Map<string, Record<string, any>>();
    for (const d of shipExpSnap.docs) {
        const data = d.data() || {};
        shipExpMap.set(String(data.voyageId || d.id), data);
    }

    const expensesByVoyageMap = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
    for (const d of expensesSnap.docs) {
        const data = d.data() || {};
        if (data.status === 'rejected') continue;
        const vId = String(data.voyageId || '').trim();
        if (!vId) continue;
        const list = expensesByVoyageMap.get(vId) || [];
        list.push({ id: d.id, data });
        expensesByVoyageMap.set(vId, list);
    }

    const activeInvoices = invoicesSnap.docs
        .map((d) => ({ id: d.id, data: d.data() || {} }))
        .filter((inv) => String(inv.data.status || '') !== 'Cancelled')
        .sort((a, b) => {
            if (a.data.status === 'Paid' && b.data.status !== 'Paid') return -1;
            if (b.data.status === 'Paid' && a.data.status !== 'Paid') return 1;
            return toDateSafe(b.data.issueDate).getTime() - toDateSafe(a.data.issueDate).getTime();
        });

    const invByTxId = new Map<string, { id: string; data: Record<string, any> }>();
    const invById = new Map<string, { id: string; data: Record<string, any> }>();
    const invByNo = new Map<string, { id: string; data: Record<string, any> }>();
    for (const inv of activeInvoices) {
        invById.set(inv.id, inv);
        const invNoKey = String(inv.data.invoiceNumber || '').trim().toLowerCase();
        if (invNoKey && !invByNo.has(invNoKey)) invByNo.set(invNoKey, inv);
        const tids: unknown[] = Array.isArray(inv.data.transactionIds) ? inv.data.transactionIds : [];
        for (const tid of tids) {
            if (typeof tid === 'string' && tid && !invByTxId.has(tid)) {
                invByTxId.set(tid, inv);
            }
        }
    }

    const allNonCancelled = voyagesSnap.docs
        .map((doc) => {
            const data = doc.data() || {};
            const depDate = toDateSafe(data.departureDate);
            return {
                id: doc.id,
                data,
                depDate,
                depIso: toWibDateIso(depDate),
            };
        })
        .filter((v) => String(v.data.status || '').toLowerCase() !== 'cancelled');

    let matchedVoyages = allNonCancelled.filter((v) => {
        if (reqVoyageId && v.id !== reqVoyageId) return false;
        if (reqDepDate && v.depIso !== reqDepDate) return false;
        if (reqMonth && !v.depIso.startsWith(reqMonth)) return false;
        if (startIso && v.depIso < startIso) return false;
        if (endIso && v.depIso > endIso) return false;

        if (q) {
            const vNo = String(v.data.voyageNumber || '').toLowerCase();
            const vDigits = vNo.replace(/\D/g, '');
            const vehiclesArr: string[] = Array.isArray(v.data.vehicleNumbers)
                ? v.data.vehicleNumbers.map(String)
                : v.data.vehicleNumber
                  ? [String(v.data.vehicleNumber)]
                  : [];
            const hit =
                vNo.includes(q) ||
                Boolean(qDigits && vDigits === qDigits) ||
                String(v.data.shipName || '').toLowerCase().includes(q) ||
                String(v.data.route || '').toLowerCase().includes(q) ||
                String(v.data.notes || '').toLowerCase().includes(q) ||
                vehiclesArr.some((vn) => vn.toLowerCase().includes(q));
            if (!hit) return false;
        }
        return true;
    });

    // If default this_month yielded 0 voyages, fall back gracefully to latest 10 voyages
    let periodDisplayLabel = reqVoyageId
        ? 'Filter ID Voyage'
        : q
          ? `Filter: ${q.toUpperCase()}`
          : reqDepDate
            ? `Tanggal: ${reqDepDate}`
            : reqMonth
              ? `Bulan: ${reqMonth}`
              : startIso || endIso
                ? `${startIso || '...'} s/d ${endIso || '...'}`
                : 'Semua Pemberangkatan';

    if (matchedVoyages.length === 0 && !hasExplicitFilter && allNonCancelled.length > 0) {
        matchedVoyages = [...allNonCancelled]
            .sort((a, b) => b.depDate.getTime() - a.depDate.getTime())
            .slice(0, 10);
        periodDisplayLabel = '10 Pemberangkatan Terbaru';
    }

    if (matchedVoyages.length === 0) {
        throw new Error('Tidak ditemukan data pemberangkatan kapal untuk laporan omzet & laba biaya tersebut.');
    }

    // Sort ascending chronologically for clean accounting report
    matchedVoyages.sort((a, b) => a.depDate.getTime() - b.depDate.getTime());

    const allTxIdsSet = new Set<string>();
    for (const v of matchedVoyages) {
        const txIds: unknown[] = Array.isArray(v.data.transactionIds) ? v.data.transactionIds : [];
        for (const tid of txIds) {
            if (typeof tid === 'string' && tid.trim()) allTxIdsSet.add(tid.trim());
        }
    }

    const txMap = new Map<string, Record<string, any>>();
    const allTxIds = Array.from(allTxIdsSet);
    for (let i = 0; i < allTxIds.length; i += 100) {
        const chunk = allTxIds.slice(i, i + 100);
        const refs = chunk.map((tid) => adminDb.collection('transactions').doc(tid));
        const txSnaps = await adminDb.getAll(...refs);
        for (const s of txSnaps) {
            if (s.exists) txMap.set(s.id, s.data() || {});
        }
    }

    interface VoyageCargoDetailItem {
        noSTT: string;
        pengirimName: string;
        penerimaName: string;
        tujuan: string;
        koli: number;
        berat: number;
        beratUnit: string;
        statusPelunasan: string;
        isPaid: boolean;
        amount: number;
    }

    interface VoyagePlRow {
        voyageNumber: string;
        shipName: string;
        route: string;
        vehicles: string;
        depDateStr: string;
        depIso: string;
        sttCount: number;
        omzetStt: number;
        penjualanMakassar: number;
        totalRevenue: number;
        tiket: number;
        tiketMakassar: number;
        opsMakassar: number;
        opsSurabaya: number;
        gajiSopir: number;
        sewaMobil: number;
        opsTambahan: number;
        fieldExpensesTotal: number;
        totalExpenses: number;
        netProfit: number;
        marginPercent: number;
        paidRevenue: number;
        unpaidRevenue: number;
        voyageNotes: string;
        costNotes: string;
        fieldExpenseItems: Array<{ date: string; category: string; desc: string; amount: number }>;
        cargoItems: VoyageCargoDetailItem[];
    }

    const includeCargoDetail = Boolean(args.includeCargoDetail) || matchedVoyages.length === 1;
    const rows: VoyagePlRow[] = [];

    for (const v of matchedVoyages) {
        const tids: string[] = Array.isArray(v.data.transactionIds) ? v.data.transactionIds.filter(Boolean) : [];
        let omzetStt = 0;
        let sttCount = 0;
        let paidRevenue = 0;
        let unpaidRevenue = 0;
        const cargoItems: VoyageCargoDetailItem[] = [];

        for (const tid of tids) {
            const td = txMap.get(tid);
            if (!td || td.status === 'dibatalkan') continue;
            const subtotal = Number(td.jumlah) || 0;
            const ppn = td.isTaxable || (Number(td.ppn) || 0) > 0 ? Math.round(subtotal * 0.011) : 0;
            const effectiveAmount = subtotal + ppn;

            sttCount += 1;
            omzetStt += effectiveAmount;

            const linkedInv =
                invByTxId.get(tid) ||
                (td.invoiceId ? invById.get(String(td.invoiceId)) : undefined) ||
                (td.invoiceNumber ? invByNo.get(String(td.invoiceNumber).trim().toLowerCase()) : undefined) ||
                (td.noInvoice ? invByNo.get(String(td.noInvoice).trim().toLowerCase()) : undefined) ||
                null;

            const pel = String(td.pelunasan || '').trim().toLowerCase();
            const isDirectPaid = pel === 'cash' || pel === 'tf' || pel === 'lunas' || pel.includes('transfer');
            const isPaid = linkedInv?.data.status === 'Paid' || isDirectPaid;
            if (isPaid) paidRevenue += effectiveAmount;
            else unpaidRevenue += effectiveAmount;

            if (includeCargoDetail) {
                const invNo = String(linkedInv?.data.invoiceNumber || td.invoiceNumber || td.noInvoice || '');
                const statusPelunasan = isPaid
                    ? invNo
                        ? `LUNAS (Inv #${invNo})`
                        : `LUNAS (${td.pelunasan || 'Cash'})`
                    : linkedInv
                      ? `BELUM LUNAS (Inv #${invNo})`
                      : 'BELUM ADA INVOICE';
                cargoItems.push({
                    noSTT: String(td.noSTT || ''),
                    pengirimName: String(td.pengirimName || '-'),
                    penerimaName: String(td.penerimaName || '-'),
                    tujuan: String(td.tujuan || '-'),
                    koli: Number(td.koli) || 0,
                    berat: Number(td.berat) || 0,
                    beratUnit: String(td.beratUnit || 'KG'),
                    statusPelunasan,
                    isPaid,
                    amount: effectiveAmount,
                });
            }
        }

        cargoItems.sort((a, b) =>
            a.noSTT.localeCompare(b.noSTT, 'id', { numeric: true, sensitivity: 'base' })
        );

        const shipExp = shipExpMap.get(v.id);
        const penjualanMakassar = Number(shipExp?.penjualanMakassar) || 0;
        const totalRevenue = omzetStt + penjualanMakassar;

        const tiket = Number(shipExp?.tiket) || 0;
        const tiketMakassar = Number(shipExp?.tiketMakassar) || 0;
        const opsSurabaya = Number(shipExp?.opsSurabaya) || 0;
        const opsMakassar = Number(shipExp?.opsMakassar) || 0;
        const gajiSopir = Number(shipExp?.gajiSopir) || 0;
        const sewaMobil = Number(shipExp?.sewaMobil) || 0;
        const opsTambahan = Number(shipExp?.opsTambahan) || 0;
        const shipCostsTotal =
            tiket + tiketMakassar + opsSurabaya + opsMakassar + gajiSopir + sewaMobil + opsTambahan;

        const rawFieldExp = expensesByVoyageMap.get(v.id) || [];
        let fieldExpensesTotal = 0;
        const fieldExpenseItems = rawFieldExp.map((e) => {
            const amt = Number(e.data.amount) || 0;
            fieldExpensesTotal += amt;
            const cat = String(e.data.category || 'lainnya') as ExpenseCategory;
            return {
                date: e.data.date ? fmtDateShortId(e.data.date) : '-',
                category: EXPENSE_CATEGORY_LABELS[cat] || cat,
                desc: String(e.data.description || '-'),
                amount: amt,
            };
        });

        const totalExpenses = shipCostsTotal + fieldExpensesTotal;
        const netProfit = totalRevenue - totalExpenses;
        const marginPercent = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

        const vehicleArr: string[] = Array.isArray(v.data.vehicleNumbers)
            ? v.data.vehicleNumbers.filter(Boolean).map(String)
            : v.data.vehicleNumber
              ? [String(v.data.vehicleNumber)]
              : [];

        rows.push({
            voyageNumber: String(v.data.voyageNumber || '-'),
            shipName: String(v.data.shipName || 'Kapal'),
            route: String(v.data.route || '-'),
            vehicles: vehicleArr.join(', '),
            depDateStr: fmtDateShortId(v.depDate),
            depIso: v.depIso,
            sttCount,
            omzetStt,
            penjualanMakassar,
            totalRevenue,
            tiket,
            tiketMakassar,
            opsMakassar,
            opsSurabaya,
            gajiSopir,
            sewaMobil,
            opsTambahan,
            fieldExpensesTotal,
            totalExpenses,
            netProfit,
            marginPercent,
            paidRevenue,
            unpaidRevenue,
            voyageNotes: String(v.data.notes || ''),
            costNotes: String(shipExp?.notes || ''),
            fieldExpenseItems,
            cargoItems,
        });
    }

    const totals = rows.reduce(
        (acc, r) => {
            acc.sttCount += r.sttCount;
            acc.omzetStt += r.omzetStt;
            acc.penjualanMakassar += r.penjualanMakassar;
            acc.totalRevenue += r.totalRevenue;
            acc.tiket += r.tiket;
            acc.tiketMakassar += r.tiketMakassar;
            acc.opsMakassar += r.opsMakassar;
            acc.opsSurabaya += r.opsSurabaya;
            acc.gajiSopir += r.gajiSopir;
            acc.sewaMobil += r.sewaMobil;
            acc.opsTambahan += r.opsTambahan;
            acc.fieldExpensesTotal += r.fieldExpensesTotal;
            acc.totalExpenses += r.totalExpenses;
            acc.paidRevenue += r.paidRevenue;
            acc.unpaidRevenue += r.unpaidRevenue;
            return acc;
        },
        {
            sttCount: 0,
            omzetStt: 0,
            penjualanMakassar: 0,
            totalRevenue: 0,
            tiket: 0,
            tiketMakassar: 0,
            opsMakassar: 0,
            opsSurabaya: 0,
            gajiSopir: 0,
            sewaMobil: 0,
            opsTambahan: 0,
            fieldExpensesTotal: 0,
            totalExpenses: 0,
            paidRevenue: 0,
            unpaidRevenue: 0,
        }
    );
    const totalNetProfit = totals.totalRevenue - totals.totalExpenses;
    const avgMargin =
        totals.totalRevenue > 0 ? Math.round((totalNetProfit / totals.totalRevenue) * 100) : 0;

    const { pdfDoc, fonts } = await createBasePdfDocument();
    const logo = await embedPublicImage(pdfDoc, 'logo.png');

    const marginX = 22;
    let page = pdfDoc.addPage(A4_LANDSCAPE);
    const { width } = page.getSize();
    const usableW = width - marginX * 2; // ~797.89pt

    let cursorY = drawCompanyHeader(page, fonts, logo, {
        marginX,
        title: 'LAPORAN OMZET & LABA BIAYA KAPAL PEMBERANGKATAN',
        subtitle: `${periodDisplayLabel} (${rows.length} Pemberangkatan)`,
        rightBadge: 'DOKUMEN EKSEKUTIF OWNER',
    });

    cursorY = drawKpiCards(page, fonts, marginX, cursorY, [
        {
            label: '1. Total Omzet Kapal',
            value: fmtRp(totals.totalRevenue),
            sub: `STT ${fmtRp(totals.omzetStt)}${totals.penjualanMakassar > 0 ? ` + Mks ${fmtRp(totals.penjualanMakassar)}` : ''}`,
            fgColor: COLOR_BLUE,
            bgColor: COLOR_BLUE_BG,
        },
        {
            label: '2. Total Biaya Kapal & Ops',
            value: fmtRp(totals.totalExpenses),
            sub: `Kapal + Ops Lap (${fmtRp(totals.fieldExpensesTotal)})`,
            fgColor: COLOR_RED,
            bgColor: COLOR_RED_BG,
        },
        {
            label: '3. Total Laba Bersih',
            value: fmtRp(totalNetProfit),
            sub: 'Total Omzet - Total Biaya',
            fgColor: totalNetProfit >= 0 ? COLOR_GREEN : COLOR_RED,
            bgColor: totalNetProfit >= 0 ? COLOR_GREEN_BG : COLOR_RED_BG,
        },
        {
            label: '4. Margin & Pelunasan STT',
            value: `Margin ${avgMargin}%`,
            sub: `Lunas: ${fmtRp(totals.paidRevenue)} | Belum: ${fmtRp(totals.unpaidRevenue)}`,
            fgColor: COLOR_AMBER,
            bgColor: COLOR_AMBER_BG,
        },
    ]);

    // Main table (15 columns summing exactly to usableW ~797.89pt)
    const shipColW = usableW - (20 + 46 + 68 + 24 + 66 + 44 + 44 + 44 + 44 + 44 + 44 + 46 + 66 + 66 + 32);
    const mainCols: TableColumn[] = [
        { header: 'NO', width: 20, align: 'center' },
        { header: 'TGL', width: 46, align: 'center' },
        { header: 'KAPAL & VOYAGE', width: shipColW, align: 'left', bold: true },
        { header: 'RUTE & UNIT', width: 68, align: 'left' },
        { header: 'STT', width: 24, align: 'center' },
        { header: 'OMZET (+)', width: 66, align: 'right', bold: true },
        { header: 'TIKET', width: 44, align: 'right' },
        { header: 'TKT MKS', width: 44, align: 'right' },
        { header: 'OPS MKS', width: 44, align: 'right' },
        { header: 'OPS SBY', width: 44, align: 'right' },
        { header: 'SOPIR', width: 44, align: 'right' },
        { header: 'SEWA', width: 44, align: 'right' },
        { header: 'OPS LAIN', width: 46, align: 'right' },
        { header: 'TOT BIAYA', width: 66, align: 'right', bold: true },
        { header: 'LABA (=)', width: 66, align: 'right', bold: true },
        { header: 'MRG', width: 32, align: 'center', bold: true },
    ];

    const fmtCost = (n: number) => (n > 0 ? fmtNum(n) : '-');
    const mainRows: TableRowInput[] = rows.map((r, idx) => {
        const opsLainCombined = r.opsTambahan + r.fieldExpensesTotal;
        return {
            cells: [
                String(idx + 1),
                r.depDateStr,
                `${r.shipName} (${r.voyageNumber})`,
                r.vehicles ? `${r.route} | ${r.vehicles}` : r.route,
                String(r.sttCount),
                {
                    text: fmtNum(r.totalRevenue),
                    bold: true,
                    color: COLOR_BLUE,
                    bgColor: COLOR_BLUE_BG,
                },
                fmtCost(r.tiket),
                fmtCost(r.tiketMakassar),
                fmtCost(r.opsMakassar),
                fmtCost(r.opsSurabaya),
                fmtCost(r.gajiSopir),
                fmtCost(r.sewaMobil),
                fmtCost(opsLainCombined),
                {
                    text: fmtNum(r.totalExpenses),
                    bold: true,
                    color: COLOR_RED,
                    bgColor: COLOR_RED_BG,
                },
                {
                    text: fmtNum(r.netProfit),
                    bold: true,
                    color: r.netProfit >= 0 ? COLOR_GREEN : COLOR_RED,
                    bgColor: r.netProfit >= 0 ? COLOR_GREEN_BG : COLOR_RED_BG,
                },
                `${r.marginPercent}%`,
            ],
        };
    });

    mainRows.push({
        isFooter: true,
        cells: [
            '',
            '',
            { text: 'TOTAL KESELURUHAN', bold: true, align: 'right' },
            `${rows.length} Trip`,
            String(totals.sttCount),
            { text: fmtNum(totals.totalRevenue), bold: true, color: COLOR_BLUE },
            fmtNum(totals.tiket),
            fmtNum(totals.tiketMakassar),
            fmtNum(totals.opsMakassar),
            fmtNum(totals.opsSurabaya),
            fmtNum(totals.gajiSopir),
            fmtNum(totals.sewaMobil),
            fmtNum(totals.opsTambahan + totals.fieldExpensesTotal),
            { text: fmtNum(totals.totalExpenses), bold: true, color: COLOR_RED },
            { text: fmtNum(totalNetProfit), bold: true, color: totalNetProfit >= 0 ? COLOR_GREEN : COLOR_RED },
            `${avgMargin}%`,
        ],
    });

    const secMain = drawPaginatedTable(pdfDoc, page, cursorY, fonts, logo, {
        pageSize: A4_LANDSCAPE,
        marginX,
        continuationTitle: 'LAPORAN OMZET & LABA BIAYA KAPAL',
        continuationSubtitle: periodDisplayLabel,
        sectionTitle: 'A. RINCIAN PENDAPATAN & BIAYA PER PEMBERANGKATAN (NOMINAL DALAM RUPIAH)',
        columns: mainCols,
        rows: mainRows,
        fontSize: 6.4,
        headerFontSize: 6.2,
        padH: 2.5,
        padV: 3.5,
    });
    page = secMain.page;
    cursorY = secMain.cursorY - 12;

    // Detailed notes, field expenses, and cargo table when single voyage or includeCargoDetail=true
    if (includeCargoDetail) {
        for (const r of rows) {
            if (r.voyageNotes || r.costNotes) {
                if (cursorY - 40 < 40) {
                    page = pdfDoc.addPage(A4_LANDSCAPE);
                    cursorY = drawCompanyHeader(page, fonts, logo, {
                        marginX,
                        title: `DETAIL ${r.voyageNumber} - ${r.shipName}`,
                        compact: true,
                    });
                }
                const noteText = [
                    r.voyageNotes ? `Catatan Pemberangkatan (${r.voyageNumber}): ${r.voyageNotes}` : '',
                    r.costNotes ? `Catatan Biaya Kapal (${r.voyageNumber}): ${r.costNotes}` : '',
                ]
                    .filter(Boolean)
                    .join(' | ');
                const noteLines = wrapTextToLines(noteText, fonts.regular, 7.5, usableW - 14);
                const noteH = 10 + noteLines.length * 10;
                page.drawRectangle({
                    x: marginX,
                    y: cursorY - noteH,
                    width: usableW,
                    height: noteH,
                    color: COLOR_AMBER_BG,
                    borderColor: COLOR_AMBER,
                    borderWidth: 0.6,
                });
                noteLines.forEach((line, li) => {
                    drawSafeText(page, line, {
                        x: marginX + 7,
                        y: cursorY - 11 - li * 10,
                        font: fonts.bold,
                        size: 7.5,
                        color: COLOR_DARK,
                    });
                });
                cursorY -= noteH + 10;
            }

            if (r.fieldExpenseItems.length > 0) {
                const expCols: TableColumn[] = [
                    { header: 'NO', width: 26, align: 'center' },
                    { header: 'TANGGAL', width: 85, align: 'center' },
                    { header: 'KATEGORI PENGELUARAN', width: 150, align: 'left', bold: true },
                    { header: 'KETERANGAN PENGELUARAN LAPANGAN', width: usableW - (26 + 85 + 150 + 110), align: 'left' },
                    { header: 'BIAYA (RP)', width: 110, align: 'right', bold: true },
                ];
                const expRows: TableRowInput[] = r.fieldExpenseItems.map((e, i) => ({
                    cells: [String(i + 1), e.date, e.category, e.desc, { text: fmtRp(e.amount), color: COLOR_RED }],
                }));
                expRows.push({
                    isFooter: true,
                    cells: [
                        '',
                        '',
                        '',
                        { text: `TOTAL PENGELUARAN LAPANGAN (${r.voyageNumber})`, bold: true, align: 'right' },
                        { text: fmtRp(r.fieldExpensesTotal), bold: true, color: COLOR_RED },
                    ],
                });
                const expTbl = drawPaginatedTable(pdfDoc, page, cursorY, fonts, logo, {
                    pageSize: A4_LANDSCAPE,
                    marginX,
                    continuationTitle: `PENGELUARAN LAPANGAN - ${r.voyageNumber}`,
                    sectionTitle: `B. RINCIAN PENGELUARAN TAMBAHAN (${r.voyageNumber} - ${r.shipName})`,
                    columns: expCols,
                    rows: expRows,
                    fontSize: 7.2,
                    headerFontSize: 7.2,
                });
                page = expTbl.page;
                cursorY = expTbl.cursorY - 12;
            }

            if (r.cargoItems.length > 0) {
                const cargoCols: TableColumn[] = [
                    { header: 'NO', width: 26, align: 'center' },
                    { header: 'NO. STT', width: 64, align: 'center', mono: true },
                    { header: 'PENGIRIM -> PENERIMA', width: 230, align: 'left', bold: true },
                    { header: 'TUJUAN', width: 90, align: 'left' },
                    { header: 'KOLI', width: 42, align: 'center' },
                    { header: 'BERAT', width: 64, align: 'right' },
                    { header: 'STATUS PELUNASAN / INVOICE', width: usableW - (26 + 64 + 230 + 90 + 42 + 64 + 98), align: 'left' },
                    { header: 'OMZET (RP)', width: 98, align: 'right', bold: true },
                ];
                const cargoRows: TableRowInput[] = r.cargoItems.map((c, i) => ({
                    cells: [
                        String(i + 1),
                        c.noSTT.replace(/^STT0*/i, '') || c.noSTT,
                        `${c.pengirimName} -> ${c.penerimaName}`,
                        c.tujuan,
                        fmtNum(c.koli),
                        `${c.berat.toLocaleString('id-ID')} ${c.beratUnit === 'M3' ? 'M3' : 'Kg'}`,
                        {
                            text: c.statusPelunasan,
                            bold: true,
                            color: c.isPaid ? COLOR_GREEN : COLOR_AMBER,
                        },
                        { text: fmtRp(c.amount), bold: true, align: 'right' },
                    ],
                }));
                cargoRows.push({
                    isFooter: true,
                    cells: [
                        '',
                        '',
                        { text: `TOTAL OMZET STT (${r.voyageNumber})`, bold: true, align: 'right' },
                        '',
                        fmtNum(r.cargoItems.reduce((s, c) => s + c.koli, 0)),
                        '',
                        `Lunas: ${fmtRp(r.paidRevenue)} | Belum: ${fmtRp(r.unpaidRevenue)}`,
                        { text: fmtRp(r.omzetStt), bold: true, color: COLOR_BLUE },
                    ],
                });
                const cargoTbl = drawPaginatedTable(pdfDoc, page, cursorY, fonts, logo, {
                    pageSize: A4_LANDSCAPE,
                    marginX,
                    continuationTitle: `RINCIAN KARGO STT - ${r.voyageNumber}`,
                    sectionTitle: `C. RINCIAN KARGO STT & PELUNASAN (${r.voyageNumber} - ${r.shipName})`,
                    columns: cargoCols,
                    rows: cargoRows,
                    fontSize: 7.2,
                    headerFontSize: 7.2,
                });
                page = cargoTbl.page;
                cursorY = cargoTbl.cursorY - 12;
            }
        }
    }

    // 3-Column Executive Signature Footer
    if (cursorY - 68 < 34) {
        page = pdfDoc.addPage(A4_LANDSCAPE);
        cursorY = drawCompanyHeader(page, fonts, logo, {
            marginX,
            title: 'LAPORAN OMZET & LABA BIAYA KAPAL',
            compact: true,
        });
    }
    const sigCols = [
        { role: 'Dibuat Oleh (Admin Operasional)', name: '( ......................................... )', sub: 'Staff Operasional Kapal' },
        { role: 'Diperiksa Oleh (Manager Keuangan)', name: '( ......................................... )', sub: 'Finance & Accounting Manager' },
        { role: 'Disetujui Oleh (Direksi / Owner)', name: COMPANY_INFO.signatureName, sub: 'Direktur Utama' },
    ];
    const sigW = usableW / 3;
    sigCols.forEach((sc, idx) => {
        const cx = marginX + idx * sigW + sigW / 2;
        const rw = safeWidth(fonts.bold, sc.role, 8);
        drawSafeText(page, sc.role, {
            x: cx - rw / 2,
            y: cursorY,
            font: fonts.bold,
            size: 8,
            color: COLOR_DARK,
        });
        page.drawLine({
            start: { x: cx - 70, y: cursorY - 40 },
            end: { x: cx + 70, y: cursorY - 40 },
            thickness: 0.9,
            color: COLOR_DARK,
        });
        const nw = safeWidth(fonts.bold, sc.name, 8);
        drawSafeText(page, sc.name, {
            x: cx - nw / 2,
            y: cursorY - 50,
            font: fonts.bold,
            size: 8,
            color: COLOR_DARK,
        });
        const sw = safeWidth(fonts.regular, sc.sub, 7);
        drawSafeText(page, sc.sub, {
            x: cx - sw / 2,
            y: cursorY - 60,
            font: fonts.regular,
            size: 7,
            color: COLOR_MUTED,
        });
    });

    finalizeFooters(pdfDoc, fonts, marginX);
    const bytes = await pdfDoc.save();
    const fileToken = safeFilenameToken(
        rows.length === 1 ? `${rows[0].voyageNumber}_${rows[0].shipName}` : reqMonth || effectivePeriod || 'Semua',
        'Kapal'
    );

    return {
        base64: Buffer.from(bytes).toString('base64'),
        mimeType: 'application/pdf',
        filename: `Laporan-Omzet-Laba-Kapal-${fileToken}.pdf`,
        summary: {
            periodLabel: periodDisplayLabel,
            voyageCount: rows.length,
            sttCount: totals.sttCount,
            omzetStt: totals.omzetStt,
            penjualanMakassar: totals.penjualanMakassar,
            totalRevenue: totals.totalRevenue,
            totalExpenses: totals.totalExpenses,
            netProfit: totalNetProfit,
            avgMarginPercent: avgMargin,
            paidRevenue: totals.paidRevenue,
            unpaidRevenue: totals.unpaidRevenue,
            voyages: rows.slice(0, 15).map((r) => ({
                voyageNumber: r.voyageNumber,
                shipName: r.shipName,
                departureDate: r.depDateStr,
                totalRevenue: r.totalRevenue,
                totalExpenses: r.totalExpenses,
                netProfit: r.netProfit,
                marginPercent: r.marginPercent,
            })),
        },
    };
}
