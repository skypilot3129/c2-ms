import { db } from './firebase';
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    doc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import type { CargoManifest, ManifestItem, ManifestRowColor } from '@/types/manifest';

const COLLECTION = 'cargo_manifests';

interface ManifestItemDoc {
    noSTT: string;
    koli: number;
    berat: number | string;
    isiBarang: string;
    pengirim: string;
    penerima: string;
    alamat: string;
    keterangan: string;
    color: ManifestRowColor;
}

interface CargoManifestDoc {
    tanggal: string;
    kapal: string;
    nopol: string;
    sopir: string;
    kepadaYth: string;
    items: ManifestItemDoc[];
    createdBy: string;
    createdByName: string;
    createdAt: Timestamp | any;
    updatedAt: Timestamp | any;
}

/**
 * Sanitize single item to guarantee no `undefined` value reaches Firestore
 */
function cleanItem(item: any): ManifestItemDoc {
    return {
        noSTT: String(item?.noSTT ?? '').trim(),
        koli: Number(item?.koli) || 0,
        berat: typeof item?.berat === 'number' ? item.berat : String(item?.berat ?? '').trim(),
        isiBarang: String(item?.isiBarang ?? '').trim(),
        pengirim: String(item?.pengirim ?? '').trim(),
        penerima: String(item?.penerima ?? '').trim(),
        alamat: String(item?.alamat ?? '').trim(),
        keterangan: String(item?.keterangan ?? '').trim(),
        color: (item?.color as ManifestRowColor) || 'white',
    };
}

/**
 * Safe conversion of Firestore timestamps or dates
 */
function toDateSafe(v: any): Date {
    if (!v) return new Date();
    if (v.toDate && typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Convert raw Firestore document to CargoManifest model
 */
function docToManifest(id: string, data: any): CargoManifest {
    return {
        id,
        tanggal: String(data?.tanggal ?? ''),
        kapal: String(data?.kapal ?? ''),
        nopol: String(data?.nopol ?? ''),
        sopir: String(data?.sopir ?? ''),
        kepadaYth: String(data?.kepadaYth ?? 'CAHAYA CARGO EXP MKS'),
        items: Array.isArray(data?.items) ? data.items.map(cleanItem) : [],
        createdBy: String(data?.createdBy ?? ''),
        createdByName: String(data?.createdByName ?? 'Admin'),
        createdAt: toDateSafe(data?.createdAt),
        updatedAt: toDateSafe(data?.updatedAt),
    };
}

/**
 * Realtime subscription to all Cargo Manifests
 */
export const subscribeToManifests = (
    callback: (manifests: CargoManifest[]) => void
): (() => void) => {
    try {
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => docToManifest(d.id, d.data()));
            callback(list);
        }, (error) => {
            console.warn('Subscription with orderBy failed, falling back to simple query:', error);
            // Fallback to simple query if orderBy index has issues
            return onSnapshot(collection(db, COLLECTION), (snap) => {
                const list = snap.docs.map(d => docToManifest(d.id, d.data()));
                list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
                callback(list);
            }, (fallbackErr) => {
                console.error('Realtime subscription to cargo_manifests failed:', fallbackErr);
            });
        });
    } catch (err) {
        console.error('Error setting up manifests subscription:', err);
        return () => {};
    }
};

/**
 * Fetch all Cargo Manifests once
 */
export const getManifests = async (): Promise<CargoManifest[]> => {
    try {
        let snapshot;
        try {
            const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
            snapshot = await getDocs(q);
        } catch (queryErr) {
            console.warn('orderBy query failed, falling back to plain collection getDocs:', queryErr);
            snapshot = await getDocs(collection(db, COLLECTION));
        }

        const list = snapshot.docs.map(d => docToManifest(d.id, d.data()));
        list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
        return list;
    } catch (error) {
        console.error('Error getting manifests:', error);
        throw error;
    }
};

/**
 * Fetch single Cargo Manifest by ID
 */
export const getManifestById = async (id: string): Promise<CargoManifest | null> => {
    try {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return docToManifest(snap.id, snap.data());
    } catch (error) {
        console.error('Error getting manifest by ID:', error);
        throw error;
    }
};

/**
 * Create new Cargo Manifest in Firestore
 */
export const createManifest = async (
    userId: string,
    data: Omit<CargoManifest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
    try {
        const now = Timestamp.now();
        const docData: CargoManifestDoc = {
            tanggal: String(data.tanggal ?? '').trim(),
            kapal: String(data.kapal ?? '').trim(),
            nopol: String(data.nopol ?? '').trim(),
            sopir: String(data.sopir ?? '').trim(),
            kepadaYth: String(data.kepadaYth ?? 'CAHAYA CARGO EXP MKS').trim(),
            items: (data.items || []).map(cleanItem),
            createdBy: String(userId || 'anonymous'),
            createdByName: String(data.createdByName || 'Admin').trim(),
            createdAt: now,
            updatedAt: now,
        };

        const ref = await addDoc(collection(db, COLLECTION), docData);
        console.log(`[createManifest] Successfully saved manifest with ID: ${ref.id}`);
        return ref.id;
    } catch (error) {
        console.error('Error creating manifest in Firestore:', error);
        throw error;
    }
};

/**
 * Update existing Cargo Manifest in Firestore (uses setDoc with merge to avoid document-not-found errors)
 */
export const updateManifest = async (
    id: string,
    data: Partial<Omit<CargoManifest, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
    try {
        const ref = doc(db, COLLECTION, id);
        const updateData: any = {
            updatedAt: Timestamp.now(),
        };

        if (data.tanggal !== undefined) updateData.tanggal = String(data.tanggal ?? '').trim();
        if (data.kapal !== undefined) updateData.kapal = String(data.kapal ?? '').trim();
        if (data.nopol !== undefined) updateData.nopol = String(data.nopol ?? '').trim();
        if (data.sopir !== undefined) updateData.sopir = String(data.sopir ?? '').trim();
        if (data.kepadaYth !== undefined) updateData.kepadaYth = String(data.kepadaYth ?? '').trim();
        if (data.createdByName !== undefined) updateData.createdByName = String(data.createdByName ?? 'Admin').trim();
        if (data.items !== undefined) {
            updateData.items = (data.items || []).map(cleanItem);
        }

        await setDoc(ref, updateData, { merge: true });
        console.log(`[updateManifest] Successfully updated manifest ID: ${id}`);
    } catch (error) {
        console.error('Error updating manifest in Firestore:', error);
        throw error;
    }
};

/**
 * Delete Cargo Manifest by ID
 */
export const deleteManifest = async (id: string): Promise<void> => {
    try {
        const ref = doc(db, COLLECTION, id);
        await deleteDoc(ref);
        console.log(`[deleteManifest] Successfully deleted manifest ID: ${id}`);
    } catch (error) {
        console.error('Error deleting manifest:', error);
        throw error;
    }
};
