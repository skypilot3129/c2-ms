import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { processAgentMessage } from '@/lib/wa-agent/agent-engine';
import type { WaAgentRole } from '@/types/wa-agent';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = await adminAuth.verifyIdToken(token);
        const body = await request.json().catch(() => ({}));

        const phone = String(body.phone || '6280000000000');
        const text = String(body.text || '');
        const role = (['owner', 'admin', 'pengurus', 'helper'].includes(body.role)
            ? body.role
            : 'owner') as WaAgentRole;
        const name = String(body.name || decoded.name || decoded.email || 'Admin Simulator');
        const media =
            body.media?.base64 && body.media?.mimeType
                ? {
                      base64: String(body.media.base64).replace(/^data:[^;]+;base64,/, ''),
                      mimeType: String(body.media.mimeType),
                  }
                : undefined;

        const result = await processAgentMessage({
            phone,
            text,
            media,
            source: 'simulator',
            overrideRole: role,
            overrideName: name,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[WA Agent Simulator] Error:', error);
        const isAuthErr = String(error?.code || '').startsWith('auth/');
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: isAuthErr ? 401 : 500 }
        );
    }
}

