import {
    collection,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    Timestamp,
    runTransaction,
    deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Invoice, InvoiceFormData, InvoiceDoc } from '@/types/invoice';

const COLLECTION_NAME = 'invoices';
const METADATA_COLLECTION = 'metadata';

const getPaidMethodCode = (methodStr?: string): 'TF' | 'Cash' => {
    const raw = (methodStr || '').toLowerCase();
    return raw.includes('transfer') || raw.includes('tf') ? 'TF' : 'Cash';
};

const computeInvoiceTotalsFromTxData = (txDataList: any[]) => {
    const subtotal = txDataList.reduce((sum, t) => sum + (Number(t?.jumlah) || 0), 0);
    const isTaxable = txDataList.some(t => Boolean(t?.isTaxable) || (Number(t?.ppn) || 0) > 0);
    const totalPPN = isTaxable ? Math.round(subtotal * 0.011) : 0;
    const totalAmount = subtotal + totalPPN;
    return { subtotal, isTaxable, totalAmount };
};

const getUnionLinkedTransactionIds = async (invoiceId: string, declaredIds: string[] = []): Promise<string[]> => {
    const idSet = new Set<string>(declaredIds.filter(Boolean));
    try {
        const q = query(collection(db, 'transactions'), where('invoiceId', '==', invoiceId));
        const snap = await getDocs(q);
        snap.docs.forEach(d => idSet.add(d.id));
    } catch (err) {
        console.warn('Query fallback for linked transactions failed:', err);
    }
    return Array.from(idSet);
};

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
    paidAt: data.paidAt?.toDate(),
    paidTime: data.paidTime,
    paidBy: data.paidBy,
    isTaxable: data.isTaxable,
    collectionFeedback: data.collectionFeedback ? {
        ...data.collectionFeedback,
        updatedAt: data.collectionFeedback.updatedAt?.toDate(),
    } : undefined,
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
    const invoiceNumber = data.invoiceNumber?.trim() || await generateInvoiceNumber(userId);
    const now = Timestamp.now();
    const txIds = Array.from(new Set((data.transactionIds || []).filter(Boolean)));
    const newInvoiceRef = doc(collection(db, COLLECTION_NAME));

    await runTransaction(db, async (transaction) => {
        // Phase 1: All reads first
        const txSnaps: { ref: ReturnType<typeof doc>; snap: any }[] = [];
        for (const txId of txIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            txSnaps.push({ ref: txRef, snap: txSnap });
        }

        const loadedTxData = txSnaps
            .filter(item => item.snap.exists())
            .map(item => item.snap.data() as any);

        const computed = loadedTxData.length > 0
            ? computeInvoiceTotalsFromTxData(loadedTxData)
            : { subtotal: data.totalAmount, isTaxable: Boolean(data.isTaxable), totalAmount: data.totalAmount };

        const invoiceData: InvoiceDoc = {
            userId,
            invoiceNumber,
            ...(data.clientId ? { clientId: data.clientId } : {}),
            clientName: data.clientName,
            ...(data.clientAddress ? { clientAddress: data.clientAddress } : {}),
            transactionIds: txIds,
            totalAmount: data.totalAmount > 0 ? data.totalAmount : computed.totalAmount,
            issueDate: Timestamp.fromDate(new Date(data.issueDate)),
            dueDate: Timestamp.fromDate(new Date(data.dueDate)),
            status: 'Unpaid',
            isTaxable: data.isTaxable !== undefined ? data.isTaxable : computed.isTaxable,
            ...(data.notes ? { notes: data.notes } : {}),
            createdAt: now,
            updatedAt: now,
        };

        // Phase 2: All writes after
        transaction.set(newInvoiceRef, invoiceData);

        for (const { ref: txRef, snap: txSnap } of txSnaps) {
            if (txSnap.exists()) {
                transaction.update(txRef, {
                    invoiceId: newInvoiceRef.id,
                    invoiceNumber,
                    invoiceStatus: 'Unpaid',
                    updatedAt: now,
                });
            }
        }
    });

    return newInvoiceRef.id;
};

