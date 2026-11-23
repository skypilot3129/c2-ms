import 'server-only';
import admin from 'firebase-admin';
import { Type, type FunctionDeclaration } from '@google/genai';
import { adminDb } from '@/lib/firebase-admin';
import { BRANCHES, type Branch } from '@/types/branch';
import type { BeratUnit, CaraPelunasan, MetodePembayaran, TipeTransaksi } from '@/types/transaction';
import type {
    CreateInvoiceDraftPayload,
    CreateSttDraftPayload,
    PendingAction,
    WaAgentRole,
} from '@/types/wa-agent';

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
        name: 'propose_create_stt',
        description:
            'Siapkan DRAFT pembuatan STT/transaksi baru untuk dikonfirmasi user (YA/BATAL). JANGAN memanggil ini sebelum pengirimName, penerimaName, dan tujuan jelas.',
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
        name: 'propose_create_invoice',
        description:
            'Siapkan DRAFT pembuatan Invoice dari STT Pending yang belum tertagih untuk dikonfirmasi user (YA/BATAL).',
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
];

const ALLOWED_TOOLS_BY_ROLE: Record<WaAgentRole, string[]> = {
    helper: ['search_clients', 'get_transaction_by_stt'],
    pengurus: [
        'search_clients',
        'get_transaction_by_stt',
        'list_unbilled_transactions',
        'get_unpaid_invoices_summary',
        'get_voyage_summary',
        'propose_create_stt',
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
    role: WaAgentRole
): Promise<{ result: Record<string, unknown>; pendingAction?: PendingAction }> {
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
        case 'propose_create_stt':
            return buildCreateSttProposal(args);
        case 'propose_create_invoice':
            return await buildCreateInvoiceProposal(args);
        default:
            return { result: { ok: false, error: `Tool "${name}" tidak dikenal.` } };
    }
}

