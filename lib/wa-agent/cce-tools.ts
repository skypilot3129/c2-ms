import 'server-only';
import admin from 'firebase-admin';
import { Type, type FunctionDeclaration } from '@google/genai';
import { adminDb } from '@/lib/firebase-admin';
import { BRANCHES, type Branch } from '@/types/branch';
import type { BeratUnit, CaraPelunasan, MetodePembayaran, StatusTransaksi, TipeTransaksi } from '@/types/transaction';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory, type VoyageStatus } from '@/types/voyage';
import type {
    AssignSttsToVoyageDraftPayload,
    BatchUpdateSttPricingDraftPayload,
    BatchUpdateSttPricingItem,
    CreateInvoiceDraftPayload,
    CreateSttDraftPayload,
    CreateVoyageDraftPayload,
    PendingAction,
    ReplyMediaItem,
    SaveVoyageExpensesDraftPayload,
    VoyageGeneralExpenseInput,
    VoyageShipCostsInput,
    WaAgentRole,
} from '@/types/wa-agent';
import { renderInvoicePngById } from './invoice-image';

function toDateSafe(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function fmtDateId(value: any): string {
    return toDateSafe(value).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function fmtRupiah(num: number): string {
    return `Rp ${Math.round(num || 0).toLocaleString('id-ID')}`;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
            out[k] = v;
        }
    }
    return out;
}

function normalizeBranch(raw?: string): Branch {
    const val = (raw || '').trim().toLowerCase();
    if (val === 'bandung' || val === 'bdg') return 'bandung';
    if (val === 'makassar' || val === 'mks') return 'makassar';
    return 'surabaya';
}

function normalizeBeratUnit(raw?: string): BeratUnit {
    const val = (raw || '').trim().toUpperCase();
    if (val === 'M3' || val === 'KUBIK') return 'M3';
    if (val === 'KG/VOLUME' || val === 'VOLUME') return 'KG/VOLUME';
    return 'KG';
}

function normalizeTipeTransaksi(raw?: string): TipeTransaksi {
    const val = (raw || '').trim().toLowerCase();
    return val === 'borongan' ? 'borongan' : 'regular';
}

function normalizePembayaran(raw?: string): MetodePembayaran {
    const val = (raw || '').trim().toLowerCase();
    if (val === 'kredit' || val === 'tagihan' || val === 'invoice') return 'Kredit';
    if (val === 'dp') return 'DP';
    return 'Tunai';
}

function normalizePelunasan(raw?: string, pembayaran?: MetodePembayaran): CaraPelunasan {
    const val = (raw || '').trim().toLowerCase();
    if (val === 'cash' || val === 'tunai' || val === 'lunas') return 'Cash';
    if (val === 'tf' || val === 'transfer') return 'TF';
    if (val === 'pending' || val === 'belum lunas') return 'Pending';
    return pembayaran === 'Kredit' || pembayaran === 'DP' ? 'Pending' : 'Cash';
}

function toWibDateIso(value: any): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(toDateSafe(value));
}

function resolveWibPeriodRange(period?: string): { startIso?: string; endIso?: string } {
    const p = (period || '').trim().toLowerCase();
    if (!p) return {};

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
        const dow = utcMid.getUTCDay(); // 0=Sun..6=Sat
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

function normalizeDestination(raw?: string): string {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/makasar/g, 'makassar');
}

function destinationsMatch(a: string, b: string): boolean {
    const na = normalizeDestination(a);
    const nb = normalizeDestination(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return (na.length >= 3 && nb.includes(na)) || (nb.length >= 3 && na.includes(nb));
}

function normalizeTargetStatus(raw?: string): StatusTransaksi {
    const val = (raw || '').trim().toLowerCase();
    if (val === 'pending' || val === 'diproses' || val === 'dikirim' || val === 'selesai') {
        return val;
    }
    return 'dikirim';
}

function normalizeVoyageStatus(raw?: string): VoyageStatus {
    const val = (raw || '').trim().toLowerCase();
    if (
        val === 'in-progress' ||
        val === 'in_progress' ||
        val === 'berangkat' ||
        val === 'berlayar' ||
        val === 'dalam perjalanan' ||
        val === 'dikirim' ||
        val === 'jalan'
    ) {
        return 'in-progress';
    }
    if (val === 'completed' || val === 'selesai' || val === 'tiba' || val === 'sampai') {
        return 'completed';
    }
    if (val === 'cancelled' || val === 'dibatalkan' || val === 'batal') {
        return 'cancelled';
    }
    return 'planned';
}

function voyageStatusLabel(status: VoyageStatus): string {
    switch (status) {
        case 'in-progress':
            return 'Dalam Perjalanan (Berlayar)';
        case 'completed':
            return 'Selesai';
        case 'cancelled':
            return 'Dibatalkan';
        default:
            return 'Direncanakan (Persiapan)';
    }
}

function normalizeExpenseCategory(raw?: string): ExpenseCategory {
    const val = (raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (val && val in EXPENSE_CATEGORY_LABELS) {
        return val as ExpenseCategory;
    }
    if (val.includes('solar') || val.includes('bbm') || val.includes('bensin')) return 'bbm_solar';
    if (val.includes('tol') || val.includes('parkir')) return 'parkir_tol';
    if (val.includes('makan')) return 'makan_tim';
    if (val.includes('pelabuhan') || val.includes('sandar') || val.includes('dermaga')) return 'biaya_pelabuhan';
    if (val.includes('tiket')) return 'tiket';
    if (val.includes('transit')) return 'transit';
    if (val.includes('sewa')) return 'sewa_mobil';
    if (val.includes('sopir') || val.includes('gaji')) return 'gaji_sopir';
    if (val.includes('surabaya') || val.includes('sby')) return 'operasional_surabaya';
    if (val.includes('makassar') || val.includes('mks')) return 'operasional_makassar';
    return 'lainnya';
}

function parseVehicleUnits(rawVehicles?: unknown): string[] {
    if (Array.isArray(rawVehicles)) {
        return Array.from(
            new Set(
                rawVehicles
                    .flatMap((v) => String(v || '').split(','))
                    .map((s) => s.trim())
                    .filter(Boolean)
            )
        );
    }
    if (typeof rawVehicles === 'string') {
        return Array.from(
            new Set(
                rawVehicles
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
            )
        );
    }
    return [];
}

function sumShipCosts(costs?: VoyageShipCostsInput): number {
    if (!costs) return 0;
    return (
        (Number(costs.tiket) || 0) +
        (Number(costs.tiketMakassar) || 0) +
        (Number(costs.opsSurabaya) || 0) +
        (Number(costs.opsMakassar) || 0) +
        (Number(costs.gajiSopir) || 0) +
        (Number(costs.sewaMobil) || 0) +
        (Number(costs.opsTambahan) || 0)
    );
}

function sanitizeShipCostsInput(raw: any): VoyageShipCostsInput | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const out: VoyageShipCostsInput = {};
    const numKeys: Array<keyof Omit<VoyageShipCostsInput, 'notes'>> = [
        'tiket',
        'tiketMakassar',
        'opsSurabaya',
        'opsMakassar',
        'gajiSopir',
        'sewaMobil',
        'opsTambahan',
        'penjualanMakassar',
    ];
    let hasAny = false;
    for (const k of numKeys) {
        if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') {
            const val = Math.max(0, Math.round(Number(raw[k]) || 0));
            out[k] = val;
            hasAny = true;
        }
    }
    if (typeof raw.notes === 'string' && raw.notes.trim()) {
        out.notes = raw.notes.trim();
        hasAny = true;
    }
    return hasAny ? out : undefined;
}

function sanitizeGeneralExpensesInput(raw: unknown): VoyageGeneralExpenseInput[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const todayWib = toWibDateIso(new Date());
    const items: VoyageGeneralExpenseInput[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const amount = Math.max(0, Math.round(Number((entry as any).amount) || 0));
        if (amount <= 0) continue;
        const category = normalizeExpenseCategory((entry as any).category || (entry as any).description);
        const description =
            String((entry as any).description || '').trim() || EXPENSE_CATEGORY_LABELS[category];
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String((entry as any).date || '').trim())
            ? String((entry as any).date).trim()
            : todayWib;
        items.push({ category, amount, description, date });
    }
    return items.length > 0 ? items : undefined;
}

async function collectAssignedTransactionIds(excludeVoyageId?: string): Promise<Map<string, string>> {
    const snap = await adminDb.collection('voyages').get();
    const map = new Map<string, string>();
    for (const doc of snap.docs) {
        if (excludeVoyageId && doc.id === excludeVoyageId) continue;
        const d = doc.data() || {};
        if (d.status === 'cancelled') continue;
        const voyLabel = String(d.voyageNumber || d.shipName || doc.id);
        const txIds: string[] = Array.isArray(d.transactionIds) ? d.transactionIds : [];
        for (const tid of txIds) {
            if (tid && !map.has(tid)) {
                map.set(tid, voyLabel);
            }
        }
    }
    return map;
}

async function findVoyageByRef(voyageId?: string, voyageRef?: string) {
    const snap = await adminDb.collection('voyages').get();
    const docs = snap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {}, depDate: toDateSafe(doc.data()?.departureDate) }))
        .filter((v) => v.data.status !== 'cancelled')
        .sort((a, b) => {
            const depDiff = b.depDate.getTime() - a.depDate.getTime();
            if (depDiff !== 0) return depDiff;
            return toDateSafe(b.data.createdAt).getTime() - toDateSafe(a.data.createdAt).getTime();
        });

    if (voyageId) {
        const hit = docs.find((d) => d.id === voyageId.trim());
        if (hit) return hit;
    }

    const q = (voyageRef || '').trim().toLowerCase();
    if (q) {
        const qDigits = q.replace(/\D/g, '');
        const exactVoy = docs.find((d) => {
            const vn = String(d.data.voyageNumber || '').trim().toLowerCase();
            if (vn === q) return true;
            const vnDigits = vn.replace(/\D/g, '');
            return Boolean(qDigits && vnDigits === qDigits && q.includes('voy'));
        });
        if (exactVoy) return exactVoy;

        const shipHit = docs.find(
            (d) =>
                String(d.data.shipName || '').toLowerCase().includes(q) ||
                String(d.data.route || '').toLowerCase().includes(q) ||
                String(d.data.voyageNumber || '').toLowerCase().includes(q)
        );
        if (shipHit) return shipHit;
    }

    return docs[0] || null;
}

// ==========================================
// 1. READ TOOLS
// ==========================================

export async function toolSearchClients(queryText: string) {
    const q = (queryText || '').trim().toLowerCase();
    const snap = await adminDb.collection('clients').get();
    const matches = snap.docs
        .map((doc) => {
            const d = doc.data() || {};
            return {
                id: doc.id,
                name: String(d.name || ''),
                phone: String(d.phone || ''),
                address: String(d.address || ''),
                city: String(d.city || ''),
            };
        })
        .filter((c) => {
            if (!q) return true;
            return (
                c.name.toLowerCase().includes(q) ||
                c.phone.toLowerCase().includes(q) ||
                c.city.toLowerCase().includes(q) ||
                c.address.toLowerCase().includes(q)
            );
        })
        .slice(0, 12);

    return { count: matches.length, clients: matches };
}

export async function toolGetTransactionBySTT(noSTT: string) {
    const raw = (noSTT || '').trim();
    if (!raw) return { found: false, message: 'Nomor STT tidak boleh kosong.' };

    const digitsOnly = raw.replace(/\D/g, '');
    const candidates = new Set<string>([raw.toUpperCase()]);
    if (digitsOnly) {
        candidates.add(`STT${digitsOnly.padStart(6, '0')}`);
        candidates.add(`STT${digitsOnly}`);
    }

    for (const candidate of candidates) {
        const snap = await adminDb.collection('transactions').where('noSTT', '==', candidate).limit(1).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            const d = doc.data() || {};
            return {
                found: true,
                transaction: {
                    id: doc.id,
                    noSTT: d.noSTT,
                    branch: d.branch || 'surabaya',
                    tanggal: fmtDateId(d.tanggal),
                    pengirimName: d.pengirimName || '',
                    pengirimPhone: d.pengirimPhone || '',
                    penerimaName: d.penerimaName || '',
                    tujuan: d.tujuan || '',
                    koli: Number(d.koli) || 0,
                    berat: Number(d.berat) || 0,
                    beratUnit: d.beratUnit || 'KG',
                    tipeTransaksi: d.tipeTransaksi || 'regular',
                    harga: Number(d.harga) || 0,
                    jumlah: Number(d.jumlah) || 0,
                    isTaxable: Boolean(d.isTaxable),
                    pembayaran: d.pembayaran || 'Tunai',
                    pelunasan: d.pelunasan || 'Pending',
                    status: d.status || 'pending',
                    isiBarang: d.isiBarang || '',
                    keterangan: d.keterangan || '',
                    invoiceId: d.invoiceId || null,
                    invoiceNumber: d.invoiceNumber || null,
                    invoiceStatus: d.invoiceStatus || null,
                },
            };
        }
    }

    // Fallback scan matching suffix digits in case legacy STT lacks leading zeroes
    if (digitsOnly) {
        const allSnap = await adminDb.collection('transactions').get();
        const hit = allSnap.docs.find((doc) => {
            const sttVal = String(doc.data()?.noSTT || '');
            return sttVal.replace(/\D/g, '') === digitsOnly;
        });
        if (hit) {
            const d = hit.data() || {};
            return {
                found: true,
                transaction: {
                    id: hit.id,
                    noSTT: d.noSTT,
                    branch: d.branch || 'surabaya',
                    tanggal: fmtDateId(d.tanggal),
                    pengirimName: d.pengirimName || '',
                    penerimaName: d.penerimaName || '',
                    tujuan: d.tujuan || '',
                    koli: Number(d.koli) || 0,
                    berat: Number(d.berat) || 0,
                    beratUnit: d.beratUnit || 'KG',
                    harga: Number(d.harga) || 0,
                    jumlah: Number(d.jumlah) || 0,
                    pelunasan: d.pelunasan || 'Pending',
                    status: d.status || 'pending',
                    invoiceId: d.invoiceId || null,
                    invoiceNumber: d.invoiceNumber || null,
                    invoiceStatus: d.invoiceStatus || null,
                },
            };
        }
    }

    return { found: false, message: `Resi/STT "${raw}" tidak ditemukan di database.` };
}

