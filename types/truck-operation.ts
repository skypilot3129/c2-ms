import { Timestamp } from 'firebase/firestore';

export interface MonthlySchedule {
    id?: string;
    month: string; // Format: YYYY-MM
    loaderIds: string[]; // Employees designated as generic loaders for this month
    stackerPoolIds: string[]; // The specific ~4 employees who are allowed to be stackers
    updatedAt?: Date | Timestamp;
    updatedBy?: string;
}

export type OperationStatus = 'scheduled' | 'loading' | 'completed' | 'cancelled';

export interface TruckOperation {
    id?: string;
    date: string; // Format: YYYY-MM-DD
    truckNumber: string;
    status: OperationStatus;
    
    // Assigned roles for this specific truck
    stackerIds: string[]; // Max 2 stackers
    loaderIds: string[]; // Loaders assigned to this truck
    escortId?: string | null;
    
    startTime: Date | null;
    endTime: Date | null;
    notes?: string;
    
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
