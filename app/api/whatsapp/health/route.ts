import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { checkOpenWaHealth, getOpenWaCredentials, getWaAgentConfig } from '@/lib/wa-agent/openwa-client';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await adminAuth.verifyIdToken(token);

        const config = await getWaAgentConfig();
        const creds = getOpenWaCredentials(config);
        const openwa = await checkOpenWaHealth();

        return NextResponse.json({
            geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
            webhookSecretConfigured: Boolean(creds.webhookSecret),
            openwaApiKeyConfigured: Boolean(creds.apiKey),
            openwa,
            config,
        });
    } catch (error: any) {
        console.error('[WA Agent Health] Error:', error);
        const isAuthErr = String(error?.code || '').startsWith('auth/');
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: isAuthErr ? 401 : 500 }
        );
    }
}