export async function toolListUnbilledTransactions(clientName?: string, limitCount: number = 20) {
    const q = (clientName || '').trim().toLowerCase();
    const snap = await adminDb
        .collection('transactions')
        .where('pelunasan', '==', 'Pending')
        .get();

    const filtered = snap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .filter(({ data }) => {
            if (data.status === 'dibatalkan') return false;
            if (data.invoiceId) return false;
            if (q) {
                const sender = String(data.pengirimName || '').toLowerCase();
                if (!sender.includes(q)) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const numA = parseInt(String(a.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(String(b.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
            return numA - numB;
        });

    const totalNominal = filtered.reduce((sum, item) => sum + (Number(item.data.jumlah) || 0), 0);
    const items = filtered.slice(0, Math.min(Math.max(1, limitCount), 30)).map(({ id, data }) => ({
        id,
        noSTT: data.noSTT || '',
        tanggal: fmtDateId(data.tanggal),
        pengirimName: data.pengirimName || '',
        penerimaName: data.penerimaName || '',
        tujuan: data.tujuan || '',
        koli: Number(data.koli) || 0,
        berat: Number(data.berat) || 0,
        beratUnit: data.beratUnit || 'KG',
        jumlah: Number(data.jumlah) || 0,
        isTaxable: Boolean(data.isTaxable) || (Number(data.ppn) || 0) > 0,
    }));

    return {
        totalCount: filtered.length,
        totalNominal,
        items,
    };
}

export async function toolGetUnpaidInvoicesSummary(clientName?: string) {
    const q = (clientName || '').trim().toLowerCase();
    const snap = await adminDb.collection('invoices').get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unpaid = snap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .filter(({ data }) => {
            if (data.status === 'Paid' || data.status === 'Cancelled') return false;
            if (q && !String(data.clientName || '').toLowerCase().includes(q)) return false;
            return true;
        })
        .map(({ id, data }) => {
            const dueDate = toDateSafe(data.dueDate);
            return {
                id,
                invoiceNumber: String(data.invoiceNumber || ''),
                clientName: String(data.clientName || ''),
                totalAmount: Number(data.totalAmount) || 0,
                issueDate: fmtDateId(data.issueDate),
                dueDate: fmtDateId(dueDate),
                dueDateTs: dueDate.getTime(),
                overdue: dueDate < today,
                sttCount: Array.isArray(data.transactionIds) ? data.transactionIds.length : 0,
            };
        })
        .sort((a, b) => a.dueDateTs - b.dueDateTs);

    const totalPiutang = unpaid.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const overdueCount = unpaid.filter((inv) => inv.overdue).length;

    return {
        totalUnpaidCount: unpaid.length,
        overdueCount,
        totalPiutang,
        invoices: unpaid.slice(0, 15).map(({ dueDateTs, ...rest }) => {
            void dueDateTs;
            return rest;
        }),
    };
}

export async function toolGetVoyageSummary(searchQuery?: string) {
    const q = (searchQuery || '').trim().toLowerCase();
    const snap = await adminDb.collection('voyages').get();

    const voyages = snap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {}, depDate: toDateSafe(doc.data()?.departureDate) }))
        .filter(({ data }) => {
            if (!q) return true;
            return (
                String(data.shipName || '').toLowerCase().includes(q) ||
                String(data.voyageNumber || '').toLowerCase().includes(q) ||
                String(data.route || '').toLowerCase().includes(q)
            );
        })
        .sort((a, b) => b.depDate.getTime() - a.depDate.getTime())
        .slice(0, 5);

    const results = [];
    for (const v of voyages) {
        const txIds: string[] = Array.isArray(v.data.transactionIds) ? v.data.transactionIds.filter(Boolean) : [];
        let totalOmzet = 0;
        let totalKoli = 0;
        let paidAmount = 0;
        let pendingAmount = 0;
        let activeSttCount = 0;

        if (txIds.length > 0) {
            const refs = txIds.map((tid) => adminDb.collection('transactions').doc(tid));
            const txSnaps = await adminDb.getAll(...refs);
            for (const txSnap of txSnaps) {
                if (!txSnap.exists) continue;
                const td = txSnap.data() || {};
                if (td.status === 'dibatalkan') continue;
                const amt = Number(td.jumlah) || 0;
                activeSttCount += 1;
                totalOmzet += amt;
                totalKoli += Number(td.koli) || 0;
                if (td.pelunasan === 'Cash' || td.pelunasan === 'TF') {
                    paidAmount += amt;
                } else {
                    pendingAmount += amt;
                }
            }
        }

        results.push({
            id: v.id,
            voyageNumber: String(v.data.voyageNumber || ''),
            shipName: String(v.data.shipName || '-'),
            route: String(v.data.route || ''),
            departureDate: fmtDateId(v.depDate),
            status: String(v.data.status || 'planned'),
            sttCount: activeSttCount,
            totalKoli,
            totalOmzet,
            paidAmount,
            pendingAmount,
        });
    }

    return { count: results.length, voyages: results };
}

interface PriceHistoryCandidate {
    tier: number;
    tipeTransaksi: TipeTransaksi;
    harga: number;
    jumlah: number;
    beratUnit: BeratUnit;
    tujuan: string;
    isTaxable: boolean;
    count: number;
    lastDateMs: number;
    lastDateWib: string;
    lastNoSTT: string;
}

export async function toolListPendingSttWithPriceHistory(args: {
    startDate?: string;
    endDate?: string;
    period?: string;
    onlyUnpriced?: boolean;
    clientName?: string;
    branch?: string;
    limit?: number;
}) {
    const periodRange = resolveWibPeriodRange(args.period);
    const startIso = /^\d{4}-\d{2}-\d{2}$/.test(String(args.startDate || '').trim())
        ? String(args.startDate).trim()
        : periodRange.startIso;
    const endIso = /^\d{4}-\d{2}-\d{2}$/.test(String(args.endDate || '').trim())
        ? String(args.endDate).trim()
        : periodRange.endIso;
    const onlyUnpriced = args.onlyUnpriced !== false;
    const clientQuery = (args.clientName || '').trim().toLowerCase();
    const branchFilter = args.branch ? normalizeBranch(args.branch) : undefined;
    const maxItems = Math.min(Math.max(1, Number(args.limit) || 25), 40);

    const snap = await adminDb.collection('transactions').get();
    const allDocs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));

    // Indeks semua riwayat transaksi berharga berdasarkan pengirimId dan pengirimName
    const bySenderId = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
    const bySenderName = new Map<string, Array<{ id: string; data: Record<string, any> }>>();

    for (const item of allDocs) {
        const d = item.data;
        if (d.status === 'dibatalkan') continue;
        const harga = Number(d.harga) || 0;
        const jumlah = Number(d.jumlah) || 0;
        if (harga <= 0 && jumlah <= 0) continue;

        const senderId = String(d.pengirimId || '').trim();
        if (senderId) {
            const arr = bySenderId.get(senderId) || [];
            arr.push(item);
            bySenderId.set(senderId, arr);
        }
        const senderNameKey = String(d.pengirimName || '').trim().toLowerCase();
        if (senderNameKey) {
            const arr = bySenderName.get(senderNameKey) || [];
            arr.push(item);
            bySenderName.set(senderNameKey, arr);
        }
    }

    const inDateRange = (dateWib: string) => {
        if (startIso && dateWib < startIso) return false;
        if (endIso && dateWib > endIso) return false;
        return true;
    };

    const pendingMatches = allDocs
        .filter(({ data }) => {
            if (String(data.status || 'pending') !== 'pending') return false;
            if (onlyUnpriced) {
                const harga = Number(data.harga) || 0;
                const jumlah = Number(data.jumlah) || 0;
                if (harga > 0 || jumlah > 0) return false;
            }
            if (clientQuery && !String(data.pengirimName || '').toLowerCase().includes(clientQuery)) {
                return false;
            }
            if (branchFilter && String(data.branch || 'surabaya').toLowerCase() !== branchFilter) {
                return false;
            }
            if (startIso || endIso) {
                const tanggalWib = toWibDateIso(data.tanggal);
                const createdAtWib = toWibDateIso(data.createdAt || data.tanggal);
                if (!inDateRange(tanggalWib) && !inDateRange(createdAtWib)) {
                    return false;
                }
            }
            return true;
        })
        .sort((a, b) => {
            const numA = parseInt(String(a.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(String(b.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
            return numA - numB;
        });

    const items = pendingMatches.slice(0, maxItems).map(({ id, data }) => {
        const senderId = String(data.pengirimId || '').trim();
        const senderName = String(data.pengirimName || '').trim();
        const senderNameKey = senderName.toLowerCase();
        const berat = Number(data.berat) || 0;
        const koli = Number(data.koli) || 0;
        const beratUnit = normalizeBeratUnit(data.beratUnit);
        const tujuan = String(data.tujuan || '').trim();

        const poolMap = new Map<string, { id: string; data: Record<string, any> }>();
        if (senderId && bySenderId.has(senderId)) {
            for (const h of bySenderId.get(senderId)!) poolMap.set(h.id, h);
        }
        if (senderNameKey && bySenderName.has(senderNameKey)) {
            for (const h of bySenderName.get(senderNameKey)!) poolMap.set(h.id, h);
        }

        const grouped = new Map<string, PriceHistoryCandidate>();
        for (const hist of poolMap.values()) {
            const hd = hist.data;
            const hTipe = normalizeTipeTransaksi(hd.tipeTransaksi);
            const hHarga = Math.round(Number(hd.harga) || 0);
            const hJumlah = Math.round(Number(hd.jumlah) || 0);
            const hUnit = normalizeBeratUnit(hd.beratUnit);
            const hTujuan = String(hd.tujuan || '').trim();
            if (hTipe === 'regular' && hHarga <= 0) continue;
            if (hTipe === 'borongan' && hJumlah <= 0 && hHarga <= 0) continue;

            const destMatch = destinationsMatch(tujuan, hTujuan);
            const unitMatch = hUnit === beratUnit;
            let tier = 4;
            if (destMatch && unitMatch && hTipe === 'regular') tier = 1;
            else if (destMatch) tier = 2;
            else if (unitMatch && hTipe === 'regular') tier = 3;

            const groupKey = `${hTipe}|${hHarga}|${hTipe === 'borongan' ? hJumlah : 0}|${hUnit}|${normalizeDestination(hTujuan)}`;
            const dateMs = toDateSafe(hd.tanggal || hd.createdAt).getTime();
            const existing = grouped.get(groupKey);
            if (existing) {
                existing.count += 1;
                if (tier < existing.tier) existing.tier = tier;
                if (dateMs >= existing.lastDateMs) {
                    existing.lastDateMs = dateMs;
                    existing.lastDateWib = toWibDateIso(hd.tanggal || hd.createdAt);
                    existing.lastNoSTT = String(hd.noSTT || '');
                    existing.isTaxable = Boolean(hd.isTaxable) || (Number(hd.ppn) || 0) > 0;
                }
            } else {
                grouped.set(groupKey, {
                    tier,
                    tipeTransaksi: hTipe,
                    harga: hTipe === 'regular' ? hHarga : 0,
                    jumlah: hTipe === 'borongan' ? (hJumlah > 0 ? hJumlah : hHarga) : hJumlah,
                    beratUnit: hUnit,
                    tujuan: hTujuan,
                    isTaxable: Boolean(hd.isTaxable) || (Number(hd.ppn) || 0) > 0,
                    count: 1,
                    lastDateMs: dateMs,
                    lastDateWib: toWibDateIso(hd.tanggal || hd.createdAt),
                    lastNoSTT: String(hd.noSTT || ''),
                });
            }
        }

        const ranked = Array.from(grouped.values()).sort(
            (a, b) => a.tier - b.tier || b.lastDateMs - a.lastDateMs || b.count - a.count
        );

        const best = ranked[0];
        let suggestedTipe: TipeTransaksi = best ? best.tipeTransaksi : 'regular';
        let suggestedHarga: number | null = null;
        let suggestedJumlah: number | null = null;
        let needsAttention: string | null = null;
        let priceSource: string | null = null;

        if (best) {
            priceSource = `Riwayat ${best.lastNoSTT || '-'} (${best.lastDateWib}, tujuan ${best.tujuan || '-'}, dipakai ${best.count}x)`;
            if (best.tipeTransaksi === 'borongan') {
                suggestedTipe = 'borongan';
                suggestedHarga = 0;
                suggestedJumlah = best.jumlah;
                needsAttention = 'Riwayat terakhir tipe borongan, mohon cek nominal total';
            } else {
                suggestedTipe = 'regular';
                suggestedHarga = best.harga;
                if (berat > 0) {
                    suggestedJumlah = Math.round(best.harga * berat);
                } else {
                    suggestedJumlah = 0;
                    needsAttention = 'Berat masih 0, perlu isi berat atau pakai harga borongan';
                }
            }
        } else {
            needsAttention = 'Belum ada riwayat harga untuk pengirim ini';
        }

        return {
            transactionId: id,
            noSTT: String(data.noSTT || ''),
            branch: String(data.branch || 'surabaya'),
            tanggalWib: toWibDateIso(data.tanggal),
            createdAtWib: toWibDateIso(data.createdAt || data.tanggal),
            pengirimName: senderName,
            penerimaName: String(data.penerimaName || ''),
            tujuan,
            koli,
            berat,
            beratUnit,
            isiBarang: String(data.isiBarang || ''),
            keterangan: String(data.keterangan || ''),
            currentHarga: Number(data.harga) || 0,
            currentJumlah: Number(data.jumlah) || 0,
            historicalIsTaxable: best ? best.isTaxable : Boolean(data.isTaxable),
            suggestedTipe,
            suggestedHarga,
            suggestedJumlah,
            priceSource,
            needsAttention,
            alternativePrices: ranked.slice(1, 4).map((alt) => ({
                tipeTransaksi: alt.tipeTransaksi,
                harga: alt.harga,
                jumlah: alt.jumlah,
                beratUnit: alt.beratUnit,
                tujuan: alt.tujuan,
                count: alt.count,
                lastDateWib: alt.lastDateWib,
                lastNoSTT: alt.lastNoSTT,
            })),
        };
    });

    return {
        totalPendingCount: pendingMatches.length,
        returnedCount: items.length,
        filterApplied: {
            startDate: startIso || null,
            endDate: endIso || null,
            onlyUnpriced,
            clientName: args.clientName || null,
            branch: branchFilter || null,
        },
        items,
    };
}

export async function toolListUnassignedStts(args: {
    statusFilter?: string;
    startDate?: string;
    endDate?: string;
    tujuan?: string;
    clientName?: string;
    branch?: string;
    limit?: number;
}) {
    const statusFilterRaw = String(args.statusFilter || 'pending').trim().toLowerCase();
    const statusFilter: 'pending' | 'dikirim' | 'all' =
        statusFilterRaw === 'dikirim' || statusFilterRaw === 'all' ? statusFilterRaw : 'pending';
    const startIso = /^\d{4}-\d{2}-\d{2}$/.test(String(args.startDate || '').trim())
        ? String(args.startDate).trim()
        : undefined;
    const endIso = /^\d{4}-\d{2}-\d{2}$/.test(String(args.endDate || '').trim())
        ? String(args.endDate).trim()
        : undefined;
    const tujuanQuery = (args.tujuan || '').trim();
    const clientQuery = (args.clientName || '').trim().toLowerCase();
    const branchFilter = args.branch ? normalizeBranch(args.branch) : undefined;
    const maxItems = Math.min(Math.max(1, Number(args.limit) || 30), 50);

    const [assignedMap, txSnap] = await Promise.all([
        collectAssignedTransactionIds(),
        adminDb.collection('transactions').get(),
    ]);

    const inDateRange = (dateWib: string) => {
        if (startIso && dateWib < startIso) return false;
        if (endIso && dateWib > endIso) return false;
        return true;
    };

    const unassignedActive = txSnap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .filter(({ id, data }) => {
            if (data.status === 'dibatalkan') return false;
            if (assignedMap.has(id)) return false;
            return true;
        });

    const unassignedPendingCount = unassignedActive.filter(
        ({ data }) => String(data.status || 'pending') === 'pending'
    ).length;
    const unassignedDikirimCount = unassignedActive.filter(
        ({ data }) => String(data.status || '') === 'dikirim'
    ).length;

    const filtered = unassignedActive
        .filter(({ data }) => {
            const st = String(data.status || 'pending');
            if (statusFilter === 'pending' && st !== 'pending') return false;
            if (statusFilter === 'dikirim' && st !== 'dikirim') return false;
            if (clientQuery && !String(data.pengirimName || '').toLowerCase().includes(clientQuery)) {
                return false;
            }
            if (tujuanQuery && !destinationsMatch(tujuanQuery, String(data.tujuan || ''))) {
                return false;
            }
            if (branchFilter && String(data.branch || 'surabaya').toLowerCase() !== branchFilter) {
                return false;
            }
            if (startIso || endIso) {
                const tanggalWib = toWibDateIso(data.tanggal);
                const createdAtWib = toWibDateIso(data.createdAt || data.tanggal);
                if (!inDateRange(tanggalWib) && !inDateRange(createdAtWib)) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const numA = parseInt(String(a.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(String(b.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
            return numA - numB;
        });

    const items = filtered.slice(0, maxItems).map(({ id, data }) => ({
        transactionId: id,
        noSTT: String(data.noSTT || ''),
        tanggalWib: toWibDateIso(data.tanggal),
        branch: String(data.branch || 'surabaya'),
        pengirimName: String(data.pengirimName || ''),
        penerimaName: String(data.penerimaName || ''),
        tujuan: String(data.tujuan || ''),
        koli: Number(data.koli) || 0,
        berat: Number(data.berat) || 0,
        beratUnit: String(data.beratUnit || 'KG'),
        harga: Number(data.harga) || 0,
        jumlah: Number(data.jumlah) || 0,
        status: String(data.status || 'pending'),
    }));

    return {
        totalMatching: filtered.length,
        unassignedPendingCount,
        unassignedDikirimCount,
        returnedCount: items.length,
        filterApplied: {
            statusFilter,
            startDate: startIso || null,
            endDate: endIso || null,
            tujuan: tujuanQuery || null,
            clientName: args.clientName || null,
            branch: branchFilter || null,
        },
        items,
    };
}

// ==========================================
// 2. WRITE PROPOSALS & EXECUTION (2-STEP CONFIRMATION)
// ==========================================

function buildCreateSttProposal(args: Record<string, any>): {
    pendingAction?: PendingAction;
    result: Record<string, unknown>;
} {
    const pengirimName = String(args.pengirimName || '').trim();
    const penerimaName = String(args.penerimaName || '').trim();
    const tujuan = String(args.tujuan || '').trim();

    if (!pengirimName || !penerimaName || !tujuan) {
        return {
            result: {
                ok: false,
                error: 'Data wajib belum lengkap. Pastikan pengirimName, penerimaName, dan tujuan sudah diisi.',
            },
        };
    }

    const branch = normalizeBranch(args.branch);
    const koli = Math.max(1, Math.round(Number(args.koli) || 1));
    const berat = Math.max(0, Number(args.berat) || 0);
    const beratUnit = normalizeBeratUnit(args.beratUnit);
    const tipeTransaksi = normalizeTipeTransaksi(args.tipeTransaksi);
    const harga = Math.max(0, Math.round(Number(args.harga) || 0));
    const explicitJumlah = Math.max(0, Math.round(Number(args.jumlah) || 0));
    const computedJumlah =
        explicitJumlah > 0
            ? explicitJumlah
            : tipeTransaksi === 'borongan'
              ? harga
              : Math.round((berat > 0 ? berat : koli) * harga);

    const pembayaran = normalizePembayaran(args.pembayaran);
    const pelunasan = normalizePelunasan(args.pelunasan, pembayaran);
    const isTaxable = Boolean(args.isTaxable);
    const todayIso = new Date().toISOString().slice(0, 10);
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(args.tanggal || ''))
        ? String(args.tanggal)
        : todayIso;

    const payload: CreateSttDraftPayload = {
        branch,
        tanggal,
        tujuan,
        pengirimName,
        ...(args.pengirimPhone ? { pengirimPhone: String(args.pengirimPhone).trim() } : {}),
        ...(args.pengirimAddress ? { pengirimAddress: String(args.pengirimAddress).trim() } : {}),
        ...(args.pengirimCity ? { pengirimCity: String(args.pengirimCity).trim() } : {}),
        penerimaName,
        ...(args.penerimaPhone ? { penerimaPhone: String(args.penerimaPhone).trim() } : {}),
        ...(args.penerimaAddress ? { penerimaAddress: String(args.penerimaAddress).trim() } : {}),
        ...(args.penerimaCity ? { penerimaCity: String(args.penerimaCity).trim() } : {}),
        koli,
        berat,
        beratUnit,
        tipeTransaksi,
        harga,
        jumlah: computedJumlah,
        pembayaran,
        pelunasan,
        isTaxable,
        ...(args.isiBarang ? { isiBarang: String(args.isiBarang).trim() } : {}),
        ...(args.keterangan ? { keterangan: String(args.keterangan).trim() } : {}),
        ...(args.noSTT ? { noSTT: String(args.noSTT).trim() } : {}),
    };

    const summaryText = [
        `• Cabang: ${BRANCHES[branch].displayName}`,
        `• Tanggal: ${tanggal}`,
        `• Pengirim: ${pengirimName}${payload.pengirimPhone ? ` (${payload.pengirimPhone})` : ''}`,
        `• Penerima: ${penerimaName}`,
        `• Tujuan: ${tujuan}`,
        `• Muatan: ${koli} Koli | ${berat} ${beratUnit}${payload.isiBarang ? ` | ${payload.isiBarang}` : ''}`,
        `• Tipe & Harga: ${tipeTransaksi.toUpperCase()} (${fmtRupiah(harga)})`,
        `• Total Tagihan: *${fmtRupiah(computedJumlah)}*${isTaxable ? ' (+ PPN 1.1%)' : ''}`,
        `• Pembayaran: ${pembayaran} / ${pelunasan}`,
    ].join('\n');

    return {
        pendingAction: {
            type: 'create_stt',
            summaryText,
            payload,
            createdAt: Date.now(),
        },
        result: {
            ok: true,
            status: 'MENUNGGU_KONFIRMASI',
            draftSummary: summaryText,
            instruction: 'Tampilkan draft ini kepada user dan minta user membalas YA untuk simpan atau BATAL.',
        },
    };
}

async function buildCreateInvoiceProposal(args: Record<string, any>): Promise<{
    pendingAction?: PendingAction;
    result: Record<string, unknown>;
}> {
    const clientNameInput = String(args.clientName || '').trim();
    const requestedStts: string[] = Array.isArray(args.noSTTs)
        ? args.noSTTs.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
    const requestedTxIds: string[] = Array.isArray(args.transactionIds)
        ? args.transactionIds.map((s) => String(s || '').trim()).filter(Boolean)
        : [];

    const snap = await adminDb.collection('transactions').get();
    const allDocs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));

    let matched = allDocs.filter(({ id, data }) => {
        if (data.status === 'dibatalkan' || data.invoiceId) return false;
        if (requestedTxIds.length > 0) {
            return requestedTxIds.includes(id);
        }
        if (requestedStts.length > 0) {
            const sttDigits = String(data.noSTT || '').replace(/\D/g, '');
            const sttUpper = String(data.noSTT || '').toUpperCase();
            return requestedStts.some((req) => {
                const reqDigits = req.replace(/\D/g, '');
                return sttUpper === req.toUpperCase() || (reqDigits !== '' && sttDigits === reqDigits);
            });
        }
        if (clientNameInput) {
            return (
                data.pelunasan === 'Pending' &&
                String(data.pengirimName || '').toLowerCase().includes(clientNameInput.toLowerCase())
            );
        }
        return false;
    });

    matched.sort((a, b) => {
        const numA = parseInt(String(a.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.data.noSTT || '').replace(/\D/g, ''), 10) || 0;
        return numA - numB;
    });

    if (matched.length === 0) {
        return {
            result: {
                ok: false,
                error: clientNameInput
                    ? `Tidak ditemukan STT status Pending yang belum dibuat invoice untuk pengirim "${clientNameInput}".`
                    : 'Tidak ditemukan STT valid yang belum dibuat invoice.',
            },
        };
    }

    const first = matched[0].data;
    const resolvedClientName = clientNameInput || String(first.pengirimName || 'Client Umum');
    const resolvedClientId = String(first.pengirimId || 'manual');
    const resolvedClientAddress = String(first.pengirimAddress || '');
    const resolvedClientPhone = String(first.pengirimPhone || '');

    const subtotal = matched.reduce((sum, item) => sum + (Number(item.data.jumlah) || 0), 0);
    const isTaxable = matched.some((item) => Boolean(item.data.isTaxable) || (Number(item.data.ppn) || 0) > 0);
    const ppn = isTaxable ? Math.round(subtotal * 0.011) : 0;
    const totalAmount = subtotal + ppn;

    const today = new Date();
    const due = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(args.issueDate || ''))
        ? String(args.issueDate)
        : today.toISOString().slice(0, 10);
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(args.dueDate || ''))
        ? String(args.dueDate)
        : due.toISOString().slice(0, 10);

    const noSTTs = matched.map((m) => String(m.data.noSTT || ''));
    const transactionIds = matched.map((m) => m.id);

    const payload: CreateInvoiceDraftPayload = {
        clientId: resolvedClientId,
        clientName: resolvedClientName,
        ...(resolvedClientAddress ? { clientAddress: resolvedClientAddress } : {}),
        ...(resolvedClientPhone ? { clientPhone: resolvedClientPhone } : {}),
        transactionIds,
        noSTTs,
        subtotal,
        ppn,
        totalAmount,
        isTaxable,
        issueDate,
        dueDate,
        ...(args.notes ? { notes: String(args.notes).trim() } : {}),
    };

    const summaryText = [
        `• Client: *${resolvedClientName}*${resolvedClientPhone ? ` (${resolvedClientPhone})` : ''}`,
        `• Jumlah Resi: ${matched.length} STT (${noSTTs.slice(0, 8).join(', ')}${noSTTs.length > 8 ? ` +${noSTTs.length - 8} lainnya` : ''})`,
        `• Tanggal Terbit: ${issueDate} | Jatuh Tempo: ${dueDate}`,
        `• Jenis: ${isTaxable ? 'Faktur Pajak (PKP + PPN 1.1%)' : 'Invoice Biasa (A5 Landscape)'}`,
        ...(isTaxable ? [`• Subtotal: ${fmtRupiah(subtotal)} | PPN 1.1%: ${fmtRupiah(ppn)}`] : []),
        `• Total Tagihan: *${fmtRupiah(totalAmount)}*`,
    ].join('\n');

    return {
        pendingAction: {
            type: 'create_invoice',
            summaryText,
            payload,
            createdAt: Date.now(),
        },
        result: {
            ok: true,
            status: 'MENUNGGU_KONFIRMASI',
            draftSummary: summaryText,
            instruction: 'Tampilkan ringkasan invoice ini dan minta user membalas YA untuk membuat invoice atau BATAL.',
        },
    };
}

export async function executeCreateStt(payload: CreateSttDraftPayload, actorName: string) {
    // 1. Lookup existing client before transaction
    const clientsSnap = await adminDb.collection('clients').get();
    const targetNameLower = payload.pengirimName.trim().toLowerCase();
    const existingClient = clientsSnap.docs.find(
        (doc) => String(doc.data()?.name || '').trim().toLowerCase() === targetNameLower
    );

    const branchInfo = BRANCHES[payload.branch];
    const sttCounterRef = adminDb.collection('metadata').doc('stt_counters');
    const invCounterRef = adminDb.collection('metadata').doc('invoice_counters');
    const invCounterKey = payload.isTaxable ? 'global_pkp' : 'global';

    const result = await adminDb.runTransaction(async (tx) => {
        // Phase 1: All reads first
        const sttCounterSnap = await tx.get(sttCounterRef);
        const invCounterSnap = await tx.get(invCounterRef);

        let sttNumber = payload.noSTT?.trim() || '';
        let nextSttNum: number | null = null;
        if (!sttNumber) {
            const counterData = sttCounterSnap.exists ? sttCounterSnap.data() || {} : {};
            const branchCounter = counterData[payload.branch] || {};
            const existingNum = Number(branchCounter.currentNumber) || branchInfo.initialCounter;
            nextSttNum = existingNum + 1;
            sttNumber = `STT${String(nextSttNum).padStart(6, '0')}`;
        }

        const invCounterData = invCounterSnap.exists ? invCounterSnap.data() || {} : {};
        const lastInvNum = payload.isTaxable
            ? Number(invCounterData[invCounterKey]?.currentNumber) || 5176
            : Number(invCounterData[invCounterKey]?.currentNumber) || 12365;
        const nextInvNum = lastInvNum + 1;
        const noInvoice = payload.isTaxable
            ? `INV-PKP${String(nextInvNum).padStart(5, '0')}`
            : `INV${String(nextInvNum).padStart(6, '0')}`;

        // Phase 2: Writes
        const now = admin.firestore.Timestamp.now();
        let pengirimId = existingClient?.id || '';
        let createdNewClient = false;

        if (!existingClient) {
            const newClientRef = adminDb.collection('clients').doc();
            pengirimId = newClientRef.id;
            createdNewClient = true;
            tx.set(newClientRef, {
                userId: 'wa-agent',
                name: payload.pengirimName,
                phone: payload.pengirimPhone || '',
                address: payload.pengirimAddress || '',
                city: payload.pengirimCity || '',
                notes: `Auto-created via WA AI Agent (${actorName})`,
                createdAt: now,
                updatedAt: now,
            });
        }

        if (nextSttNum !== null) {
            tx.set(
                sttCounterRef,
                {
                    [payload.branch]: {
                        currentNumber: nextSttNum,
                        prefix: 'STT',
                        branchName: branchInfo.displayName,
                        lastUpdated: now,
                    },
                },
                { merge: true }
            );
        }

        tx.set(
            invCounterRef,
            {
                [invCounterKey]: {
                    currentNumber: nextInvNum,
                    prefix: payload.isTaxable ? 'INV-PKP' : 'INV',
                    lastUpdated: now,
                },
            },
            { merge: true }
        );

        const tanggalTs = admin.firestore.Timestamp.fromDate(new Date(`${payload.tanggal}T08:00:00+07:00`));
        const ppn = payload.isTaxable ? Math.round(payload.jumlah * 0.011) : 0;

        const newTxRef = adminDb.collection('transactions').doc();
        const txDoc = stripUndefined({
            userId: 'wa-agent',
            branch: payload.branch,
            tanggal: tanggalTs,
            tujuan: payload.tujuan,
            noSTT: sttNumber,
            pengirimId,
            pengirimName: payload.pengirimName,
            pengirimPhone: payload.pengirimPhone || existingClient?.data()?.phone || '',
            pengirimAddress: payload.pengirimAddress || existingClient?.data()?.address || '',
            pengirimCity: payload.pengirimCity || existingClient?.data()?.city || '',
            penerimaId: '',
            penerimaName: payload.penerimaName,
            penerimaPhone: payload.penerimaPhone || '',
            penerimaAddress: payload.penerimaAddress || '',
            penerimaCity: payload.penerimaCity || '',
            koli: payload.koli,
            berat: payload.berat,
            beratUnit: payload.beratUnit,
            tipeTransaksi: payload.tipeTransaksi,
            harga: payload.harga,
            jumlah: payload.jumlah,
            isTaxable: payload.isTaxable,
            ppnRate: payload.isTaxable ? 0.011 : 0,
            ppn,
            noInvoice,
            pembayaran: payload.pembayaran,
            pelunasan: payload.pelunasan,
            keterangan: payload.keterangan || '',
            isiBarang: payload.isiBarang || '',
            status: 'pending',
            statusHistory: [
                {
                    status: 'pending',
                    timestamp: now,
                    catatan: `Dibuat via WA AI Agent oleh ${actorName}`,
                },
            ],
            createdAt: now,
            updatedAt: now,
        });

        tx.set(newTxRef, txDoc);

        return {
            id: newTxRef.id,
            noSTT: sttNumber,
            jumlah: payload.jumlah,
            pengirimName: payload.pengirimName,
            createdNewClient,
        };
    });

    return result;
}

export async function executeCreateInvoice(payload: CreateInvoiceDraftPayload, actorName: string) {
    const counterRef = adminDb.collection('metadata').doc('invoice_gen_counters');
    const newInvoiceRef = adminDb.collection('invoices').doc();
    const txIds = Array.from(new Set(payload.transactionIds.filter(Boolean)));

    const created = await adminDb.runTransaction(async (tx) => {
        // Phase 1: Reads
        const counterSnap = await tx.get(counterRef);
        const txRefs = txIds.map((tid) => adminDb.collection('transactions').doc(tid));
        const txSnaps = await Promise.all(txRefs.map((ref) => tx.get(ref)));

        const existingTxs: Array<{ ref: admin.firestore.DocumentReference; data: Record<string, any> }> = [];
        for (const snap of txSnaps) {
            if (!snap.exists) continue;
            const d = snap.data() || {};
            if (d.invoiceId) {
                throw new Error(`STT ${d.noSTT || snap.id} sudah tertaut ke invoice ${d.invoiceNumber || d.invoiceId}`);
            }
            existingTxs.push({ ref: snap.ref, data: d });
        }

        if (existingTxs.length === 0) {
            throw new Error('Tidak ada transaksi valid untuk dibuatkan invoice.');
        }

        const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
        let currentNumber = Number(counterData.global_invoice_number) || 0;
        if (currentNumber < 12702) currentNumber = 12702;
        const nextNumber = currentNumber + 1;
        const invoiceNumber = String(nextNumber);

        const subtotal = existingTxs.reduce((sum, item) => sum + (Number(item.data.jumlah) || 0), 0);
        const isTaxable =
            payload.isTaxable || existingTxs.some((item) => Boolean(item.data.isTaxable) || (Number(item.data.ppn) || 0) > 0);
        const totalAmount = subtotal + (isTaxable ? Math.round(subtotal * 0.011) : 0);

        const now = admin.firestore.Timestamp.now();
        const invoiceDoc = stripUndefined({
            userId: 'wa-agent',
            invoiceNumber,
            clientId: payload.clientId || 'manual',
            clientName: payload.clientName,
            clientAddress: payload.clientAddress || '',
            transactionIds: existingTxs.map((item) => item.ref.id),
            totalAmount,
            issueDate: admin.firestore.Timestamp.fromDate(new Date(`${payload.issueDate}T08:00:00+07:00`)),
            dueDate: admin.firestore.Timestamp.fromDate(new Date(`${payload.dueDate}T08:00:00+07:00`)),
            status: 'Unpaid',
            isTaxable,
            notes: payload.notes ? `${payload.notes} (via WA Agent: ${actorName})` : undefined,
            createdAt: now,
            updatedAt: now,
        });

        // Phase 2: Writes
        tx.set(counterRef, { global_invoice_number: nextNumber, lastUpdated: now }, { merge: true });
        tx.set(newInvoiceRef, invoiceDoc);
        for (const item of existingTxs) {
            tx.update(item.ref, {
                invoiceId: newInvoiceRef.id,
                invoiceNumber,
                invoiceStatus: 'Unpaid',
                updatedAt: now,
            });
        }

        return {
            id: newInvoiceRef.id,
            invoiceNumber,
            totalAmount,
            clientName: payload.clientName,
            sttCount: existingTxs.length,
        };
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return {
        ...created,
        printUrl: `${appUrl}/finance/invoices/${created.id}/print`,
    };
}

async function buildBatchUpdateSttPricingProposal(args: Record<string, any>): Promise<{
    pendingAction?: PendingAction;
    result: Record<string, unknown>;
}> {
    const rawItems = Array.isArray(args.items) ? args.items : [];
    if (rawItems.length === 0) {
        return {
            result: {
                ok: false,
                error: 'Daftar STT (items) tidak boleh kosong.',
            },
        };
    }

    const defaultTargetStatus = normalizeTargetStatus(args.targetStatus);
    const snap = await adminDb.collection('transactions').get();
    const docById = new Map<string, { id: string; data: Record<string, any> }>();
    const docBySttUpper = new Map<string, { id: string; data: Record<string, any> }>();
    const docBySttDigits = new Map<string, { id: string; data: Record<string, any> }>();

    for (const doc of snap.docs) {
        const data = doc.data() || {};
        const entry = { id: doc.id, data };
        docById.set(doc.id, entry);
        const sttUpper = String(data.noSTT || '').trim().toUpperCase();
        if (sttUpper) docBySttUpper.set(sttUpper, entry);
        const digits = sttUpper.replace(/\D/g, '');
        if (digits) docBySttDigits.set(digits, entry);
    }

    const seenIds = new Set<string>();
    const validItems: BatchUpdateSttPricingItem[] = [];
    const skippedNeedsPrice: Array<{ noSTT: string; pengirimName: string; reason: string }> = [];
    const notFound: string[] = [];

    for (const raw of rawItems) {
        if (!raw || typeof raw !== 'object') continue;
        const reqTxId = String(raw.transactionId || '').trim();
        const reqNoStt = String(raw.noSTT || '').trim();
        const reqUpper = reqNoStt.toUpperCase();
        const reqDigits = reqUpper.replace(/\D/g, '');

        const match =
            (reqTxId ? docById.get(reqTxId) : undefined) ||
            (reqUpper ? docBySttUpper.get(reqUpper) : undefined) ||
            (reqDigits ? docBySttDigits.get(reqDigits) : undefined);

        if (!match) {
            notFound.push(reqNoStt || reqTxId || '(tanpa nomor)');
            continue;
        }
        if (match.data.status === 'dibatalkan') {
            notFound.push(`${match.data.noSTT || match.id} (status dibatalkan)`);
            continue;
        }
        if (seenIds.has(match.id)) continue;
        seenIds.add(match.id);

        const td = match.data;
        const beratUnit = raw.beratUnit ? normalizeBeratUnit(raw.beratUnit) : normalizeBeratUnit(td.beratUnit);
        const berat = raw.berat !== undefined ? Math.max(0, Number(raw.berat) || 0) : Math.max(0, Number(td.berat) || 0);
        const koli = Math.max(1, Math.round(Number(td.koli) || 1));
        const tipeTransaksi = raw.tipeTransaksi
            ? normalizeTipeTransaksi(raw.tipeTransaksi)
            : normalizeTipeTransaksi(td.tipeTransaksi);
        const inputHarga = Math.max(0, Math.round(Number(raw.harga) || 0));
        const inputJumlah = Math.max(0, Math.round(Number(raw.jumlah) || 0));

        let finalHarga = 0;
        let finalJumlah = 0;

        if (tipeTransaksi === 'borongan') {
            finalJumlah = inputJumlah > 0 ? inputJumlah : inputHarga;
            finalHarga = 0;
        } else {
            finalHarga = inputHarga;
            finalJumlah = inputJumlah > 0 ? inputJumlah : Math.round(finalHarga * berat);
        }

        const noSTT = String(td.noSTT || reqNoStt || match.id);
        const pengirimName = String(td.pengirimName || '-');

        if (finalJumlah <= 0) {
            skippedNeedsPrice.push({
                noSTT,
                pengirimName,
                reason:
                    berat <= 0 && tipeTransaksi === 'regular'
                        ? `Berat masih 0${finalHarga > 0 ? ` (tarif ${fmtRupiah(finalHarga)}/${beratUnit})` : ''}`
                        : 'Harga / nominal belum terisi',
            });
            continue;
        }

        const newStatus = raw.newStatus ? normalizeTargetStatus(raw.newStatus) : defaultTargetStatus;
        const isTaxable = raw.isTaxable !== undefined ? Boolean(raw.isTaxable) : Boolean(td.isTaxable);

        validItems.push({
            transactionId: match.id,
            noSTT,
            pengirimName,
            penerimaName: String(td.penerimaName || '-'),
            tujuan: String(td.tujuan || '-'),
            koli,
            berat,
            beratUnit,
            tipeTransaksi,
            harga: finalHarga,
            jumlah: finalJumlah,
            isTaxable,
            newStatus,
            ...(raw.priceSource ? { priceSource: String(raw.priceSource).trim() } : {}),
        });
    }

    if (validItems.length === 0) {
        return {
            result: {
                ok: false,
                error: 'Tidak ada STT yang siap diproses karena harga atau berat masih kosong.',
                skippedNeedsPrice,
                notFound,
            },
        };
    }

    const totalNominal = validItems.reduce((sum, item) => sum + item.jumlah, 0);
    const lines = validItems.map((item, idx) => {
        const priceDesc =
            item.tipeTransaksi === 'borongan'
                ? `Borongan -> *${fmtRupiah(item.jumlah)}*`
                : `${fmtRupiah(item.harga)}/${item.beratUnit} × ${item.berat} = *${fmtRupiah(item.jumlah)}*`;
        const srcLine = item.priceSource ? `\n   _Sumber: ${item.priceSource}_` : '';
        return `${idx + 1}. *${item.noSTT}* | ${item.pengirimName} → ${item.tujuan} (${item.koli} koli, ${item.berat} ${item.beratUnit})\n   Harga: ${priceDesc} | Status → *${item.newStatus}*${srcLine}`;
    });

    if (skippedNeedsPrice.length > 0) {
        lines.push('');
        lines.push('⚠️ *Belum masuk proses (perlu input manual/revisi):*');
        for (const s of skippedNeedsPrice) {
            lines.push(`• ${s.noSTT} (${s.pengirimName}): ${s.reason}`);
        }
    }

    lines.push('');
    lines.push(`• Jumlah diproses: *${validItems.length} STT* | Total Nilai: *${fmtRupiah(totalNominal)}*`);

    const summaryText = lines.join('\n');
    const payload: BatchUpdateSttPricingDraftPayload = {
        items: validItems,
        targetStatus: defaultTargetStatus,
    };

    return {
        pendingAction: {
            type: 'batch_update_stt_pricing',
            summaryText,
            payload,
            createdAt: Date.now(),
        },
        result: {
            ok: true,
            status: 'MENUNGGU_KONFIRMASI',
            processedCount: validItems.length,
            totalNominal,
            skippedNeedsPrice,
            notFound,
            draftSummary: summaryText,
            instruction:
                'Tampilkan daftar usulan harga & status ini kepada user. Minta user membalas "YA" / "Sudah benar" untuk memproses, mengirim revisi jika ada harga yang ingin diubah, atau "BATAL" untuk membatalkan.',
        },
    };
}

export async function executeBatchUpdateSttPricing(
    payload: BatchUpdateSttPricingDraftPayload,
    actorName: string
) {
    const uniqueItems: BatchUpdateSttPricingItem[] = [];
    const seen = new Set<string>();
    for (const item of payload.items) {
        if (!item.transactionId || seen.has(item.transactionId)) continue;
        seen.add(item.transactionId);
        uniqueItems.push(item);
    }

    const updatedItems: Array<{
        transactionId: string;
        noSTT: string;
        pengirimName: string;
        jumlah: number;
        newStatus: StatusTransaksi;
        invoiceId?: string;
    }> = [];
    const skippedItems: Array<{ noSTT: string; reason: string }> = [];
    const linkedInvoiceIds = new Set<string>();

    await adminDb.runTransaction(async (tx) => {
        // Phase 1: All reads first
        const refs = uniqueItems.map((item) => adminDb.collection('transactions').doc(item.transactionId));
        const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

        // Phase 2: All writes
        const now = admin.firestore.Timestamp.now();
        for (let i = 0; i < uniqueItems.length; i++) {
            const item = uniqueItems[i];
            const snap = snaps[i];
            if (!snap.exists) {
                skippedItems.push({ noSTT: item.noSTT, reason: 'Dokumen transaksi tidak ditemukan' });
                continue;
            }

            const current = snap.data() || {};
            if (current.status === 'dibatalkan') {
                skippedItems.push({ noSTT: item.noSTT, reason: 'Transaksi berstatus dibatalkan' });
                continue;
            }

            const isTaxable = item.isTaxable !== undefined ? item.isTaxable : Boolean(current.isTaxable);
            const ppnRate = isTaxable ? Number(current.ppnRate) || 0.011 : 0;
            const ppn = isTaxable ? Math.round(item.jumlah * ppnRate) : 0;

            const updates: Record<string, unknown> = {
                tipeTransaksi: item.tipeTransaksi,
                harga: item.harga,
                jumlah: item.jumlah,
                berat: item.berat,
                beratUnit: item.beratUnit,
                isTaxable,
                ppnRate,
                ppn,
                updatedAt: now,
            };

            if (current.status !== item.newStatus) {
                const existingHistory = Array.isArray(current.statusHistory) ? current.statusHistory : [];
                updates.status = item.newStatus;
                updates.statusHistory = [
                    ...existingHistory,
                    {
                        status: item.newStatus,
                        timestamp: now,
                        catatan: `Harga diisi & status diubah via WA AI Agent oleh ${actorName}`,
                    },
                ];
            }

            tx.update(snap.ref, updates);

            const invoiceId = typeof current.invoiceId === 'string' && current.invoiceId ? current.invoiceId : undefined;
            if (invoiceId) linkedInvoiceIds.add(invoiceId);

            updatedItems.push({
                transactionId: item.transactionId,
                noSTT: String(current.noSTT || item.noSTT),
                pengirimName: String(current.pengirimName || item.pengirimName),
                jumlah: item.jumlah,
                newStatus: item.newStatus,
                invoiceId,
            });
        }
    });

    // Sinkronkan invoice jika ada transaksi yang sudah tertaut ke invoice
    for (const invoiceId of linkedInvoiceIds) {
        try {
            const invRef = adminDb.collection('invoices').doc(invoiceId);
            const invSnap = await invRef.get();
            if (!invSnap.exists) continue;
            const invData = invSnap.data() || {};
            const txIds: string[] = Array.isArray(invData.transactionIds) ? invData.transactionIds.filter(Boolean) : [];
            if (txIds.length === 0) continue;

            const txRefs = txIds.map((tid) => adminDb.collection('transactions').doc(tid));
            const txSnaps = await adminDb.getAll(...txRefs);
            const subtotal = txSnaps.reduce((sum, s) => sum + (s.exists ? Number(s.data()?.jumlah) || 0 : 0), 0);
            const invTaxable = Boolean(invData.isTaxable);
            const totalAmount = subtotal + (invTaxable ? Math.round(subtotal * 0.011) : 0);

            await invRef.update({
                totalAmount,
                updatedAt: admin.firestore.Timestamp.now(),
            });
        } catch (err) {
            console.warn('[WA Agent] Failed syncing linked invoice after batch pricing update:', invoiceId, err);
        }
    }

    const totalNominal = updatedItems.reduce((sum, item) => sum + item.jumlah, 0);
    return {
        updatedCount: updatedItems.length,
        totalNominal,
        updatedItems,
        skippedItems,
    };
}

// ==========================================
// 2C. DIRECT EXECUTION TOOLS (STT & INVOICE TANPA KONFIRMASI)
// ==========================================

async function toolCreateSttDirect(args: Record<string, any>, actorName: string) {
    const built = buildCreateSttProposal(args);
    if (!built.pendingAction || built.pendingAction.type !== 'create_stt') {
        return { result: built.result };
    }
    const created = await executeCreateStt(built.pendingAction.payload, actorName);
    return {
        result: {
            ok: true,
            executed: true,
            transactionId: created.id,
            noSTT: created.noSTT,
            pengirimName: created.pengirimName,
            createdNewClient: created.createdNewClient,
            jumlah: created.jumlah,
            summary: built.pendingAction.summaryText,
        },
    };
}

async function toolUpdateSttDirect(args: Record<string, any>, actorName: string) {
    const reqId = String(args.transactionId || '').trim();
    const reqNo = String(args.noSTT || '').trim();
    if (!reqId && !reqNo) {
        return { result: { ok: false, error: 'Sebutkan nomor STT atau transactionId.' } };
    }

    const snap = await adminDb.collection('transactions').get();
    const reqUpper = reqNo.toUpperCase();
    const reqDigits = reqUpper.replace(/\D/g, '');

    const match = snap.docs.find((doc) => {
        if (reqId && doc.id === reqId) return true;
        const sttUpper = String(doc.data()?.noSTT || '').trim().toUpperCase();
        if (reqUpper && sttUpper === reqUpper) return true;
        const sttDigits = sttUpper.replace(/\D/g, '');
        return Boolean(reqDigits && sttDigits === reqDigits);
    });

    if (!match) {
        return { result: { ok: false, error: `STT "${reqNo || reqId}" tidak ditemukan.` } };
    }

    const current = match.data() || {};
    const updates: Record<string, unknown> = {
        updatedAt: admin.firestore.Timestamp.now(),
    };

    const nextKoli = args.koli !== undefined ? Math.max(1, Math.round(Number(args.koli) || 1)) : Number(current.koli) || 1;
    const nextBerat = args.berat !== undefined ? Math.max(0, Number(args.berat) || 0) : Number(current.berat) || 0;
    const nextBeratUnit = args.beratUnit ? normalizeBeratUnit(args.beratUnit) : normalizeBeratUnit(current.beratUnit);
    const nextTipe = args.tipeTransaksi ? normalizeTipeTransaksi(args.tipeTransaksi) : normalizeTipeTransaksi(current.tipeTransaksi);
    const nextHarga = args.harga !== undefined ? Math.max(0, Math.round(Number(args.harga) || 0)) : Number(current.harga) || 0;

    if (args.koli !== undefined) updates.koli = nextKoli;
    if (args.berat !== undefined) updates.berat = nextBerat;
    if (args.beratUnit !== undefined) updates.beratUnit = nextBeratUnit;
    if (args.tipeTransaksi !== undefined) updates.tipeTransaksi = nextTipe;
    if (args.harga !== undefined) updates.harga = nextTipe === 'borongan' ? 0 : nextHarga;

    let nextJumlah = Number(current.jumlah) || 0;
    if (args.jumlah !== undefined) {
        nextJumlah = Math.max(0, Math.round(Number(args.jumlah) || 0));
        if (nextTipe === 'borongan') updates.harga = 0;
    } else if (nextTipe === 'borongan' && args.harga !== undefined) {
        nextJumlah = nextHarga;
        updates.harga = 0;
    } else if (
        nextTipe === 'regular' &&
        (args.harga !== undefined || args.berat !== undefined || args.koli !== undefined || args.tipeTransaksi !== undefined)
    ) {
        nextJumlah = Math.round((nextBerat > 0 ? nextBerat : nextKoli) * nextHarga);
    }
    updates.jumlah = nextJumlah;

    const nextIsTaxable = args.isTaxable !== undefined ? Boolean(args.isTaxable) : Boolean(current.isTaxable);
    const ppnRate = nextIsTaxable ? Number(current.ppnRate) || 0.011 : 0;
    updates.isTaxable = nextIsTaxable;
    updates.ppnRate = ppnRate;
    updates.ppn = nextIsTaxable ? Math.round(nextJumlah * ppnRate) : 0;

    if (args.tujuan !== undefined) updates.tujuan = String(args.tujuan).trim();
    if (args.pengirimName !== undefined) updates.pengirimName = String(args.pengirimName).trim();
    if (args.penerimaName !== undefined) updates.penerimaName = String(args.penerimaName).trim();
    if (args.isiBarang !== undefined) updates.isiBarang = String(args.isiBarang).trim();
    if (args.keterangan !== undefined) updates.keterangan = String(args.keterangan).trim();
    if (args.pembayaran !== undefined) updates.pembayaran = normalizePembayaran(args.pembayaran);
    if (args.pelunasan !== undefined) {
        updates.pelunasan = normalizePelunasan(args.pelunasan, (updates.pembayaran as MetodePembayaran) || current.pembayaran);
    }
    if (args.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(String(args.tanggal).trim())) {
        updates.tanggal = admin.firestore.Timestamp.fromDate(new Date(`${String(args.tanggal).trim()}T08:00:00+07:00`));
    }
    if (args.noSTTNew && String(args.noSTTNew).trim()) {
        updates.noSTT = String(args.noSTTNew).trim().toUpperCase();
    }

    let nextStatus = String(current.status || 'pending');
    if (args.status !== undefined) {
        const stRaw = String(args.status).trim().toLowerCase();
        if (['pending', 'diproses', 'dikirim', 'selesai', 'dibatalkan'].includes(stRaw)) {
            nextStatus = stRaw;
            if (stRaw !== current.status) {
                const hist = Array.isArray(current.statusHistory) ? current.statusHistory : [];
                updates.status = stRaw;
                updates.statusHistory = [
                    ...hist,
                    {
                        status: stRaw,
                        timestamp: admin.firestore.Timestamp.now(),
                        catatan: `Diubah via WA AI Agent oleh ${actorName}`,
                    },
                ];
            }
        }
    }

    await match.ref.update(updates);

    // Sinkronkan invoice jika STT ini sudah tertaut
    if (typeof current.invoiceId === 'string' && current.invoiceId) {
        try {
            const invRef = adminDb.collection('invoices').doc(current.invoiceId);
            const invSnap = await invRef.get();
            if (invSnap.exists) {
                const invData = invSnap.data() || {};
                const txIds: string[] = Array.isArray(invData.transactionIds) ? invData.transactionIds.filter(Boolean) : [];
                if (txIds.length > 0) {
                    const txRefs = txIds.map((tid) => adminDb.collection('transactions').doc(tid));
                    const txSnaps = await adminDb.getAll(...txRefs);
                    const sub = txSnaps.reduce((s, sn) => s + (sn.exists ? Number(sn.data()?.jumlah) || 0 : 0), 0);
                    const invTax = Boolean(invData.isTaxable);
                    await invRef.update({
                        totalAmount: sub + (invTax ? Math.round(sub * 0.011) : 0),
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                }
            }
        } catch (err) {
            console.warn('[WA Agent] Failed syncing linked invoice in update_stt:', err);
        }
    }

    return {
        result: {
            ok: true,
            executed: true,
            transactionId: match.id,
            noSTT: String(updates.noSTT || current.noSTT),
            pengirimName: String(updates.pengirimName || current.pengirimName || ''),
            tujuan: String(updates.tujuan || current.tujuan || ''),
            koli: nextKoli,
            berat: nextBerat,
            beratUnit: nextBeratUnit,
            tipeTransaksi: nextTipe,
            harga: updates.harga !== undefined ? Number(updates.harga) : nextHarga,
            jumlah: nextJumlah,
            status: nextStatus,
        },
    };
}

async function toolBatchUpdateSttPricingDirect(args: Record<string, any>, actorName: string) {
    const rawItems = Array.isArray(args.items) ? args.items : [];
    const defaultTargetStatus = normalizeTargetStatus(args.targetStatus);

    // Expand item yang dikirim berbasis customerName jika tidak menyebut noSTT/transactionId
    const expandedItems: any[] = [];
    let cachedSnapDocs: Array<{ id: string; data: Record<string, any> }> | null = null;

    for (const raw of rawItems) {
        if (!raw || typeof raw !== 'object') continue;
        if (raw.noSTT || raw.transactionId) {
            expandedItems.push(raw);
            continue;
        }
        const custQ = String(raw.customerName || raw.pengirimName || '').trim().toLowerCase();
        if (!custQ) continue;

        if (!cachedSnapDocs) {
            const snap = await adminDb.collection('transactions').get();
            cachedSnapDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
        }
        const matches = cachedSnapDocs.filter(({ data }) => {
            if (String(data.status || 'pending') !== 'pending') return false;
            return String(data.pengirimName || '').toLowerCase().includes(custQ);
        });
        for (const m of matches) {
            expandedItems.push({
                ...raw,
                transactionId: m.id,
                noSTT: String(m.data.noSTT || m.id),
            });
        }
    }

    const built = await buildBatchUpdateSttPricingProposal({
        ...args,
        items: expandedItems,
        targetStatus: defaultTargetStatus,
    });

    if (!built.pendingAction || built.pendingAction.type !== 'batch_update_stt_pricing') {
        return { result: built.result };
    }

    const res = await executeBatchUpdateSttPricing(built.pendingAction.payload, actorName);
    return {
        result: {
            ok: true,
            executed: true,
            updatedCount: res.updatedCount,
            totalNominal: res.totalNominal,
            updatedItems: res.updatedItems,
            skippedItems: res.skippedItems,
            skippedNeedsPrice: (built.result as any).skippedNeedsPrice || [],
            notFound: (built.result as any).notFound || [],
        },
    };
}

async function toolDeleteSttDirect(args: Record<string, any>, actorName: string) {
    void actorName;
    const reqIds = Array.isArray(args.transactionIds) ? args.transactionIds.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
    if (args.transactionId) reqIds.push(String(args.transactionId).trim());
    const reqStts = Array.isArray(args.noSTTs) ? args.noSTTs.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
    if (args.noSTT) reqStts.push(String(args.noSTT).trim());

    if (reqIds.length === 0 && reqStts.length === 0) {
        return { result: { ok: false, error: 'Sebutkan nomor STT atau transactionId yang akan dihapus.' } };
    }

    const txSnap = await adminDb.collection('transactions').get();
    const toDelete: Array<{ id: string; noSTT: string; invoiceId?: string }> = [];
    const seen = new Set<string>();

    for (const doc of txSnap.docs) {
        const d = doc.data() || {};
        const sttUpper = String(d.noSTT || '').trim().toUpperCase();
        const sttDigits = sttUpper.replace(/\D/g, '');

        const hitById = reqIds.includes(doc.id);
        const hitByStt = reqStts.some((req) => {
            const u = req.toUpperCase();
            const dig = u.replace(/\D/g, '');
            return u === sttUpper || (dig !== '' && dig === sttDigits);
        });

        if ((hitById || hitByStt) && !seen.has(doc.id)) {
            seen.add(doc.id);
            toDelete.push({
                id: doc.id,
                noSTT: String(d.noSTT || doc.id),
                invoiceId: typeof d.invoiceId === 'string' && d.invoiceId ? d.invoiceId : undefined,
            });
        }
    }

    if (toDelete.length === 0) {
        return { result: { ok: false, error: 'STT yang ingin dihapus tidak ditemukan.' } };
    }

    const deletedIds = new Set(toDelete.map((t) => t.id));
    const affectedInvoices = new Set(toDelete.map((t) => t.invoiceId).filter((v): v is string => Boolean(v)));

    // Hapus dokumen transaksi
    await Promise.all(toDelete.map((t) => adminDb.collection('transactions').doc(t.id).delete()));

    // Bersihkan dari voyages yang menautkan transaksi ini
    const voyagesSnap = await adminDb.collection('voyages').get();
    for (const vDoc of voyagesSnap.docs) {
        const txIds: string[] = Array.isArray(vDoc.data()?.transactionIds) ? vDoc.data()!.transactionIds : [];
        if (txIds.some((tid) => deletedIds.has(tid))) {
            await vDoc.ref.update({
                transactionIds: txIds.filter((tid) => !deletedIds.has(tid)),
                updatedAt: admin.firestore.Timestamp.now(),
            });
        }
    }

    // Bersihkan & hitung ulang invoice yang menautkan transaksi ini
    for (const invId of affectedInvoices) {
        try {
            const invRef = adminDb.collection('invoices').doc(invId);
            const invSnap = await invRef.get();
            if (!invSnap.exists) continue;
            const invData = invSnap.data() || {};
            const remainingIds: string[] = (Array.isArray(invData.transactionIds) ? invData.transactionIds : []).filter(
                (tid: string) => tid && !deletedIds.has(tid)
            );
            let sub = 0;
            if (remainingIds.length > 0) {
                const refs = remainingIds.map((tid) => adminDb.collection('transactions').doc(tid));
                const snaps = await adminDb.getAll(...refs);
                sub = snaps.reduce((s, sn) => s + (sn.exists ? Number(sn.data()?.jumlah) || 0 : 0), 0);
            }
            const invTax = Boolean(invData.isTaxable);
            await invRef.update({
                transactionIds: remainingIds,
                totalAmount: sub + (invTax ? Math.round(sub * 0.011) : 0),
                updatedAt: admin.firestore.Timestamp.now(),
            });
        } catch (err) {
            console.warn('[WA Agent] Failed updating invoice after delete_stt:', invId, err);
        }
    }

    return {
        result: {
            ok: true,
            executed: true,
            deletedCount: toDelete.length,
            deletedSTTs: toDelete.map((t) => t.noSTT),
        },
    };
}

async function findInvoiceDocByArgs(args: Record<string, any>) {
    const reqId = String(args.invoiceId || '').trim();
    const reqNum = String(args.invoiceNumber || '').trim();
    const reqClient = String(args.clientName || '').trim().toLowerCase();

    if (reqId) {
        const snap = await adminDb.collection('invoices').doc(reqId).get();
        if (snap.exists) return { id: snap.id, ref: snap.ref, data: snap.data() || {} };
        return null;
    }

    const snap = await adminDb.collection('invoices').get();
    const docs = snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }));

    if (reqNum) {
        const reqUpper = reqNum.toUpperCase();
        const reqDigits = reqUpper.replace(/\D/g, '');
        const hit = docs.find(({ data }) => {
            const invNo = String(data.invoiceNumber || '').trim().toUpperCase();
            if (invNo === reqUpper) return true;
            const invDigits = invNo.replace(/\D/g, '');
            return Boolean(reqDigits && invDigits === reqDigits);
        });
        if (hit) return hit;
    }

    if (reqClient) {
        const matches = docs
            .filter(({ data }) => String(data.clientName || '').toLowerCase().includes(reqClient))
            .sort((a, b) => {
                const ta = toDateSafe(a.data.createdAt || a.data.issueDate).getTime();
                const tb = toDateSafe(b.data.createdAt || b.data.issueDate).getTime();
                return tb - ta;
            });
        if (matches.length > 0) return matches[0];
    }

    return null;
}

async function toolCreateInvoiceDirect(
    args: Record<string, any>,
    actorName: string
): Promise<{ result: Record<string, unknown>; replyMedia?: ReplyMediaItem[] }> {
    const built = await buildCreateInvoiceProposal(args);
    if (!built.pendingAction || built.pendingAction.type !== 'create_invoice') {
        return { result: built.result };
    }

    const inv = await executeCreateInvoice(built.pendingAction.payload, actorName);
    let replyMedia: ReplyMediaItem[] | undefined;
    try {
        const rendered = await renderInvoicePngById(inv.id);
        replyMedia = [
            {
                base64: rendered.base64,
                mimeType: rendered.mimeType,
                filename: rendered.filename,
            },
        ];
    } catch (err) {
        console.error('[WA Agent] Failed rendering PNG in create_invoice:', err);
    }

    return {
        result: {
            ok: true,
            executed: true,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            clientName: inv.clientName,
            sttCount: inv.sttCount,
            totalAmount: inv.totalAmount,
            printUrl: inv.printUrl,
            imageAttached: Boolean(replyMedia?.length),
        },
        replyMedia,
    };
}

async function toolUpdateInvoiceDirect(
    args: Record<string, any>,
    actorName: string
): Promise<{ result: Record<string, unknown>; replyMedia?: ReplyMediaItem[] }> {
    const found = await findInvoiceDocByArgs(args);
    if (!found) {
        return {
            result: {
                ok: false,
                error: 'Invoice tidak ditemukan. Sebutkan nomor invoice atau nama client.',
            },
        };
    }

    const invData = found.data;
    const allTxSnap = await adminDb.collection('transactions').get();
    const txById = new Map(allTxSnap.docs.map((d) => [d.id, { id: d.id, ref: d.ref, data: d.data() || {} }]));
    const txBySttUpper = new Map<string, { id: string; ref: admin.firestore.DocumentReference; data: Record<string, any> }>();
    const txBySttDigits = new Map<string, { id: string; ref: admin.firestore.DocumentReference; data: Record<string, any> }>();

    for (const d of txById.values()) {
        const upper = String(d.data.noSTT || '').trim().toUpperCase();
        if (upper) txBySttUpper.set(upper, d);
        const dig = upper.replace(/\D/g, '');
        if (dig) txBySttDigits.set(dig, d);
    }

    const matchSttList = (list: unknown): string[] => {
        if (!Array.isArray(list)) return [];
        const out: string[] = [];
        for (const raw of list) {
            const s = String(raw || '').trim();
            if (!s) continue;
            const upper = s.toUpperCase();
            const dig = upper.replace(/\D/g, '');
            const hit = txById.get(s) || txBySttUpper.get(upper) || (dig ? txBySttDigits.get(dig) : undefined);
            if (hit) out.push(hit.id);
        }
        return out;
    };

    const currentIds = new Set<string>(Array.isArray(invData.transactionIds) ? invData.transactionIds.filter(Boolean) : []);
    const addIds = matchSttList(args.addNoSTTs);
    const removeIds = new Set(matchSttList(args.removeNoSTTs));

    for (const rId of removeIds) currentIds.delete(rId);
    for (const aId of addIds) currentIds.add(aId);

    const finalTxIds = Array.from(currentIds);
    const nextInvoiceNumber = args.invoiceNumberNew
        ? String(args.invoiceNumberNew).trim()
        : String(invData.invoiceNumber || '');
    const nextIsTaxable = args.isTaxable !== undefined ? Boolean(args.isTaxable) : Boolean(invData.isTaxable);
    const nextStatusRaw = args.status ? String(args.status).trim().toLowerCase() : '';
    const nextStatus: 'Paid' | 'Unpaid' | 'Cancelled' =
        nextStatusRaw === 'paid' || nextStatusRaw === 'lunas'
            ? 'Paid'
            : nextStatusRaw === 'cancelled' || nextStatusRaw === 'batal'
              ? 'Cancelled'
              : nextStatusRaw === 'unpaid' || nextStatusRaw === 'belum lunas'
                ? 'Unpaid'
                : (invData.status as 'Paid' | 'Unpaid' | 'Cancelled') || 'Unpaid';

    const subtotal = finalTxIds.reduce((sum, tid) => {
        const entry = txById.get(tid);
        return sum + (entry ? Number(entry.data.jumlah) || 0 : 0);
    }, 0);
    const computedTotal = subtotal + (nextIsTaxable ? Math.round(subtotal * 0.011) : 0);
    const nextTotalAmount =
        args.totalAmountOverride !== undefined && Number(args.totalAmountOverride) >= 0
            ? Math.round(Number(args.totalAmountOverride))
            : finalTxIds.length > 0
              ? computedTotal
              : Number(invData.totalAmount) || 0;

    const now = admin.firestore.Timestamp.now();
    const invUpdates: Record<string, unknown> = {
        invoiceNumber: nextInvoiceNumber,
        transactionIds: finalTxIds,
        isTaxable: nextIsTaxable,
        totalAmount: nextTotalAmount,
        status: nextStatus,
        updatedAt: now,
    };

    if (args.clientName !== undefined) invUpdates.clientName = String(args.clientName).trim();
    if (args.clientAddress !== undefined) invUpdates.clientAddress = String(args.clientAddress).trim();
    if (args.notes !== undefined) invUpdates.notes = String(args.notes).trim();
    if (args.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(args.issueDate).trim())) {
        invUpdates.issueDate = admin.firestore.Timestamp.fromDate(new Date(`${String(args.issueDate).trim()}T08:00:00+07:00`));
    }
    if (args.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(args.dueDate).trim())) {
        invUpdates.dueDate = admin.firestore.Timestamp.fromDate(new Date(`${String(args.dueDate).trim()}T08:00:00+07:00`));
    }

    if (nextStatus === 'Paid') {
        invUpdates.paidAt = invData.paidAt || now;
        invUpdates.paidBy = actorName;
        if (args.paymentMethod) invUpdates.paymentMethod = String(args.paymentMethod).trim();
    } else if (args.status !== undefined && nextStatus === 'Unpaid') {
        invUpdates.paidAt = admin.firestore.FieldValue.delete();
        invUpdates.paidTime = admin.firestore.FieldValue.delete();
        invUpdates.paidBy = admin.firestore.FieldValue.delete();
        invUpdates.paymentDate = admin.firestore.FieldValue.delete();
        invUpdates.paymentMethod = admin.firestore.FieldValue.delete();
    }

    await found.ref.update(invUpdates);

    // Lepas STT yang dihapus dari invoice
    for (const rId of removeIds) {
        const entry = txById.get(rId);
        if (!entry) continue;
        await entry.ref.update({
            invoiceId: admin.firestore.FieldValue.delete(),
            invoiceNumber: admin.firestore.FieldValue.delete(),
            invoiceStatus: admin.firestore.FieldValue.delete(),
            ...(invData.status === 'Paid' ? { pelunasan: 'Pending' } : {}),
            updatedAt: now,
        });
    }

    // Sinkronkan STT yang tertaut
    const paidMethodStr = String(args.paymentMethod || invData.paymentMethod || '').toLowerCase();
    const paidCode = paidMethodStr.includes('tf') || paidMethodStr.includes('transfer') ? 'TF' : 'Cash';

    for (const tid of finalTxIds) {
        const entry = txById.get(tid);
        if (!entry) continue;
        if (nextStatus === 'Cancelled') {
            await entry.ref.update({
                invoiceId: admin.firestore.FieldValue.delete(),
                invoiceNumber: admin.firestore.FieldValue.delete(),
                invoiceStatus: admin.firestore.FieldValue.delete(),
                updatedAt: now,
            });
        } else {
            await entry.ref.update({
                invoiceId: found.id,
                invoiceNumber: nextInvoiceNumber,
                invoiceStatus: nextStatus,
                ...(args.status !== undefined
                    ? { pelunasan: nextStatus === 'Paid' ? paidCode : 'Pending' }
                    : {}),
                updatedAt: now,
            });
        }
    }

    let replyMedia: ReplyMediaItem[] | undefined;
    if (nextStatus !== 'Cancelled') {
        try {
            const rendered = await renderInvoicePngById(found.id);
            replyMedia = [
                {
                    base64: rendered.base64,
                    mimeType: rendered.mimeType,
                    filename: rendered.filename,
                },
            ];
        } catch (err) {
            console.error('[WA Agent] Failed rendering PNG in update_invoice:', err);
        }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return {
        result: {
            ok: true,
            executed: true,
            invoiceId: found.id,
            invoiceNumber: nextInvoiceNumber,
            clientName: String(invUpdates.clientName || invData.clientName || ''),
            status: nextStatus,
            sttCount: finalTxIds.length,
            totalAmount: nextTotalAmount,
            printUrl: `${appUrl}/finance/invoices/${found.id}/print`,
            imageAttached: Boolean(replyMedia?.length),
        },
        replyMedia,
    };
}

async function toolDeleteInvoiceDirect(args: Record<string, any>, actorName: string) {
    void actorName;
    const found = await findInvoiceDocByArgs(args);
    if (!found) {
        return {
            result: {
                ok: false,
                error: 'Invoice tidak ditemukan. Sebutkan nomor invoice atau ID invoice.',
            },
        };
    }

    const linkedQuerySnap = await adminDb
        .collection('transactions')
        .where('invoiceId', '==', found.id)
        .get();

    const invoiceData = found.data;
    const invoiceNumber = String(invoiceData.invoiceNumber || found.id);
    const clientName = String(invoiceData.clientName || '');

    await adminDb.runTransaction(async (tx) => {
        const invSnap = await tx.get(found.ref);
        if (!invSnap.exists) return;
        const d = invSnap.data() || {};
        const declaredIds: string[] = Array.isArray(d.transactionIds) ? d.transactionIds : [];
        const idSet = new Set<string>([...declaredIds.filter(Boolean), ...linkedQuerySnap.docs.map((doc) => doc.id)]);

        const txRefs = Array.from(idSet).map((tid) => adminDb.collection('transactions').doc(tid));
        const txSnaps = await Promise.all(txRefs.map((ref) => tx.get(ref)));
        const now = admin.firestore.Timestamp.now();

        for (const tSnap of txSnaps) {
            if (!tSnap.exists) continue;
            const txUpdates: Record<string, unknown> = {
                invoiceId: admin.firestore.FieldValue.delete(),
                invoiceNumber: admin.firestore.FieldValue.delete(),
                invoiceStatus: admin.firestore.FieldValue.delete(),
                updatedAt: now,
            };
            if (d.status === 'Paid') {
                txUpdates.pelunasan = 'Pending';
            }
            tx.update(tSnap.ref, txUpdates);
        }

        tx.delete(found.ref);
    });

    return {
        result: {
            ok: true,
            executed: true,
            deletedInvoiceId: found.id,
            invoiceNumber,
            clientName,
        },
    };
}

export async function toolGetInvoiceImage(args: {
    invoiceNumber?: string;
    invoiceId?: string;
    clientName?: string;
    noText?: boolean;
}): Promise<{ result: Record<string, unknown>; replyMedia?: ReplyMediaItem[]; suppressReplyText?: boolean }> {
    const reqId = String(args.invoiceId || '').trim();
    const reqNum = String(args.invoiceNumber || '').trim();
    const reqClient = String(args.clientName || '').trim().toLowerCase();

    let matchedId = reqId;

    if (!matchedId) {
        const snap = await adminDb.collection('invoices').get();
        const docs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));

        if (reqNum) {
            const reqUpper = reqNum.toUpperCase();
            const reqDigits = reqUpper.replace(/\D/g, '');
            const hit = docs.find(({ data }) => {
                const invNo = String(data.invoiceNumber || '').trim().toUpperCase();
                if (invNo === reqUpper) return true;
                const invDigits = invNo.replace(/\D/g, '');
                return Boolean(reqDigits && invDigits === reqDigits);
            });
            if (hit) matchedId = hit.id;
        } else if (reqClient) {
            const matches = docs
                .filter(({ data }) =>
                    String(data.clientName || '').toLowerCase().includes(reqClient)
                )
                .sort((a, b) => {
                    const ta = toDateSafe(a.data.createdAt || a.data.issueDate).getTime();
                    const tb = toDateSafe(b.data.createdAt || b.data.issueDate).getTime();
                    return tb - ta;
                });
            if (matches.length > 0) matchedId = matches[0].id;
        }
    }

    if (!matchedId) {
        return {
            result: {
                ok: false,
                error: reqNum
                    ? `Invoice nomor "${reqNum}" tidak ditemukan.`
                    : reqClient
                      ? `Tidak ditemukan invoice untuk client "${args.clientName}".`
                      : 'Sebutkan nomor invoice atau nama client.',
            },
        };
    }

    const rendered = await renderInvoicePngById(matchedId);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

    return {
        result: {
            ok: true,
            invoiceId: matchedId,
            invoiceNumber: rendered.invoiceNumber,
            clientName: rendered.clientName,
            totalAmount: rendered.totalAmount,
            sttCount: rendered.sttCount,
            printUrl: `${appUrl}/finance/invoices/${matchedId}/print`,
            imageAttached: true,
        },
        replyMedia: [
            {
                base64: rendered.base64,
                mimeType: rendered.mimeType,
                filename: rendered.filename,
            },
        ],
        ...(args.noText ? { suppressReplyText: true } : {}),
    };
}

export async function toolGetVoyageInvoiceImages(args: {
    voyageId?: string;
    voyageNumber?: string;
    shipName?: string;
    departureDate?: string;
    startDate?: string;
    endDate?: string;
    silentText?: boolean;
}): Promise<{
    result: Record<string, unknown>;
    replyMedia?: ReplyMediaItem[];
    suppressReplyText?: boolean;
}> {
    const reqVoyageId = String(args.voyageId || '').trim();
    const reqVoyageNo = String(args.voyageNumber || '').trim().toLowerCase();
    const reqVoyageDigits = reqVoyageNo.replace(/\D/g, '');
    const reqShip = String(args.shipName || '').trim().toLowerCase();
    const reqDepDate = String(args.departureDate || '').trim();
    const reqStartDate = String(args.startDate || '').trim();
    const reqEndDate = String(args.endDate || '').trim();

    const voyagesSnap = await adminDb.collection('voyages').get();
    const allVoyages = voyagesSnap.docs
        .map((doc) => {
            const data = doc.data() || {};
            return {
                id: doc.id,
                data,
                depDate: toDateSafe(data.departureDate),
                depIso: toWibDateIso(data.departureDate),
            };
        })
        .filter((v) => String(v.data.status || '').toLowerCase() !== 'cancelled');

    const hasFilter = Boolean(reqVoyageId || reqVoyageNo || reqShip || reqDepDate || reqStartDate || reqEndDate);

    let matchedVoyages = allVoyages.filter((v) => {
        if (reqVoyageId) return v.id === reqVoyageId;
        if (reqVoyageNo) {
            const vNo = String(v.data.voyageNumber || '').trim().toLowerCase();
            const vDigits = vNo.replace(/\D/g, '');
            const matchesNo = vNo.includes(reqVoyageNo) || Boolean(reqVoyageDigits && vDigits === reqVoyageDigits);
            if (!matchesNo) return false;
        }
        if (reqShip) {
            const ship = String(v.data.shipName || '').toLowerCase();
            const route = String(v.data.route || '').toLowerCase();
            if (!ship.includes(reqShip) && !route.includes(reqShip)) return false;
        }
        if (reqDepDate && v.depIso !== reqDepDate) return false;
        if (reqStartDate && v.depIso < reqStartDate) return false;
        if (reqEndDate && v.depIso > reqEndDate) return false;
        return true;
    });

    if (!hasFilter && matchedVoyages.length > 0) {
        matchedVoyages = [...matchedVoyages]
            .sort((a, b) => b.depDate.getTime() - a.depDate.getTime())
            .slice(0, 1);
    }

    if (matchedVoyages.length === 0) {
        return {
            result: {
                ok: false,
                error: 'Tidak ditemukan pemberangkatan kapal sesuai filter tersebut.',
            },
        };
    }

    const voyageLabels = matchedVoyages.map((v) => {
        const vNo = String(v.data.voyageNumber || v.id);
        const ship = String(v.data.shipName || '').trim();
        return ship ? `${vNo} (${ship} - ${v.depIso})` : `${vNo} (${v.depIso})`;
    });

    const voyageTxIdSet = new Set<string>();
    for (const v of matchedVoyages) {
        const txIds: unknown[] = Array.isArray(v.data.transactionIds) ? v.data.transactionIds : [];
        for (const tid of txIds) {
            if (typeof tid === 'string' && tid.trim()) {
                voyageTxIdSet.add(tid.trim());
            }
        }
    }

    if (voyageTxIdSet.size === 0) {
        return {
            result: {
                ok: false,
                error: 'Pemberangkatan tersebut belum memiliki STT / invoice.',
            },
        };
    }

    const candidateInvoiceIds = new Set<string>();
    const voyageTxIds = Array.from(voyageTxIdSet);
    for (let i = 0; i < voyageTxIds.length; i += 100) {
        const chunk = voyageTxIds.slice(i, i + 100);
        const refs = chunk.map((tid) => adminDb.collection('transactions').doc(tid));
        const txSnaps = await adminDb.getAll(...refs);
        for (const txSnap of txSnaps) {
            if (!txSnap.exists) continue;
            const td = txSnap.data() || {};
            if (String(td.status || '').toLowerCase() === 'dibatalkan') continue;
            if (typeof td.invoiceId === 'string' && td.invoiceId.trim()) {
                candidateInvoiceIds.add(td.invoiceId.trim());
            }
        }
    }

    const invoicesSnap = await adminDb.collection('invoices').get();
    const invoiceDocById = new Map<string, Record<string, any>>();
    for (const doc of invoicesSnap.docs) {
        const data = doc.data() || {};
        invoiceDocById.set(doc.id, data);
        if (String(data.status || '') === 'Cancelled') continue;
        const invTxIds: unknown[] = Array.isArray(data.transactionIds) ? data.transactionIds : [];
        if (invTxIds.some((tid) => typeof tid === 'string' && voyageTxIdSet.has(tid.trim()))) {
            candidateInvoiceIds.add(doc.id);
        }
    }

    const matchedInvoices = Array.from(candidateInvoiceIds)
        .map((invId) => ({ id: invId, data: invoiceDocById.get(invId) }))
        .filter((item): item is { id: string; data: Record<string, any> } => {
            if (!item.data) return false;
            return String(item.data.status || '') !== 'Cancelled';
        })
        .sort((a, b) => {
            const noA = String(a.data.invoiceNumber || '');
            const noB = String(b.data.invoiceNumber || '');
            const numA = parseInt(noA.replace(/\D/g, ''), 10);
            const numB = parseInt(noB.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                return numA - numB;
            }
            return noA.localeCompare(noB);
        });

    if (matchedInvoices.length === 0) {
        return {
            result: {
                ok: false,
                error: `Belum ada invoice yang dibuat untuk pemberangkatan ${voyageLabels.join(', ')}.`,
            },
        };
    }

    const media: ReplyMediaItem[] = [];
    const invoiceNumbers: string[] = [];
    let failedCount = 0;

    for (let i = 0; i < matchedInvoices.length; i += 4) {
        const chunk = matchedInvoices.slice(i, i + 4);
        const settled = await Promise.all(
            chunk.map(async (inv) => {
                try {
                    return await renderInvoicePngById(inv.id);
                } catch (err) {
                    console.error(`[WA Agent] Failed rendering invoice ${inv.id}:`, err);
                    return null;
                }
            })
        );
        for (const rendered of settled) {
            if (!rendered) {
                failedCount += 1;
                continue;
            }
            media.push({
                base64: rendered.base64,
                mimeType: rendered.mimeType,
                filename: rendered.filename,
            });
            invoiceNumbers.push(rendered.invoiceNumber);
        }
    }

    if (media.length === 0) {
        return {
            result: {
                ok: false,
                error: 'Gagal merender gambar invoice.',
            },
        };
    }

    const silentText = args.silentText !== false;
    return {
        result: {
            ok: true,
            voyages: voyageLabels,
            invoiceCount: media.length,
            invoiceNumbers,
            failedCount,
            silentText,
        },
        replyMedia: media,
        suppressReplyText: silentText,
    };
}

// ==========================================
// 2B. VOYAGE (PEMBERANGKATAN) PROPOSALS & EXECUTORS
// ==========================================

function formatShipCostsSummaryLines(costs?: VoyageShipCostsInput): string[] {
    if (!costs) return [];
    const lines: string[] = [];
    if (costs.tiket) lines.push(`• Tiket Kapal (SBY): ${fmtRupiah(costs.tiket)}`);
    if (costs.tiketMakassar) lines.push(`• Tiket Makassar: ${fmtRupiah(costs.tiketMakassar)}`);
    if (costs.opsSurabaya) lines.push(`• Ops Surabaya: ${fmtRupiah(costs.opsSurabaya)}`);
    if (costs.opsMakassar) lines.push(`• Ops Makassar: ${fmtRupiah(costs.opsMakassar)}`);
    if (costs.gajiSopir) lines.push(`• Gaji Sopir: ${fmtRupiah(costs.gajiSopir)}`);
    if (costs.sewaMobil) lines.push(`• Sewa Mobil: ${fmtRupiah(costs.sewaMobil)}`);
    if (costs.opsTambahan) lines.push(`• Ops Tambahan: ${fmtRupiah(costs.opsTambahan)}`);
    if (costs.penjualanMakassar) lines.push(`• Penjualan Makassar (+Omzet): ${fmtRupiah(costs.penjualanMakassar)}`);
    if (costs.notes) lines.push(`• Catatan Biaya: ${costs.notes}`);
    return lines;
}

async function resolveSttsForVoyageAssignment(args: {
    noSTTs?: string[];
    transactionIds?: string[];
    assignAllUnassigned?: boolean;
    statusFilter?: string;
    startDate?: string;
    endDate?: string;
    tujuan?: string;
    clientName?: string;
    excludeVoyageId?: string;
    existingVoyageTxIds?: Set<string>;
}) {
    const [assignedMap, txSnap] = await Promise.all([
        collectAssignedTransactionIds(args.excludeVoyageId),
        adminDb.collection('transactions').get(),
    ]);

    const allTxs = txSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    const byId = new Map(allTxs.map((t) => [t.id, t]));
    const bySttUpper = new Map<string, { id: string; data: Record<string, any> }>();
    const bySttDigits = new Map<string, { id: string; data: Record<string, any> }>();

    for (const t of allTxs) {
        const upper = String(t.data.noSTT || '').trim().toUpperCase();
        if (upper) bySttUpper.set(upper, t);
        const digits = upper.replace(/\D/g, '');
        if (digits) bySttDigits.set(digits, t);
    }

    const candidates: Array<{ id: string; data: Record<string, any> }> = [];
    const notFound: string[] = [];
    const alreadyAssignedElsewhere: Array<{ noSTT: string; voyageNumber: string }> = [];
    const seen = new Set<string>();

    const reqIds = Array.isArray(args.transactionIds) ? args.transactionIds.map((s) => String(s || '').trim()).filter(Boolean) : [];
    const reqStts = Array.isArray(args.noSTTs) ? args.noSTTs.map((s) => String(s || '').trim()).filter(Boolean) : [];

    if (reqIds.length > 0 || reqStts.length > 0) {
        for (const tid of reqIds) {
            const hit = byId.get(tid);
            if (!hit) {
                notFound.push(tid);
                continue;
            }
            if (!seen.has(hit.id)) {
                seen.add(hit.id);
                candidates.push(hit);
            }
        }
        for (const req of reqStts) {
            const upper = req.toUpperCase();
            const digits = upper.replace(/\D/g, '');
            const hit = bySttUpper.get(upper) || (digits ? bySttDigits.get(digits) : undefined);
            if (!hit) {
                notFound.push(req);
                continue;
            }
            if (!seen.has(hit.id)) {
                seen.add(hit.id);
                candidates.push(hit);
            }
        }
    } else if (args.assignAllUnassigned) {
        const stFilter = String(args.statusFilter || 'pending').trim().toLowerCase();
        const startIso = /^\d{4}-\d{2}-\d{2}$/.test(String(args.startDate || '').trim()) ? String(args.startDate).trim() : undefined;
        const endIso = /^\d{4}-\d{2}-\d{2}$/.test(String(args.endDate || '').trim()) ? String(args.endDate).trim() : undefined;
        const tujuanQ = (args.tujuan || '').trim();
        const clientQ = (args.clientName || '').trim().toLowerCase();

        for (const t of allTxs) {
            const d = t.data;
            if (d.status === 'dibatalkan') continue;
            if (assignedMap.has(t.id)) continue;
            if (args.existingVoyageTxIds?.has(t.id)) continue;
            const st = String(d.status || 'pending');
            if (stFilter === 'pending' && st !== 'pending') continue;
            if (stFilter === 'dikirim' && st !== 'dikirim') continue;
            if (tujuanQ && !destinationsMatch(tujuanQ, String(d.tujuan || ''))) continue;
            if (clientQ && !String(d.pengirimName || '').toLowerCase().includes(clientQ)) continue;
            if (startIso || endIso) {
                const tWib = toWibDateIso(d.tanggal);
                const cWib = toWibDateIso(d.createdAt || d.tanggal);
                const inRange = (val: string) => (!startIso || val >= startIso) && (!endIso || val <= endIso);
                if (!inRange(tWib) && !inRange(cWib)) continue;
            }
            candidates.push(t);
        }
    }

    const validItems: AssignSttsToVoyageDraftPayload['items'] = [];
    for (const c of candidates) {
        const d = c.data;
        const noSTT = String(d.noSTT || c.id);
        if (d.status === 'dibatalkan') {
            notFound.push(`${noSTT} (dibatalkan)`);
            continue;
        }
        if (args.existingVoyageTxIds?.has(c.id)) {
            continue;
        }
        const otherVoy = assignedMap.get(c.id);
        if (otherVoy) {
            alreadyAssignedElsewhere.push({ noSTT, voyageNumber: otherVoy });
            continue;
        }
        validItems.push({
            transactionId: c.id,
            noSTT,
            pengirimName: String(d.pengirimName || '-'),
            penerimaName: String(d.penerimaName || '-'),
            tujuan: String(d.tujuan || '-'),
            koli: Number(d.koli) || 0,
            berat: Number(d.berat) || 0,
            beratUnit: String(d.beratUnit || 'KG'),
            jumlah: Number(d.jumlah) || 0,
            status: String(d.status || 'pending'),
        });
    }

    validItems.sort((a, b) => {
        const na = parseInt(a.noSTT.replace(/\D/g, ''), 10) || 0;
        const nb = parseInt(b.noSTT.replace(/\D/g, ''), 10) || 0;
        return na - nb;
    });

    return { validItems, notFound, alreadyAssignedElsewhere };
}

async function buildCreateVoyageProposal(args: Record<string, any>): Promise<{
    pendingAction?: PendingAction;
    result: Record<string, unknown>;
}> {
    let route = String(args.route || args.tujuan || '').trim();
    if (!route) {
        return {
            result: {
                ok: false,
                error: 'Tujuan / rute pemberangkatan wajib diisi (misal "Surabaya - Makassar" atau "Makassar").',
            },
        };
    }
    if (!route.includes('-')) {
        route = `Surabaya - ${route}`;
    }

    const shipName = String(args.shipName || args.kapal || '').trim();
    const vehicleNumbers = parseVehicleUnits(args.vehicleNumbers ?? args.units ?? args.unit ?? args.sopir);
    const todayWib = toWibDateIso(new Date());
    const departureDate = /^\d{4}-\d{2}-\d{2}$/.test(String(args.departureDate || '').trim())
        ? String(args.departureDate).trim()
        : todayWib;
    const arrivalDate = /^\d{4}-\d{2}-\d{2}$/.test(String(args.arrivalDate || '').trim())
        ? String(args.arrivalDate).trim()
        : undefined;
    const status = normalizeVoyageStatus(args.status);
    const notes = String(args.notes || '').trim() || undefined;
    const shipCosts = sanitizeShipCostsInput(args.shipCosts);
    const generalExpenses = sanitizeGeneralExpensesInput(args.generalExpenses);

    let assignedStts: AssignSttsToVoyageDraftPayload['items'] = [];
    let alreadyAssignedElsewhere: Array<{ noSTT: string; voyageNumber: string }> = [];
    let notFound: string[] = [];

    if ((Array.isArray(args.noSTTs) && args.noSTTs.length > 0) || (Array.isArray(args.transactionIds) && args.transactionIds.length > 0)) {
        const resolved = await resolveSttsForVoyageAssignment({
            noSTTs: args.noSTTs,
            transactionIds: args.transactionIds,
        });
        assignedStts = resolved.validItems;
        alreadyAssignedElsewhere = resolved.alreadyAssignedElsewhere;
        notFound = resolved.notFound;
    }

    const payload: CreateVoyageDraftPayload = {
        route,
        shipName,
        vehicleNumbers,
        departureDate,
        ...(arrivalDate ? { arrivalDate } : {}),
        status,
        ...(notes ? { notes } : {}),
        ...(shipCosts ? { shipCosts } : {}),
        ...(generalExpenses ? { generalExpenses } : {}),
        ...(assignedStts.length > 0
            ? {
                  transactionIds: assignedStts.map((s) => s.transactionId),
                  noSTTs: assignedStts.map((s) => s.noSTT),
              }
            : {}),
    };

    const lines = [
        `• Rute / Tujuan: *${route}*`,
        `• Kapal: ${shipName ? `*${shipName}*` : '_Belum diisi_'}`,
        `• Unit Berangkat (Manual): ${vehicleNumbers.length > 0 ? vehicleNumbers.join(', ') : '_Belum diisi_'}`,
        `• Tgl Berangkat: ${departureDate}${arrivalDate ? ` | Tgl Tiba: ${arrivalDate}` : ' | Tgl Tiba: _Belum diisi_'}`,
        `• Status: *${voyageStatusLabel(status)}*`,
        ...(notes ? [`• Catatan: ${notes}`] : []),
    ];

    const costLines = formatShipCostsSummaryLines(shipCosts);
    if (costLines.length > 0) {
        lines.push('', '*Biaya Kapal:*', ...costLines, `• Total Biaya Kapal: *${fmtRupiah(sumShipCosts(shipCosts))}*`);
    }
    if (generalExpenses && generalExpenses.length > 0) {
        const totalGen = generalExpenses.reduce((s, e) => s + e.amount, 0);
        lines.push('', '*Biaya Pengeluaran Tambahan:*');
        generalExpenses.forEach((e, i) => lines.push(`${i + 1}. ${e.description}: ${fmtRupiah(e.amount)}`));
        lines.push(`• Total Pengeluaran Tambahan: *${fmtRupiah(totalGen)}*`);
    }
    if (assignedStts.length > 0) {
        lines.push(
            '',
            `• Muatan STT (${assignedStts.length} resi): ${assignedStts.slice(0, 10).map((s) => s.noSTT).join(', ')}${assignedStts.length > 10 ? ` +${assignedStts.length - 10} lainnya` : ''}`
        );
    }

    return {
        pendingAction: {
            type: 'create_voyage',
            summaryText: lines.join('\n'),
            payload,
            createdAt: Date.now(),
        },
        result: {
            ok: true,
            status: 'MENUNGGU_KONFIRMASI',
            alreadyAssignedElsewhere,
            notFound,
            draftSummary: lines.join('\n'),
            instruction:
                'Tampilkan draft pemberangkatan baru ini kepada user dan minta balas YA / Sudah benar untuk menyimpan, kirim revisi bila ada yang diubah, atau BATAL.',
        },
    };
}

export async function executeCreateVoyage(payload: CreateVoyageDraftPayload, actorName: string) {
    const counterRef = adminDb.collection('metadata').doc('voyage_counter');
    const newVoyageRef = adminDb.collection('voyages').doc();
    const txIds = Array.from(new Set((payload.transactionIds || []).filter(Boolean)));

    const created = await adminDb.runTransaction(async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
        const currentNumber = Number(counterData.global?.currentNumber) || 0;
        const nextNumber = currentNumber + 1;
        const voyageNumber = `VOY${String(nextNumber).padStart(3, '0')}`;

        const now = admin.firestore.Timestamp.now();
        const departureDate = admin.firestore.Timestamp.fromDate(new Date(`${payload.departureDate}T08:00:00+07:00`));
        const arrivalDate = payload.arrivalDate
            ? admin.firestore.Timestamp.fromDate(new Date(`${payload.arrivalDate}T08:00:00+07:00`))
            : undefined;

        const voyageDoc = stripUndefined({
            userId: 'wa-agent',
            voyageNumber,
            departureDate,
            arrivalDate,
            route: payload.route,
            shipName: payload.shipName || '',
            vehicleNumbers: payload.vehicleNumbers || [],
            status: payload.status,
            transactionIds: txIds,
            notes: payload.notes ? `${payload.notes} (via WA Agent: ${actorName})` : undefined,
            createdAt: now,
            updatedAt: now,
        });

        tx.set(
            counterRef,
            {
                global: {
                    currentNumber: nextNumber,
                    prefix: 'VOY',
                    lastUpdated: now,
                },
            },
            { merge: true }
        );
        tx.set(newVoyageRef, voyageDoc);

        return {
            id: newVoyageRef.id,
            voyageNumber,
            route: payload.route,
            shipName: payload.shipName || '',
            vehicleNumbers: payload.vehicleNumbers || [],
            departureDate: payload.departureDate,
            arrivalDate: payload.arrivalDate,
            status: payload.status,
            assignedCount: txIds.length,
        };
    });

    let totalShipCosts = 0;
    if (payload.shipCosts) {
        totalShipCosts = sumShipCosts(payload.shipCosts);
        await adminDb
            .collection('owner_ship_expenses')
            .doc(created.id)
            .set(
                {
                    voyageId: created.id,
                    voyageNumber: created.voyageNumber,
                    shipName: created.shipName,
                    departureDate: created.departureDate,
                    route: created.route,
                    penjualanMakassar: Number(payload.shipCosts.penjualanMakassar) || 0,
                    tiket: Number(payload.shipCosts.tiket) || 0,
                    tiketMakassar: Number(payload.shipCosts.tiketMakassar) || 0,
                    opsMakassar: Number(payload.shipCosts.opsMakassar) || 0,
                    opsSurabaya: Number(payload.shipCosts.opsSurabaya) || 0,
                    gajiSopir: Number(payload.shipCosts.gajiSopir) || 0,
                    sewaMobil: Number(payload.shipCosts.sewaMobil) || 0,
                    opsTambahan: Number(payload.shipCosts.opsTambahan) || 0,
                    notes: (payload.shipCosts.notes || '').trim(),
                    updatedAt: admin.firestore.Timestamp.now(),
                    updatedBy: actorName,
                },
                { merge: true }
            );
    }

    if (payload.generalExpenses && payload.generalExpenses.length > 0) {
        const now = admin.firestore.Timestamp.now();
        for (const exp of payload.generalExpenses) {
            await adminDb.collection('expenses').add({
                userId: 'wa-agent',
                type: 'voyage',
                voyageId: created.id,
                category: exp.category,
                amount: exp.amount,
                description: exp.description,
                date: admin.firestore.Timestamp.fromDate(new Date(`${exp.date || created.departureDate}T08:00:00+07:00`)),
                status: 'approved',
                approvedBy: actorName,
                createdAt: now,
                updatedAt: now,
            });
        }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return {
        ...created,
        totalShipCosts,
        detailUrl: `${appUrl}/voyages/${created.id}`,
    };
}

async function buildSaveVoyageExpensesProposal(args: Record<string, any>): Promise<{
    pendingAction?: PendingAction;
    result: Record<string, unknown>;
}> {
    const voyageMatch = await findVoyageByRef(
        args.voyageId ? String(args.voyageId) : undefined,
        args.voyageNumber ? String(args.voyageNumber) : args.shipName ? String(args.shipName) : undefined
    );
    if (!voyageMatch) {
        return {
            result: {
                ok: false,
                error: 'Pemberangkatan tidak ditemukan. Buat pemberangkatan terlebih dahulu atau sebutkan nomor VOY / nama kapal.',
            },
        };
    }

    const vd = voyageMatch.data;
    const shipCostsInput = sanitizeShipCostsInput(args.shipCosts);
    const generalExpenses = sanitizeGeneralExpensesInput(args.generalExpenses);

    if (!shipCostsInput && (!generalExpenses || generalExpenses.length === 0)) {
        return {
            result: {
                ok: false,
                error: 'Masukkan minimal 1 rincian biaya (misal tiket kapal, gaji sopir, sewa mobil, ops Surabaya, ops Makassar, atau biaya operasional lainnya).',
            },
        };
    }

    let mergedShipCosts: VoyageShipCostsInput | undefined = shipCostsInput;
    if (shipCostsInput) {
        const existingSnap = await adminDb.collection('owner_ship_expenses').doc(voyageMatch.id).get();
        const existing = existingSnap.exists ? existingSnap.data() || {} : {};
        const resolvedNotes = shipCostsInput.notes ?? (String(existing.notes || '').trim() || '');
        mergedShipCosts = {
            tiket: shipCostsInput.tiket ?? (Number(existing.tiket) || 0),
            tiketMakassar: shipCostsInput.tiketMakassar ?? (Number(existing.tiketMakassar) || 0),
            opsSurabaya: shipCostsInput.opsSurabaya ?? (Number(existing.opsSurabaya) || 0),
            opsMakassar: shipCostsInput.opsMakassar ?? (Number(existing.opsMakassar) || 0),
            gajiSopir: shipCostsInput.gajiSopir ?? (Number(existing.gajiSopir) || 0),
            sewaMobil: shipCostsInput.sewaMobil ?? (Number(existing.sewaMobil) || 0),
            opsTambahan: shipCostsInput.opsTambahan ?? (Number(existing.opsTambahan) || 0),
            penjualanMakassar: shipCostsInput.penjualanMakassar ?? (Number(existing.penjualanMakassar) || 0),
            ...(resolvedNotes ? { notes: resolvedNotes } : {}),
        };
    }

    const voyageNumber = String(vd.voyageNumber || voyageMatch.id);
    const shipName = String(vd.shipName || '-');
    const route = String(vd.route || '-');
    const departureDate = toWibDateIso(vd.departureDate);

    const payload: SaveVoyageExpensesDraftPayload = {
        voyageId: voyageMatch.id,
        voyageNumber,
        shipName,
        route,
        departureDate,
        ...(mergedShipCosts ? { shipCosts: mergedShipCosts } : {}),
        ...(generalExpenses ? { generalExpenses } : {}),
    };

    const lines = [
        `• Pemberangkatan: *${voyageNumber}* (${shipName})`,
        `• Rute: ${route} | Tgl: ${departureDate}`,
    ];
    const costLines = formatShipCostsSummaryLines(mergedShipCosts);
    if (costLines.length > 0) {
        lines.push('', '*Rincian Biaya Kapal (Owner Ship Expenses):*', ...costLines, `• Total Biaya Kapal: *${fmtRupiah(sumShipCosts(mergedShipCosts))}*`);
    }
    if (generalExpenses && generalExpenses.length > 0) {
        const totalGen = generalExpenses.reduce((s, e) => s + e.amount, 0);
        lines.push('', '*Pengeluaran Operasional Tambahan:*');
        generalExpenses.forEach((e, idx) =>
            lines.push(`${idx + 1}. ${EXPENSE_CATEGORY_LABELS[e.category]} (${e.description}): *${fmtRupiah(e.amount)}*`)
        );
        lines.push(`• Total Tambahan: *${fmtRupiah(totalGen)}*`);
    }

    return {
        pendingAction: {
            type: 'save_voyage_expenses',
            summaryText: lines.join('\n'),
            payload,
            createdAt: Date.now(),
        },
        result: {
            ok: true,
            status: 'MENUNGGU_KONFIRMASI',
            draftSummary: lines.join('\n'),
            instruction:
                'Tampilkan rincian biaya pemberangkatan ini kepada user dan minta konfirmasi YA / Sudah benar untuk menyimpan, revisi bila ada yang diubah, atau BATAL.',
        },
    };
}

export async function executeSaveVoyageExpenses(payload: SaveVoyageExpensesDraftPayload, actorName: string) {
    let totalShipCosts = 0;
    if (payload.shipCosts) {
        totalShipCosts = sumShipCosts(payload.shipCosts);
        await adminDb
            .collection('owner_ship_expenses')
            .doc(payload.voyageId)
            .set(
                {
                    voyageId: payload.voyageId,
                    voyageNumber: payload.voyageNumber,
                    shipName: payload.shipName,
                    departureDate: payload.departureDate,
                    route: payload.route,
                    penjualanMakassar: Number(payload.shipCosts.penjualanMakassar) || 0,
                    tiket: Number(payload.shipCosts.tiket) || 0,
                    tiketMakassar: Number(payload.shipCosts.tiketMakassar) || 0,
                    opsMakassar: Number(payload.shipCosts.opsMakassar) || 0,
                    opsSurabaya: Number(payload.shipCosts.opsSurabaya) || 0,
                    gajiSopir: Number(payload.shipCosts.gajiSopir) || 0,
                    sewaMobil: Number(payload.shipCosts.sewaMobil) || 0,
                    opsTambahan: Number(payload.shipCosts.opsTambahan) || 0,
                    notes: (payload.shipCosts.notes || '').trim(),
                    updatedAt: admin.firestore.Timestamp.now(),
                    updatedBy: actorName,
                },
                { merge: true }
            );
    }

    let generalExpensesAddedCount = 0;
    let totalGeneralExpenses = 0;
    if (payload.generalExpenses && payload.generalExpenses.length > 0) {
        const now = admin.firestore.Timestamp.now();
        for (const exp of payload.generalExpenses) {
            await adminDb.collection('expenses').add({
                userId: 'wa-agent',
                type: 'voyage',
                voyageId: payload.voyageId,
                category: exp.category,
                amount: exp.amount,
                description: exp.description,
                date: admin.firestore.Timestamp.fromDate(new Date(`${exp.date || payload.departureDate}T08:00:00+07:00`)),
                status: 'approved',
                approvedBy: actorName,
                createdAt: now,
                updatedAt: now,
            });
            generalExpensesAddedCount += 1;
            totalGeneralExpenses += exp.amount;
        }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return {
        voyageId: payload.voyageId,
        voyageNumber: payload.voyageNumber,
        shipName: payload.shipName,
        totalShipCosts,
        generalExpensesAddedCount,
        totalGeneralExpenses,
        detailUrl: `${appUrl}/voyages/${payload.voyageId}`,
    };
}

async function buildAssignSttsToVoyageProposal(args: Record<string, any>): Promise<{
    pendingAction?: PendingAction;
    result: Record<string, unknown>;
}> {
    const voyageMatch = await findVoyageByRef(
        args.voyageId ? String(args.voyageId) : undefined,
        args.voyageNumber ? String(args.voyageNumber) : args.shipName ? String(args.shipName) : undefined
    );
    if (!voyageMatch) {
        return {
            result: {
                ok: false,
                error: 'Pemberangkatan tidak ditemukan. Sebutkan nomor VOY / nama kapal atau buat pemberangkatan baru dulu.',
            },
        };
    }

    const vd = voyageMatch.data;
    const existingIds = new Set<string>(Array.isArray(vd.transactionIds) ? vd.transactionIds.filter(Boolean) : []);
    const resolved = await resolveSttsForVoyageAssignment({
        noSTTs: Array.isArray(args.noSTTs) ? args.noSTTs : undefined,
        transactionIds: Array.isArray(args.transactionIds) ? args.transactionIds : undefined,
        assignAllUnassigned: Boolean(args.assignAllUnassignedPending ?? args.assignAllUnassigned),
        statusFilter: args.statusFilter ? String(args.statusFilter) : 'pending',
        startDate: args.startDate ? String(args.startDate) : undefined,
        endDate: args.endDate ? String(args.endDate) : undefined,
        tujuan: args.tujuan ? String(args.tujuan) : undefined,
        clientName: args.clientName ? String(args.clientName) : undefined,
        excludeVoyageId: voyageMatch.id,
        existingVoyageTxIds: existingIds,
    });

    if (resolved.validItems.length === 0) {
        return {
            result: {
                ok: false,
                error: 'Tidak ada STT baru yang bisa dimasukkan ke pemberangkatan ini.',
                alreadyAssignedElsewhere: resolved.alreadyAssignedElsewhere,
                notFound: resolved.notFound,
            },
        };
    }

    const voyageNumber = String(vd.voyageNumber || voyageMatch.id);
    const shipName = String(vd.shipName || '-');
    const route = String(vd.route || '-');
    const departureDate = toWibDateIso(vd.departureDate);

    const payload: AssignSttsToVoyageDraftPayload = {
        voyageId: voyageMatch.id,
        voyageNumber,
        shipName,
        route,
        departureDate,
        items: resolved.validItems,
    };

    const totalOmzet = resolved.validItems.reduce((s, it) => s + it.jumlah, 0);
    const totalKoli = resolved.validItems.reduce((s, it) => s + it.koli, 0);
    const totalBerat = resolved.validItems.reduce((s, it) => s + it.berat, 0);

    const lines = [
        `• Tujuan Pemberangkatan: *${voyageNumber}* (${shipName} | ${route})`,
        `• Tanggal Berangkat: ${departureDate}`,
        '',
        ...resolved.validItems.slice(0, 25).map(
            (it, idx) =>
                `${idx + 1}. *${it.noSTT}* | ${it.pengirimName} → ${it.tujuan} (${it.koli} koli, ${it.berat} ${it.beratUnit}) | ${fmtRupiah(it.jumlah)} [${it.status}]`
        ),
        ...(resolved.validItems.length > 25 ? [`... dan ${resolved.validItems.length - 25} STT lainnya`] : []),
        '',
        `• Total Dimasukkan: *${resolved.validItems.length} STT* (${totalKoli} koli, ${totalBerat.toLocaleString('id-ID')} kg/vol)`,
        `• Total Nilai Muatan: *${fmtRupiah(totalOmzet)}*`,
    ];

    if (resolved.alreadyAssignedElsewhere.length > 0) {
        lines.push(
            `⚠️ Dilewati (sudah ikut kapal lain): ${resolved.alreadyAssignedElsewhere.map((a) => `${a.noSTT} (${a.voyageNumber})`).join(', ')}`
        );
    }

    return {
        pendingAction: {
            type: 'assign_stts_to_voyage',
            summaryText: lines.join('\n'),
            payload,
            createdAt: Date.now(),
        },
        result: {
            ok: true,
            status: 'MENUNGGU_KONFIRMASI',
            count: resolved.validItems.length,
            alreadyAssignedElsewhere: resolved.alreadyAssignedElsewhere,
            notFound: resolved.notFound,
            draftSummary: lines.join('\n'),
            instruction:
                'Tampilkan daftar STT yang akan dimasukkan ke pemberangkatan ini. Minta user membalas YA / Sudah benar untuk memproses, kirim revisi (misal keluarkan STT tertentu), atau BATAL.',
        },
    };
}

export async function executeAssignSttsToVoyage(
    payload: AssignSttsToVoyageDraftPayload,
    actorName: string
) {
    void actorName;
    const voyageRef = adminDb.collection('voyages').doc(payload.voyageId);
    const addIds = payload.items.map((i) => i.transactionId).filter(Boolean);

    const totalSttInVoyage = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(voyageRef);
        if (!snap.exists) {
            throw new Error(`Pemberangkatan ${payload.voyageNumber} tidak ditemukan.`);
        }
        const currentIds: string[] = Array.isArray(snap.data()?.transactionIds) ? snap.data()!.transactionIds : [];
        const mergedIds = Array.from(new Set([...currentIds, ...addIds]));
        tx.update(voyageRef, {
            transactionIds: mergedIds,
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return mergedIds.length;
    });

    const addedKoli = payload.items.reduce((s, it) => s + it.koli, 0);
    const addedWeight = payload.items.reduce((s, it) => s + it.berat, 0);
    const addedOmzet = payload.items.reduce((s, it) => s + it.jumlah, 0);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

    return {
        voyageId: payload.voyageId,
        voyageNumber: payload.voyageNumber,
        shipName: payload.shipName,
        addedCount: payload.items.length,
        totalSttInVoyage,
        addedKoli,
        addedWeight,
        addedOmzet,
        detailUrl: `${appUrl}/voyages/${payload.voyageId}`,
    };
}

// ==========================================
// 3. GEMINI FUNCTION DECLARATIONS & DISPATCH
// ==========================================

const ALL_TOOL_DECLARATIONS: FunctionDeclaration[] = [
    {
        name: 'search_clients',
        description: 'Cari data client/pengirim di database CCE berdasarkan nama, kota, alamat, atau nomor HP.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: 'Kata kunci nama client, kota, atau nomor HP.' },
            },
            required: ['query'],
        },
    },
    {
        name: 'get_transaction_by_stt',
        description: 'Cek detail lengkap 1 resi/STT berdasarkan nomor STT (contoh: "19787" atau "STT019787").',
        parameters: {
            type: Type.OBJECT,
            properties: {
                noSTT: { type: Type.STRING, description: 'Nomor STT atau angka STT.' },
            },
            required: ['noSTT'],
        },
    },
    {
        name: 'list_unbilled_transactions',
        description: 'Daftar STT berstatus Pending yang belum dibuatkan invoice. Bisa difilter per nama pengirim.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                clientName: { type: Type.STRING, description: 'Opsional: filter nama pengirim/client.' },
                limit: { type: Type.NUMBER, description: 'Maksimal item yang dikembalikan (default 20).' },
            },
        },
    },
    {
        name: 'get_unpaid_invoices_summary',
        description: 'Lihat ringkasan dan daftar invoice yang belum lunas / jatuh tempo (piutang).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                clientName: { type: Type.STRING, description: 'Opsional: filter nama client.' },
            },
        },
    },
    {
        name: 'get_voyage_summary',
        description: 'Lihat ringkasan pemberangkatan kapal (voyage): total STT, koli, omzet, lunas vs pending.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                searchQuery: { type: Type.STRING, description: 'Opsional: nama kapal, nomor voyage, atau rute.' },
            },
        },
    },
    {
        name: 'create_stt',
        description:
            'Buat & simpan STT/transaksi baru LANGSUNG ke Firestore (TANPA konfirmasi). JANGAN memanggil ini sebelum pengirimName, penerimaName, dan tujuan jelas.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                branch: { type: Type.STRING, description: 'Cabang asal: "surabaya", "bandung", atau "makassar".' },
                tanggal: { type: Type.STRING, description: 'Tanggal format YYYY-MM-DD (kosongkan untuk hari ini).' },
                pengirimName: { type: Type.STRING, description: 'Nama pengirim / perusahaan.' },
                pengirimPhone: { type: Type.STRING, description: 'No HP pengirim (opsional).' },
                pengirimAddress: { type: Type.STRING, description: 'Alamat pengirim (opsional).' },
                penerimaName: { type: Type.STRING, description: 'Nama penerima.' },
                tujuan: { type: Type.STRING, description: 'Kota tujuan pengiriman (contoh: MAKASSAR, PALU, KENDARI).' },
                koli: { type: Type.NUMBER, description: 'Jumlah koli/paket.' },
                berat: { type: Type.NUMBER, description: 'Angka berat/volume (KG atau M3).' },
                beratUnit: { type: Type.STRING, description: 'Satuan: "KG", "M3", atau "KG/VOLUME".' },
                tipeTransaksi: { type: Type.STRING, description: '"regular" (harga x berat/koli) atau "borongan" (harga total).' },
                harga: { type: Type.NUMBER, description: 'Tarif satuan (regular) atau total (borongan) dalam Rupiah penuh.' },
                jumlah: { type: Type.NUMBER, description: 'Opsional: total Rupiah jika disebutkan eksplisit.' },
                pembayaran: { type: Type.STRING, description: '"Tunai", "Kredit", atau "DP".' },
                pelunasan: { type: Type.STRING, description: '"Cash", "TF", atau "Pending".' },
                isTaxable: { type: Type.BOOLEAN, description: 'true jika kena pajak PPN / PKP.' },
                isiBarang: { type: Type.STRING, description: 'Isi / jenis barang.' },
                keterangan: { type: Type.STRING, description: 'Catatan tambahan.' },
                noSTT: { type: Type.STRING, description: 'Opsional: nomor STT manual jika disebutkan user.' },
            },
            required: ['pengirimName', 'penerimaName', 'tujuan'],
        },
    },
    {
        name: 'update_stt',
        description:
            'Edit data 1 STT secara LANGSUNG (TANPA konfirmasi): harga, jumlah, tipeTransaksi, koli, berat, beratUnit, tujuan, pengirimName, penerimaName, isiBarang, keterangan, pembayaran, pelunasan, status, tanggal, atau nomor STT.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                noSTT: { type: Type.STRING, description: 'Nomor STT yang akan diedit.' },
                transactionId: { type: Type.STRING, description: 'Opsional: ID Firestore transaksi.' },
                harga: { type: Type.NUMBER, description: 'Tarif satuan baru (regular).' },
                jumlah: { type: Type.NUMBER, description: 'Total Rupiah baru (wajib untuk borongan / override).' },
                tipeTransaksi: { type: Type.STRING, description: '"regular" atau "borongan".' },
                koli: { type: Type.NUMBER, description: 'Jumlah koli baru.' },
                berat: { type: Type.NUMBER, description: 'Berat/volume baru.' },
                beratUnit: { type: Type.STRING, description: '"KG", "M3", atau "KG/VOLUME".' },
                tujuan: { type: Type.STRING, description: 'Kota tujuan baru.' },
                pengirimName: { type: Type.STRING, description: 'Nama pengirim baru.' },
                penerimaName: { type: Type.STRING, description: 'Nama penerima baru.' },
                isiBarang: { type: Type.STRING, description: 'Isi barang baru.' },
                keterangan: { type: Type.STRING, description: 'Keterangan baru.' },
                pembayaran: { type: Type.STRING, description: '"Tunai", "Kredit", atau "DP".' },
                pelunasan: { type: Type.STRING, description: '"Cash", "TF", atau "Pending".' },
                isTaxable: { type: Type.BOOLEAN, description: 'true jika PKP.' },
                status: { type: Type.STRING, description: '"pending", "diproses", "dikirim", "selesai", atau "dibatalkan".' },
                tanggal: { type: Type.STRING, description: 'Tanggal format YYYY-MM-DD.' },
                noSTTNew: { type: Type.STRING, description: 'Nomor STT baru jika mengganti nomor STT.' },
            },
        },
    },
    {
        name: 'delete_stt',
        description:
            'Hapus satu atau beberapa STT secara LANGSUNG dari Firestore (TANPA konfirmasi).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                noSTT: { type: Type.STRING, description: 'Satu nomor STT yang akan dihapus.' },
                noSTTs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Daftar nomor STT yang akan dihapus.',
                },
                transactionId: { type: Type.STRING, description: 'Opsional: ID Firestore transaksi.' },
            },
        },
    },
    {
        name: 'create_invoice',
        description:
            'Buat & terbitkan Invoice LANGSUNG dari STT Pending yang belum tertagih (TANPA konfirmasi), lalu otomatis kirim gambar PNG invoice.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                clientName: { type: Type.STRING, description: 'Nama pengirim / client tertagih.' },
                noSTTs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Opsional: daftar nomor STT spesifik jika user menyebut nomor STT tertentu.',
                },
                issueDate: { type: Type.STRING, description: 'Opsional: tanggal terbit YYYY-MM-DD.' },
                dueDate: { type: Type.STRING, description: 'Opsional: jatuh tempo YYYY-MM-DD.' },
                notes: { type: Type.STRING, description: 'Catatan invoice (opsional).' },
            },
        },
    },
    {
        name: 'update_invoice',
        description:
            'Revisi/edit Invoice yang sudah ada secara LANGSUNG (TANPA konfirmasi): ubah nomor invoice, tanggal, jatuh tempo, catatan, status Paid/Unpaid/Cancelled, PKP, tambah/hapus STT, lalu otomatis kirim gambar PNG invoice terbaru.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                invoiceNumber: { type: Type.STRING, description: 'Nomor invoice yang akan direvisi.' },
                invoiceId: { type: Type.STRING, description: 'Opsional: ID Firestore invoice.' },
                clientName: { type: Type.STRING, description: 'Opsional: cari invoice terbaru client atau ganti nama client.' },
                invoiceNumberNew: { type: Type.STRING, description: 'Nomor invoice baru jika ingin diganti.' },
                issueDate: { type: Type.STRING, description: 'Tanggal terbit baru YYYY-MM-DD.' },
                dueDate: { type: Type.STRING, description: 'Jatuh tempo baru YYYY-MM-DD.' },
                notes: { type: Type.STRING, description: 'Catatan invoice baru.' },
                isTaxable: { type: Type.BOOLEAN, description: 'true untuk PKP (PPN 1.1%).' },
                status: { type: Type.STRING, description: '"Paid", "Unpaid", atau "Cancelled".' },
                paymentMethod: { type: Type.STRING, description: 'Metode bayar bila Paid (mis. "Transfer BCA", "Cash").' },
                addNoSTTs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Nomor STT yang ingin ditambahkan ke invoice ini.',
                },
                removeNoSTTs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Nomor STT yang ingin dilepas dari invoice ini.',
                },
                totalAmountOverride: { type: Type.NUMBER, description: 'Opsional: override total tagihan.' },
            },
        },
    },
    {
        name: 'delete_invoice',
        description:
            'Hapus Invoice secara LANGSUNG (TANPA konfirmasi) dan otomatis lepas tautannya dari semua STT terkait.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                invoiceNumber: { type: Type.STRING, description: 'Nomor invoice yang akan dihapus.' },
                invoiceId: { type: Type.STRING, description: 'Opsional: ID Firestore invoice.' },
            },
        },
    },
    {
        name: 'list_pending_stt_with_price_history',
        description:
            'Cari daftar STT berstatus pending (terutama yang belum diisi harga) dalam periode/tanggal tertentu beserta data customer dan riwayat harga transaksi pengirim sebelumnya.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                period: {
                    type: Type.STRING,
                    description: 'Shortcut periode WIB: "this_week" (minggu ini), "today" (hari ini), "last_7_days", atau "this_month".',
                },
                startDate: { type: Type.STRING, description: 'Opsional: tanggal mulai format YYYY-MM-DD.' },
                endDate: { type: Type.STRING, description: 'Opsional: tanggal akhir format YYYY-MM-DD.' },
                onlyUnpriced: {
                    type: Type.BOOLEAN,
                    description: 'Default true (hanya STT yang harga & jumlah masih 0). Set false untuk semua STT pending.',
                },
                clientName: { type: Type.STRING, description: 'Opsional: filter nama pengirim.' },
                branch: { type: Type.STRING, description: 'Opsional: filter cabang ("surabaya", "bandung", "makassar").' },
                limit: { type: Type.NUMBER, description: 'Maksimal jumlah STT yang ditampilkan (default 25).' },
            },
        },
    },
    {
        name: 'batch_update_stt_pricing',
        description:
            'Update harga & ubah status pengiriman (default "dikirim") untuk satu atau banyak STT sekaligus secara LANGSUNG (TANPA konfirmasi). Bisa pakai noSTT atau customerName.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                targetStatus: {
                    type: Type.STRING,
                    description: 'Status pengiriman tujuan untuk semua item jika tidak ditentukan per item. Default: "dikirim". Pilihan: "pending", "diproses", "dikirim", "selesai".',
                },
                items: {
                    type: Type.ARRAY,
                    description: 'Daftar STT atau customer yang akan diisi harganya dan diubah statusnya.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            transactionId: { type: Type.STRING, description: 'ID dokumen Firestore transaksi (jika tersedia).' },
                            noSTT: { type: Type.STRING, description: 'Nomor STT (contoh: "STT019787" atau "19787").' },
                            customerName: { type: Type.STRING, description: 'Opsional jika user menyebut harga per customer tanpa noSTT (terapkan ke semua STT pending milik customer tsb).' },
                            tipeTransaksi: { type: Type.STRING, description: '"regular" (harga x berat) atau "borongan" (jumlah total).' },
                            harga: { type: Type.NUMBER, description: 'Tarif satuan dalam Rupiah untuk tipe "regular".' },
                            jumlah: { type: Type.NUMBER, description: 'Total Rupiah (wajib untuk "borongan", atau opsional override untuk "regular").' },
                            berat: { type: Type.NUMBER, description: 'Opsional: perbarui angka berat jika user merevisi berat.' },
                            beratUnit: { type: Type.STRING, description: 'Opsional: "KG", "M3", atau "KG/VOLUME".' },
                            isTaxable: { type: Type.BOOLEAN, description: 'Opsional: true jika kena PPN 1.1%.' },
                            newStatus: { type: Type.STRING, description: 'Opsional: status khusus untuk STT ini.' },
                            priceSource: { type: Type.STRING, description: 'Opsional: keterangan asal harga.' },
                        },
                    },
                },
            },
            required: ['items'],
        },
    },
    {
        name: 'get_invoice_image',
        description:
            'Render dan kirim gambar PNG invoice secara langsung ke chat WhatsApp berdasarkan nomor invoice, ID invoice, atau nama client terbaru.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                invoiceNumber: { type: Type.STRING, description: 'Nomor invoice, contoh: "13828" atau "INV012366".' },
                invoiceId: { type: Type.STRING, description: 'Opsional: ID dokumen Firestore invoice.' },
                clientName: { type: Type.STRING, description: 'Opsional: nama client untuk mengambil invoice terbarunya.' },
                noText: {
                    type: Type.BOOLEAN,
                    description: 'Set true jika user meminta kirim gambar saja tanpa teks tambahan.',
                },
            },
        },
    },
    {
        name: 'get_voyage_invoice_images',
        description:
            'Ambil dan kirim SEMUA gambar PNG invoice yang sudah dibuat pada suatu pemberangkatan kapal (voyage) / tanggal keberangkatan, secara default tanpa teks atau caption apa pun.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                voyageId: { type: Type.STRING, description: 'Opsional: ID dokumen Firestore voyage.' },
                voyageNumber: { type: Type.STRING, description: 'Opsional: nomor voyage, mis. "VOY045" atau "45".' },
                shipName: { type: Type.STRING, description: 'Opsional: nama kapal atau rute tujuan.' },
                departureDate: {
                    type: Type.STRING,
                    description: 'Tanggal keberangkatan format YYYY-MM-DD (WIB). Contoh jika user bilang "tgl 24" bulan ini, isi "YYYY-MM-24".',
                },
                startDate: { type: Type.STRING, description: 'Opsional: rentang awal keberangkatan YYYY-MM-DD.' },
                endDate: { type: Type.STRING, description: 'Opsional: rentang akhir keberangkatan YYYY-MM-DD.' },
                silentText: {
                    type: Type.BOOLEAN,
                    description: 'Default true — kirim gambar invoice saja tanpa teks/caption apa pun.',
                },
            },
        },
    },
    {
        name: 'list_unassigned_stts',
        description:
            'Lihat daftar STT (default status pending) yang BELUM ikut / belum dimasukkan ke pemberangkatan kapal mana pun.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                statusFilter: {
                    type: Type.STRING,
                    description: 'Filter status STT: "pending" (default), "dikirim", atau "all" (semua status aktif selain dibatalkan).',
                },
                startDate: { type: Type.STRING, description: 'Opsional: tanggal mulai YYYY-MM-DD.' },
                endDate: { type: Type.STRING, description: 'Opsional: tanggal akhir YYYY-MM-DD.' },
                tujuan: { type: Type.STRING, description: 'Opsional: filter kota tujuan.' },
                clientName: { type: Type.STRING, description: 'Opsional: filter nama pengirim.' },
                branch: { type: Type.STRING, description: 'Opsional: filter cabang.' },
                limit: { type: Type.NUMBER, description: 'Maksimal item (default 30).' },
            },
        },
    },
    {
        name: 'propose_create_voyage',
        description:
            'Siapkan DRAFT pembuatan pemberangkatan baru (voyage) dengan tujuan/rute, nama kapal, unit berangkat manual (bebas nama sopir atau nopol tanpa harus pilih dari armada), tanggal berangkat & tiba, status pemberangkatan, serta opsional biaya & daftar STT.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                route: { type: Type.STRING, description: 'Rute atau tujuan pemberangkatan (mis. "Surabaya - Makassar" atau "Makassar").' },
                shipName: { type: Type.STRING, description: 'Nama kapal (mis. "KM Dharma Kencana VII").' },
                vehicleNumbers: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Daftar unit berangkat secara manual: boleh nama sopir (mis. "Pak Budi"), nopol truk (mis. "L 9988 AB"), atau keduanya.',
                },
                departureDate: { type: Type.STRING, description: 'Tanggal keberangkatan YYYY-MM-DD (default hari ini).' },
                arrivalDate: { type: Type.STRING, description: 'Tanggal tiba YYYY-MM-DD (opsional).' },
                status: {
                    type: Type.STRING,
                    description: 'Status pemberangkatan: "planned" (direncanakan/persiapan), "in-progress" (berlayar/dalam perjalanan/berangkat), atau "completed" (selesai/tiba).',
                },
                notes: { type: Type.STRING, description: 'Catatan tambahan (opsional).' },
                noSTTs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Opsional: nomor STT yang ingin langsung dimasukkan saat pembuatan.',
                },
                shipCosts: {
                    type: Type.OBJECT,
                    description: 'Opsional: rincian biaya kapal jika langsung disebut.',
                    properties: {
                        tiket: { type: Type.NUMBER },
                        tiketMakassar: { type: Type.NUMBER },
                        opsSurabaya: { type: Type.NUMBER },
                        opsMakassar: { type: Type.NUMBER },
                        gajiSopir: { type: Type.NUMBER },
                        sewaMobil: { type: Type.NUMBER },
                        opsTambahan: { type: Type.NUMBER },
                        penjualanMakassar: { type: Type.NUMBER },
                        notes: { type: Type.STRING },
                    },
                },
            },
            required: ['route'],
        },
    },
    {
        name: 'propose_save_voyage_expenses',
        description:
            'Siapkan DRAFT input/update biaya pemberangkatan (tiket kapal, tiket Makassar, ops Surabaya, ops Makassar, gaji sopir, sewa mobil, ops tambahan, dan/atau biaya pengeluaran operasional lainnya) untuk dikonfirmasi user.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                voyageNumber: { type: Type.STRING, description: 'Nomor pemberangkatan (mis. "VOY045") atau nama kapal. Kosongkan untuk pemberangkatan terbaru.' },
                voyageId: { type: Type.STRING, description: 'Opsional: ID Firestore voyage.' },
                shipCosts: {
                    type: Type.OBJECT,
                    description: 'Rincian biaya operasional kapal (isi field yang disebutkan user).',
                    properties: {
                        tiket: { type: Type.NUMBER, description: 'Biaya Tiket Kapal (Surabaya).' },
                        tiketMakassar: { type: Type.NUMBER, description: 'Biaya Tiket Makassar.' },
                        opsSurabaya: { type: Type.NUMBER, description: 'Biaya Operasional Surabaya.' },
                        opsMakassar: { type: Type.NUMBER, description: 'Biaya Operasional Makassar.' },
                        gajiSopir: { type: Type.NUMBER, description: 'Gaji Sopir.' },
                        sewaMobil: { type: Type.NUMBER, description: 'Biaya Sewa Mobil.' },
                        opsTambahan: { type: Type.NUMBER, description: 'Operasional Tambahan.' },
                        penjualanMakassar: { type: Type.NUMBER, description: 'Penjualan / omzet tambahan di Makassar (opsional).' },
                        notes: { type: Type.STRING, description: 'Catatan biaya.' },
                    },
                },
                generalExpenses: {
                    type: Type.ARRAY,
                    description: 'Opsional: pengeluaran tambahan ber-kategori (BBM, tol, makan tim, pelabuhan, dll).',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING, description: 'Kategori, misal bbm_solar, parkir_tol, makan_tim, biaya_pelabuhan, tiket, transit, sewa_mobil, gaji_sopir, lainnya.' },
                            amount: { type: Type.NUMBER, description: 'Nominal Rupiah.' },
                            description: { type: Type.STRING, description: 'Keterangan pengeluaran.' },
                            date: { type: Type.STRING, description: 'Tanggal YYYY-MM-DD (opsional).' },
                        },
                        required: ['amount', 'description'],
                    },
                },
            },
        },
    },
    {
        name: 'propose_assign_stts_to_voyage',
        description:
            'Siapkan DRAFT memasukkan STT yang belum ikut kapal manapun ke dalam sebuah pemberangkatan (voyage) untuk dikonfirmasi user.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                voyageNumber: { type: Type.STRING, description: 'Nomor pemberangkatan tujuan (mis. "VOY045") atau nama kapal. Kosongkan untuk pemberangkatan terbaru.' },
                voyageId: { type: Type.STRING, description: 'Opsional: ID Firestore voyage.' },
                noSTTs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Daftar nomor STT spesifik yang ingin dimasukkan (contoh: ["STT019801", "19802"]).',
                },
                assignAllUnassignedPending: {
                    type: Type.BOOLEAN,
                    description: 'Set true jika user ingin memasukkan semua STT unassigned sesuai filter tanggal/tujuan/client.',
                },
                statusFilter: { type: Type.STRING, description: 'Saat assignAllUnassignedPending=true: "pending" (default), "dikirim", atau "all".' },
                startDate: { type: Type.STRING, description: 'Opsional: filter tanggal mulai YYYY-MM-DD.' },
                endDate: { type: Type.STRING, description: 'Opsional: filter tanggal akhir YYYY-MM-DD.' },
                tujuan: { type: Type.STRING, description: 'Opsional: filter kota tujuan.' },
                clientName: { type: Type.STRING, description: 'Opsional: filter nama pengirim.' },
            },
        },
    },
];

