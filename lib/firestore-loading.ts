import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    orderBy,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    LoadingSession,
    LoadingSessionDoc,
    EmployeeDepartureLog,
    CargoStackItem,
    AssignedEmployee,
    LoadingStatus
} from '@/types/loading-session';

const COLLECTION_NAME = 'loading_sessions';

// Helper to convert Firestore Doc to LoadingSession
const docToSession = (id: string, data: LoadingSessionDoc): LoadingSession => {
    return {
        ...data,
        id,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
    };
};

// Generate next Session ID (e.g. MUAT-20260725-001)
export const generateSessionId = async (): Promise<string> => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `MUAT-${todayStr}`;
    
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const todayCount = snap.docs.filter(d => d.data().sessionId?.startsWith(prefix)).length;
        const seq = String(todayCount + 1).padStart(3, '0');
        return `${prefix}-${seq}`;
    } catch (e) {
        const randomStr = Math.floor(100 + Math.random() * 900);
        return `${prefix}-${randomStr}`;
    }
};

// Realtime Listener for All Loading Sessions
export const subscribeToLoadingSessions = (
    onUpdate: (sessions: LoadingSession[]) => void
) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => docToSession(d.id, d.data() as LoadingSessionDoc));
        onUpdate(list);
    }, (error) => {
        console.error('Error subscribing to loading sessions:', error);
    });
};

// Fetch Single Loading Session By ID
export const getLoadingSessionById = async (id: string): Promise<LoadingSession | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return docToSession(docSnap.id, docSnap.data() as LoadingSessionDoc);
    } catch (error) {
        console.error('Error fetching loading session:', error);
        return null;
    }
};

// Create New Loading Session
export const createLoadingSession = async (
    payload: Omit<LoadingSession, 'id' | 'createdAt' | 'updatedAt' | 'sessionId'> & { customSessionId?: string }
): Promise<string> => {
    const sessionDocRef = doc(collection(db, COLLECTION_NAME));
    const sessionId = payload.customSessionId || await generateSessionId();

    const dataToSave = {
        ...payload,
        sessionId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    await setDoc(sessionDocRef, dataToSave);
    return sessionDocRef.id;
};

// Update Loading Session Status & Timer
export const updateLoadingSessionStatus = async (
    id: string,
    status: LoadingStatus,
    extraUpdates: Partial<LoadingSession> = {}
): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updates: Record<string, any> = {
        status,
        updatedAt: Timestamp.now(),
        ...extraUpdates
    };

    if (status === 'loading' && !extraUpdates.startTime) {
        updates.startTime = new Date().toISOString();
    } else if (status === 'completed' && !extraUpdates.endTime) {
        updates.endTime = new Date().toISOString();
    }

    await updateDoc(docRef, updates);
};

// Log Employee Departure / Desertion
export const logEmployeeDeparture = async (
    sessionId: string,
    departureLog: Omit<EmployeeDepartureLog, 'id'>,
    assignedEmployees: AssignedEmployee[]
): Promise<void> => {
    const session = await getLoadingSessionById(sessionId);
    if (!session) throw new Error('Session loading tidak ditemukan');

    const newLogId = `LOG-${Date.now()}`;
    const newDeparture: EmployeeDepartureLog = {
        ...departureLog,
        id: newLogId,
    };

    const updatedDepartureLogs = [...(session.departureLogs || []), newDeparture];

    // Update employee status
    const updatedEmployees: AssignedEmployee[] = (assignedEmployees || session.assignedEmployees).map(emp => {
        if (emp.employeeId === departureLog.employeeId) {
            const newStatus: AssignedEmployee['status'] = departureLog.reason.includes('Kabur') ? 'deserted' : 'on_leave';
            return {
                ...emp,
                status: newStatus,
                notes: `Log: ${departureLog.reason} (Pergi ${new Date(departureLog.departureTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`
            };
        }
        return emp;
    });

    // Recalculate Uang Muat distribution
    const recalculatedEmployees = calculateUangMuatShare(
        updatedEmployees,
        updatedDepartureLogs,
        session.totalUangMuat || 0,
        session.totalDurationMinutes || 60
    );

    const docRef = doc(db, COLLECTION_NAME, sessionId);
    await updateDoc(docRef, {
        departureLogs: updatedDepartureLogs,
        assignedEmployees: recalculatedEmployees,
        updatedAt: Timestamp.now(),
    });
};

