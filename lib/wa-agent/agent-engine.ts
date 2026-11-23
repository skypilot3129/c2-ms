import 'server-only';
import admin from 'firebase-admin';
import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { adminDb } from '@/lib/firebase-admin';
import { COMPANY_INFO } from '@/lib/company-config';
import { ROLE_LABELS } from '@/types/roles';
import {
    normalizeWaPhone,
    type PendingAction,
    type WaAgentHistoryItem,
    type WaAgentRole,
    type WaAgentUser,
} from '@/types/wa-agent';
import {
    dispatchAgentToolCall,
    executeCreateInvoice,
    executeCreateStt,
    getToolDeclarationsForRole,
} from './cce-tools';
import { getWaAgentConfig } from './openwa-client';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_ITEMS = 10;

const CONFIRM_REGEX = /^(ya|iya|yes|y|ok|oke|okay|setuju|lanjut|kirim|simpan|gas|betul)$/i;
const CANCEL_REGEX = /^(batal|tidak|no|n|cancel|gak|nggak|jangan|stop)$/i;

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
    toolsUsed: string[];
    pendingAction: PendingAction | null;
    status: 'ok' | 'blocked' | 'disabled' | 'error';
    ignored?: boolean;
}

function fmtRupiah(num: number): string {
    return `Rp ${Math.round(num || 0).toLocaleString('id-ID')}`;
}

