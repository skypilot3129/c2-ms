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
    setDoc,
    runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction, TransactionFormData, TransactionDoc, StatusTransaksi, SuratJalanData } from '@/types/transaction';

const COLLECTION_NAME = 'transactions';
const METADATA_COLLECTION = 'metadata';
const STT_COUNTER_DOC = 'stt_counters';

// Convert Firestore document to Transaction type
export const docToTransaction = (id: string, data: TransactionDoc): Transaction => {
    return {
        id,
        userId: data.userId,
        tanggal: data.tanggal?.toDate() || new Date(),
        tujuan: data.tujuan || '',
        noSTT: data.noSTT || '',
        pengirimId: data.pengirimId || '',
        pengirimName: data.pengirimName || '',
        pengirimPhone: data.pengirimPhone,
        pengirimAddress: data.pengirimAddress,
        pengirimCity: data.pengirimCity,
        penerimaId: data.penerimaId || '',
        penerimaName: data.penerimaName || '',
        penerimaPhone: data.penerimaPhone,
        penerimaAddress: data.penerimaAddress,
        penerimaCity: data.penerimaCity,
        koli: data.koli || 0,
        berat: data.berat || 0,
        beratUnit: data.beratUnit || 'KG',
        tipeTransaksi: data.tipeTransaksi || 'regular',
        harga: data.harga || 0,
        jumlah: data.jumlah || 0,
        noInvoice: data.noInvoice || '',
        pembayaran: data.pembayaran || 'Tunai',
        pelunasan: data.pelunasan || 'Pending',

        // Tax
        isTaxable: data.isTaxable || false,
        ppn: data.ppn || 0,
        ppnRate: data.ppnRate || 0,

        keterangan: data.keterangan,
        isiBarang: data.isiBarang,
        suratJalan: data.suratJalan,  // Include surat jalan data
        status: data.status || 'pending',
        statusHistory: (data.statusHistory || []).map(entry => ({
            status: entry.status,
            timestamp: entry.timestamp?.toDate() || new Date(),
            catatan: entry.catatan,
        })),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
    };
};

/**
 * Peek at next STT number without incrementing counter (for preview)
 */
export const peekNextSTTNumber = async (userId: string): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, STT_COUNTER_DOC);

    try {
        const counterDoc = await getDoc(counterRef);

        // DEBUG: Log what we're reading
        console.log('[DEBUG peekNextSTTNumber] userId:', userId);
        console.log('[DEBUG peekNextSTTNumber] counterDoc exists:', counterDoc.exists());

        let nextNumber = 17642; // Start from 017642
        if (counterDoc.exists()) {
            const data = counterDoc.data();
            // Use 'global' key for shared counter
            const counterData = data['global'] || {};
            const existingNumber = counterData.currentNumber || 0;

            // Use the higher of 17641 or existing counter, then add 1
            nextNumber = Math.max(17641, existingNumber) + 1;
        }

        // Format: STT017642, STT017643, etc. (6 digits)
        const formatted = `STT${String(nextNumber).padStart(6, '0')}`;
        console.log('[DEBUG peekNextSTTNumber] Returning:', formatted);
        return formatted;
    } catch (error) {
        console.error('Error peeking STT number:', error);
        // Fallback to timestamp-based
        return `STT${Date.now().toString().slice(-6)}`;
    }
};

/**
 * Generate next STT number for user (e.g., STT017642, STT017643)
 */
export const generateSTTNumber = async (userId: string): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, STT_COUNTER_DOC);

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let currentNumber = 17642; // Start from 017642
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                // Use 'global' key
                const counterData = data['global'] || {};
                const existingNumber = counterData.currentNumber || 0;
                // Use the higher of 17641 or existing counter, then add 1
                currentNumber = Math.max(17641, existingNumber) + 1;
            }

            // Update counter
            transaction.set(counterRef, {
                ['global']: {
                    currentNumber,
                    prefix: 'STT',
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            return currentNumber;
        });

        // Format: STT017642, STT017643, etc. (6 digits)
        return `STT${String(newNumber).padStart(6, '0')}`;
    } catch (error) {
        console.error('Error generating STT number:', error);
        // Fallback to timestamp-based
        return `STT${Date.now().toString().slice(-6)}`;
    }
};

/**
 * Peek at next invoice number without incrementing counter (for preview)
 * Regular invoices start from 012366
 * PKP invoices start from 05177
 */
