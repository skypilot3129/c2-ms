import 'server-only';
import admin from 'firebase-admin';
import {
    FunctionCallingConfigMode,
    GoogleGenAI,
    ThinkingLevel,
    type Content,
    type Part,
    type ThinkingConfig,
} from '@google/genai';
import { adminDb } from '@/lib/firebase-admin';
import { COMPANY_INFO } from '@/lib/company-config';
import { ROLE_LABELS } from '@/types/roles';
import {
    normalizeWaPhone,
    type PendingAction,
    type ReplyMediaItem,
    type WaAgentHistoryItem,
    type WaAgentRole,
    type WaAgentUser,
    type WaThinkingLevel,
    type WaTokenUsage,
} from '@/types/wa-agent';
import {
    dispatchAgentToolCall,
    executeAssignSttsToVoyage,
    executeBatchUpdateSttPricing,
    executeCreateInvoice,
    executeCreateStt,
    executeCreateVoyage,
    executeSaveVoyageExpenses,
    getToolDeclarationsForRole,
} from './cce-tools';
import { renderInvoicePngById } from './invoice-image';
import { getWaAgentConfig } from './openwa-client';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_ITEMS = 12;
const MAX_AGENT_TOOL_STEPS = 25;
const inFlightMessageIds = new Set<string>();

const CONFIRM_REGEX =
    /^(ya|iya|yes|y|ok|oke|okay|setuju|lanjut|kirim|simpan|gas|betul|proses|sudah\s+benar|benar\s+semua|sudah\s+benar[\s,]+proses|oke\s+benar|ya\s+proses|lanjut\s+proses|oke\s+lanjut\s+proses)[.!]*$/i;
const CANCEL_REGEX = /^(batal|tidak|no|n|cancel|gak|nggak|jangan|stop)[.!]*$/i;

export interface AgentProcessInput {
    phone: string;
    text: string;
    media?: {
        base64: string;
        mimeType: string;
    };
    messageId?: string;
    source: 'whatsapp' | 'simulator';
    overrideRole?: WaAgentRole;
    overrideName?: string;
}

export interface AgentProcessOutput {
    replyText: string;
    replyMedia?: ReplyMediaItem[];
    suppressReplyText?: boolean;
    toolsUsed: string[];
    tokenUsage?: WaTokenUsage;
    pendingAction: PendingAction | null;
    status: 'ok' | 'blocked' | 'disabled' | 'error';
    ignored?: boolean;
}

function resolveThinkingConfig(modelName: string, level?: WaThinkingLevel): ThinkingConfig | undefined {
    const lvl: WaThinkingLevel = level || 'low';
    const normalized = modelName.trim().toLowerCase();

    if (normalized.startsWith('gemini-4-') || normalized.startsWith('gemini-3')) {
        const mapped =
            lvl === 'minimal'
                ? ThinkingLevel.MINIMAL
                : lvl === 'medium'
                  ? ThinkingLevel.MEDIUM
                  : lvl === 'high'
                    ? ThinkingLevel.HIGH
                    : ThinkingLevel.LOW;
        return { thinkingLevel: mapped };
    }

    if (normalized.startsWith('gemini-2.5-')) {
        const budget =
            lvl === 'minimal' ? 0 : lvl === 'medium' ? 2048 : lvl === 'high' ? 8192 : 512;
        return { thinkingBudget: budget };
    }

    return undefined;
}

function stripUndefinedDeep<T>(value: T): T {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    if (value instanceof Date || value instanceof admin.firestore.Timestamp) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.filter((item) => item !== undefined).map((item) => stripUndefinedDeep(item)) as unknown as T;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
        return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== undefined) {
            out[k] = stripUndefinedDeep(v);
        }
    }
    return out as T;
}

function fmtRupiah(num: number): string {
    return `Rp ${Math.round(num || 0).toLocaleString('id-ID')}`;
}