export const updateInvoiceStatus = async (
    id: string, 
    status: 'Paid' | 'Unpaid', 
    paymentDetails?: { date: Date, method: string, ref?: string, paidBy?: string }
) => {
    const invoiceRef = doc(db, COLLECTION_NAME, id);
    const preSnap = await getDoc(invoiceRef);
    const preDeclaredIds = preSnap.exists() ? ((preSnap.data() as InvoiceDoc).transactionIds || []) : [];
    const preUnionIds = await getUnionLinkedTransactionIds(id, preDeclaredIds);

    await runTransaction(db, async (transaction) => {
        // ===== PHASE 1: ALL READS FIRST =====
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists()) throw new Error("Invoice tidak ditemukan");

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const allTxIds = Array.from(new Set([...preUnionIds, ...(invoiceData.transactionIds || [])].filter(Boolean)));

        const txRefs: { ref: ReturnType<typeof doc>, snap: any }[] = [];
        for (const txId of allTxIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            txRefs.push({ ref: txRef, snap: txSnap });
        }

        // ===== PHASE 2: ALL WRITES AFTER =====
        const now = Timestamp.now();
        const dateObj = paymentDetails?.date || new Date();
        const formattedTime = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

        const updates: any = {
            status,
            updatedAt: now
        };

        if (status === 'Paid') {
            updates.paidAt = now;
            updates.paidTime = formattedTime;
            if (paymentDetails?.paidBy) {
                updates.paidBy = paymentDetails.paidBy;
            }
            if (paymentDetails) {
                updates.paymentDate = Timestamp.fromDate(paymentDetails.date);
                updates.paymentMethod = paymentDetails.method;
                if (paymentDetails.ref !== undefined) {
                    updates.paymentRef = paymentDetails.ref;
                }
            }
        } else if (status === 'Unpaid') {
            updates.paidAt = deleteField();
            updates.paidTime = deleteField();
            updates.paidBy = deleteField();
            updates.paymentDate = deleteField();
            updates.paymentMethod = deleteField();
            updates.paymentRef = deleteField();
        }

        // Write 1: Update invoice status
        transaction.update(invoiceRef, updates);

        // Write 2: Update all linked transactions
        const paidMethod = getPaidMethodCode(paymentDetails?.method);
        for (const { ref: txRef, snap: txSnap } of txRefs) {
            if (txSnap.exists()) {
                if (status === 'Paid') {
                    transaction.update(txRef, {
                        pelunasan: paidMethod,
                        invoiceId: id,
                        invoiceNumber: invoiceData.invoiceNumber,
                        invoiceStatus: 'Paid',
                        updatedAt: now
                    });
                } else if (status === 'Unpaid') {
                    transaction.update(txRef, {
                        pelunasan: 'Pending',
                        invoiceId: id,
                        invoiceNumber: invoiceData.invoiceNumber,
                        invoiceStatus: 'Unpaid',
                        updatedAt: now
                    });
                }
            } else {
                console.warn(`Transaction doc not found, skipping.`);
            }
        }
    });
};

export const deleteInvoice = async (id: string) => {
    const invoiceRef = doc(db, COLLECTION_NAME, id);
    const preSnap = await getDoc(invoiceRef);
    const preDeclaredIds = preSnap.exists() ? ((preSnap.data() as InvoiceDoc).transactionIds || []) : [];
    const preUnionIds = await getUnionLinkedTransactionIds(id, preDeclaredIds);

    await runTransaction(db, async (transaction) => {
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists()) return;

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const allTxIds = Array.from(new Set([...preUnionIds, ...(invoiceData.transactionIds || [])].filter(Boolean)));

        const txRefs: { ref: ReturnType<typeof doc>, snap: any }[] = [];
        for (const txId of allTxIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            txRefs.push({ ref: txRef, snap: txSnap });
        }

        const now = Timestamp.now();
        for (const { ref: txRef, snap: txSnap } of txRefs) {
            if (txSnap.exists()) {
                const txUpdates: any = {
                    invoiceId: deleteField(),
                    invoiceNumber: deleteField(),
                    invoiceStatus: deleteField(),
                    updatedAt: now,
                };
                if (invoiceData.status === 'Paid') {
                    txUpdates.pelunasan = 'Pending';
                }
                transaction.update(txRef, txUpdates);
            }
        }

        transaction.delete(invoiceRef);
    });
};

export const updateInvoiceNumber = async (id: string, newInvoiceNumber: string): Promise<void> => {
    const cleanNumber = newInvoiceNumber.trim();
    const invoiceRef = doc(db, COLLECTION_NAME, id);
    const preSnap = await getDoc(invoiceRef);
    const preDeclaredIds = preSnap.exists() ? ((preSnap.data() as InvoiceDoc).transactionIds || []) : [];
    const preUnionIds = await getUnionLinkedTransactionIds(id, preDeclaredIds);

    await runTransaction(db, async (transaction) => {
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists()) throw new Error("Invoice tidak ditemukan");

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const allTxIds = Array.from(new Set([...preUnionIds, ...(invoiceData.transactionIds || [])].filter(Boolean)));

        const txRefs: { ref: ReturnType<typeof doc>, snap: any }[] = [];
        for (const txId of allTxIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            txRefs.push({ ref: txRef, snap: txSnap });
        }

        const now = Timestamp.now();
        transaction.update(invoiceRef, {
            invoiceNumber: cleanNumber,
            updatedAt: now,
        });

        for (const { ref: txRef, snap: txSnap } of txRefs) {
            if (txSnap.exists()) {
                transaction.update(txRef, {
                    invoiceId: id,
                    invoiceNumber: cleanNumber,
                    updatedAt: now,
                });
            }
        }
    });
};