export const peekNextInvoiceNumber = async (userId: string, isPKP: boolean = false): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, 'invoice_counters');
    // Use global keys
    const counterKey = isPKP ? 'global_pkp' : 'global';

    try {
        const counterDoc = await getDoc(counterRef);

        // Different starting numbers based on PKP status
        let nextNumber = isPKP ? 5177 : 12366;

        if (counterDoc.exists()) {
            const data = counterDoc.data();
            const lastNumber = isPKP
                ? (data[counterKey]?.currentNumber || 5176)
                : (data[counterKey]?.currentNumber || 12365);
            nextNumber = lastNumber + 1;
        }

        // Format: INV012366 or INV-PKP05177 (with leading zeros)
        const formatted = isPKP
            ? `INV-PKP${String(nextNumber).padStart(5, '0')}`
            : `INV${String(nextNumber).padStart(6, '0')}`;

        return formatted;
    } catch (error) {
        console.error('Error peeking invoice number:', error);
        // Fallback to timestamp-based
        const prefix = isPKP ? 'INV-PKP' : 'INV';
        return `${prefix}${Date.now().toString().slice(-6)}`;
    }
};

/**
 * Generate invoice number with proper counters
 * Regular invoices start from 012366
 * PKP invoices start from 05177
 */
export const generateInvoiceNumber = async (userId: string, isPKP: boolean = false): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, 'invoice_counters');
    // Use global keys
    const counterKey = isPKP ? 'global_pkp' : 'global';

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            // Different starting numbers based on PKP status
            let currentNumber = isPKP ? 5177 : 12366;

            if (counterDoc.exists()) {
                const data = counterDoc.data();
                const lastNumber = isPKP
                    ? (data[counterKey]?.currentNumber || 5176)
                    : (data[counterKey]?.currentNumber || 12365);
                currentNumber = lastNumber + 1;
            }

            // Update counter
            transaction.set(counterRef, {
                [counterKey]: {
                    currentNumber,
                    prefix: isPKP ? 'INV-PKP' : 'INV',
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            return currentNumber;
        });

        // Format: INV012366 or INV-PKP05177 (with leading zeros)
        const formatted = isPKP
            ? `INV-PKP${String(newNumber).padStart(5, '0')}`
            : `INV${String(newNumber).padStart(6, '0')}`;

        return formatted;
    } catch (error) {
        console.error('Error generating invoice number:', error);
        // Fallback to timestamp-based
        const prefix = isPKP ? 'INV-PKP' : 'INV';
        return `${prefix}${Date.now().toString().slice(-6)}`;
    }
};

/**
 * Subscribe to all transactions for a user (real-time)
 * Optionally filter by date range
 */
export const subscribeToTransactions = (
    callback: (transactions: Transaction[]) => void,
    userId?: string, // Deprecated, kept for signature compatibility
    dateRange?: { startDate: Date; endDate: Date }
) => {
    const transactionsRef = collection(db, COLLECTION_NAME);
    let constraints: any[] = [];

    // Removed userId filter to allow shared access
    // if (userId) {
    //    constraints.push(where('userId', '==', userId));
    // }

    if (dateRange) {
        const start = Timestamp.fromDate(dateRange.startDate);
        const end = Timestamp.fromDate(dateRange.endDate);
        constraints.push(where('tanggal', '>=', start));
        constraints.push(where('tanggal', '<=', end));
    }

    const q = query(transactionsRef, ...constraints);

    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map((doc) =>
            docToTransaction(doc.id, doc.data() as TransactionDoc)
        );

        // Sort by tanggal descending (newest first)
        const sorted = transactions.sort((a, b) =>
            b.tanggal.getTime() - a.tanggal.getTime()
        );

        callback(sorted);
    });
};

/**
 * Get single transaction by ID
 */
export const getTransactionById = async (id: string): Promise<Transaction | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docToTransaction(docSnap.id, docSnap.data() as TransactionDoc);
    }
    return null;
};

/**
 * Add new transaction
 */
