import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import {
    DEFAULT_WA_AGENT_CONFIG,
    normalizeWaPhone,
    type WaAgentConfig,
    type WaThinkingLevel,
} from '@/types/wa-agent';

export interface OpenWaHealthResult {
    reachable: boolean;
    statusCode?: number;
    message: string;
    baseUrl: string;
    sessionId: string;
}

export async function getWaAgentConfig(): Promise<WaAgentConfig> {
    const envBaseUrl = process.env.OPENWA_BASE_URL?.trim();
    const envSessionId = process.env.OPENWA_SESSION_ID?.trim();

    const base: WaAgentConfig = {
        ...DEFAULT_WA_AGENT_CONFIG,
        ...(envBaseUrl ? { openwaBaseUrl: envBaseUrl.replace(/\/+$/, '') } : {}),
        ...(envSessionId ? { openwaSessionId: envSessionId } : {}),
    };

    try {
        const snap = await adminDb.collection('settings').doc('wa_agent_config').get();
        if (snap.exists) {
            const data = snap.data() || {};
            return {
                enabled: typeof data.enabled === 'boolean' ? data.enabled : base.enabled,
                openwaBaseUrl:
                    typeof data.openwaBaseUrl === 'string' && data.openwaBaseUrl.trim()
                        ? data.openwaBaseUrl.trim().replace(/\/+$/, '')
                        : base.openwaBaseUrl,
                openwaSessionId:
                    typeof data.openwaSessionId === 'string' && data.openwaSessionId.trim()
                        ? data.openwaSessionId.trim()
                        : base.openwaSessionId,
                allowGroups: typeof data.allowGroups === 'boolean' ? data.allowGroups : base.allowGroups,
                groupPrefix:
                    typeof data.groupPrefix === 'string' && data.groupPrefix.trim()
                        ? data.groupPrefix.trim()
                        : base.groupPrefix,
                modelName:
                    typeof data.modelName === 'string' && data.modelName.trim()
                        ? data.modelName.trim()
                        : base.modelName,
                thinkingLevel: (['minimal', 'low', 'medium', 'high'].includes(data.thinkingLevel)
                    ? data.thinkingLevel
                    : base.thinkingLevel || 'low') as WaThinkingLevel,
                updatedAt: data.updatedAt?.toDate?.() || undefined,
            };
        }
    } catch (err) {
        console.warn('[WA Agent] Failed reading settings/wa_agent_config:', err);
    }

    return base;
}

export function getOpenWaCredentials(config?: WaAgentConfig) {
    const baseUrl = (config?.openwaBaseUrl || process.env.OPENWA_BASE_URL || DEFAULT_WA_AGENT_CONFIG.openwaBaseUrl).replace(
        /\/+$/,
        ''
    );
    const sessionId =
        config?.openwaSessionId || process.env.OPENWA_SESSION_ID || DEFAULT_WA_AGENT_CONFIG.openwaSessionId;
    const apiKey = process.env.OPENWA_API_KEY?.trim() || '';
    const webhookSecret = process.env.OPENWA_WEBHOOK_SECRET?.trim() || '';

    return { baseUrl, sessionId, apiKey, webhookSecret };
}

export function phoneToChatId(phoneOrChatId: string): string {
    const trimmed = String(phoneOrChatId || '').trim();
    if (!trimmed) return '';
    if (trimmed.includes('@')) return trimmed;
    const normalized = normalizeWaPhone(trimmed);
    return normalized ? `${normalized}@c.us` : '';
}