export const linkTransactionsToInvoice = async (invoiceId: string, transactionIdsToAdd: string[]): Promise<void> => {
    const idsToAdd = Array.from(new Set(transactionIdsToAdd.filter(Boolean)));
    if (idsToAdd.length === 0) return;

    const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);

    await runTransaction(db, async (transaction) => {
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists()) throw new Error("Invoice tidak ditemukan");

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const mergedIds = Array.from(new Set([...(invoiceData.transactionIds || []), ...idsToAdd]));

        const txRefs: { id: string; ref: ReturnType<typeof doc>; snap: any }[] = [];
        for (const txId of mergedIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            txRefs.push({ id: txId, ref: txRef, snap: txSnap });
        }

        const existingTxData = txRefs
            .filter(item => item.snap.exists())
            .map(item => item.snap.data() as any);

        const computed = computeInvoiceTotalsFromTxData(existingTxData);
        const now = Timestamp.now();

        transaction.update(invoiceRef, {
            transactionIds: mergedIds,
            totalAmount: existingTxData.length > 0 ? computed.totalAmount : invoiceData.totalAmount,
            isTaxable: existingTxData.length > 0 ? computed.isTaxable : Boolean(invoiceData.isTaxable),
            updatedAt: now,
        });

        const paidMethod = getPaidMethodCode(invoiceData.paymentMethod);
        for (const { ref: txRef, snap: txSnap } of txRefs) {
            if (txSnap.exists()) {
                const txUpdates: any = {
                    invoiceId,
                    invoiceNumber: invoiceData.invoiceNumber,
                    invoiceStatus: invoiceData.status,
                    updatedAt: now,
                };
                if (invoiceData.status === 'Paid') {
                    txUpdates.pelunasan = paidMethod;
                }
                transaction.update(txRef, txUpdates);
            }
        }
    });
};

export const unlinkTransactionFromInvoice = async (invoiceId: string, transactionId: string): Promise<void> => {
    const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);

    await runTransaction(db, async (transaction) => {
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists()) throw new Error("Invoice tidak ditemukan");

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const remainingIds = (invoiceData.transactionIds || []).filter(tid => tid !== transactionId);

        const remainingRefs: { ref: ReturnType<typeof doc>; snap: any }[] = [];
        for (const txId of remainingIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            remainingRefs.push({ ref: txRef, snap: txSnap });
        }

        const targetTxRef = doc(db, 'transactions', transactionId);
        const targetTxSnap = await transaction.get(targetTxRef);

        const existingTxData = remainingRefs
            .filter(item => item.snap.exists())
            .map(item => item.snap.data() as any);

        const computed = computeInvoiceTotalsFromTxData(existingTxData);
        const now = Timestamp.now();

        transaction.update(invoiceRef, {
            transactionIds: remainingIds,
            totalAmount: computed.totalAmount,
            isTaxable: computed.isTaxable,
            updatedAt: now,
        });

        if (targetTxSnap.exists()) {
            const txUpdates: any = {
                invoiceId: deleteField(),
                invoiceNumber: deleteField(),
                invoiceStatus: deleteField(),
                updatedAt: now,
            };
            if (invoiceData.status === 'Paid') {
                txUpdates.pelunasan = 'Pending';
            }
            transaction.update(targetTxRef, txUpdates);
        }
    });
};