export const addTransaction = async (
    data: TransactionFormData,
    userId: string,
    pengirimData: { name: string; phone?: string; address?: string; city?: string },
    penerimaData: { name: string; phone?: string; address?: string; city?: string },
    jumlah: number,  // Total calculated from form
    noSTT?: string   // Optional: Manual STT number
): Promise<string> => {
    // Generate STT and Invoice numbers (use manual if provided)
    const sttNumber = noSTT && noSTT.trim() ? noSTT.trim() : await generateSTTNumber(userId);
    const noInvoice = data.noInvoice || await generateInvoiceNumber(userId);

    const now = Timestamp.now();
    const tanggal = Timestamp.fromDate(new Date(data.tanggal));

    const transactionData: Omit<TransactionDoc, 'userId'> & { userId: string } = {
        userId,
        tanggal,
        tujuan: data.tujuan,
        noSTT: sttNumber,

        // Pengirim
        pengirimId: data.pengirimId,
        pengirimName: pengirimData.name,
        pengirimPhone: pengirimData.phone,
        pengirimAddress: pengirimData.address,
        pengirimCity: pengirimData.city,


        // Penerima (manual input, no ID reference)
        penerimaId: '',  // Empty since penerima is manual input
        penerimaName: penerimaData.name,
        penerimaPhone: penerimaData.phone,
        penerimaAddress: penerimaData.address,
        penerimaCity: penerimaData.city,

        koli: data.koli,
        berat: data.berat,
        beratUnit: data.beratUnit,
        tipeTransaksi: data.tipeTransaksi,
        harga: data.harga,
        jumlah: jumlah,

        // Tax
        isTaxable: data.isTaxable,
        ppnRate: data.ppnRate,
        // Use explicit PPN if provided, otherwise calculate from Total (Assuming Total is Inclusive if taxable)
        ppn: data.ppn !== undefined
            ? data.ppn
            : (data.isTaxable ? Math.round(jumlah - (jumlah / (1 + (data.ppnRate || 0)))) : 0),

        noInvoice: noInvoice,
        pembayaran: data.pembayaran,
        pelunasan: data.pelunasan,
        keterangan: data.keterangan,
        isiBarang: data.isiBarang,
        status: data.status,
        statusHistory: [{
            status: data.status,
            timestamp: now,
            catatan: 'Transaksi dibuat',
        }],
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), transactionData);
    return docRef.id;
};

/**
 * Update existing transaction with enhanced tracking
 */