export function extractPhoneFromChatId(chatId: string): string {
    const raw = String(chatId || '').trim();
    if (!raw) return '';
    const withoutDomain = raw.split('@')[0] || '';
    return normalizeWaPhone(withoutDomain);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a session name (e.g. "cce-admin") to its OpenWA UUID if needed.
 * Returns the original string if already a UUID or lookup fails.
 */
async function resolveOpenWaSessionId(
    sessionIdOrName: string,
    baseUrl: string,
    apiKey: string
): Promise<string> {
    const trimmed = sessionIdOrName.trim();
    if (!trimmed || UUID_REGEX.test(trimmed)) {
        return trimmed;
    }

    const headers: Record<string, string> = {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${baseUrl}/api/sessions`, { headers, signal: controller.signal }).finally(() =>
            clearTimeout(timer)
        );
        if (!res.ok) return trimmed;

        const body: any = await res.json().catch(() => null);
        const list: any[] = Array.isArray(body)
            ? body
            : Array.isArray(body?.data)
                ? body.data
                : Array.isArray(body?.sessions)
                    ? body.sessions
                    : [];

        const matched = list.find(
            (s) => s && (s.name === trimmed || s.id === trimmed)
        );
        if (matched?.id && typeof matched.id === 'string') {
            return matched.id;
        }
    } catch {
        // Fallback to original session name/id
    }

    return trimmed;
}

/**
 * Resolve an OpenWA contact JID (such as an @lid privacy ID) to a normalized phone number.
 */
export async function resolveOpenWaContactPhone(
    contactId: string,
    sessionIdOverride?: string,
    configOverride?: WaAgentConfig
): Promise<string | null> {
    const trimmedContact = String(contactId || '').trim();
    if (!trimmedContact) return null;

    const cfg = configOverride || (await getWaAgentConfig());
    const { baseUrl, sessionId, apiKey } = getOpenWaCredentials(cfg);
    const targetSession = await resolveOpenWaSessionId(
        sessionIdOverride?.trim() || sessionId,
        baseUrl,
        apiKey
    );
    if (!targetSession) return null;

    const headers: Record<string, string> = {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
            `${baseUrl}/api/sessions/${encodeURIComponent(targetSession)}/contacts/${encodeURIComponent(trimmedContact)}/phone`,
            { headers, signal: controller.signal }
        ).finally(() => clearTimeout(timer));

        if (!res.ok) return null;
        const data: any = await res.json().catch(() => null);
        const phone = data?.phone ? normalizeWaPhone(String(data.phone)) : '';
        return phone || null;
    } catch {
        return null;
    }
}

export async function sendOpenWaText(
    chatId: string,
    text: string,
    sessionIdOverride?: string,
    configOverride?: WaAgentConfig
): Promise<{ ok: boolean; error?: string }> {
    const cfg = configOverride || (await getWaAgentConfig());
    const { baseUrl, sessionId, apiKey } = getOpenWaCredentials(cfg);
    const targetSession = await resolveOpenWaSessionId(
        sessionIdOverride?.trim() || sessionId,
        baseUrl,
        apiKey
    );
    const targetChatId = phoneToChatId(chatId);

    if (!targetChatId) {
        return { ok: false, error: 'chatId tujuan kosong' };
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    try {
        const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(targetSession)}/messages/send-text`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                chatId: targetChatId,
                text,
            }),
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            return { ok: false, error: `OpenWA HTTP ${res.status}: ${errText.slice(0, 200)}` };
        }
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err?.message || 'Gagal menghubungi server OpenWA' };
    }
}

async function sendOpenWaMedia(
    endpoint: 'send-image' | 'send-document',
    chatId: string,
    mediaBase64: string,
    mimetype: string,
    caption?: string,
    sessionIdOverride?: string,
    configOverride?: WaAgentConfig,
    filename?: string
): Promise<{ ok: boolean; error?: string }> {
    const cfg = configOverride || (await getWaAgentConfig());
    const { baseUrl, sessionId, apiKey } = getOpenWaCredentials(cfg);
    const targetSession = await resolveOpenWaSessionId(
        sessionIdOverride?.trim() || sessionId,
        baseUrl,
        apiKey
    );
    const targetChatId = phoneToChatId(chatId);

    if (!targetChatId) {
        return { ok: false, error: 'chatId tujuan kosong' };
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    const cleanBase64 = mediaBase64.replace(/^data:[^;]+;base64,/, '');

    try {
        const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(targetSession)}/messages/${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                chatId: targetChatId,
                base64: cleanBase64,
                mimetype: mimetype || (endpoint === 'send-document' ? 'application/pdf' : 'image/png'),
                ...(filename ? { filename } : {}),
                ...(caption ? { caption } : {}),
            }),
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            return { ok: false, error: `OpenWA HTTP ${res.status}: ${errText.slice(0, 200)}` };
        }
        return { ok: true };
    } catch (err: any) {
        return {
            ok: false,
            error:
                err?.message ||
                (endpoint === 'send-document' ? 'Gagal mengirim dokumen lewat OpenWA' : 'Gagal mengirim gambar lewat OpenWA'),
        };
    }
}

