import {
    collection,
    doc,
    setDoc,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    getDocs,
    orderBy,
    onSnapshot,
    Timestamp,
    deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import type { MonthlySchedule, TruckOperation, OperationStatus } from '@/types/truck-operation';

const SCHEDULES_COLLECTION = 'monthly_schedules';
const OPERATIONS_COLLECTION = 'truck_operations';

// ==========================================
// Monthly Schedules
// ==========================================

export async function getMonthlySchedule(month: string): Promise<MonthlySchedule | null> {
    const docRef = doc(db, SCHEDULES_COLLECTION, month);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            month: data.month,
            loaderIds: data.loaderIds || [],
            stackerPoolIds: data.stackerPoolIds || [],
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
            updatedBy: data.updatedBy
        };
    }
    
    return null;
}

export async function saveMonthlySchedule(schedule: MonthlySchedule): Promise<void> {
    const docRef = doc(db, SCHEDULES_COLLECTION, schedule.month);
    
    const dataToSave = {
        month: schedule.month,
        loaderIds: schedule.loaderIds,
        stackerPoolIds: schedule.stackerPoolIds,
        updatedAt: Timestamp.now(),
        updatedBy: schedule.updatedBy || 'system'
    };
    
    await setDoc(docRef, dataToSave, { merge: true });
}

// ==========================================
// Truck Operations
// ==========================================

export async function createTruckOperation(operation: Omit<TruckOperation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const operationsRef = collection(db, OPERATIONS_COLLECTION);
    
    const docRef = await addDoc(operationsRef, {
        ...operation,
        startTime: operation.startTime ? Timestamp.fromDate(operation.startTime) : null,
        endTime: operation.endTime ? Timestamp.fromDate(operation.endTime) : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });
    
    return docRef.id;
}

export async function updateTruckOperationStatus(
    id: string, 
    status: OperationStatus, 
    updates?: Partial<TruckOperation>
): Promise<void> {
    const docRef = doc(db, OPERATIONS_COLLECTION, id);
    
    const dataToUpdate: any = {
        status,
        updatedAt: Timestamp.now(),
        ...updates
    };

    if (updates?.startTime !== undefined) {
        dataToUpdate.startTime = updates.startTime ? Timestamp.fromDate(updates.startTime) : null;
    }
    
    if (updates?.endTime !== undefined) {
        dataToUpdate.endTime = updates.endTime ? Timestamp.fromDate(updates.endTime) : null;
    }
    
    await updateDoc(docRef, dataToUpdate);
}

export async function deleteTruckOperation(id: string): Promise<void> {
    const docRef = doc(db, OPERATIONS_COLLECTION, id);
    await deleteDoc(docRef);
}

export async function getOperationsByDate(date: string): Promise<TruckOperation[]> {
    const q = query(
        collection(db, OPERATIONS_COLLECTION),
        where('date', '==', date),
        orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => convertOperationDoc(doc));
}

export function subscribeToDailyOperations(
    date: string,
    callback: (operations: TruckOperation[]) => void
) {
    const q = query(
        collection(db, OPERATIONS_COLLECTION),
        where('date', '==', date),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const operations = snapshot.docs.map(convertOperationDoc);
        callback(operations);
    }, (error) => {
        console.error("Error subscribing to daily operations:", error);
        callback([]);
    });
}

function convertOperationDoc(docSnap: any): TruckOperation {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        date: data.date,
        truckNumber: data.truckNumber || '',
        status: data.status,
        stackerIds: data.stackerIds || [],
        loaderIds: data.loaderIds || [],
        escortId: data.escortId || null,
        notes: data.notes || '',
        startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : null,
        endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : null,
        createdBy: data.createdBy || 'system',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
    };
}