// Mark Employee Returned from Leave
export const returnEmployeeFromLeave = async (
    sessionId: string,
    employeeId: string,
    returnTimeIso: string
): Promise<void> => {
    const session = await getLoadingSessionById(sessionId);
    if (!session) throw new Error('Session loading tidak ditemukan');

    const departureLogs = (session.departureLogs || []).map(log => {
        if (log.employeeId === employeeId && !log.returnTime) {
            const depTime = new Date(log.departureTime).getTime();
            const retTime = new Date(returnTimeIso).getTime();
            const durationMin = Math.max(1, Math.round((retTime - depTime) / 60000));
            return {
                ...log,
                returnTime: returnTimeIso,
                durationMinutes: durationMin,
            };
        }
        return log;
    });

    const updatedEmployees = (session.assignedEmployees || []).map(emp => {
        if (emp.employeeId === employeeId) {
            return {
                ...emp,
                status: 'returned' as const,
                notes: `Kembali pada ${new Date(returnTimeIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
            };
        }
        return emp;
    });

    const recalculatedEmployees = calculateUangMuatShare(
        updatedEmployees,
        departureLogs,
        session.totalUangMuat || 0,
        session.totalDurationMinutes || 60
    );

    const docRef = doc(db, COLLECTION_NAME, sessionId);
    await updateDoc(docRef, {
        departureLogs,
        assignedEmployees: recalculatedEmployees,
        updatedAt: Timestamp.now(),
    });
};

// Save Cargo Items / 3D Stack Layout
export const saveCargoStackLayout = async (
    sessionId: string,
    cargoItems: CargoStackItem[]
): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, sessionId);
    
    const totalKoli = cargoItems.reduce((sum, item) => sum + (item.koliCount || 1), 0);
    const totalWeightKg = cargoItems.reduce((sum, item) => sum + (item.weightKg || 0), 0);
    const totalCbm = cargoItems.reduce((sum, item) => sum + (item.cbm || 0), 0);

    await updateDoc(docRef, {
        cargoItems,
        totalKoli,
        totalWeightKg: Math.round(totalWeightKg * 10) / 10,
        totalCbm: Math.round(totalCbm * 100) / 100,
        updatedAt: Timestamp.now(),
    });
};

// Helper to Calculate Fair Distribution of Uang Muat
export const calculateUangMuatShare = (
    employees: AssignedEmployee[],
    logs: EmployeeDepartureLog[],
    totalUangMuat: number,
    sessionDurationMinutes: number
): AssignedEmployee[] => {
    if (employees.length === 0) return employees;
    if (totalUangMuat <= 0) return employees.map(e => ({ ...e, uangMuatShare: 0 }));

    // Role weight: Penyusun gets 1.3x ratio, Loader gets 1.0x ratio, Pengawal gets 0.8x ratio
    const roleWeights: Record<string, number> = {
        'Penyusun': 1.3,
        'Loader/Helper': 1.0,
        'Pengawal': 0.8
    };

    const effectiveDuration = Math.max(15, sessionDurationMinutes);

    // Calculate effective work score for each employee
    const scores = employees.map(emp => {
        const empLogs = logs.filter(l => l.employeeId === emp.employeeId);
        
        let penaltyTotalPct = 0;
        let leaveMinutesTotal = 0;

        empLogs.forEach(l => {
            const leaveMins = l.durationMinutes || 15;
            leaveMinutesTotal += leaveMins;
            penaltyTotalPct += (l.penaltyPercentage || 0);

            // Special penalty: Desertion / Kabur gets 100% penalty
            if (l.reason.includes('Kabur')) {
                penaltyTotalPct += 100;
            }
        });

        const activeMinutes = Math.max(0, effectiveDuration - leaveMinutesTotal);
        const attendanceRatio = Math.min(1, activeMinutes / effectiveDuration);
        const penaltyMultiplier = Math.max(0, 1 - (penaltyTotalPct / 100));
        
        const baseRoleWeight = roleWeights[emp.role] || 1.0;
        const score = baseRoleWeight * attendanceRatio * penaltyMultiplier;

        return {
            employeeId: emp.employeeId,
            score,
            activeMinutes,
        };
    });

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

    return employees.map(emp => {
        const empScore = scores.find(s => s.employeeId === emp.employeeId);
        const scoreVal = empScore?.score || 0;
        const share = totalScore > 0 ? Math.round((scoreVal / totalScore) * totalUangMuat) : 0;

        return {
            ...emp,
            totalActiveMinutes: empScore?.activeMinutes || 0,
            uangMuatShare: share,
        };
    });
};