export async function sendOpenWaImage(
    chatId: string,
    imageBase64: string,
    mimetype: string,
    caption?: string,
    sessionIdOverride?: string,
    configOverride?: WaAgentConfig,
    filename?: string
): Promise<{ ok: boolean; error?: string }> {
    return sendOpenWaMedia(
        'send-image',
        chatId,
        imageBase64,
        mimetype || 'image/png',
        caption,
        sessionIdOverride,
        configOverride,
        filename
    );
}

export async function sendOpenWaDocument(
    chatId: string,
    docBase64: string,
    mimetype: string = 'application/pdf',
    filename: string = 'Dokumen-CCE.pdf',
    caption?: string,
    sessionIdOverride?: string,
    configOverride?: WaAgentConfig
): Promise<{ ok: boolean; error?: string }> {
    return sendOpenWaMedia(
        'send-document',
        chatId,
        docBase64,
        mimetype || 'application/pdf',
        caption,
        sessionIdOverride,
        configOverride,
        filename
    );
}

export async function downloadOpenWaMedia(
    mediaUrl: string,
    fallbackMimeType?: string,
    configOverride?: WaAgentConfig
): Promise<{ base64: string; mimeType: string } | null> {
    if (!mediaUrl) return null;

    // Support direct data URI if OpenWA sends inline media
    if (mediaUrl.startsWith('data:')) {
        const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            return { mimeType: match[1], base64: match[2] };
        }
    }

    const cfg = configOverride || (await getWaAgentConfig());
    const { baseUrl, apiKey } = getOpenWaCredentials(cfg);
    const resolvedUrl = mediaUrl.startsWith('http')
        ? mediaUrl
        : `${baseUrl}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;

    const headers: Record<string, string> = {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(resolvedUrl, { headers, signal: controller.signal }).finally(() =>
            clearTimeout(timer)
        );
        if (!res.ok) return null;

        const arrayBuffer = await res.arrayBuffer();
        // Cap inline multimodal buffer at 10 MB for safety
        if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 10 * 1024 * 1024) {
            return null;
        }

        const contentType = res.headers.get('content-type')?.split(';')[0]?.trim();
        return {
            base64: Buffer.from(arrayBuffer).toString('base64'),
            mimeType: contentType || fallbackMimeType || 'application/octet-stream',
        };
    } catch (err) {
        console.warn('[WA Agent] Failed downloading OpenWA media:', err);
        return null;
    }
}

export async function checkOpenWaHealth(): Promise<OpenWaHealthResult> {
    const cfg = await getWaAgentConfig();
    const { baseUrl, sessionId, apiKey } = getOpenWaCredentials(cfg);
    const headers: Record<string, string> = {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    const probe = async (path: string) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
            return await fetch(`${baseUrl}${path}`, { headers, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    try {
        let res = await probe('/api/sessions');
        if (res.status === 404) {
            res = await probe('/health');
        }
        const ok = res.ok || res.status === 401 || res.status === 403;
        const msg =
            res.status === 401 || res.status === 403
                ? 'OpenWA aktif, tetapi OPENWA_API_KEY belum cocok / belum diisi.'
                : res.ok
                    ? 'OpenWA terhubung & siap.'
                    : `OpenWA merespons HTTP ${res.status}.`;
        return {
            reachable: ok,
            statusCode: res.status,
            message: msg,
            baseUrl,
            sessionId,
        };
    } catch (err: any) {
        return {
            reachable: false,
            message: err?.name === 'AbortError'
                ? 'Timeout menghubungi OpenWA (pastikan Docker Desktop / container openwa berjalan).'
                : `OpenWA belum aktif di ${baseUrl}`,
            baseUrl,
            sessionId,
        };
    }
}

