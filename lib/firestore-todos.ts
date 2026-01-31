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
    Todo,
    TodoFormData,
    TodoDoc,
    TodoStatus,
    TodoPriority
} from '@/types/todo';

const COLLECTION_NAME = 'todos';

// Get all todos for user
export const getTodosByUser = async (userId: string): Promise<Todo[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId),
            orderBy('dueDate', 'asc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data() as TodoDoc;
            return {
                id: doc.id,
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: data.status,
                dueDate: data.dueDate?.toDate() || new Date(),
                completedAt: data.completedAt?.toDate(),
                userId: data.userId,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error('Error getting todos:', error);
        throw error;
    }
};

// Get todos by status
export const getTodosByStatus = async (userId: string, status: TodoStatus): Promise<Todo[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId),
            where('status', '==', status),
            orderBy('dueDate', 'asc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data() as TodoDoc;
            return {
                id: doc.id,
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: data.status,
                dueDate: data.dueDate?.toDate() || new Date(),
                completedAt: data.completedAt?.toDate(),
                userId: data.userId,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error('Error getting todos by status:', error);
        throw error;
    }
};

// Get todos for specific date range
export const getTodosForDateRange = async (
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<Todo[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId),
            where('dueDate', '>=', Timestamp.fromDate(startDate)),
            where('dueDate', '<=', Timestamp.fromDate(endDate)),
            orderBy('dueDate', 'asc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data() as TodoDoc;
            return {
                id: doc.id,
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: data.status,
                dueDate: data.dueDate?.toDate() || new Date(),
                completedAt: data.completedAt?.toDate(),
                userId: data.userId,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error('Error getting todos for date range:', error);
        throw error;
    }
};

// Get todos for calendar (grouped by date)
export const getTodosForCalendar = async (userId: string, month: number, year: number) => {
    try {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const todos = await getTodosForDateRange(userId, startDate, endDate);

        // Group by date
        const todosByDate: Record<string, Todo[]> = {};
        todos.forEach(todo => {
            const dateKey = todo.dueDate.toISOString().split('T')[0];
            if (!todosByDate[dateKey]) {
                todosByDate[dateKey] = [];
            }
            todosByDate[dateKey].push(todo);
        });

        return todosByDate;
    } catch (error) {
        console.error('Error getting todos for calendar:', error);
        throw error;
    }
};

// Add new todo
export const addTodo = async (userId: string, data: TodoFormData): Promise<string> => {
    try {
        const now = Timestamp.now();
        const docData: Omit<TodoDoc, 'createdAt' | 'updatedAt'> & {
            createdAt: Timestamp;
            updatedAt: Timestamp;
        } = {
            title: data.title,
            description: data.description,
            priority: data.priority,
            status: 'pending',
            dueDate: Timestamp.fromDate(data.dueDate),
            userId,
            createdAt: now,
            updatedAt: now
        };

        const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
        return docRef.id;
    } catch (error) {
        console.error('Error adding todo:', error);
        throw error;
    }
};

// Update todo
export const updateTodo = async (id: string, data: Partial<TodoFormData>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const updateData: any = {
            ...data,
            updatedAt: Timestamp.now()
        };

        if (data.dueDate) {
            updateData.dueDate = Timestamp.fromDate(data.dueDate);
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error('Error updating todo:', error);
        throw error;
    }
};

// Update todo status
export const updateTodoStatus = async (id: string, status: TodoStatus): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const updateData: any = {
            status,
            updatedAt: Timestamp.now()
        };

        if (status === 'completed') {
            updateData.completedAt = Timestamp.now();
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error('Error updating todo status:', error);
        throw error;
    }
};

// Delete todo
export const deleteTodo = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting todo:', error);
        throw error;
    }
};

// Get todo statistics
export const getTodoStats = async (userId: string) => {
    try {
        const todos = await getTodosByUser(userId);

        return {
            total: todos.length,
            pending: todos.filter(t => t.status === 'pending').length,
            inProgress: todos.filter(t => t.status === 'in-progress').length,
            completed: todos.filter(t => t.status === 'completed').length,
            cancelled: todos.filter(t => t.status === 'cancelled').length,
            overdue: todos.filter(t =>
                t.status !== 'completed' &&
                t.status !== 'cancelled' &&
                t.dueDate < new Date()
            ).length
        };
    } catch (error) {
        console.error('Error getting todo stats:', error);
        throw error;
    }
};