function buildSystemInstruction(
    userName: string,
    userRole: WaAgentRole,
    activePendingAction?: PendingAction | null
): string {
    const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const roleLabel = ROLE_LABELS[userRole] || userRole;
    const bankLines = COMPANY_INFO.bankAccounts
        .map((b) => `${b.bank} ${b.accountNumber} a/n ${b.accountName}`)
        .join(', ');

    const shouldIncludeJsonContext =
        activePendingAction &&
        (activePendingAction.type === 'batch_update_stt_pricing' ||
            activePendingAction.type === 'create_voyage' ||
            activePendingAction.type === 'save_voyage_expenses' ||
            activePendingAction.type === 'assign_stts_to_voyage');

    const pendingContextBlock = activePendingAction
        ? `\n\nDRAFT KONFIRMASI YANG SEDANG MENUNGGU SAAT INI (type: ${activePendingAction.type}):\n${activePendingAction.summaryText}${
              shouldIncludeJsonContext
                  ? `\nDATA JSON DRAFT AKTIF (gunakan saat user meminta revisi sebagian agar item lain tidak hilang):\n${JSON.stringify(
                        activePendingAction.payload
                    )}`
                  : ''
          }`
        : '';

    return `Anda adalah *Asisten Operasional AI* resmi untuk ekspedisi *${COMPANY_INFO.name} (CCE)*.
Anda berbicara langsung dengan staf internal melalui WhatsApp.

PROFIL LAWAN BICARA SAAT INI:
- Nama: ${userName}
- Jabatan / Role: ${roleLabel} (${userRole})
- Tanggal Hari Ini (WIB): ${todayIso}

PENGETAHUAN WAJIB TENTANG SISTEM CCE:
1. Cabang & Counter STT:
   - \`surabaya\` (Surabaya Pusat — default jika cabang tidak disebut)
   - \`bandung\` (Bandung)
   - \`makassar\` (Makassar)
   - Format nomor STT: \`STT\` + 6 digit (contoh \`STT019787\`).
2. Rute Utama: Surabaya / Bandung -> seluruh Sulawesi (Makassar, Palu, Kendari, Manado, Gorontalo, dll).
3. Aturan Transaksi & Biaya:
   - \`regular\`: Total = Berat (atau Koli jika berat 0) × Harga satuan.
   - \`borongan\`: Harga yang disebut = Total harga borongan.
   - Pembayaran: \`Tunai\`, \`Kredit\` (Tagihan), atau \`DP\`.
   - Pelunasan: \`Cash\`, \`TF\`, atau \`Pending\`.
   - Jika kena pajak (\`isTaxable=true\` / PKP), ditambahkan PPN **1.1%** pada invoice.
4. Rekening Transfer & Saldo Real Penagihan Ika:
   - Standar (Non-PKP): ${bankLines} (di Saldo Real terpetakan ke bank \`bca\`, \`bri\`, \`mandiri\`, atau \`perusahaan\` untuk Cash/Tunai)
   - Faktur Pajak (PKP): BCA 187 1414 187 a/n CAHAYA CARGO EXPRESS CV

ATURAN GAYA BICARA & EKSEKUSI KETAT:
- **SINGKAT, PADAT, JELAS, TO THE POINT.** DILARANG bertele-tele, DILARANG pembuka basa-basi (*"Halo"*, *"Baik, saya akan..."*, *"Berikut adalah informasi..."*) maupun penutup berbasa-basi (*"Ada lagi yang bisa saya bantu?"*). Langsung tampilkan hasil, poin data, angka, atau status aksi.
- **EFISIENSI MULTI-LANGKAH:** Jika perintah mencakup banyak item/client sekaligus (mis. buat beberapa invoice, buat/revisi beberapa STT, atau cek beberapa data), panggil beberapa tool sekaligus dalam satu giliran (*parallel function calls*) atau gunakan tool batch seperti \`batch_update_stt_pricing\` agar langsung tuntas.
- **DILARANG mengarang angka, status resi, nama client, atau nominal tagihan.** Selalu panggil tool Firestore terlebih dahulu.
- **EKSEKUSI LANGSUNG (TANPA KONFIRMASI) UNTUK STT & INVOICE:**
  - Buat / edit / hapus STT (\`create_stt\`, \`update_stt\`, \`batch_update_stt_pricing\`, \`delete_stt\`): **langsung eksekusi** tanpa meminta konfirmasi YA/BATAL (kecuali data wajib seperti nama pengirim/penerima/tujuan pada STT baru benar-benar belum ada, tanya singkat 1 baris).
  - Buat / revisi / hapus Invoice (\`create_invoice\`, \`update_invoice\`, \`delete_invoice\`): **langsung eksekusi** tanpa konfirmasi YA/BATAL. Saat membuat/merevisi invoice, gambar PNG format A5/PKP otomatis ikut terkirim ke WhatsApp — cukup laporkan ringkas No. Invoice, Client, Total, dan jumlah resi.
  - **ATURAN GABUNG INVOICE PENERIMA SAMA (MULTI-PENGIRIM):** STT yang memiliki **nama PENERIMA sama tetapi PENGIRIM berbeda-beda BISA & BOLEH dijadikan 1 Invoice yang sama** (ditagihkan ke nama Penerima tsb atau nama pihak tertagih yang disebut user). Jika user memerintahkan buat 1 invoice untuk beberapa STT penerima sama / pengirim beda (misal sebut daftar no STT atau nama penerima), langsung gabung semua ke **1 panggilan \`create_invoice\`** (\`noSTTs\` dan/atau \`penerimaName\` + \`clientName\`), jangan dipecah per pengirim.
  - Minta gambar invoice lama: panggil \`get_invoice_image\` langsung (set \`noText: true\` jika user minta kirim gambar saja tanpa teks).
  - Minta kirim SEMUA gambar invoice di suatu pemberangkatan / tanggal keberangkatan kapal (mis. "kirimkan semua gambar invoice pemberangkatan kapal tgl 24"): langsung panggil \`get_voyage_invoice_images\` (isi \`departureDate\` format \`YYYY-MM-DD\` berdasarkan Tanggal Hari Ini jika disebut tanggal, atau \`voyageNumber\`/\`shipName\`, dan \`silentText: true\`) agar semua gambar invoice langsung dikirim tanpa teks apa pun.
- **ALUR CEK STT PENDING MINGGU INI / TANPA HARGA:**
  1. Jika user tanya cek STT pending minggu ini (atau rentang tanggal) yang belum ada harga dan minta data customer + harga riwayatnya: panggil \`list_pending_stt_with_price_history\` (\`onlyUnpriced: true\`, \`period: "this_week"\` atau \`startDate\`/\`endDate\`). JANGAN ubah dulu — tampilkan daftar padat bernomor: **No. STT | Customer → Tujuan | Koli / Berat | Riwayat Harga** (tulis \`-\` jika belum ada riwayat), lalu tutup 1 baris: *"Kirim harga yang mau dipakai, langsung saya update & ubah status ke dikirim."*
  2. Saat user membalas memberi harga yang ingin dipakai (per No. STT maupun per customer) dan minta ubah status ke \`dikirim\`: langsung panggil \`batch_update_stt_pricing\` (\`targetStatus: "dikirim"\`) tanpa konfirmasi lagi, lalu tampilkan ringkasan padat hasil update.
- **MODUL PEMBERANGKATAN (VOYAGES):**
  1. Cek detail lengkap omzet, rincian biaya, laba/margin, dan catatan keterangan pemberangkatan: panggil \`get_voyage_summary\` (isi \`searchQuery\`, \`departureDate\`, \`month\`, \`period\`, atau \`includeCargoList: true\` jika ditanya rincian STT/keterangan per resi). Sajikan angka Omzet STT + Penjualan Makassar, seluruh pos biaya (Tiket SBY, Tiket MKS, Ops SBY, Ops MKS, Gaji Sopir, Sewa Mobil, Ops Tambahan, pengeluaran berkategori), Laba Bersih & Margin, status lunas/belum lunas muatan, serta \`voyageNotes\` & \`costNotes\` secara lengkap dan rapi.
  2. Buat pemberangkatan (\`propose_create_voyage\`): unit berangkat manual bebas nama sopir/nopol tanpa pilih armada.
  3. Input biaya (\`propose_save_voyage_expenses\`): targetkan VOY yang disebut atau terbaru.
  4. Cek & masukkan STT pending yang belum ikut kapal mana pun: panggil \`list_unassigned_stts\` lalu \`propose_assign_stts_to_voyage\`.
- **MODUL PENAGIHAN IKA (PELUNASAN BUKTI TF & REKAPAN HARIAN):**
  1. **Pelunasan Langsung dari Gambar Bukti Transfer + Teks Konfirmasi (TANPA KONFIRMASI YA/BATAL):**
     - Jika user mengirim foto/screenshot bukti transfer/pembayaran disertai teks konfirmasi (atau konfirmasi teks pelunasan): ekstrak nama pengirim/client, nominal Rupiah, rekening bank tujuan (\`bca\`/\`bri\`/\`mandiri\`/\`perusahaan\` jika cash), nomor referensi/berita TF, tanggal bayar, serta nomor invoice/STT.
     - Jika nomor invoice belum disebut, cek dulu dengan \`get_penagihan_ika_overview\` (\`clientName\`, \`amountHint\`). Bila target invoice jelas atau cocok secara nominal/client, **langsung panggil \`pay_penagihan_ika_invoice\`** tanpa minta konfirmasi YA/BATAL (kecuali ambigu beberapa invoice unpaid dengan nominal tidak cocok, tanyakan singkat nomor invoicenya).
     - **Wajib langsung sertakan ringkasan uang masuk Penagihan Ika hari itu** dari \`dailyCollectionSummary\` yang dikembalikan tool (No. Invoice yang baru dilunasi, nominal, metode/bank, plus **Total Terkumpul Hari Ini** beserta jumlah invoice lunas dan pecahan per bank/cash).
  2. **Rekap Harian / Per Hari Penagihan Ika:** Jika user menanyakan per hari Penagihan Ika dapat berapa uang dari invoice yang lunas (hari ini, tanggal tertentu, minggu ini, bulan ini), panggil \`get_penagihan_ika_daily_recap\` lalu tampilkan ringkas per tanggal: total Rupiah masuk, jumlah invoice lunas, pecahan BCA/BRI/Mandiri/Cash, dan daftar client/invoice-nya.
  3. **Cek Data Penagihan Ika, Catat Feedback, & Batal Lunas:** Gunakan \`get_penagihan_ika_overview\` untuk cek piutang/status lunas per pemberangkatan kapal atau per client, \`save_penagihan_ika_feedback\` untuk mencatat respon/janji bayar customer, dan \`revert_penagihan_ika_payment\` jika diminta membatalkan status lunas.
- Jika user mengirim **voice note** atau **foto nota**, ekstrak data secara cermat lalu langsung jalankan sesuai aturan di atas.
- Jika tool menolak karena batasan role (\`${userRole}\`), jawab singkat bahwa fitur hanya untuk Owner/Admin.${pendingContextBlock}`;
}

