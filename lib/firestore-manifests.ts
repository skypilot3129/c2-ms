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
import type { CargoManifest } from '@/types/manifest';

const COLLECTION = 'cargo_manifests';

interface ManifestItemDoc {
    noSTT: string;
    koli: number;
    berat: number;
    isiBarang: string;
    pengirim: string;
    penerima: string;
    keterangan: string;
}

interface CargoManifestDoc {
    tanggal: string;
    kapal: string;
    nopol: string;
    sopir: string;
    kepadaYth: string;
    items: ManifestItemDoc[];
    createdBy: string;
    createdByName?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

function docToManifest(id: string, data: CargoManifestDoc): CargoManifest {
    return {
        id,
        tanggal: data.tanggal,
        kapal: data.kapal,
        nopol: data.nopol,
        sopir: data.sopir,
        kepadaYth: data.kepadaYth || '',
        items: data.items || [],
        createdBy: data.createdBy,
        createdByName: data.createdByName,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
    };
}

export const getManifests = async (): Promise<CargoManifest[]> => {
    try {
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docToManifest(d.id, d.data() as CargoManifestDoc));
    } catch (error) {
        console.error('Error getting manifests:', error);
        throw error;
    }
};

export const getManifestById = async (id: string): Promise<CargoManifest | null> => {
    try {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return docToManifest(snap.id, snap.data() as CargoManifestDoc);
    } catch (error) {
        console.error('Error getting manifest by ID:', error);
        throw error;
    }
};

export const createManifest = async (
    userId: string,
    data: Omit<CargoManifest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    try {
        const now = Timestamp.now();
        const docData: CargoManifestDoc = {
            tanggal: data.tanggal,
            kapal: data.kapal,
            nopol: data.nopol,
            sopir: data.sopir,
            kepadaYth: data.kepadaYth,
            items: data.items,
            createdBy: userId,
            createdByName: data.createdByName || '',
            createdAt: now,
            updatedAt: now,
        };
        const ref = await addDoc(collection(db, COLLECTION), docData);
        return ref.id;
    } catch (error) {
        console.error('Error creating manifest:', error);
        throw error;
    }
};

export const updateManifest = async (
    id: string,
    data: Partial<Omit<CargoManifest, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
    try {
        const ref = doc(db, COLLECTION, id);
        await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
    } catch (error) {
        console.error('Error updating manifest:', error);
        throw error;
    }
};

export const deleteManifest = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, COLLECTION, id));
    } catch (error) {
        console.error('Error deleting manifest:', error);
        throw error;
    }
};
