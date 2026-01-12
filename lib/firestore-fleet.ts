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
        // where('userId', '==', userId), // Removed
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
            // where('userId', '==', userId), // Removed
            where('fleetId', '==', fleetId),
            orderBy('date', 'desc')
        );
    } else {
        // All logs
        q = query(
            collection(db, MAINT_LOGS_COLLECTION),
            // where('userId', '==', userId), // Removed
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

/**
 * Update maintenance log
 */
export const updateMaintenanceLog = async (
    id: string,
    data: Partial<Omit<MaintenanceLog, 'id' | 'createdAt' | 'userId' | 'expenseId'>>
) => {
    try {
        const logRef = doc(db, MAINT_LOGS_COLLECTION, id);
        const updates: any = {};

        if (data.fleetId !== undefined) updates.fleetId = data.fleetId;
        if (data.fleetName !== undefined) updates.fleetName = data.fleetName;
        if (data.date !== undefined) updates.date = Timestamp.fromDate(data.date);
        if (data.serviceType !== undefined) updates.serviceType = data.serviceType;
        if (data.description !== undefined) updates.description = data.description;
        if (data.cost !== undefined) updates.cost = data.cost;
        if (data.provider !== undefined) updates.provider = data.provider;

        await updateDoc(logRef, updates);
    } catch (error) {
        console.error("Error updating maintenance log:", error);
        throw error;
    }
};

export const deleteMaintenanceLog = async (id: string) => {
    try {
        // 1. Get the maintenance log to find the linked expense ID
        const logRef = doc(db, MAINT_LOGS_COLLECTION, id);
        const logSnap = await getDoc(logRef);

        if (!logSnap.exists()) {
            throw new Error('Maintenance log not found');
        }

        const logData = logSnap.data();
        const expenseId = logData.expenseId;

        // 2. Delete the maintenance log
        await deleteDoc(logRef);

        // 3. Delete the linked expense if it exists
        if (expenseId) {
            try {
                await deleteDoc(doc(db, 'expenses', expenseId));
            } catch (expError) {
                console.warn('Could not delete linked expense:', expError);
                // Continue even if expense deletion fails
            }
        }
    } catch (error) {
        console.error("Error deleting maintenance log:", error);
        throw error;
    }
};