export const updateInvoiceTransactions = async (invoiceId: string, newTransactionIds: string[]): Promise<void> => {
    const targetIds = Array.from(new Set(newTransactionIds.filter(Boolean)));
    const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);
    const preSnap = await getDoc(invoiceRef);
    const preDeclaredIds = preSnap.exists() ? ((preSnap.data() as InvoiceDoc).transactionIds || []) : [];
    const preUnionIds = await getUnionLinkedTransactionIds(invoiceId, preDeclaredIds);

    await runTransaction(db, async (transaction) => {
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists()) throw new Error("Invoice tidak ditemukan");

        const invoiceData = invoiceDoc.data() as InvoiceDoc;
        const allPreviouslyLinked = Array.from(new Set([...preUnionIds, ...(invoiceData.transactionIds || [])].filter(Boolean)));
        const removedIds = allPreviouslyLinked.filter(id => !targetIds.includes(id));

        const targetRefs: { id: string; ref: ReturnType<typeof doc>; snap: any }[] = [];
        for (const txId of targetIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            targetRefs.push({ id: txId, ref: txRef, snap: txSnap });
        }

        const removedRefs: { id: string; ref: ReturnType<typeof doc>; snap: any }[] = [];
        for (const txId of removedIds) {
            const txRef = doc(db, 'transactions', txId);
            const txSnap = await transaction.get(txRef);
            removedRefs.push({ id: txId, ref: txRef, snap: txSnap });
        }

        const existingTargetData = targetRefs
            .filter(item => item.snap.exists())
            .map(item => item.snap.data() as any);

        const computed = computeInvoiceTotalsFromTxData(existingTargetData);
        const now = Timestamp.now();

        transaction.update(invoiceRef, {
            transactionIds: targetIds,
            totalAmount: computed.totalAmount,
            isTaxable: computed.isTaxable,
            updatedAt: now,
        });

        const paidMethod = getPaidMethodCode(invoiceData.paymentMethod);

        for (const { ref: txRef, snap: txSnap } of targetRefs) {
            if (txSnap.exists()) {
                const txUpdates: any = {
                    invoiceId,
                    invoiceNumber: invoiceData.invoiceNumber,
                    invoiceStatus: invoiceData.status,
                    updatedAt: now,
                };
                if (invoiceData.status === 'Paid') {
                    txUpdates.pelunasan = paidMethod;
                }
                transaction.update(txRef, txUpdates);
            }
        }

        for (const { ref: txRef, snap: txSnap } of removedRefs) {
            if (txSnap.exists()) {
                const txUpdates: any = {
                    invoiceId: deleteField(),
                    invoiceNumber: deleteField(),
                    invoiceStatus: deleteField(),
                    updatedAt: now,
                };
                if (invoiceData.status === 'Paid') {
                    txUpdates.pelunasan = 'Pending';
                }
                transaction.update(txRef, txUpdates);
            }
        }
    });
};

export const updateCollectionFeedback = async (
    invoiceId: string,
    feedback: {
        status: string;
        notes: string;
        promisedDate?: string;
        officer: string;
    }
): Promise<void> => {
    const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);

    const cleanFeedback: Record<string, any> = {
        status: feedback.status,
        notes: feedback.notes || '',
        officer: feedback.officer || 'Petugas',
        updatedAt: Timestamp.now(),
    };

    if (feedback.promisedDate && feedback.promisedDate.trim() !== '') {
        cleanFeedback.promisedDate = feedback.promisedDate.trim();
    }

    await updateDoc(invoiceRef, {
        collectionFeedback: cleanFeedback,
        updatedAt: Timestamp.now(),
    });
};

export const syncInvoiceWithTransactions = async (invoiceId: string): Promise<Invoice | null> => {
    try {
        const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        if (!invoiceSnap.exists()) return null;

        const invData = invoiceSnap.data() as InvoiceDoc;
        if (!invData.transactionIds || invData.transactionIds.length === 0) {
            return docToInvoice(invoiceSnap.id, invData);
        }

        const txDocs = await Promise.all(
            invData.transactionIds.map(tid => getDoc(doc(db, 'transactions', tid)))
        );
        const loadedTx = txDocs
            .filter(snap => snap.exists())
            .map(snap => snap.data() as any);

        if (loadedTx.length === 0) {
            return docToInvoice(invoiceSnap.id, invData);
        }

        const primaryTx = loadedTx[0];
        const liveClientName = primaryTx.pengirimName || invData.clientName;
        const liveClientAddress = primaryTx.pengirimAddress || invData.clientAddress;

        const { isTaxable, totalAmount: liveTotalAmount } = computeInvoiceTotalsFromTxData(loadedTx);

        const needsUpdate = invData.clientName !== liveClientName ||
            invData.totalAmount !== liveTotalAmount ||
            invData.clientAddress !== liveClientAddress ||
            Boolean(invData.isTaxable) !== isTaxable;

        if (needsUpdate) {
            await updateDoc(invoiceRef, {
                clientName: liveClientName,
                ...(liveClientAddress ? { clientAddress: liveClientAddress } : {}),
                totalAmount: liveTotalAmount,
                isTaxable,
                updatedAt: Timestamp.now(),
            });
            invData.clientName = liveClientName;
            invData.clientAddress = liveClientAddress;
            invData.totalAmount = liveTotalAmount;
            invData.isTaxable = isTaxable;
        }

        return docToInvoice(invoiceSnap.id, invData);
    } catch (error) {
        console.error('Error syncing invoice with transactions:', error);
        return null;
    }
};

export const syncInvoicesContainingTransaction = async (transactionId: string): Promise<void> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('transactionIds', 'array-contains', transactionId)
        );
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
            await syncInvoiceWithTransactions(docSnap.id);
        }
    } catch (error) {
        console.error('Error syncing invoices containing transaction:', error);
    }
};

