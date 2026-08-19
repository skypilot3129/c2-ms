/**
 * Firestore functions for Makassar Operational Expenses Management
 * Handles CRUD and automatic dual-sync to central 'expenses' collection.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { MakassarOpsRecord } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';

const MAKASSAR_OPS_COLLECTION = 'makassar_ops';
const EXPENSES_COLLECTION = 'expenses';

const docToRecord = (id: string, data: any): MakassarOpsRecord => ({
    id,
    date: data.date || '',
    userId: data.userId || '',
    pemuatanMobilTim: data.pemuatanMobilTim || '',
    pemuatanItems: Array.isArray(data.pemuatanItems) ? data.pemuatanItems : [],
    totalPemuatan: Number(data.totalPemuatan) || 0,

    bongkarMobilTim: data.bongkarMobilTim || '',
    bongkarItems: Array.isArray(data.bongkarItems) ? data.bongkarItems : [],
    totalBongkar: Number(data.totalBongkar) || 0,

    transitItems: Array.isArray(data.transitItems) ? data.transitItems : [],
    totalTransit: Number(data.totalTransit) || 0,

    tiketItems: Array.isArray(data.tiketItems) ? data.tiketItems : [],
    totalTiket: Number(data.totalTiket) || 0,

    totalGrossOps: Number(data.totalGrossOps) || 0,

    depositItems: Array.isArray(data.depositItems) ? data.depositItems : [],
    totalDeposit: Number(data.totalDeposit) || 0,

    totalNetOps: Number(data.totalNetOps) || 0,

    notes: data.notes || '',
    expenseDocId: data.expenseDocId || undefined,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
});

/**
 * Save or Update a Makassar Operational Record
 * Stored independently in 'makassar_ops' collection to prevent disrupting general petty cash balance.
 */
export const saveMakassarOpsRecord = async (
    recordData: Omit<MakassarOpsRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    userId: string
): Promise<string> => {
    const now = Timestamp.now();

    // If an old dual-synced expenseDocId exists, clean it up from 'expenses' collection
    if (recordData.expenseDocId) {
        try {
            const expRef = doc(db, EXPENSES_COLLECTION, recordData.expenseDocId);
            const expSnap = await getDoc(expRef);
            if (expSnap.exists()) {
                await deleteDoc(expRef);
            }
        } catch (e) {
            console.warn('Cleanup legacy expense doc notice:', e);
        }
    }

    // Sanitize payload arrays so no `undefined` values are sent to Firestore
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

    // 3. Prepare Ops Document Payload
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

    // Find if a record for this date already exists if no id was provided
    let targetDocId = recordData.id;
    if (!targetDocId) {
        try {
            const existingQ = query(
                collection(db, MAKASSAR_OPS_COLLECTION),
                where('date', '==', recordData.date)
            );
            const snap = await getDocs(existingQ);
            if (!snap.empty) {
                targetDocId = snap.docs[0].id;
            }
        } catch (e) {
            console.warn('Date check query warning:', e);
        }
    }

    if (targetDocId) {
        const opsDocRef = doc(db, MAKASSAR_OPS_COLLECTION, targetDocId);
        await updateDoc(opsDocRef, opsPayload);
        return targetDocId;
    } else {
        opsPayload.createdAt = now;
        const newOpsRef = await addDoc(collection(db, MAKASSAR_OPS_COLLECTION), opsPayload);
        return newOpsRef.id;
    }
};

/**
 * Get Makassar Ops record by date
 */
export const getMakassarOpsByDate = async (
    date: string,
    userId: string
): Promise<MakassarOpsRecord | null> => {
    try {
        const q = query(
            collection(db, MAKASSAR_OPS_COLLECTION),
            where('date', '==', date)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return docToRecord(snap.docs[0].id, snap.docs[0].data());
    } catch (e) {
        console.error('Error fetching makassar ops by date:', e);
        return null;
    }
};

/**
 * Subscribe to Makassar Ops record for a specific date in real-time
 */
export const subscribeToMakassarOpsByDate = (
    date: string,
    userId: string,
    callback: (record: MakassarOpsRecord | null) => void
): (() => void) => {
    const q = query(
        collection(db, MAKASSAR_OPS_COLLECTION),
        where('date', '==', date)
    );
    return onSnapshot(
        q,
        snap => {
            if (snap.empty) {
                callback(null);
                return;
            }
            callback(docToRecord(snap.docs[0].id, snap.docs[0].data()));
        },
        error => {
            console.error('Error subscribing to makassar ops by date:', error);
        }
    );
};

/**
 * Subscribe to all Makassar Ops records
 */
export const subscribeToMakassarOpsList = (
    userId: string,
    callback: (records: MakassarOpsRecord[]) => void
): (() => void) => {
    const q = query(
        collection(db, MAKASSAR_OPS_COLLECTION)
    );
    return onSnapshot(
        q,
        snap => {
            const records = snap.docs.map(d => docToRecord(d.id, d.data()));
            // Sort descending by date
            records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            callback(records);
        },
        error => {
            console.error('Error subscribing to makassar ops list:', error);
        }
    );
};

/**
 * Delete a Makassar Ops Record and its corresponding expense doc
 */
export const deleteMakassarOpsRecord = async (
    id: string,
    expenseDocId?: string
): Promise<void> => {
    // 1. Delete central expense doc if exists
    if (expenseDocId) {
        try {
            const expDocRef = doc(db, EXPENSES_COLLECTION, expenseDocId);
            const snap = await getDoc(expDocRef);
            if (snap.exists()) {
                await deleteDoc(expDocRef);
            }
        } catch (e) {
            console.warn('Failed to delete central expense doc:', e);
        }
    }

    // 2. Delete main Makassar ops record
    await deleteDoc(doc(db, MAKASSAR_OPS_COLLECTION, id));
};