async function resolveAuthorizedUser(phone: string): Promise<WaAgentUser | null> {
    if (!phone) return null;
    const snap = await adminDb
        .collection('wa_agent_users')
        .where('phone', '==', phone)
        .where('active', '==', true)
        .limit(1)
        .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    const d = doc.data() || {};
    return {
        id: doc.id,
        phone: String(d.phone || phone),
        name: String(d.name || 'Staf CCE'),
        role: (d.role as WaAgentRole) || 'helper',
        active: Boolean(d.active),
        notes: d.notes ? String(d.notes) : undefined,
        createdAt: d.createdAt?.toDate?.() || new Date(),
        updatedAt: d.updatedAt?.toDate?.() || new Date(),
    };
}

async function writeAuditLog(entry: {
    messageId?: string;
    phone: string;
    userName?: string;
    userRole?: WaAgentRole;
    source: 'whatsapp' | 'simulator';
    incomingText: string;
    replyText: string;
    toolsUsed: string[];
    tokenUsage?: WaTokenUsage;
    status: 'ok' | 'blocked' | 'disabled' | 'error';
    errorMessage?: string;
}) {
    try {
        await adminDb.collection('wa_agent_logs').add({
            ...(entry.messageId ? { messageId: entry.messageId } : {}),
            phone: entry.phone,
            ...(entry.userName ? { userName: entry.userName } : {}),
            ...(entry.userRole ? { userRole: entry.userRole } : {}),
            source: entry.source,
            incomingText: entry.incomingText.slice(0, 1000),
            replyText: entry.replyText.slice(0, 2000),
            toolsUsed: entry.toolsUsed,
            ...(entry.tokenUsage ? { tokenUsage: entry.tokenUsage } : {}),
            status: entry.status,
            ...(entry.errorMessage ? { errorMessage: entry.errorMessage } : {}),
            createdAt: admin.firestore.Timestamp.now(),
        });
    } catch (err) {
        console.error('[WA Agent] Failed writing audit log:', err);
    }
}

