import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    query,
    where,
    onSnapshot,
    Timestamp,
    runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Invoice, InvoiceFormData, InvoiceDoc } from '@/types/invoice';
import { updateTransaction } from './firestore-transactions';

const COLLECTION_NAME = 'invoices';
const METADATA_COLLECTION = 'metadata';

// Convert Firestore doc to Invoice type
const docToInvoice = (id: string, data: InvoiceDoc): Invoice => ({
    id,
    userId: data.userId,
    invoiceNumber: data.invoiceNumber,
    clientId: data.clientId,
    clientName: data.clientName,
    clientAddress: data.clientAddress,
    transactionIds: data.transactionIds,
    totalAmount: data.totalAmount,
    issueDate: data.issueDate.toDate(),
    dueDate: data.dueDate.toDate(),
    status: data.status,
    paymentDate: data.paymentDate?.toDate(),
    paymentMethod: data.paymentMethod,
    paymentRef: data.paymentRef,
    notes: data.notes,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
});

// Generate proper Invoice Number (INV/YYYY/MM/XXXX)
const generateInvoiceNumber = async (userId: string): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, 'invoice_gen_counters');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV/${year}/${month}`;

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentNumber = 0;

            if (counterDoc.exists()) {
                const data = counterDoc.data();
                // Check if we are in the same month/year group
                // Implementation simplification: Global counter for user or month-based?
                // Let's do month-based for cleaner reset.
                const key = `global_${year}${month}`; // Global key
                currentNumber = data[key] || 0;
            }

            const nextNumber = currentNumber + 1;
            const key = `global_${year}${month}`; // Global key

            transaction.set(counterRef, {
                [key]: nextNumber,
                lastUpdated: Timestamp.now()
            }, { merge: true });

            return nextNumber;
        });

        return `${prefix}/${String(newNumber).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating invoice number:', error);
        return `${prefix}/${Date.now().toString().slice(-4)}`;
    }
};

export const subscribeToInvoices = (userId: string, callback: (invoices: Invoice[]) => void) => {
    // Shared access: Remove filter
    const q = query(collection(db, COLLECTION_NAME));
    // const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => docToInvoice(doc.id, doc.data() as InvoiceDoc));
        // Sort by issueDate descending
        items.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
        callback(items);
    });
};

export const getInvoiceById = async (id: string): Promise<Invoice | null> => {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (docSnap.exists()) {
        return docToInvoice(docSnap.id, docSnap.data() as InvoiceDoc);
    }
    return null;
};

export const createInvoice = async (data: InvoiceFormData, userId: string): Promise<string> => {
    const invoiceNumber = await generateInvoiceNumber(userId);
    const now = Timestamp.now();

    const invoiceData: InvoiceDoc = {
        userId,
        invoiceNumber,
        clientId: data.clientId,
        clientName: data.clientName,
        clientAddress: data.clientAddress,
        transactionIds: data.transactionIds,
        totalAmount: data.totalAmount,
        issueDate: Timestamp.fromDate(new Date(data.issueDate)),
        dueDate: Timestamp.fromDate(new Date(data.dueDate)),
        status: 'Unpaid',
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
    };

    // Run as transaction to update all linked transactions with this invoice reference?
    // Or just create invoice first. Ideally, we should tag transactions as "Invoiced" or "Billed".
    // Since 'noInvoice' field exists in Transaction, we can update it.

    // NOTE: Transaction already has 'noInvoice' which is usually the per-STT invoice number.
    // This 'Invoice' is a Consolidated Invoice. 
    // We might need to store this consolidated Invoice ID in the transaction or just trust the Invoice's transactionIds array.
    // Let's rely on Invoice's transactionIds array for grouping. 
    // BUT we should update Transaction status? 'pelunasan' is still Pending.
    // Maybe we update 'keterangan' or a new field 'billedIn'?
    // For now, let's just create the Invoice doc. Linking logic will be read-time or manual update if needed.

    // Better: Update transactions to prevent re-invoicing.
    // But 'noInvoice' on Transaction is distinct.
    // Let's proceed with creating Invoice only for now.

    const docRef = await addDoc(collection(db, COLLECTION_NAME), invoiceData);
    return docRef.id;
};

export const updateInvoiceStatus = async (id: string, status: 'Paid' | 'Unpaid', paymentDetails?: { date: Date, method: string, ref?: string }) => {
    // 1. Get the invoice to find transaction IDs
    const invoiceRef = doc(db, COLLECTION_NAME, id);

    await runTransaction(db, async (transaction) => {
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists()) throw new Error("Invoice not found");

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const updates: any = {
            status,
            updatedAt: Timestamp.now()
        };

        if (status === 'Paid' && paymentDetails) {
            updates.paymentDate = Timestamp.fromDate(paymentDetails.date);
            updates.paymentMethod = paymentDetails.method;
            updates.paymentRef = paymentDetails.ref;
        }

        // Update Invoice
        transaction.update(invoiceRef, updates);

        // 2. Update all linked transactions if MARKED AS PAID
        if (status === 'Paid') {
            const method = paymentDetails?.method === 'Transfer' ? 'TF' : 'Cash'; // Map to CaraPelunasan

            for (const txId of invoiceData.transactionIds) {
                const txRef = doc(db, 'transactions', txId);
                transaction.update(txRef, {
                    pelunasan: method, // Mark transaction as paid
                    updatedAt: Timestamp.now()
                });
            }
        }
    });
};

export const deleteInvoice = async (id: string) => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
};
