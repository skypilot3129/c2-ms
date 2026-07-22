import { Timestamp } from 'firebase/firestore';

export type InvoiceStatus = 'Unpaid' | 'Paid' | 'Cancelled';

export interface Invoice {
    id: string;
    userId: string;
    invoiceNumber: string; // INV/2023/10/001

    // Client Info (Snapshot at creation)
    clientId?: string;
    clientName: string;
    clientAddress?: string;

    // Content
    transactionIds: string[]; // List of STT IDs included
    totalAmount: number;

    // Dates
    issueDate: Date;
    dueDate: Date;

    // Status & Payment details
    status: InvoiceStatus;
    paymentDate?: Date;
    paymentMethod?: string;
    paymentRef?: string; // Bukti Transfer ref
    notes?: string;

    // Detailed Timestamp when marked as Paid / Lunas
    paidAt?: Date;
    paidTime?: string; // e.g. "10:11:51 WIB"
    paidBy?: string;   // Operator email / name who marked as Paid

    isTaxable?: boolean;
    collectionFeedback?: {
        status: string;
        notes: string;
        promisedDate?: string;
        officer: string;
        updatedAt?: Date;
    };

    createdAt: Date;
    updatedAt: Date;
}

export interface InvoiceFormData {
    clientName: string;
    clientId?: string;
    clientAddress?: string;
    transactionIds: string[];
    totalAmount: number;
    issueDate: string;
    dueDate: string;
    notes?: string;
}

export interface InvoiceDoc {
    userId: string;
    invoiceNumber: string;
    clientId?: string;
    clientName: string;
    clientAddress?: string;
    transactionIds: string[];
    totalAmount: number;
    issueDate: Timestamp;
    dueDate: Timestamp;
    status: InvoiceStatus;
    paymentDate?: Timestamp;
    paymentMethod?: string;
    paymentRef?: string;
    notes?: string;
    paidAt?: Timestamp;
    paidTime?: string;
    paidBy?: string;
    isTaxable?: boolean;
    collectionFeedback?: {
        status: string;
        notes: string;
        promisedDate?: string;
        officer: string;
        updatedAt?: Timestamp;
    };
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
