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
    date: data.date,
    userId: data.userId,
    pemuatanMobilTim: data.pemuatanMobilTim || '',
    pemuatanItems: data.pemuatanItems || [],
    totalPemuatan: data.totalPemuatan || 0,

    bongkarMobilTim: data.bongkarMobilTim || '',
    bongkarItems: data.bongkarItems || [],
    totalBongkar: data.totalBongkar || 0,

    transitItems: data.transitItems || [],
    totalTransit: data.totalTransit || 0,

    totalGrossOps: data.totalGrossOps || 0,

    depositItems: data.depositItems || [],
    totalDeposit: data.totalDeposit || 0,

    totalNetOps: data.totalNetOps || 0,

    notes: data.notes || '',
    expenseDocId: data.expenseDocId || undefined,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
});

/**
 * Save or Update a Makassar Operational Record
 * Automatically syncs with central 'expenses' collection (category: 'operasional_makassar')
 */
export const saveMakassarOpsRecord = async (
    recordData: Omit<MakassarOpsRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    userId: string
): Promise<string> => {
    const now = Timestamp.now();
    const opDateObj = new Date(recordData.date + 'T00:00:00');
    const dateTimestamp = Timestamp.fromDate(opDateObj);

    // Build description for central expenses ledger
    const summaryDescription = `[OPS MAKASSAR ${recordData.date}] Bongkar: ${formatRupiah(recordData.totalBongkar)} | Pemuatan: ${formatRupiah(recordData.totalPemuatan)} | Transit: ${formatRupiah(recordData.totalTransit)} | Deposit: -${formatRupiah(recordData.totalDeposit)}`;

    let expenseDocId = recordData.expenseDocId;

    // 1. Sync or Create central expense document
    if (expenseDocId) {
        // Update existing expense doc
        const expRef = doc(db, EXPENSES_COLLECTION, expenseDocId);
        await updateDoc(expRef, {
            amount: recordData.totalNetOps,
            description: summaryDescription,
            date: dateTimestamp,
            updatedAt: now,
        });
    } else {
        // Create new central expense doc
        const newExpRef = await addDoc(collection(db, EXPENSES_COLLECTION), {
            userId,
            type: 'general',
            category: 'operasional_makassar',
            amount: recordData.totalNetOps,
            description: summaryDescription,
            date: dateTimestamp,
            status: 'approved',
            createdAt: now,
            updatedAt: now,
        });
        expenseDocId = newExpRef.id;
    }

    // 2. Save/Update record in 'makassar_ops' collection
    const opsPayload: any = {
        date: recordData.date,
        userId,
        pemuatanMobilTim: recordData.pemuatanMobilTim || '',
        pemuatanItems: recordData.pemuatanItems || [],
        totalPemuatan: recordData.totalPemuatan || 0,

        bongkarMobilTim: recordData.bongkarMobilTim || '',
        bongkarItems: recordData.bongkarItems || [],
        totalBongkar: recordData.totalBongkar || 0,

        transitItems: recordData.transitItems || [],
        totalTransit: recordData.totalTransit || 0,

        totalGrossOps: recordData.totalGrossOps || 0,

        depositItems: recordData.depositItems || [],
        totalDeposit: recordData.totalDeposit || 0,

        totalNetOps: recordData.totalNetOps || 0,

        notes: recordData.notes || '',
        expenseDocId,
        updatedAt: now,
    };

    if (recordData.id) {
        const opsDocRef = doc(db, MAKASSAR_OPS_COLLECTION, recordData.id);
        await updateDoc(opsDocRef, opsPayload);
        return recordData.id;
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
    const q = query(
        collection(db, MAKASSAR_OPS_COLLECTION),
        where('date', '==', date)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return docToRecord(snap.docs[0].id, snap.docs[0].data());
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
    return onSnapshot(q, snap => {
        if (snap.empty) {
            callback(null);
            return;
        }
        callback(docToRecord(snap.docs[0].id, snap.docs[0].data()));
    });
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
    return onSnapshot(q, snap => {
        const records = snap.docs.map(d => docToRecord(d.id, d.data()));
        // Sort descending by date
        records.sort((a, b) => b.date.localeCompare(a.date));
        callback(records);
    });
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
            await deleteDoc(doc(db, EXPENSES_COLLECTION, expenseDocId));
        } catch (e) {
            console.error('Failed to delete central expense doc:', e);
        }
    }

    // 2. Delete main Makassar ops record
    await deleteDoc(doc(db, MAKASSAR_OPS_COLLECTION, id));
};
