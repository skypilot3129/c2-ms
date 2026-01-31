export type MessageSource = 'whatsapp' | 'direct' | 'call' | 'email';
export type MessageStatus = 'unread' | 'read' | 'responded' | 'archived';

export interface CustomerMessage {
    id: string;
    customerName: string;
    customerPhone: string;
    message: string;
    source: MessageSource;
    status: MessageStatus;
    receivedAt: Date;
    respondedAt?: Date;
    responseNotes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CustomerMessageFormData {
    customerName: string;
    customerPhone: string;
    message: string;
    source: MessageSource;
    receivedAt: Date;
}

export interface CustomerMessageDoc {
    customerName: string;
    customerPhone: string;
    message: string;
    source: MessageSource;
    status: MessageStatus;
    receivedAt: any; // Firestore Timestamp
    respondedAt?: any; // Firestore Timestamp
    responseNotes?: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export const MESSAGE_SOURCE_LABELS: Record<MessageSource, string> = {
    'whatsapp': 'WhatsApp',
    'direct': 'Direct',
    'call': 'Telepon',
    'email': 'Email'
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
    'unread': 'Belum Dibaca',
    'read': 'Sudah Dibaca',
    'responded': 'Sudah Direspon',
    'archived': 'Arsip'
};

export const MESSAGE_STATUS_COLORS: Record<MessageStatus, { bg: string; text: string }> = {
    'unread': { bg: 'bg-red-100', text: 'text-red-700' },
    'read': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'responded': { bg: 'bg-green-100', text: 'text-green-700' },
    'archived': { bg: 'bg-gray-100', text: 'text-gray-600' }
};
