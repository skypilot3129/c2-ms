import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    onSnapshot,
    Timestamp,
    query,
    orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import type { OwnerShipExpense } from '@/types/owner-ship-report';

const OWNER_SHIP_EXPENSES_COLLECTION = 'owner_ship_expenses';

function docToOwnerShipExpense(id: string, data: any): OwnerShipExpense {
    return {
        id,
        voyageId: data.voyageId || id,
        voyageNumber: data.voyageNumber || '',
        shipName: data.shipName || '',
        departureDate: data.departureDate || '',
        route: data.route || '',
        tiket: Number(data.tiket) || 0,
        opsMakassar: Number(data.opsMakassar) || 0,
        opsSurabaya: Number(data.opsSurabaya) || 0,
        gajiSopir: Number(data.gajiSopir) || 0,
        sewaMobil: Number(data.sewaMobil) || 0,
        opsTambahan: Number(data.opsTambahan) || 0,
        notes: data.notes || '',
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
        updatedBy: data.updatedBy || '',
    };
}

/**
 * Subscribe to Owner Ship Expenses
 */
export function subscribeToOwnerShipExpenses(
    callback: (expenses: OwnerShipExpense[]) => void
): () => void {
    const q = query(collection(db, OWNER_SHIP_EXPENSES_COLLECTION));
    return onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => docToOwnerShipExpense(d.id, d.data()));
        callback(list);
    }, (error) => {
        console.error('Error listening to owner ship expenses:', error);
    });
}

/**
 * Save / Update manual expenses for a voyage
 */
export async function saveOwnerShipExpense(
    data: OwnerShipExpense,
    userId?: string,
    updatedBy?: string
): Promise<void> {
    const docId = data.voyageId;
    const docRef = doc(db, OWNER_SHIP_EXPENSES_COLLECTION, docId);

    const payload: any = {
        voyageId: data.voyageId,
        voyageNumber: data.voyageNumber,
        shipName: data.shipName || '',
        departureDate: data.departureDate || '',
        route: data.route || '',
        tiket: Number(data.tiket) || 0,
        opsMakassar: Number(data.opsMakassar) || 0,
        opsSurabaya: Number(data.opsSurabaya) || 0,
        gajiSopir: Number(data.gajiSopir) || 0,
        sewaMobil: Number(data.sewaMobil) || 0,
        opsTambahan: Number(data.opsTambahan) || 0,
        notes: (data.notes || '').trim(),
        updatedAt: Timestamp.now(),
        updatedBy: updatedBy || userId || 'Owner',
    };

    await setDoc(docRef, payload, { merge: true });
}

/**
 * Delete manual expenses for a voyage
 */
export async function deleteOwnerShipExpense(voyageId: string): Promise<void> {
    const docRef = doc(db, OWNER_SHIP_EXPENSES_COLLECTION, voyageId);
    await deleteDoc(docRef);
}
