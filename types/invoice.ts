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

    // Status
    status: InvoiceStatus;
    paymentDate?: Date;
    paymentMethod?: string;
    paymentRef?: string; // Bukti Transfer ref
    notes?: string;

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
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
