/**
 * Firestore functions for Voyage management
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
    runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Voyage, VoyageDoc, VoyageFormData } from '@/types/voyage';

const VOYAGES_COLLECTION = 'voyages';
const METADATA_COLLECTION = 'metadata';
const VOYAGE_COUNTER_DOC = 'voyage_counter';

/**
 * Convert Firestore document to Voyage object
 */
const docToVoyage = (id: string, data: any): Voyage => {
    return {
        id,
        userId: data.userId,
        voyageNumber: data.voyageNumber,
        departureDate: data.departureDate?.toDate() || new Date(),
        arrivalDate: data.arrivalDate?.toDate(),
        route: data.route,
        shipName: data.shipName,
        // Backward compatibility: if vehicleNumbers doesn't exist, convert old vehicleNumber to array
        vehicleNumbers: data.vehicleNumbers || (data.vehicleNumber ? [data.vehicleNumber] : []),
        vehicleNumber: data.vehicleNumber,  // Keep for backward compatibility
        status: data.status,
        transactionIds: data.transactionIds || [],
        notes: data.notes,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
    };
};

/**
 * Generate next voyage number (VOY001, VOY002, ...)
 */
export const generateVoyageNumber = async (userId: string): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, VOYAGE_COUNTER_DOC);

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let currentNumber = 1;
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                // Use global key
                const counterData = data['global'] || {};
                currentNumber = (counterData.currentNumber || 0) + 1;
            }

            // Update counter
            transaction.set(counterRef, {
                ['global']: {
                    currentNumber,
                    prefix: 'VOY',
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            return currentNumber;
        });

        // Format: VOY001, VOY002, etc.
        return `VOY${String(newNumber).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error generating voyage number:', error);
        // Fallback to timestamp-based
        return `VOY${Date.now().toString().slice(-6)}`;
    }
};

/**
 * Create new voyage
 */
export const createVoyage = async (
    data: VoyageFormData,
    userId: string
): Promise<string> => {
    const voyageNumber = await generateVoyageNumber(userId);
    const now = Timestamp.now();
    const departureDate = Timestamp.fromDate(new Date(data.departureDate));
    const arrivalDate = data.arrivalDate ? Timestamp.fromDate(new Date(data.arrivalDate)) : null;

    const voyageData: Omit<VoyageDoc, 'userId'> & { userId: string } = {
        userId,
        voyageNumber,
        departureDate,
        arrivalDate: arrivalDate || undefined,
        route: data.route,
        shipName: data.shipName,
        vehicleNumbers: data.vehicleNumbers || [],  // Save array
        vehicleNumber: data.vehicleNumber,  // Keep for backward compatibility
        status: data.status,
        transactionIds: [],
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await addDoc(collection(db, VOYAGES_COLLECTION), voyageData);
    return docRef.id;
};

/**
 * Get voyage by ID
 */
export const getVoyageById = async (id: string): Promise<Voyage | null> => {
    const docRef = doc(db, VOYAGES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        return null;
    }

    return docToVoyage(docSnap.id, docSnap.data());
};

/**
 * Subscribe to voyages in real-time
 */
/**
 * Subscribe to voyages in real-time
 * Optionally filter by date range
 */
export const subscribeToVoyages = (
    userId: string,
    callback: (voyages: Voyage[]) => void,
    dateRange?: { startDate: Date; endDate: Date }
): (() => void) => {
    const voyagesRef = collection(db, VOYAGES_COLLECTION);
    let constraints: any[] = [];

    // constraints.push(where('userId', '==', userId)); // Removed

    if (dateRange) {
        // Ensure strictly this range. Firestore composite index might be needed.
        const start = Timestamp.fromDate(dateRange.startDate);
        const end = Timestamp.fromDate(dateRange.endDate);
        constraints.push(where('departureDate', '>=', start));
        constraints.push(where('departureDate', '<=', end));
    }

    const q = query(voyagesRef, ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const voyages = snapshot.docs.map(doc => docToVoyage(doc.id, doc.data()));
        // Sort in memory
        const sorted = voyages.sort((a, b) => b.departureDate.getTime() - a.departureDate.getTime());
        callback(sorted);
    });

    return unsubscribe;
};

/**
 * Update voyage
 */
export const updateVoyage = async (
    id: string,
    data: Partial<VoyageFormData>
): Promise<void> => {
    const docRef = doc(db, VOYAGES_COLLECTION, id);
    const updates: any = {
        ...data,
        updatedAt: Timestamp.now(),
    };

    if (data.departureDate) {
        updates.departureDate = Timestamp.fromDate(new Date(data.departureDate));
    }

    if (data.arrivalDate) {
        updates.arrivalDate = Timestamp.fromDate(new Date(data.arrivalDate));
    }

    await updateDoc(docRef, updates);
};

/**
 * Delete voyage and all associated expenses
 */
export const deleteVoyage = async (id: string): Promise<void> => {
    // First, get the voyage to verify it exists
    const voyageRef = doc(db, VOYAGES_COLLECTION, id);
    const voyageSnap = await getDoc(voyageRef);

    if (!voyageSnap.exists()) {
        throw new Error('Voyage not found');
    }

    const userId = voyageSnap.data().userId;

    // Delete all expenses associated with this voyage
    const expensesQuery = query(
        collection(db, 'expenses'),
        where('voyageId', '==', id),
        where('userId', '==', userId)
    );

    const expensesSnapshot = await getDocs(expensesQuery);

    // Delete each expense
    const deletePromises = expensesSnapshot.docs.map(doc =>
        deleteDoc(doc.ref)
    );

    await Promise.all(deletePromises);

    // Finally, delete the voyage itself
    await deleteDoc(voyageRef);
};

/**
 * Assign transactions to voyage
 */
export const assignTransactionsToVoyage = async (
    voyageId: string,
    transactionIds: string[]
): Promise<void> => {
    const docRef = doc(db, VOYAGES_COLLECTION, voyageId);
    const voyageSnap = await getDoc(docRef);

    if (!voyageSnap.exists()) {
        throw new Error('Voyage not found');
    }

    const currentIds = voyageSnap.data().transactionIds || [];
    const newIds = [...new Set([...currentIds, ...transactionIds])]; // Remove duplicates

    await updateDoc(docRef, {
        transactionIds: newIds,
        updatedAt: Timestamp.now(),
    });
};

/**
 * Remove transactions from voyage
 */
export const removeTransactionsFromVoyage = async (
    voyageId: string,
    transactionIds: string[]
): Promise<void> => {
    const docRef = doc(db, VOYAGES_COLLECTION, voyageId);
    const voyageSnap = await getDoc(docRef);

    if (!voyageSnap.exists()) {
        throw new Error('Voyage not found');
    }

    const currentIds = voyageSnap.data().transactionIds || [];
    const newIds = currentIds.filter((id: string) => !transactionIds.includes(id));

    await updateDoc(docRef, {
        transactionIds: newIds,
        updatedAt: Timestamp.now(),
    });
};

/**
 * Get all voyages for a user
 */
export const getVoyages = async (userId: string): Promise<Voyage[]> => {
    const q = query(
        collection(db, VOYAGES_COLLECTION),
        // where('userId', '==', userId), // Removed
        orderBy('departureDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToVoyage(doc.id, doc.data()));
};