export const updateTransaction = async (
    id: string,
    data: Partial<TransactionFormData>,
    pengirimData?: { name: string; phone?: string; address?: string; city?: string },
    penerimaData?: { name: string; phone?: string; address?: string; city?: string },
    jumlah?: number,  // Calculated total from form
    noSTT?: string    // Optional: Updated STT number
): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updates: any = {
        updatedAt: Timestamp.now(),
    };

    // Update noSTT if provided
    if (noSTT !== undefined) {
        updates.noSTT = noSTT;
    }

    // Update basic fields
    if (data.tanggal) {
        updates.tanggal = Timestamp.fromDate(new Date(data.tanggal));
    }
    if (data.tujuan !== undefined) updates.tujuan = data.tujuan;
    if (data.koli !== undefined) updates.koli = data.koli;
    if (data.berat !== undefined) updates.berat = data.berat;
    if (data.beratUnit !== undefined) updates.beratUnit = data.beratUnit;
    if (data.tipeTransaksi !== undefined) updates.tipeTransaksi = data.tipeTransaksi;
    if (data.harga !== undefined) updates.harga = data.harga;
    if (data.noInvoice !== undefined) updates.noInvoice = data.noInvoice;
    if (data.pembayaran !== undefined) updates.pembayaran = data.pembayaran;
    if (data.pelunasan !== undefined) updates.pelunasan = data.pelunasan;
    if (data.keterangan !== undefined) updates.keterangan = data.keterangan;
    if (data.isiBarang !== undefined) updates.isiBarang = data.isiBarang;

    // Update jumlah if provided
    if (jumlah !== undefined) {
        updates.jumlah = jumlah;
    }

    // Update Tax fields
    if (data.isTaxable !== undefined) updates.isTaxable = data.isTaxable;
    if (data.ppnRate !== undefined) updates.ppnRate = data.ppnRate;

    // Recalculate PPN if relevant fields change (simplified: if either changed, update PPN)
    // Note: ideally we need previous values, but for now assuming if they are passed in update, we recalculate using current/new values.
    // However, updateTransaction usually receives partial data. 
    // If 'jumlah' or 'isTaxable' changes, we should update 'ppn'.
    // This is tricky without reading first. 
    // Let's assume the caller handles logic or we add a read.
    // For safety, let's read doc if we need to recalc PPN.
    if (data.isTaxable !== undefined || data.ppnRate !== undefined || jumlah !== undefined) {
        // We can't really do accurate partial update without reading unless we trust the caller to pass all needed.
        // Let's rely on the caller sending correct data or just add a simple check logic if we read later properly.
        // For now, let's just update fields if present. PPN calculation logic should ideally be in the form before sending here, 
        // OR we read the doc to recalculate. 
        // Let's do a read if we suspect tax impact to be safe?
        // Actually, let's just update the fields passed. 
        // If PPN needs update, caller should pass PPN. BUT addTransaction calculated it.
        // Let's add explicit 'ppn' handle if it's in TransactionFormData? No, it's calculated.
        // Let's add explicit `ppn` to `updateTransaction` args or calculate it here by reading.

        // DECISION: Modify updateTransaction to check if we can update PPN
        // Or better, let's assume the FORM handles calculation and we just save what's given?
        // But TransactionFormData doesn't have 'ppn' field as input (it has rate).
        // Let's read the doc to get current values if not provided.
    }
    // Optimization: Just update what is passed. We will ensure the FORM sends 'ppn' if we add it to the partial data type?
    // Wait, TransactionFormData doesn't have 'ppn'.
    // Let's UPDATE TransactionFormData to include optional ppn? No, interface says calculated.
    // Let's calculate PPN here correctly.

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const current = docSnap.data() as TransactionDoc;
        const newIsTaxable = data.isTaxable !== undefined ? data.isTaxable : current.isTaxable;
        const newRate = data.ppnRate !== undefined ? data.ppnRate : (current.ppnRate || 0);
        const newJumlah = jumlah !== undefined ? jumlah : current.jumlah;

        if (newIsTaxable) {
            updates.ppn = Math.round(newJumlah * newRate);
        } else {
            updates.ppn = 0;
        }
    }

    // Update pengirim data if provided
    if (pengirimData) {
        updates.pengirimName = pengirimData.name;
        if (pengirimData.phone !== undefined) updates.pengirimPhone = pengirimData.phone;
        if (pengirimData.address !== undefined) updates.pengirimAddress = pengirimData.address;
        if (pengirimData.city !== undefined) updates.pengirimCity = pengirimData.city;
    }

    // Update penerima data if provided
    if (penerimaData) {
        updates.penerimaName = penerimaData.name;
        if (penerimaData.phone !== undefined) updates.penerimaPhone = penerimaData.phone;
        if (penerimaData.address !== undefined) updates.penerimaAddress = penerimaData.address;
        if (penerimaData.city !== undefined) updates.penerimaCity = penerimaData.city;
    }

    // Handle status update with history tracking
    if (data.status !== undefined) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const currentData = docSnap.data() as TransactionDoc;

            // Only add to history if status actually changed
            if (currentData.status !== data.status) {
                const newEntry = {
                    status: data.status,
                    timestamp: Timestamp.now(),
                    catatan: 'Status diubah via edit',
                };
                updates.status = data.status;
                updates.statusHistory = [...(currentData.statusHistory || []), newEntry];
            }
        }
    }

    await updateDoc(docRef, updates);
};

/**
 * Update transaction status
 */
export const updateTransactionStatus = async (
    id: string,
    status: StatusTransaksi,
    catatan?: string
): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        throw new Error('Transaction not found');
    }

    const currentData = docSnap.data() as TransactionDoc;
    const newEntry = {
        status,
        timestamp: Timestamp.now(),
        catatan,
    };

    await updateDoc(docRef, {
        status,
        statusHistory: [...(currentData.statusHistory || []), newEntry],
        updatedAt: Timestamp.now(),
    });
};

/**
 * Delete transaction
 */
export const deleteTransaction = async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
};

/**
 * Search transactions (client-side)
 */
export const searchTransactions = (
    transactions: Transaction[],
    searchTerm: string
): Transaction[] => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return transactions;

    return transactions.filter(
        (transaction) =>
            transaction.noSTT.toLowerCase().includes(term) ||
            transaction.pengirimName.toLowerCase().includes(term) ||
            transaction.penerimaName.toLowerCase().includes(term) ||
            transaction.tujuan.toLowerCase().includes(term) ||
            transaction.noInvoice.toLowerCase().includes(term) ||
            transaction.keterangan?.toLowerCase().includes(term)
    );
};

/**
 * Update surat jalan data for a transaction
 */
export const updateSuratJalanData = async (
    id: string,
    suratJalanData: SuratJalanData
): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
        suratJalan: suratJalanData,
        updatedAt: Timestamp.now(),
    });
};
