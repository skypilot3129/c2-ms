import { db } from './firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    onSnapshot,
    orderBy,
    Timestamp,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';
import { Fleet, MaintenanceLog, FleetStatus } from '@/types/fleet';
import { addExpense } from './firestore-expenses';

const FLEETS_COLLECTION = 'fleets';
const MAINT_LOGS_COLLECTION = 'maintenance_logs';

// --- Fleet Operations ---

export const subscribeToFleets = (userId: string, callback: (fleets: Fleet[]) => void) => {
    const q = query(
        collection(db, FLEETS_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const fleets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Fleet[];
        callback(fleets);
    });
};

export const addFleet = async (userId: string, data: Omit<Fleet, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    try {
        await addDoc(collection(db, FLEETS_COLLECTION), {
            ...data,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error adding fleet:", error);
        throw error;
    }
};

export const updateFleet = async (id: string, data: Partial<Fleet>) => {
    try {
        const docRef = doc(db, FLEETS_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error updating fleet:", error);
        throw error;
    }
};

export const deleteFleet = async (id: string) => {
    try {
        await deleteDoc(doc(db, FLEETS_COLLECTION, id));
    } catch (error) {
        console.error("Error deleting fleet:", error);
        throw error;
    }
};

export const updateFleetStatus = async (id: string, status: FleetStatus) => {
    return updateFleet(id, { status });
};


// --- Maintenance Operations ---

export const subscribeToMaintenanceLogs = (userId: string, fleetId: string | null, callback: (logs: MaintenanceLog[]) => void) => {
    let q;
    if (fleetId) {
        q = query(
            collection(db, MAINT_LOGS_COLLECTION),
            where('userId', '==', userId),
            where('fleetId', '==', fleetId),
            orderBy('date', 'desc')
        );
    } else {
        // All logs
        q = query(
            collection(db, MAINT_LOGS_COLLECTION),
            where('userId', '==', userId),
            orderBy('date', 'desc')
        );
    }

    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as MaintenanceLog[];
        callback(logs);
    });
};

export const addMaintenanceLog = async (userId: string, data: Omit<MaintenanceLog, 'id' | 'createdAt' | 'userId' | 'expenseId'>) => {
    try {
        // 1. Create the Expense Record first (or logic to link them)
        // We'll treat Maintenance as a 'general' expense type for now but tagged 'maintenance'
        // Actually, let's create the expense first.

        const expenseId = await addExpense({
            description: `Maintenance ${data.fleetName}: ${data.serviceType}`,
            amount: data.cost,
            date: data.date.toISOString(),
            category: 'maintenance',
            type: 'general'
        }, userId);

        // 2. Create the Log
        await addDoc(collection(db, MAINT_LOGS_COLLECTION), {
            ...data,
            userId,
            expenseId: expenseId, // Link the ID
            date: Timestamp.fromDate(data.date),
            createdAt: serverTimestamp(),
        });

        // 3. Update Fleet status to 'Maintenance' if it's a major service? 
        // Optional: for now we just log it. The user might want to manually set status.

    } catch (error) {
        console.error("Error adding maintenance log:", error);
        throw error;
    }
};

export const deleteMaintenanceLog = async (id: string) => {
    try {
        // Note: This does NOT automatically delete the linked Expense to prevent accidental financial data loss.
        // User should delete expense manually if needed, or we implement improved logic later.
        await deleteDoc(doc(db, MAINT_LOGS_COLLECTION, id));
    } catch (error) {
        console.error("Error deleting maintenance log:", error);
        throw error;
    }
};