async function executePendingAction(
    pending: PendingAction,
    actorName: string
): Promise<{ replyText: string; toolName: string; replyMedia?: ReplyMediaItem[] }> {
    if (pending.type === 'create_stt') {
        const res = await executeCreateStt(pending.payload, actorName);
        return {
            toolName: 'execute_create_stt',
            replyText: [
                `✅ *STT Baru Berhasil Disimpan!*`,
                `• No. STT: *${res.noSTT}*`,
                `• Pengirim: ${res.pengirimName}${res.createdNewClient ? ' _(client baru otomatis ditambahkan)_' : ''}`,
                `• Total: *${fmtRupiah(res.jumlah)}*`,
                ``,
                `Data sudah otomatis sinkron ke aplikasi web & Daftar Transaksi CCE.`,
            ].join('\n'),
        };
    }

    if (pending.type === 'batch_update_stt_pricing') {
        const res = await executeBatchUpdateSttPricing(pending.payload, actorName);
        const itemLines = res.updatedItems
            .slice(0, 20)
            .map(
                (it, idx) =>
                    `${idx + 1}. *${it.noSTT}* (${it.pengirimName}): *${fmtRupiah(it.jumlah)}* → Status *${it.newStatus}*`
            );
        if (res.updatedItems.length > 20) {
            itemLines.push(`... dan ${res.updatedItems.length - 20} STT lainnya`);
        }
        if (res.skippedItems.length > 0) {
            itemLines.push('');
            itemLines.push('⚠️ *Dilewati:*');
            for (const sk of res.skippedItems) {
                itemLines.push(`• ${sk.noSTT}: ${sk.reason}`);
            }
        }
        return {
            toolName: 'execute_batch_update_stt_pricing',
            replyText: [
                `✅ *${res.updatedCount} STT Berhasil Diisi Harga & Diupdate!*`,
                ...itemLines,
                ``,
                `• Total Nilai: *${fmtRupiah(res.totalNominal)}*`,
                `Semua data sudah otomatis sinkron ke Modul Resi & Transaksi CCE.`,
            ].join('\n'),
        };
    }

    if (pending.type === 'create_voyage') {
        const res = await executeCreateVoyage(pending.payload, actorName);
        return {
            toolName: 'execute_create_voyage',
            replyText: [
                `✅ *Pemberangkatan Baru Berhasil Dibuat!*`,
                `• No. Voyage: *${res.voyageNumber}*`,
                `• Rute: ${res.route}`,
                `• Kapal: ${res.shipName || '-'}`,
                `• Unit Berangkat: ${res.vehicleNumbers.length > 0 ? res.vehicleNumbers.join(', ') : '-'}`,
                `• Tgl Berangkat: ${res.departureDate}${res.arrivalDate ? ` | Tgl Tiba: ${res.arrivalDate}` : ''}`,
                `• Detail Web: ${res.detailUrl}`,
                ``,
                `Langkah berikutnya, Anda bisa langsung ketik:`,
                `• *"Input biaya ${res.voyageNumber}: ..."* untuk catat biaya kapal`,
                `• *"Cek STT pending yang belum ikut kapal"* untuk memasukkan muatan ke ${res.voyageNumber}`,
            ].join('\n'),
        };
    }

    if (pending.type === 'save_voyage_expenses') {
        const res = await executeSaveVoyageExpenses(pending.payload, actorName);
        return {
            toolName: 'execute_save_voyage_expenses',
            replyText: [
                `✅ *Biaya Pemberangkatan ${res.voyageNumber} Tersimpan!*`,
                `• Kapal: ${res.shipName}`,
                ...(res.totalShipCosts > 0 ? [`• Total Biaya Kapal: *${fmtRupiah(res.totalShipCosts)}*`] : []),
                ...(res.generalExpensesAddedCount > 0
                    ? [`• Pengeluaran Tambahan: ${res.generalExpensesAddedCount} item (*${fmtRupiah(res.totalGeneralExpenses)}*)`]
                    : []),
                `• Detail Web: ${res.detailUrl}`,
                ``,
                `Jika mau lanjut masukkan STT ke ${res.voyageNumber}, ketik *"Cek STT pending yang belum ikut kapal"*.`,
            ].join('\n'),
        };
    }

    if (pending.type === 'assign_stts_to_voyage') {
        const res = await executeAssignSttsToVoyage(pending.payload, actorName);
        return {
            toolName: 'execute_assign_stts_to_voyage',
            replyText: [
                `✅ *${res.addedCount} STT Berhasil Dimasukkan ke ${res.voyageNumber}!*`,
                `• Kapal: ${res.shipName}`,
                `• Muatan Ditambahkan: ${res.addedKoli} koli | ${res.addedWeight.toLocaleString('id-ID')} kg/vol`,
                `• Nilai Muatan Ditambahkan: *${fmtRupiah(res.addedOmzet)}*`,
                `• Total STT di ${res.voyageNumber} saat ini: *${res.totalSttInVoyage} resi*`,
                `• Detail Web: ${res.detailUrl}`,
            ].join('\n'),
        };
    }

    const inv = await executeCreateInvoice(pending.payload, actorName);
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
    } catch (imgErr) {
        console.error('[WA Agent] Failed rendering invoice PNG after creation:', imgErr);
    }

    return {
        toolName: 'execute_create_invoice',
        replyMedia,
        replyText: [
            `✅ *Invoice Berhasil Diterbitkan!*`,
            `• No. Invoice: *${inv.invoiceNumber}*`,
            `• Client: ${inv.clientName} (${inv.sttCount} resi)`,
            `• Total Tagihan: *${fmtRupiah(inv.totalAmount)}*`,
            `• Link Cetak: ${inv.printUrl}`,
            ``,
            `Semua STT terkait otomatis tertaut dan tidak akan tertagih ganda.`,
        ].join('\n'),
    };
}

