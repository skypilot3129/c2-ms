import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type { RealBalanceMutation, RealBalanceSettings, RealBankAccount } from '@/types/saldo-real';
import { IKA_SYNC_START_DATE } from '@/types/saldo-real';
import type { Invoice } from '@/types/invoice';

const SETTINGS_COLLECTION = 'real_balance_settings';
const MUTATIONS_COLLECTION = 'real_balance_mutations';

const SETTINGS_DOC_ID = 'global_settings';

// Helper to convert Firestore doc to RealBalanceSettings
function docToSettings(data: any): RealBalanceSettings {
    return {
        id: SETTINGS_DOC_ID,
        userId: data.userId || '',
        modalAwalPerusahaan: Number(data.modalAwalPerusahaan) || 0,
        modalAwalBca: Number(data.modalAwalBca) || 0,
        modalAwalBri: Number(data.modalAwalBri) || 0,
        modalAwalMandiri: Number(data.modalAwalMandiri) || 0,
        effectiveDate: data.effectiveDate || '2026-08-23',
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
        updatedBy: data.updatedBy || '',
    };
}

// Helper to convert Firestore doc to RealBalanceMutation
function docToMutation(id: string, data: any): RealBalanceMutation {
    return {
        id,
        userId: data.userId || '',
        date: data.date || new Date().toISOString().split('T')[0],
        type: data.type || 'in',
        source: data.source || 'manual',
        bank: (data.bank as RealBankAccount) || 'bca',
        targetBank: data.targetBank ? (data.targetBank as RealBankAccount) : undefined,
        amount: Number(data.amount) || 0,
        category: data.category || 'Lainnya',
        description: data.description || '',
        refNumber: data.refNumber || '',
        invoiceId: data.invoiceId || undefined,
        clientName: data.clientName || undefined,
        paidBy: data.paidBy || undefined,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
    };
}

/**
 * Subscribe to Real Balance Settings (Modal Awal)
 */
export function subscribeToRealBalanceSettings(
    callback: (settings: RealBalanceSettings) => void
): () => void {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            callback(docToSettings(snap.data()));
        } else {
            callback({
                id: SETTINGS_DOC_ID,
                modalAwalPerusahaan: 0,
                modalAwalBca: 0,
                modalAwalBri: 0,
                modalAwalMandiri: 0,
                effectiveDate: '2026-08-23',
            });
        }
    }, (error) => {
        console.error('Error listening to real balance settings:', error);
    });
}

/**
 * Save Real Balance Settings (Modal Awal)
 */
export async function saveRealBalanceSettings(
    settings: Partial<RealBalanceSettings>,
    userId: string,
    updatedBy?: string
): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const payload = {
        userId,
        modalAwalPerusahaan: Number(settings.modalAwalPerusahaan) || 0,
        modalAwalBca: Number(settings.modalAwalBca) || 0,
        modalAwalBri: Number(settings.modalAwalBri) || 0,
        modalAwalMandiri: Number(settings.modalAwalMandiri) || 0,
        effectiveDate: settings.effectiveDate || '2026-08-23',
        updatedAt: Timestamp.now(),
        updatedBy: updatedBy || '',
    };
    await setDoc(docRef, payload, { merge: true });
}

/**
 * Subscribe to Real Balance Mutations
 */
export function subscribeToRealMutations(
    callback: (mutations: RealBalanceMutation[]) => void
): () => void {
    const q = query(
        collection(db, MUTATIONS_COLLECTION),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
        const mutations = snap.docs.map((d) => docToMutation(d.id, d.data()));
        callback(mutations);
    }, (error) => {
        console.error('Error listening to real mutations:', error);
        // Fallback without compound orderBy in case index is building
        const fallbackQ = query(collection(db, MUTATIONS_COLLECTION));
        onSnapshot(fallbackQ, (snap) => {
            const mutations = snap.docs.map((d) => docToMutation(d.id, d.data()));
            mutations.sort((a, b) => {
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                return b.createdAt.getTime() - a.createdAt.getTime();
            });
            callback(mutations);
        });
    });
}

/**
 * Add a manual mutation (Income, Expense, or Bank Transfer)
 */
