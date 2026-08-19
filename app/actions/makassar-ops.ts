'use server';

import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { MakassarOpsRecord } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';

const MAKASSAR_OPS_COLLECTION = 'makassar_ops';
const EXPENSES_COLLECTION = 'expenses';

export async function saveMakassarOpsServerAction(
    recordData: Omit<MakassarOpsRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    userId: string
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const now = Timestamp.now();

        // 1. If a legacy dual-synced expense doc exists, delete it so it won't affect petty cash
        let expenseDocId = recordData.expenseDocId;
        if (expenseDocId) {
            try {
                const expRef = adminDb.collection(EXPENSES_COLLECTION).doc(expenseDocId);
                const expSnap = await expRef.get();
                if (expSnap.exists) {
                    await expRef.delete();
                }
            } catch (e) {
                console.warn('Admin: Legacy expense cleanup notice:', e);
            }
        }

        // 2. Sanitize payload arrays
        const sanitizedBongkarItems = (recordData.bongkarItems || []).map(item => ({
            id: item.id || Math.random().toString(36).slice(2, 10),
            name: item.name || '',
            amount: Number(item.amount) || 0,
            note: item.note || ''
        }));

        const sanitizedPemuatanItems = (recordData.pemuatanItems || []).map(item => ({
            id: item.id || Math.random().toString(36).slice(2, 10),
            name: item.name || '',
            amount: Number(item.amount) || 0,
            note: item.note || ''
        }));

        const sanitizedTransitItems = (recordData.transitItems || []).map(item => ({
            id: item.id || Math.random().toString(36).slice(2, 10),
            resiNumber: item.resiNumber || '',
            koliDetails: item.koliDetails || '',
            customerName: item.customerName || '',
            destination: item.destination || '',
            amount: Number(item.amount) || 0
        }));

        const sanitizedTiketItems = (recordData.tiketItems || []).map(item => ({
            id: item.id || Math.random().toString(36).slice(2, 10),
            shipName: item.shipName || '',
            ticketNumber: item.ticketNumber || '',
            route: item.route || '',
            category: item.category || '',
            amount: Number(item.amount) || 0,
            note: item.note || ''
        }));

        const sanitizedDepositItems = (recordData.depositItems || []).map(item => ({
            id: item.id || Math.random().toString(36).slice(2, 10),
            resiNumber: item.resiNumber || '',
            description: item.description || 'Deposit Kantor',
            amount: Number(item.amount) || 0
        }));

        const opsPayload: any = {
            date: recordData.date,
            userId,
            pemuatanMobilTim: recordData.pemuatanMobilTim || '',
            pemuatanItems: sanitizedPemuatanItems,
            totalPemuatan: Number(recordData.totalPemuatan) || 0,

            bongkarMobilTim: recordData.bongkarMobilTim || '',
            bongkarItems: sanitizedBongkarItems,
            totalBongkar: Number(recordData.totalBongkar) || 0,

            transitItems: sanitizedTransitItems,
            totalTransit: Number(recordData.totalTransit) || 0,

            tiketItems: sanitizedTiketItems,
            totalTiket: Number(recordData.totalTiket) || 0,

            totalGrossOps: Number(recordData.totalGrossOps) || 0,

            depositItems: sanitizedDepositItems,
            totalDeposit: Number(recordData.totalDeposit) || 0,

            totalNetOps: Number(recordData.totalNetOps) || 0,

            notes: recordData.notes || '',
            updatedAt: now,
        };

        let targetDocId = recordData.id;
        if (!targetDocId) {
            const snap = await adminDb.collection(MAKASSAR_OPS_COLLECTION).where('date', '==', recordData.date).limit(1).get();
            if (!snap.empty) {
                targetDocId = snap.docs[0].id;
            }
        }

        if (targetDocId) {
            await adminDb.collection(MAKASSAR_OPS_COLLECTION).doc(targetDocId).update(opsPayload);
            return { success: true, id: targetDocId };
        } else {
            opsPayload.createdAt = now;
            const newOpsRef = await adminDb.collection(MAKASSAR_OPS_COLLECTION).add(opsPayload);
            return { success: true, id: newOpsRef.id };
        }
    } catch (err: any) {
        console.error('Server Action saveMakassarOps error:', err);
        return { success: false, error: err?.message || 'Gagal menyimpan di server.' };
    }
}

export async function getMakassarOpsByDateServerAction(
    date: string
): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const snap = await adminDb.collection(MAKASSAR_OPS_COLLECTION).where('date', '==', date).limit(1).get();
        if (snap.empty) {
            return { success: true, data: null };
        }
        const doc = snap.docs[0];
        const raw = doc.data();
        return {
            success: true,
            data: {
                ...raw,
                id: doc.id,
                createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate().toISOString() : raw.createdAt,
                updatedAt: raw.updatedAt?.toDate ? raw.updatedAt.toDate().toISOString() : raw.updatedAt,
            }
        };
    } catch (err: any) {
        console.error('Server Action getMakassarOpsByDate error:', err);
        return { success: false, error: err?.message };
    }
}

export async function deleteMakassarOpsServerAction(
    id: string,
    expenseDocId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (expenseDocId) {
            try {
                const expRef = adminDb.collection(EXPENSES_COLLECTION).doc(expenseDocId);
                const snap = await expRef.get();
                if (snap.exists) {
                    await expRef.delete();
                }
            } catch (e) {
                console.warn('Admin: Failed to delete central expense doc:', e);
            }
        }
        await adminDb.collection(MAKASSAR_OPS_COLLECTION).doc(id).delete();
        return { success: true };
    } catch (err: any) {
        console.error('Server Action deleteMakassarOps error:', err);
        return { success: false, error: err?.message };
    }
}

export async function cleanupMakassarOpsExpensesAction(): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
        const snap = await adminDb.collection(EXPENSES_COLLECTION).where('category', '==', 'operasional_makassar').get();
        if (snap.empty) {
            return { success: true, deletedCount: 0 };
        }
        const batch = adminDb.batch();
        let count = 0;
        snap.docs.forEach(d => {
            batch.delete(d.ref);
            count++;
        });
        await batch.commit();
        return { success: true, deletedCount: count };
    } catch (err: any) {
        console.error('Server Action cleanupMakassarOpsExpenses error:', err);
        return { success: false, deletedCount: 0, error: err?.message };
    }
}