export async function processAgentMessage(input: AgentProcessInput): Promise<AgentProcessOutput> {
    const cleanPhone = normalizeWaPhone(input.phone) || (input.source === 'simulator' ? '6280000000000' : '');
    const userText = (input.text || '').trim();
    const hasMedia = Boolean(input.media?.base64);
    const incomingPreview = userText || (hasMedia ? `[Media: ${input.media?.mimeType}]` : '');

    // 1. Check global kill switch for live WhatsApp messages
    const config = await getWaAgentConfig();
    if (input.source === 'whatsapp' && !config.enabled) {
        return {
            replyText: '',
            toolsUsed: [],
            pendingAction: null,
            status: 'disabled',
            ignored: true,
        };
    }

    // 2. Idempotency check for WhatsApp webhooks (skip retried / in-flight messageIds)
    const trackedMessageId = input.source === 'whatsapp' && input.messageId ? input.messageId : '';
    if (trackedMessageId) {
        if (inFlightMessageIds.has(trackedMessageId)) {
            return {
                replyText: '',
                toolsUsed: [],
                pendingAction: null,
                status: 'ok',
                ignored: true,
            };
        }
        const dupSnap = await adminDb
            .collection('wa_agent_logs')
            .where('messageId', '==', trackedMessageId)
            .limit(1)
            .get();
        if (!dupSnap.empty) {
            return {
                replyText: '',
                toolsUsed: [],
                pendingAction: null,
                status: 'ok',
                ignored: true,
            };
        }
        inFlightMessageIds.add(trackedMessageId);
    }

    try {
    // 3. Verify whitelist & role
    let resolvedRole: WaAgentRole | null = input.source === 'simulator' && input.overrideRole ? input.overrideRole : null;
    let resolvedName = input.overrideName || 'Admin Simulator';

    if (!resolvedRole) {
        const waUser = await resolveAuthorizedUser(cleanPhone);
        if (!waUser) {
            await writeAuditLog({
                messageId: input.messageId,
                phone: cleanPhone || input.phone,
                source: input.source,
                incomingText: incomingPreview,
                replyText: '(Diabaikan — nomor tidak terdaftar)',
                toolsUsed: [],
                status: 'blocked',
            });
            return {
                replyText: '',
                toolsUsed: [],
                pendingAction: null,
                status: 'blocked',
                ignored: true,
            };
        }
        resolvedRole = waUser.role;
        resolvedName = waUser.name;
    }

    // 4. Load session memory + pending action
    const sessionId = input.source === 'simulator' ? `sim_${cleanPhone}_${resolvedRole}` : cleanPhone;
    const sessionRef = adminDb.collection('wa_agent_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const nowMs = Date.now();

    let history: WaAgentHistoryItem[] = [];
    let pendingAction: PendingAction | null = null;

    if (sessionSnap.exists) {
        const sData = sessionSnap.data() || {};
        const updatedMs = sData.updatedAt?.toDate?.()?.getTime?.() || 0;
        if (nowMs - updatedMs <= SESSION_TTL_MS) {
            if (Array.isArray(sData.history)) {
                history = sData.history.slice(-MAX_HISTORY_ITEMS);
            }
            if (sData.pendingAction && nowMs - (sData.pendingAction.createdAt || 0) <= SESSION_TTL_MS) {
                pendingAction = sData.pendingAction as PendingAction;
            }
        }
    }

    const appendAndSaveSession = async (userTurnText: string, modelReplyText: string, nextPending: PendingAction | null) => {
        const updatedHistory: WaAgentHistoryItem[] = [
            ...history,
            { role: 'user' as const, text: userTurnText, timestamp: nowMs },
            { role: 'model' as const, text: modelReplyText, timestamp: Date.now() },
        ].slice(-MAX_HISTORY_ITEMS);

        await sessionRef.set({
            phone: cleanPhone,
            history: updatedHistory,
            pendingAction: nextPending ? stripUndefinedDeep(nextPending) : null,
            updatedAt: admin.firestore.Timestamp.now(),
        });
    };

    // 5. Fast 2-step confirmation intercept (YA / BATAL)
    if (pendingAction && !hasMedia && userText) {
        if (CONFIRM_REGEX.test(userText)) {
            try {
                const { replyText, toolName, replyMedia } = await executePendingAction(pendingAction, resolvedName);
                await appendAndSaveSession(userText, replyText, null);
                await writeAuditLog({
                    messageId: input.messageId,
                    phone: cleanPhone,
                    userName: resolvedName,
                    userRole: resolvedRole,
                    source: input.source,
                    incomingText: incomingPreview,
                    replyText,
                    toolsUsed: [toolName],
                    status: 'ok',
                });
                return {
                    replyText,
                    ...(replyMedia && replyMedia.length > 0 ? { replyMedia } : {}),
                    toolsUsed: [toolName],
                    pendingAction: null,
                    status: 'ok',
                };
            } catch (err: any) {
                const errReply = `❌ Gagal menyimpan data: ${err?.message || 'Terjadi kesalahan saat menulis ke database.'}`;
                await appendAndSaveSession(userText, errReply, null);
                await writeAuditLog({
                    messageId: input.messageId,
                    phone: cleanPhone,
                    userName: resolvedName,
                    userRole: resolvedRole,
                    source: input.source,
                    incomingText: incomingPreview,
                    replyText: errReply,
                    toolsUsed: [],
                    status: 'error',
                    errorMessage: err?.message || 'Unknown error',
                });
                return { replyText: errReply, toolsUsed: [], pendingAction: null, status: 'error' };
            }
        }

        if (CANCEL_REGEX.test(userText)) {
            const cancelReply = 'Baik, draft sebelumnya sudah dibatalkan. Ada lagi yang bisa saya bantu?';
            await appendAndSaveSession(userText, cancelReply, null);
            await writeAuditLog({
                messageId: input.messageId,
                phone: cleanPhone,
                userName: resolvedName,
                userRole: resolvedRole,
                source: input.source,
                incomingText: incomingPreview,
                replyText: cancelReply,
                toolsUsed: ['cancel_pending_action'],
                status: 'ok',
            });
            return { replyText: cancelReply, toolsUsed: ['cancel_pending_action'], pendingAction: null, status: 'ok' };
        }
    }

    // 6. Gemini 2.5 Agent Tool-Calling Loop
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const msg = 'GEMINI_API_KEY belum terkonfigurasi di environment server CCE.';
        return { replyText: msg, toolsUsed: [], pendingAction, status: 'error' };
    }

    const ai = new GoogleGenAI({ apiKey });
    const toolDeclarations = getToolDeclarationsForRole(resolvedRole);
    const systemInstruction = buildSystemInstruction(resolvedName, resolvedRole, pendingAction);

    const contents: Content[] = history.map((item) => ({
        role: item.role,
        parts: [{ text: item.text }],
    }));

    const currentParts: Part[] = [];
    if (userText) {
        currentParts.push({ text: userText });
    }
    if (input.media?.base64 && input.media?.mimeType) {
        currentParts.push({
            inlineData: {
                data: input.media.base64,
                mimeType: input.media.mimeType,
            },
        });
        if (!userText) {
            currentParts.push({
                text: 'Tolong pahami gambar atau voice note yang dikirim ini dan jalankan perintah sesuai konteks operasional CCE.',
            });
        }
    }
    if (currentParts.length === 0) {
        return {
            replyText: 'Silakan kirim pesan teks, voice note, atau foto nota untuk diproses.',
            toolsUsed: [],
            pendingAction,
            status: 'ok',
        };
    }
    contents.push({ role: 'user', parts: currentParts });

    const toolsUsed: string[] = [];
    const collectedMedia: ReplyMediaItem[] = [];
    let suppressReplyText = false;
    let nextPendingAction: PendingAction | null = pendingAction;
    let finalReplyText = '';

    const activeModel = config.modelName || 'gemini-4-hydrogen';
    const thinkingConfig = resolveThinkingConfig(activeModel, config.thinkingLevel);

    let promptTokens = 0;
    let outputTokens = 0;
    let thoughtTokens = 0;
    let cachedTokens = 0;
    let totalTokens = 0;

    const accumulateUsage = (usageMeta: any) => {
        if (!usageMeta) return;
        promptTokens += Number(usageMeta.promptTokenCount) || 0;
        outputTokens += Number(usageMeta.candidatesTokenCount) || 0;
        thoughtTokens += Number(usageMeta.thoughtsTokenCount) || 0;
        cachedTokens += Number(usageMeta.cachedContentTokenCount) || 0;
        totalTokens += Number(usageMeta.totalTokenCount) || 0;
    };

    try {
        for (let step = 0; step < MAX_AGENT_TOOL_STEPS; step++) {
            const response = await ai.models.generateContent({
                model: activeModel,
                contents,
                config: {
                    systemInstruction,
                    tools: toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations }] : undefined,
                    ...(thinkingConfig ? { thinkingConfig } : {}),
                },
            });
            accumulateUsage(response.usageMetadata);

            const calls = response.functionCalls;
            const candidateContent = response.candidates?.[0]?.content;

            if (!calls || calls.length === 0) {
                finalReplyText = (response.text || '').trim() || 'Siap, ada yang bisa saya bantu lagi?';
                break;
            }

            if (candidateContent) {
                contents.push(candidateContent);
            }

            const fnResponseParts: Part[] = [];
            for (const call of calls) {
                const fnName = call.name || '';
                const fnArgs = (call.args || {}) as Record<string, any>;
                toolsUsed.push(fnName);

                const outcome = await dispatchAgentToolCall(fnName, fnArgs, resolvedRole, resolvedName);
                if (outcome.pendingAction) {
                    nextPendingAction = outcome.pendingAction;
                }
                if (outcome.replyMedia && outcome.replyMedia.length > 0) {
                    collectedMedia.push(...outcome.replyMedia);
                }
                if (outcome.suppressReplyText === true) {
                    suppressReplyText = true;
                }

                fnResponseParts.push({
                    functionResponse: {
                        ...(call.id ? { id: call.id } : {}),
                        name: fnName,
                        response: outcome.result,
                    },
                });
            }

            if (suppressReplyText && collectedMedia.length > 0) {
                finalReplyText = '';
                break;
            }

            contents.push({ role: 'user', parts: fnResponseParts });
        }

        const isSilentMedia = suppressReplyText && collectedMedia.length > 0;
        if (!finalReplyText && !isSilentMedia) {
            if (nextPendingAction) {
                finalReplyText = `Mohon konfirmasi draft berikut:\n${nextPendingAction.summaryText}\n\nBalas *YA* untuk simpan atau *BATAL* untuk membatalkan.`;
            } else {
                const summaryResp = await ai.models.generateContent({
                    model: activeModel,
                    contents,
                    config: {
                        systemInstruction,
                        tools: toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations }] : undefined,
                        toolConfig:
                            toolDeclarations.length > 0
                                ? { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } }
                                : undefined,
                        ...(thinkingConfig ? { thinkingConfig } : {}),
                    },
                });
                accumulateUsage(summaryResp.usageMetadata);
                finalReplyText =
                    (summaryResp.text || '').trim() ||
                    `✅ Selesai diproses (${toolsUsed.length} aksi dijalankan).`;
            }
        }

        const persistedReplyText = isSilentMedia
            ? `[Mengirim ${collectedMedia.length} gambar invoice tanpa teks]`
            : finalReplyText;

        const tokenUsage: WaTokenUsage | undefined =
            totalTokens > 0
                ? {
                      promptTokens,
                      outputTokens,
                      thoughtTokens,
                      cachedTokens,
                      totalTokens,
                      modelName: activeModel,
                  }
                : undefined;

        await appendAndSaveSession(incomingPreview, persistedReplyText, nextPendingAction);
        await writeAuditLog({
            messageId: input.messageId,
            phone: cleanPhone,
            userName: resolvedName,
            userRole: resolvedRole,
            source: input.source,
            incomingText: incomingPreview,
            replyText: persistedReplyText,
            toolsUsed,
            ...(tokenUsage ? { tokenUsage } : {}),
            status: 'ok',
        });

        return {
            replyText: isSilentMedia ? '' : finalReplyText,
            ...(collectedMedia.length > 0 ? { replyMedia: collectedMedia } : {}),
            ...(isSilentMedia ? { suppressReplyText: true } : {}),
            toolsUsed,
            ...(tokenUsage ? { tokenUsage } : {}),
            pendingAction: nextPendingAction,
            status: 'ok',
        };
    } catch (err: any) {
        console.error('[WA Agent] Gemini processing error:', err);
        const errReply = 'Maaf, terjadi gangguan saat memproses pesan ke AI. Silakan coba lagi beberapa saat.';
        await writeAuditLog({
            messageId: input.messageId,
            phone: cleanPhone,
            userName: resolvedName,
            userRole: resolvedRole,
            source: input.source,
            incomingText: incomingPreview,
            replyText: errReply,
            toolsUsed,
            status: 'error',
            errorMessage: err?.message || 'Gemini error',
        });
        return {
            replyText: errReply,
            toolsUsed,
            pendingAction: nextPendingAction,
            status: 'error',
        };
    }
    } finally {
        if (trackedMessageId) {
            inFlightMessageIds.delete(trackedMessageId);
        }
    }
}
