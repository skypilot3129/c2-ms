import { Timestamp } from 'firebase/firestore';

export type LoadingStatus = 'draft' | 'loading' | 'paused' | 'completed' | 'cancelled';
export type CargoZone = 'front' | 'middle' | 'rear';
export type CargoLayer = 'dasaran' | 'tengah' | 'atasan' | 'bottom' | 'middle' | 'top';
export type CargoSide = 'left' | 'center' | 'right';

export type DepartureReason = 
    | 'Izin Resmi (Izin Atasan)' 
    | 'Ke Toilet / Istirahat Makan' 
    | 'Sengaja Kabur / Lari' 
    | 'Sakit / Hal Darurat';

export interface EmployeeDepartureLog {
    id: string;
    employeeId: string;
    employeeName: string;
    role: string;
    departureTime: string; // ISO string
    returnTime?: string | null; // ISO string
    durationMinutes: number;
    reason: DepartureReason;
    penaltyPercentage: number; // e.g. 0 to 100% deduction
    notes?: string;
    loggedBy: string;
}

export interface AssignedEmployee {
    employeeId: string;
    employeeName: string;
    role: 'Penyusun' | 'Loader/Helper' | 'Pengawal';
    status: 'active' | 'on_leave' | 'deserted' | 'returned';
    totalActiveMinutes: number;
    uangMuatShare: number;
    customUangMuatShare?: number | null; // Manual override by Admin
    isManualShare?: boolean; // Flag if manually edited by Admin
    notes?: string;
}

export interface CargoStackItem {
    id: string;
    sttNumber: string;
    clientName: string;
    destination: string;
    koliCount: number;
    weightKg: number;
    cbm: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    zone: CargoZone;
    layer: CargoLayer;
    heightLevelMeters?: number; // 0.0 to 3.3m
    side: CargoSide;
    color?: string;
    notes?: string;
}

export interface LoadingSession {
    id: string;
    sessionId: string; // e.g. "MUAT-20260725-001"
    date: string; // YYYY-MM-DD
    fleetId: string;
    fleetName: string;
    plateNumber: string;
    fleetType: string;
    status: LoadingStatus;
    
    assignedEmployees: AssignedEmployee[];
    departureLogs: EmployeeDepartureLog[];
    cargoItems: CargoStackItem[];
    
    startTime?: string | null;
    endTime?: string | null;
    totalDurationMinutes: number;
    
    totalKoli: number;
    totalWeightKg: number;
    totalCbm: number;
    
    totalUangMuat: number; // Budget allocated for loading money
    notes?: string;
    
    createdBy: string;
    createdAt: Date | Timestamp | string;
    updatedAt: Date | Timestamp | string;
}

export interface LoadingSessionDoc extends Omit<LoadingSession, 'id' | 'createdAt' | 'updatedAt'> {
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
