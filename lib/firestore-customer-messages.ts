import { db } from './firebase';
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import type {
    CustomerMessage,
    CustomerMessageFormData,
    CustomerMessageDoc,
    MessageStatus
} from '@/types/customer-message';

const COLLECTION_NAME = 'customer_messages';

// Get all customer messages
export const getAllCustomerMessages = async (): Promise<CustomerMessage[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('receivedAt', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data() as CustomerMessageDoc;
            return {
                id: doc.id,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                message: data.message,
                source: data.source,
                status: data.status,
                receivedAt: data.receivedAt?.toDate() || new Date(),
                respondedAt: data.respondedAt?.toDate(),
                responseNotes: data.responseNotes,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error('Error getting customer messages:', error);
        throw error;
    }
};

// Get messages by status
export const getCustomerMessagesByStatus = async (status: MessageStatus): Promise<CustomerMessage[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('status', '==', status),
            orderBy('receivedAt', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data() as CustomerMessageDoc;
            return {
                id: doc.id,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                message: data.message,
                source: data.source,
                status: data.status,
                receivedAt: data.receivedAt?.toDate() || new Date(),
                respondedAt: data.respondedAt?.toDate(),
                responseNotes: data.responseNotes,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error('Error getting customer messages by status:', error);
        throw error;
    }
};

// Get message statistics
export const getMessageStats = async () => {
    try {
        const messages = await getAllCustomerMessages();

        return {
            total: messages.length,
            unread: messages.filter(m => m.status === 'unread').length,
            read: messages.filter(m => m.status === 'read').length,
            responded: messages.filter(m => m.status === 'responded').length,
            archived: messages.filter(m => m.status === 'archived').length
        };
    } catch (error) {
        console.error('Error getting message stats:', error);
        throw error;
    }
};

// Add new customer message
export const addCustomerMessage = async (data: CustomerMessageFormData): Promise<string> => {
    try {
        const now = Timestamp.now();
        const docData: Omit<CustomerMessageDoc, 'createdAt' | 'updatedAt'> & {
            createdAt: Timestamp;
            updatedAt: Timestamp;
        } = {
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            message: data.message,
            source: data.source,
            status: 'unread',
            receivedAt: Timestamp.fromDate(data.receivedAt),
            createdAt: now,
            updatedAt: now
        };

        const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
        return docRef.id;
    } catch (error) {
        console.error('Error adding customer message:', error);
        throw error;
    }
};

// Update message status
export const updateMessageStatus = async (
    id: string,
    status: MessageStatus,
    responseNotes?: string
): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const updateData: any = {
            status,
            updatedAt: Timestamp.now()
        };

        if (status === 'responded') {
            updateData.respondedAt = Timestamp.now();
            if (responseNotes) {
                updateData.responseNotes = responseNotes;
            }
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error('Error updating message status:', error);
        throw error;
    }
};

// Update customer message
export const updateCustomerMessage = async (id: string, data: Partial<CustomerMessageFormData>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const updateData: any = {
            ...data,
            updatedAt: Timestamp.now()
        };

        if (data.receivedAt) {
            updateData.receivedAt = Timestamp.fromDate(data.receivedAt);
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error('Error updating customer message:', error);
        throw error;
    }
};

// Delete customer message
export const deleteCustomerMessage = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting customer message:', error);
        throw error;
    }
};
