export interface Client {
    id: string;
    name: string;
    phone: string;
    address: string;
    city: string;
    notes: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ClientFormData {
    name: string;
    phone: string;
    address: string;
    city: string;
    notes: string;
}

// Firestore document data (without id, before conversion)
export interface ClientDoc {
    name: string;
    phone: string;
    address: string;
    city: string;
    notes: string;
    userId: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}
