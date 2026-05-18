import { db } from './firebase';
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import type { VolumeSession, KoliItem } from '@/types/volume-calculation';

const COLLECTION = 'volume_sessions';

// ── Firestore raw document shape ─────────────────────────────────────────────
interface VolumeSessionDoc {
    senderName: string;
    pricePerKg: number;
    koliList: KoliItem[];
    totalWeight: number;
    totalPrice: number;
    notes?: string;
    createdBy: string;
    createdByName?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

function docToSession(id: string, data: VolumeSessionDoc): VolumeSession {
    return {
        id,
        senderName: data.senderName,
        pricePerKg: data.pricePerKg,
        koliList: data.koliList,
        totalWeight: data.totalWeight,
        totalPrice: data.totalPrice,
        notes: data.notes,
        createdBy: data.createdBy,
        createdByName: data.createdByName,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
    };
}

// ── Get all sessions (shared — newest first) ─────────────────────────────────
export const getVolumeSessions = async (): Promise<VolumeSession[]> => {
    try {
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docToSession(d.id, d.data() as VolumeSessionDoc));
    } catch (error) {
        console.error('Error getting volume sessions:', error);
        throw error;
    }
};

// ── Get single session ────────────────────────────────────────────────────────
export const getVolumeSessionById = async (id: string): Promise<VolumeSession | null> => {
    try {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return docToSession(snap.id, snap.data() as VolumeSessionDoc);
    } catch (error) {
        console.error('Error getting volume session:', error);
        throw error;
    }
};

// ── Save new session ──────────────────────────────────────────────────────────
export const saveVolumeSession = async (
    userId: string,
    data: Omit<VolumeSession, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    try {
        const now = Timestamp.now();
        const docData: VolumeSessionDoc = {
            senderName: data.senderName,
            pricePerKg: data.pricePerKg,
            koliList: data.koliList,
            totalWeight: data.totalWeight,
            totalPrice: data.totalPrice,
            notes: data.notes || '',
            createdBy: userId,
            createdByName: data.createdByName || '',
            createdAt: now,
            updatedAt: now,
        };
        const ref = await addDoc(collection(db, COLLECTION), docData);
        return ref.id;
    } catch (error) {
        console.error('Error saving volume session:', error);
        throw error;
    }
};

// ── Update existing session ───────────────────────────────────────────────────
export const updateVolumeSession = async (
    id: string,
    data: Partial<Omit<VolumeSession, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
    try {
        const ref = doc(db, COLLECTION, id);
        await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
    } catch (error) {
        console.error('Error updating volume session:', error);
        throw error;
    }
};

// ── Delete session ────────────────────────────────────────────────────────────
export const deleteVolumeSession = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, COLLECTION, id));
    } catch (error) {
        console.error('Error deleting volume session:', error);
        throw error;
    }
};