const ALLOWED_TOOLS_BY_ROLE: Record<WaAgentRole, string[]> = {
    helper: ['search_clients', 'get_transaction_by_stt'],
    pengurus: [
        'search_clients',
        'get_transaction_by_stt',
        'list_unbilled_transactions',
        'list_pending_stt_with_price_history',
        'list_unassigned_stts',
        'get_unpaid_invoices_summary',
        'get_voyage_summary',
        'create_stt',
        'update_stt',
        'propose_create_voyage',
        'propose_assign_stts_to_voyage',
    ],
    admin: ALL_TOOL_DECLARATIONS.map((t) => t.name!),
    owner: ALL_TOOL_DECLARATIONS.map((t) => t.name!),
};

export function getToolDeclarationsForRole(role: WaAgentRole): FunctionDeclaration[] {
    const allowed = new Set(ALLOWED_TOOLS_BY_ROLE[role] || ALLOWED_TOOLS_BY_ROLE.helper);
    return ALL_TOOL_DECLARATIONS.filter((decl) => decl.name && allowed.has(decl.name));
}

export async function dispatchAgentToolCall(
    name: string,
    args: Record<string, any>,
    role: WaAgentRole,
    actorName: string = 'Admin WA'
): Promise<{
    result: Record<string, unknown>;
    pendingAction?: PendingAction;
    replyMedia?: ReplyMediaItem[];
    suppressReplyText?: boolean;
}> {
    const allowed = new Set(ALLOWED_TOOLS_BY_ROLE[role] || []);
    if (!allowed.has(name)) {
        return {
            result: { ok: false, error: `Role "${role}" tidak memiliki izin menggunakan tool "${name}".` },
        };
    }

    switch (name) {
        case 'search_clients':
            return { result: await toolSearchClients(String(args.query || '')) };
        case 'get_transaction_by_stt':
            return { result: await toolGetTransactionBySTT(String(args.noSTT || '')) };
        case 'list_unbilled_transactions':
            return {
                result: await toolListUnbilledTransactions(
                    args.clientName ? String(args.clientName) : undefined,
                    typeof args.limit === 'number' ? args.limit : 20
                ),
            };
        case 'list_pending_stt_with_price_history':
            return {
                result: await toolListPendingSttWithPriceHistory({
                    period: args.period ? String(args.period) : undefined,
                    startDate: args.startDate ? String(args.startDate) : undefined,
                    endDate: args.endDate ? String(args.endDate) : undefined,
                    onlyUnpriced: typeof args.onlyUnpriced === 'boolean' ? args.onlyUnpriced : true,
                    clientName: args.clientName ? String(args.clientName) : undefined,
                    branch: args.branch ? String(args.branch) : undefined,
                    limit: typeof args.limit === 'number' ? args.limit : 25,
                }),
            };
        case 'list_unassigned_stts':
            return {
                result: await toolListUnassignedStts({
                    statusFilter: args.statusFilter ? String(args.statusFilter) : 'pending',
                    startDate: args.startDate ? String(args.startDate) : undefined,
                    endDate: args.endDate ? String(args.endDate) : undefined,
                    tujuan: args.tujuan ? String(args.tujuan) : undefined,
                    clientName: args.clientName ? String(args.clientName) : undefined,
                    branch: args.branch ? String(args.branch) : undefined,
                    limit: typeof args.limit === 'number' ? args.limit : 30,
                }),
            };
        case 'get_unpaid_invoices_summary':
            return {
                result: await toolGetUnpaidInvoicesSummary(
                    args.clientName ? String(args.clientName) : undefined
                ),
            };
        case 'get_voyage_summary':
            return {
                result: await toolGetVoyageSummary(args.searchQuery ? String(args.searchQuery) : undefined),
            };
        case 'create_stt':
            return await toolCreateSttDirect(args, actorName);
        case 'update_stt':
            return await toolUpdateSttDirect(args, actorName);
        case 'delete_stt':
            return await toolDeleteSttDirect(args, actorName);
        case 'batch_update_stt_pricing':
            return await toolBatchUpdateSttPricingDirect(args, actorName);
        case 'create_invoice':
            return await toolCreateInvoiceDirect(args, actorName);
        case 'update_invoice':
            return await toolUpdateInvoiceDirect(args, actorName);
        case 'delete_invoice':
            return await toolDeleteInvoiceDirect(args, actorName);
        case 'get_invoice_image':
            return await toolGetInvoiceImage({
                invoiceNumber: args.invoiceNumber ? String(args.invoiceNumber) : undefined,
                invoiceId: args.invoiceId ? String(args.invoiceId) : undefined,
                clientName: args.clientName ? String(args.clientName) : undefined,
                noText: typeof args.noText === 'boolean' ? args.noText : undefined,
            });
        case 'get_voyage_invoice_images':
            return await toolGetVoyageInvoiceImages({
                voyageId: args.voyageId ? String(args.voyageId) : undefined,
                voyageNumber: args.voyageNumber ? String(args.voyageNumber) : undefined,
                shipName: args.shipName ? String(args.shipName) : undefined,
                departureDate: args.departureDate ? String(args.departureDate) : undefined,
                startDate: args.startDate ? String(args.startDate) : undefined,
                endDate: args.endDate ? String(args.endDate) : undefined,
                silentText: typeof args.silentText === 'boolean' ? args.silentText : true,
            });
        case 'propose_create_voyage':
            return await buildCreateVoyageProposal(args);
        case 'propose_save_voyage_expenses':
            return await buildSaveVoyageExpensesProposal(args);
        case 'propose_assign_stts_to_voyage':
            return await buildAssignSttsToVoyageProposal(args);
        default:
            return { result: { ok: false, error: `Tool "${name}" tidak dikenal.` } };
    }
}

