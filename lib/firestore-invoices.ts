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

// Generate continuous Invoice Number (e.g. 12703)
const generateInvoiceNumber = async (userId: string): Promise<string> => {
    const counterRef = doc(db, METADATA_COLLECTION, 'invoice_gen_counters');

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentNumber = 0;

            if (counterDoc.exists()) {
                const data = counterDoc.data();
                // Continuous global counter
                const key = 'global_invoice_number';
                currentNumber = data[key] || 0;
            }

            if (currentNumber < 12702) {
                currentNumber = 12702;
            }

            const nextNumber = currentNumber + 1;
            const key = 'global_invoice_number';

            transaction.set(counterRef, {
                [key]: nextNumber,
                lastUpdated: Timestamp.now()
            }, { merge: true });

            return nextNumber;
        });

        return String(newNumber);
    } catch (error) {
        console.error('Error generating invoice number:', error);
        return String(12702 + Math.floor(Math.random() * 1000));
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
        if (!invoiceDoc.exists()) throw new Error("Invoice tidak ditemukan");

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const updates: any = {
            status,
            updatedAt: Timestamp.now()
        };

        if (status === 'Paid' && paymentDetails) {
            updates.paymentDate = Timestamp.fromDate(paymentDetails.date);
            updates.paymentMethod = paymentDetails.method;
            if (paymentDetails.ref !== undefined) {
                updates.paymentRef = paymentDetails.ref;
            }
        }

        // 1. Update Invoice status
        transaction.update(invoiceRef, updates);

        // 2. Update all linked transactions if MARKED AS PAID
        if (status === 'Paid') {
            const method = paymentDetails?.method === 'Transfer' ? 'TF' : 'Cash';

            // We use Promise.all with transaction.get to check existence of all transactions first
            // to avoid "no document to update" error which would fail the entire transaction.
            for (const txId of invoiceData.transactionIds) {
                const txRef = doc(db, 'transactions', txId);
                const txSnap = await transaction.get(txRef);
                
                if (txSnap.exists()) {
                    transaction.update(txRef, {
                        pelunasan: method,
                        updatedAt: Timestamp.now()
                    });
                } else {
                    console.warn(`Transaction ${txId} referenced in invoice ${id} was not found. Skipping update.`);
                }
            }
        }
    });
};

export const deleteInvoice = async (id: string) => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
};