export async function addRealMutation(
    data: Omit<RealBalanceMutation, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
): Promise<string> {
    const now = Timestamp.now();
    const payload: any = {
        userId,
        date: data.date,
        type: data.type,
        source: data.source || 'manual',
        bank: data.bank,
        targetBank: data.targetBank || null,
        amount: Number(data.amount) || 0,
        category: data.category || 'Umum',
        description: data.description || '',
        refNumber: data.refNumber || '',
        invoiceId: data.invoiceId || null,
        clientName: data.clientName || null,
        paidBy: data.paidBy || null,
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await addDoc(collection(db, MUTATIONS_COLLECTION), payload);
    return docRef.id;
}

/**
 * Update an existing mutation
 */
export async function updateRealMutation(
    id: string,
    data: Partial<RealBalanceMutation>
): Promise<void> {
    const docRef = doc(db, MUTATIONS_COLLECTION, id);
    const payload: any = {
        updatedAt: Timestamp.now(),
    };

    if (data.date !== undefined) payload.date = data.date;
    if (data.type !== undefined) payload.type = data.type;
    if (data.bank !== undefined) payload.bank = data.bank;
    if (data.targetBank !== undefined) payload.targetBank = data.targetBank || null;
    if (data.amount !== undefined) payload.amount = Number(data.amount) || 0;
    if (data.category !== undefined) payload.category = data.category;
    if (data.description !== undefined) payload.description = data.description;
    if (data.refNumber !== undefined) payload.refNumber = data.refNumber;

    await updateDoc(docRef, payload);
}

/**
 * Delete a mutation
 */
export async function deleteRealMutation(id: string): Promise<void> {
    const docRef = doc(db, MUTATIONS_COLLECTION, id);
    await deleteDoc(docRef);
}

/**
 * Synchronize Paid Invoices from Penagihan IKA starting from 23 August 2026
 */
export async function syncIkaInvoicesToRealMutations(
    invoices: Invoice[],
    userId: string,
    operatorName?: string
): Promise<{ addedCount: number; updatedCount: number }> {
    try {
        // 1. Filter eligible Paid invoices with payment date or issue date >= 2026-08-23
        const eligibleInvoices = invoices.filter(inv => {
            if (inv.status !== 'Paid') return false;
            
            // Check payment date or issue date
            const payDateStr = inv.paymentDate 
                ? (inv.paymentDate instanceof Date ? inv.paymentDate.toISOString().split('T')[0] : String(inv.paymentDate).split('T')[0])
                : (inv.paidAt instanceof Date ? inv.paidAt.toISOString().split('T')[0] : (inv.issueDate instanceof Date ? inv.issueDate.toISOString().split('T')[0] : String(inv.issueDate).split('T')[0]));
            
            return payDateStr >= IKA_SYNC_START_DATE;
        });

        if (eligibleInvoices.length === 0) {
            return { addedCount: 0, updatedCount: 0 };
        }

        // 2. Fetch all existing mutations from penagihan_ika
        const existingQ = query(
            collection(db, MUTATIONS_COLLECTION),
            where('source', '==', 'penagihan_ika')
        );
        const existingSnap = await getDocs(existingQ);
        const existingByInvoiceId = new Map<string, { id: string; amount: number; bank: RealBankAccount; date: string }>();

        existingSnap.docs.forEach(docSnap => {
            const d = docSnap.data();
            if (d.invoiceId) {
                existingByInvoiceId.set(d.invoiceId, {
                    id: docSnap.id,
                    amount: Number(d.amount) || 0,
                    bank: (d.bank as RealBankAccount) || 'bca',
                    date: d.date || '',
                });
            }
        });

        let addedCount = 0;
        let updatedCount = 0;
        const now = Timestamp.now();
        const batch = writeBatch(db);

        for (const inv of eligibleInvoices) {
            const payDateObj = inv.paymentDate || inv.paidAt || inv.issueDate || new Date();
            const dateStr = payDateObj instanceof Date 
                ? payDateObj.toISOString().split('T')[0] 
                : String(payDateObj).split('T')[0];

            // Normalize bank account from invoice paymentMethod or paymentRef
            let bank: RealBankAccount = 'bca'; // Default to primary BCA rekening
            const pMethod = (inv.paymentMethod || '').toLowerCase();
            const pRef = (inv.paymentRef || '').toLowerCase();
            const combined = `${pMethod} ${pRef}`;

            if (combined.includes('bri')) {
                bank = 'bri';
            } else if (combined.includes('mandiri')) {
                bank = 'mandiri';
            } else if (combined.includes('perusahaan') || combined.includes('kas') || combined.includes('tunai') || pMethod === 'cash') {
                bank = 'perusahaan';
            } else if (combined.includes('bca')) {
                bank = 'bca';
            }

            const amount = Number(inv.totalAmount) || 0;
            const description = `[PENAGIHAN IKA] Pelunasan Invoice ${inv.invoiceNumber} - ${inv.clientName}`;
            const refNumber = inv.paymentRef || inv.invoiceNumber;
            const clientName = inv.clientName;
            const paidBy = inv.paidBy || operatorName || 'Officer Penagihan IKA';

            const existing = existingByInvoiceId.get(inv.id);

            if (!existing) {
                // Add new mutation document
                const newDocRef = doc(collection(db, MUTATIONS_COLLECTION));
                batch.set(newDocRef, {
                    userId,
                    date: dateStr,
                    type: 'in',
                    source: 'penagihan_ika',
                    bank,
                    amount,
                    category: 'Penagihan IKA',
                    description,
                    refNumber,
                    invoiceId: inv.id,
                    clientName,
                    paidBy,
                    createdAt: now,
                    updatedAt: now,
                });
                addedCount++;
            } else if (existing.amount !== amount || existing.date !== dateStr) {
                // Update existing mutation if amount or date was edited
                const mutRef = doc(db, MUTATIONS_COLLECTION, existing.id);
                batch.update(mutRef, {
                    amount,
                    date: dateStr,
                    description,
                    refNumber,
                    updatedAt: now,
                });
                updatedCount++;
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            await batch.commit();
        }

        return { addedCount, updatedCount };
    } catch (error) {
        console.error('Error syncing IKA invoices to real balance:', error);
        throw error;
    }
}

/**
 * Remove an auto-synced mutation when an invoice is reverted to Unpaid
 */
export async function removeIkaInvoiceMutation(invoiceId: string): Promise<void> {
    try {
        const q = query(
            collection(db, MUTATIONS_COLLECTION),
            where('invoiceId', '==', invoiceId),
            where('source', '==', 'penagihan_ika')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => {
                batch.delete(d.ref);
            });
            await batch.commit();
        }
    } catch (err) {
        console.warn('Notice removing IKA invoice mutation:', err);
    }
}