function buildSystemInstruction(userName: string, userRole: WaAgentRole): string {
    const todayIso = new Date().toISOString().slice(0, 10);
    const roleLabel = ROLE_LABELS[userRole] || userRole;
    const bankLines = COMPANY_INFO.bankAccounts
        .map((b) => `${b.bank} ${b.accountNumber} a/n ${b.accountName}`)
        .join(', ');

    return `Anda adalah *Asisten Operasional AI* resmi untuk ekspedisi *${COMPANY_INFO.name} (CCE)*.
Anda berbicara langsung dengan staf internal melalui WhatsApp.

PROFIL LAWAN BICARA SAAT INI:
- Nama: ${userName}
- Jabatan / Role: ${roleLabel} (${userRole})
- Tanggal Hari Ini: ${todayIso}

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
4. Rekening Transfer:
   - Standar (Non-PKP): ${bankLines}
   - Faktur Pajak (PKP): BCA 187 1414 187 a/n CAHAYA CARGO EXPRESS CV

ATURAN KERJA & KEAMANAN KETAT:
- Selalu gunakan Bahasa Indonesia yang singkat, sopan, rapi (cocok dibaca di layar WhatsApp), dan langsung ke inti.
- **DILARANG mengarang angka, status resi, nama client, atau nominal tagihan.** Selalu panggil tool untuk mengecek database Firestore terlebih dahulu.
- Jika user mengirim **voice note** atau **foto nota/resi/catatan muatan**, ekstrak datanya secara cermat:
  - Jika user hanya bertanya, jawab langsung memakai data tool.
  - Jika user ingin **membuat STT baru**, pastikan minimal \`pengirimName\`, \`penerimaName\`, dan \`tujuan\` sudah diketahui (jika kurang, tanya singkat ke user). Jika sudah cukup, panggil \`propose_create_stt\` agar sistem menyimpan draft dan meminta konfirmasi **YA / BATAL**.
  - Jika user ingin **membuat Invoice**, cek STT belum tertagih atau panggil \`propose_create_invoice\` agar sistem menghitung nominal asli dari Firestore dan meminta konfirmasi **YA / BATAL**.
- Jangan pernah menyatakan bahwa STT atau Invoice sudah tersimpan sebelum user membalas **YA** dan sistem benar-benar mengeksekusinya.
- Jika tool menolak karena batasan role (\`${userRole}\`), jelaskan dengan sopan bahwa fitur tersebut hanya untuk Owner/Admin.`;
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
): Promise<{ replyText: string; toolName: string }> {
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

    const inv = await executeCreateInvoice(pending.payload, actorName);
    return {
        toolName: 'execute_create_invoice',
        replyText: [
            `✅ *Invoice Berhasil Diterbitkan!*`,
            `• No. Invoice: *${inv.invoiceNumber}*`,
            `• Client: ${inv.clientName} (${inv.sttCount} resi)`,
            `• Total Tagihan: *${fmtRupiah(inv.totalAmount)}*`,
            `• Cetak A5 / Kirim WA (PNG/JPG): ${inv.printUrl}`,
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

    // 2. Idempotency check for WhatsApp webhooks (skip retried messageIds)
    if (input.source === 'whatsapp' && input.messageId) {
        const dupSnap = await adminDb
            .collection('wa_agent_logs')
            .where('messageId', '==', input.messageId)
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
    }

    // 3. Verify whitelist & role
    let resolvedRole: WaAgentRole | null = input.source === 'simulator' && input.overrideRole ? input.overrideRole : null;
    let resolvedName = input.overrideName || 'Admin Simulator';

    if (!resolvedRole) {
        const waUser = await resolveAuthorizedUser(cleanPhone);
        if (!waUser) {
            const blockedReply =
                'Maaf, nomor WhatsApp Anda belum terdaftar di AI Agent internal Cahaya Cargo Express. Hubungi Admin/Owner untuk mendaftarkan nomor Anda.';
            await writeAuditLog({
                messageId: input.messageId,
                phone: cleanPhone || input.phone,
                source: input.source,
                incomingText: incomingPreview,
                replyText: blockedReply,
                toolsUsed: [],
                status: 'blocked',
            });
            return {
                replyText: blockedReply,
                toolsUsed: [],
                pendingAction: null,
                status: 'blocked',
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
            pendingAction: nextPending,
            updatedAt: admin.firestore.Timestamp.now(),
        });
    };

    // 5. Fast 2-step confirmation intercept (YA / BATAL)
    if (pendingAction && !hasMedia && userText) {
        if (CONFIRM_REGEX.test(userText)) {
            try {
                const { replyText, toolName } = await executePendingAction(pendingAction, resolvedName);
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
                return { replyText, toolsUsed: [toolName], pendingAction: null, status: 'ok' };
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
    const systemInstruction = buildSystemInstruction(resolvedName, resolvedRole);

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
    let nextPendingAction: PendingAction | null = pendingAction;
    let finalReplyText = '';

    try {
        for (let step = 0; step < 5; step++) {
            const response = await ai.models.generateContent({
                model: config.modelName || 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction,
                    tools: toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations }] : undefined,
                },
            });

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

                const outcome = await dispatchAgentToolCall(fnName, fnArgs, resolvedRole);
                if (outcome.pendingAction) {
                    nextPendingAction = outcome.pendingAction;
                }

                fnResponseParts.push({
                    functionResponse: {
                        ...(call.id ? { id: call.id } : {}),
                        name: fnName,
                        response: outcome.result,
                    },
                });
            }

            contents.push({ role: 'user', parts: fnResponseParts });
        }

        if (!finalReplyText) {
            finalReplyText = nextPendingAction
                ? `Mohon konfirmasi draft berikut:\n${nextPendingAction.summaryText}\n\nBalas *YA* untuk simpan atau *BATAL* untuk membatalkan.`
                : 'Maaf, permintaan membutuhkan terlalu banyak langkah. Bisa diulangi lebih spesifik?';
        }

        await appendAndSaveSession(incomingPreview, finalReplyText, nextPendingAction);
        await writeAuditLog({
            messageId: input.messageId,
            phone: cleanPhone,
            userName: resolvedName,
            userRole: resolvedRole,
            source: input.source,
            incomingText: incomingPreview,
            replyText: finalReplyText,
            toolsUsed,
            status: 'ok',
        });

        return {
            replyText: finalReplyText,
            toolsUsed,
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
}
