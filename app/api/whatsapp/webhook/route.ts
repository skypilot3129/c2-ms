import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { processAgentMessage } from '@/lib/wa-agent/agent-engine';
import {
    downloadOpenWaMedia,
    extractPhoneFromChatId,
    getOpenWaCredentials,
    getWaAgentConfig,
    resolveOpenWaContactPhone,
    sendOpenWaDocument,
    sendOpenWaImage,
    sendOpenWaText,
} from '@/lib/wa-agent/openwa-client';
import { normalizeWaPhone } from '@/types/wa-agent';

function safeTimingEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function verifyWebhookSecret(request: Request, rawBody: string, expectedSecret: string): boolean {
    if (!expectedSecret) return true;

    const directHeader =
        request.headers.get('x-webhook-secret') ||
        request.headers.get('x-openwa-secret') ||
        '';
    if (directHeader && safeTimingEquals(directHeader.trim(), expectedSecret)) {
        return true;
    }

    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ') && safeTimingEquals(authHeader.slice(7).trim(), expectedSecret)) {
        return true;
    }

    const sigHeader =
        request.headers.get('x-openwa-signature') ||
        request.headers.get('x-hub-signature-256') ||
        request.headers.get('x-webhook-signature') ||
        '';
    if (sigHeader) {
        const cleanedSig = sigHeader.replace(/^sha256=/i, '').trim();
        const digestHex = crypto.createHmac('sha256', expectedSecret).update(rawBody).digest('hex');
        if (safeTimingEquals(cleanedSig, digestHex)) {
            return true;
        }
    }

    const url = new URL(request.url);
    const querySecret = url.searchParams.get('secret') || '';
    if (querySecret && safeTimingEquals(querySecret, expectedSecret)) {
        return true;
    }

    return false;
}

export const maxDuration = 120;

