export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TodoStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export interface Todo {
    id: string;
    title: string;
    description: string;
    priority: TodoPriority;
    status: TodoStatus;
    dueDate: Date;
    completedAt?: Date;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TodoFormData {
    title: string;
    description: string;
    priority: TodoPriority;
    dueDate: Date;
}

export interface TodoDoc {
    title: string;
    description: string;
    priority: TodoPriority;
    status: TodoStatus;
    dueDate: any; // Firestore Timestamp
    completedAt?: any; // Firestore Timestamp
    userId: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
    'low': 'Rendah',
    'medium': 'Sedang',
    'high': 'Tinggi',
    'urgent': 'Mendesak'
};

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
    'pending': 'Belum Mulai',
    'in-progress': 'Sedang Dikerjakan',
    'completed': 'Selesai',
    'cancelled': 'Dibatalkan'
};

export const TODO_PRIORITY_COLORS: Record<TodoPriority, { bg: string; text: string; border: string }> = {
    'low': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    'medium': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    'high': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    'urgent': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
};

export const TODO_STATUS_COLORS: Record<TodoStatus, { bg: string; text: string }> = {
    'pending': { bg: 'bg-gray-100', text: 'text-gray-700' },
    'in-progress': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'completed': { bg: 'bg-green-100', text: 'text-green-700' },
    'cancelled': { bg: 'bg-red-100', text: 'text-red-700' }
};
