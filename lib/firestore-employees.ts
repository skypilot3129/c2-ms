import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    Timestamp,
    orderBy,
    runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import type { Employee, EmployeeFormData, EmployeeDoc, EmployeeRole } from '@/types/employee';

const COLLECTION_NAME = 'employees';
const METADATA_COLLECTION = 'metadata';
const EMPLOYEE_COUNTER_DOC = 'employee_counters';

// Convert Firestore document to Employee type
export const docToEmployee = (id: string, data: EmployeeDoc): Employee => {
    return {
        id,
        employeeId: data.employeeId,
        fullName: data.fullName,
        role: data.role,
        status: data.status,
        joinDate: data.joinDate?.toDate() || new Date(),
        contact: data.contact,
        documents: data.documents || [],
        salaryConfig: data.salaryConfig,
        photoUrl: data.photoUrl,
        notes: data.notes,
        // Auth fields
        authUid: data.authUid || null,
        email: data.email || '',
        accountStatus: data.accountStatus || 'pending',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
    };
};

/**
 * Peek at next Employee ID without incrementing counter (for preview)
 */
export const peekNextEmployeeId = async (): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, EMPLOYEE_COUNTER_DOC);

    try {
        const counterDoc = await getDoc(counterRef);

        let nextNumber = 1;
        if (counterDoc.exists()) {
            const data = counterDoc.data();
            const counterData = data['global'] || {};
            nextNumber = (counterData.currentNumber || 0) + 1;
        }

        return `EMP-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error peeking employee ID:', error);
        return 'EMP-???';
    }
};

/**
 * Generate next Employee ID (EMP-001, EMP-002, etc.)
 * WARNING: This INCREMENTS the counter. Only call when actually creating employee.
 */
export const generateEmployeeId = async (): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, EMPLOYEE_COUNTER_DOC);

    try {
        const newId = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let nextNumber = 1;
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                const counterData = data['global'] || {};
                nextNumber = (counterData.currentNumber || 0) + 1;
            }

            // Update counter
            transaction.set(counterRef, {
                global: { currentNumber: nextNumber }
            }, { merge: true });

            return nextNumber;
        });

        // Format: EMP-001, EMP-002, etc.
        return `EMP-${String(newId).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error generating employee ID:', error);
        throw error;
    }
};

/**
 * Subscribe to all employees with real-time updates
 */
export const subscribeToEmployees = (
    callback: (employees: Employee[]) => void,
    role?: EmployeeRole
): (() => void) => {
    let q = query(collection(db, COLLECTION_NAME), orderBy('fullName', 'asc'));

    if (role) {
        q = query(collection(db, COLLECTION_NAME), where('role', '==', role), orderBy('fullName', 'asc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const employees = snapshot.docs.map(doc =>
            docToEmployee(doc.id, doc.data() as EmployeeDoc)
        );
        callback(employees);
    });

    return unsubscribe;
};

/**
 * Get all employees (one-time fetch)
 */
export const getEmployees = async (role?: EmployeeRole): Promise<Employee[]> => {
    let q = query(collection(db, COLLECTION_NAME), orderBy('fullName', 'asc'));

    if (role) {
        q = query(collection(db, COLLECTION_NAME), where('role', '==', role), orderBy('fullName', 'asc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToEmployee(doc.id, doc.data() as EmployeeDoc));
};

/**
 * Get single employee by ID
 */
export const getEmployee = async (id: string): Promise<Employee | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docToEmployee(docSnap.id, docSnap.data() as EmployeeDoc);
    }
    return null;
};

/**
 * Get employee by custom employee ID (EMP-001)
 */
export const getEmployeeByEmployeeId = async (employeeId: string): Promise<Employee | null> => {
    const q = query(collection(db, COLLECTION_NAME), where('employeeId', '==', employeeId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return docToEmployee(doc.id, doc.data() as EmployeeDoc);
    }
    return null;
};

/**
 * Add new employee (with Auth user creation)
 */
export const addEmployee = async (data: EmployeeFormData): Promise<{
    id: string;
    authUid?: string;
    password?: string;
    error?: string;
}> => {
    // Note: Auth user creation must be done server-side
    // This should be called from a component that uses the server action
    const now = Timestamp.now();

    const docData: EmployeeDoc = {
        ...data,
        joinDate: Timestamp.fromDate(data.joinDate),
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

    return {
        id: docRef.id
    };
};

/**
 * Update existing employee
 */
export const updateEmployee = async (id: string, data: Partial<EmployeeFormData>): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: any = {
        ...data,
        updatedAt: Timestamp.now(),
    };

    // Convert Date to Timestamp if joinDate is provided
    if (data.joinDate) {
        updateData.joinDate = Timestamp.fromDate(data.joinDate);
    }

    await updateDoc(docRef, updateData);
};

/**
 * Delete employee
 */
export const deleteEmployee = async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
};

/**
 * Get active drivers (for Voyage assignment)
 */
export const getActiveDrivers = async (): Promise<Employee[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('role', '==', 'driver'),
        where('status', '==', 'active'),
        orderBy('fullName', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToEmployee(doc.id, doc.data() as EmployeeDoc));
};

/**
 * Check for expiring documents across all employees
 */
export const getEmployeesWithExpiringDocs = async (daysThreshold: number = 30): Promise<{
    employee: Employee;
    expiringDocs: any[];
}[]> => {
    const employees = await getEmployees();
    const today = new Date();
    const results: any[] = [];

    employees.forEach(emp => {
        const expiringDocs = emp.documents.filter(doc => {
            if (!doc.expiryDate) return false;
            const expiry = new Date(doc.expiryDate);
            const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return daysUntil <= daysThreshold && daysUntil >= 0;
        });

        if (expiringDocs.length > 0) {
            results.push({ employee: emp, expiringDocs });
        }
    });

    return results;
};