export async function GET() {
    return NextResponse.json({
        ok: true,
        service: 'CCE WhatsApp AI Agent Webhook (OpenWA)',
        timestamp: new Date().toISOString(),
    });
}

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const config = await getWaAgentConfig();
        const { webhookSecret, sessionId: defaultSessionId } = getOpenWaCredentials(config);

        if (!verifyWebhookSecret(request, rawBody, webhookSecret)) {
            return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
        }

        let body: any = {};
        try {
            body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
            return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
        }

        const eventName = String(body.event || body.type || '').toLowerCase();
        if (eventName && eventName !== 'message.received' && eventName !== 'message') {
            return NextResponse.json({ ok: true, ignored: true, reason: `event:${eventName}` });
        }

        const payload = body.payload || body.data || body.message || body;
        if (!payload || typeof payload !== 'object') {
            return NextResponse.json({ ok: true, ignored: true, reason: 'empty_payload' });
        }

        if (payload.fromMe === true || body.fromMe === true || payload.direction === 'outgoing') {
            return NextResponse.json({ ok: true, ignored: true, reason: 'fromMe' });
        }

        const fromChatId = String(payload.from || payload.chatId || payload.key?.remoteJid || '').trim();
        if (!fromChatId || fromChatId === 'status@broadcast' || fromChatId.endsWith('@newsletter')) {
            return NextResponse.json({ ok: true, ignored: true, reason: 'ignored_chat_type' });
        }

        const incomingSessionId = String(body.sessionId || body.session || defaultSessionId || '').trim();
        const isGroup = fromChatId.endsWith('@g.us');
        let senderPhone = '';
        let textBody = String(payload.body || payload.text || payload.caption || payload.content || '').trim();

        if (isGroup) {
            if (!config.allowGroups) {
                return NextResponse.json({ ok: true, ignored: true, reason: 'groups_disabled' });
            }
            const prefix = (config.groupPrefix || '/cce').trim();
            if (prefix && !textBody.toLowerCase().startsWith(prefix.toLowerCase())) {
                return NextResponse.json({ ok: true, ignored: true, reason: 'missing_group_prefix' });
            }
            textBody = textBody.slice(prefix.length).trim();
            const participantId = String(payload.author || payload.participant || payload.key?.participant || '').trim();
            if (participantId.endsWith('@lid')) {
                senderPhone = (await resolveOpenWaContactPhone(participantId, incomingSessionId, config)) || '';
            }
            if (!senderPhone) {
                senderPhone = extractPhoneFromChatId(participantId);
            }
        } else {
            const explicitPhone = payload.senderPhone || payload.fromPhone || payload.phone || '';
            if (explicitPhone) {
                senderPhone = normalizeWaPhone(String(explicitPhone));
            }
            if (!senderPhone && fromChatId.endsWith('@lid')) {
                senderPhone = (await resolveOpenWaContactPhone(fromChatId, incomingSessionId, config)) || '';
            }
            if (!senderPhone) {
                senderPhone = extractPhoneFromChatId(fromChatId);
            }
        }

        const messageId =
            String(payload.id || payload.waMessageId || payload.messageId || payload.key?.id || '').trim() || undefined;

        // Optional multimodal attachment (image / voice note)
        let media: { base64: string; mimeType: string } | undefined;
        const mediaObj = payload.media || payload.attachment || null;
        if (payload.hasMedia || mediaObj) {
            if (mediaObj?.data && typeof mediaObj.data === 'string') {
                media = {
                    base64: mediaObj.data.replace(/^data:[^;]+;base64,/, ''),
                    mimeType: String(mediaObj.mimetype || mediaObj.mimeType || 'image/jpeg'),
                };
            } else if (mediaObj?.url || payload.mediaUrl) {
                const mediaUrl = String(mediaObj?.url || payload.mediaUrl);
                const downloaded = await downloadOpenWaMedia(
                    mediaUrl,
                    mediaObj?.mimetype || mediaObj?.mimeType,
                    config
                );
                if (downloaded) {
                    media = downloaded;
                }
            }
        }

        const result = await processAgentMessage({
            phone: senderPhone,
            text: textBody,
            media,
            messageId,
            source: 'whatsapp',
        });

        if (result.ignored) {
            return NextResponse.json({ ok: true, ignored: true, status: result.status });
        }

        if (result.replyMedia && result.replyMedia.length > 0) {
            const suppressText = Boolean(result.suppressReplyText);
            const replyText = suppressText ? '' : result.replyText || '';
            const captionFits = !suppressText && replyText.length > 0 && replyText.length <= 1000;

            let sentCount = 0;
            let lastError: string | undefined;

            for (let i = 0; i < result.replyMedia.length; i++) {
                const mediaItem = result.replyMedia[i];
                const caption = suppressText
                    ? undefined
                    : i === 0
                      ? mediaItem.caption || (captionFits ? replyText : undefined)
                      : mediaItem.caption;

                const isDocument =
                    mediaItem.mimeType === 'application/pdf' || !mediaItem.mimeType.startsWith('image/');

                const sendOne = (target: string) =>
                    isDocument
                        ? sendOpenWaDocument(
                              target,
                              mediaItem.base64,
                              mediaItem.mimeType,
                              mediaItem.filename || 'Laporan-CCE.pdf',
                              caption,
                              incomingSessionId,
                              config
                          )
                        : sendOpenWaImage(
                              target,
                              mediaItem.base64,
                              mediaItem.mimeType,
                              caption,
                              incomingSessionId,
                              config,
                              mediaItem.filename
                          );

                let imgRes = await sendOne(fromChatId);
                if (!imgRes.ok && !isGroup && fromChatId.endsWith('@lid') && senderPhone) {
                    imgRes = await sendOne(senderPhone);
                }

                if (imgRes.ok) {
                    sentCount += 1;
                } else {
                    lastError = imgRes.error;
                    console.error(`[WA Agent Webhook] Failed sending OpenWA media #${i + 1}:`, imgRes.error);
                }

                if (i < result.replyMedia.length - 1) {
                    await new Promise((r) => setTimeout(r, 350));
                }
            }

            if (sentCount > 0) {
                if (!suppressText && replyText && !captionFits) {
                    let textRes = await sendOpenWaText(fromChatId, replyText, incomingSessionId, config);
                    if (!textRes.ok && !isGroup && fromChatId.endsWith('@lid') && senderPhone) {
                        textRes = await sendOpenWaText(senderPhone, replyText, incomingSessionId, config);
                    }
                }
                return NextResponse.json({
                    ok: true,
                    status: result.status,
                    replied: true,
                    mediaSent: true,
                    mediaCount: sentCount,
                    suppressReplyText: suppressText,
                    toolsUsed: result.toolsUsed,
                });
            }

            if (suppressText) {
                return NextResponse.json({
                    ok: true,
                    status: result.status,
                    replied: false,
                    mediaSent: false,
                    suppressReplyText: true,
                    sendError: lastError,
                    toolsUsed: result.toolsUsed,
                });
            }

            console.error('[WA Agent Webhook] Failed sending all OpenWA images, falling back to text:', lastError);
        }

        if (!result.suppressReplyText && result.replyText) {
            let sendRes = await sendOpenWaText(fromChatId, result.replyText, incomingSessionId, config);
            if (!sendRes.ok && !isGroup && fromChatId.endsWith('@lid') && senderPhone) {
                sendRes = await sendOpenWaText(senderPhone, result.replyText, incomingSessionId, config);
            }
            if (!sendRes.ok) {
                console.error('[WA Agent Webhook] Failed sending OpenWA reply:', sendRes.error);
            }
            return NextResponse.json({
                ok: true,
                status: result.status,
                replied: sendRes.ok,
                sendError: sendRes.error,
                toolsUsed: result.toolsUsed,
            });
        }

        return NextResponse.json({ ok: true, status: result.status, toolsUsed: result.toolsUsed });
    } catch (error: any) {
        console.error('[WA Agent Webhook] Unhandled error:', error);
        return NextResponse.json({ ok: false, error: error?.message || 'Internal error' }, { status: 200 });
    }
}

