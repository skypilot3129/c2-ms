import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    Timestamp,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Client, ClientFormData, ClientDoc } from '@/types/client';

const COLLECTION_NAME = 'clients';

// Convert Firestore document to Client type
export const docToClient = (id: string, data: ClientDoc): Client => {
    return {
        id,
        name: data.name || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        notes: data.notes || '',
        userId: data.userId || '',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
    };
};

// Get all clients with real-time updates  
export const subscribeToClients = (
    callback: (clients: Client[]) => void,
    userId?: string
) => {
    const clientsRef = collection(db, COLLECTION_NAME);

    // Filter by userId if provided (removed orderBy to avoid index requirement)
    const q = userId
        ? query(clientsRef, where('userId', '==', userId))
        : query(clientsRef);

    return onSnapshot(q, (snapshot) => {
        const clients = snapshot.docs.map((doc) =>
            docToClient(doc.id, doc.data() as ClientDoc)
        );
        // Sort on client side to avoid Firestore index
        const sortedClients = clients.sort((a, b) => a.name.localeCompare(b.name));
        callback(sortedClients);
    });
};

// Get single client by ID
export const getClientById = async (id: string): Promise<Client | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docToClient(docSnap.id, docSnap.data() as ClientDoc);
    }
    return null;
};

// Add new client
export const addClient = async (
    data: ClientFormData,
    userId: string
): Promise<string> => {
    const now = Timestamp.now();
    const clientData = {
        ...data,
        userId,
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), clientData);
    return docRef.id;
};

// Update existing client
export const updateClient = async (
    id: string,
    data: Partial<ClientFormData>
): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
    });
};

// Delete client
export const deleteClient = async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
};

// Search clients by name, phone, or city
export const searchClients = (
    clients: Client[],
    searchTerm: string
): Client[] => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return clients;

    return clients.filter(
        (client) =>
            client.name.toLowerCase().includes(term) ||
            client.phone.toLowerCase().includes(term) ||
            client.city.toLowerCase().includes(term) ||
            client.address.toLowerCase().includes(term)
    );
};
