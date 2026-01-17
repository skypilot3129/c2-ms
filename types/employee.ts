import { Timestamp } from 'firebase/firestore';
import type { UserRole } from './roles';

// Employee Roles (using UserRole from roles.ts)
export type EmployeeRole = UserRole;
export type EmployeeStatus = 'active' | 'inactive' | 'suspended';
export type AccountStatus = 'active' | 'suspended' | 'pending';

// Document Types (for compliance tracking)
export type DocumentType = 'KTP' | 'SIM A' | 'SIM B1' | 'SIM B2' | 'KK' | 'NPWP' | 'STNK';

// Employee Document (with expiry tracking)
export interface EmployeeDocument {
    type: DocumentType;
    number: string;
    expiryDate: string | null; // YYYY-MM-DD format, null if no expiry
    photoUrl?: string; // Optional file upload support
    notes?: string;
}

// Contact Information
export interface EmployeeContact {
    phone: string;
    email?: string;
    address: string;
    city?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
}

// Salary Configuration
export interface SalaryConfig {
    baseSalary: number; // Gaji Pokok
    allowance: number; // Uang Makan/Harian
    tripCommission: number; // Per trip or percentage
    commissionType: 'fixed' | 'percentage'; // How to calculate trip pay
}

// Main Employee Interface (for form data)
export interface EmployeeFormData {
    employeeId: string; // Custom ID like EMP-001
    fullName: string;
    role: EmployeeRole;
    status: EmployeeStatus;
    joinDate: Date;
    contact: EmployeeContact;
    documents: EmployeeDocument[];
    salaryConfig: SalaryConfig;
    photoUrl?: string; // Profile photo
    jobdesk?: string; // Job description/responsibilities
    notes?: string;
    // Auth integration fields
    authUid?: string | null; // Firebase Auth UID
    email: string; // Generated from name
    accountStatus: AccountStatus; // Auth account status
}

// Firestore Document (what's actually stored)
export interface EmployeeDoc extends Omit<EmployeeFormData, 'joinDate'> {
    joinDate: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Client-side Employee (after fetching from Firestore)
export interface Employee extends Omit<EmployeeFormData, 'joinDate'> {
    id: string; // Firestore doc ID
    joinDate: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Role Labels (import from roles.ts)
import { ROLE_LABELS } from './roles';
export const EMPLOYEE_ROLE_LABELS = ROLE_LABELS;

// Status Labels
export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
    active: 'Aktif',
    inactive: 'Tidak Aktif',
    suspended: 'Suspend'
};

// Document Type Labels
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    'KTP': 'KTP',
    'SIM A': 'SIM A',
    'SIM B1': 'SIM B1',
    'SIM B2': 'SIM B2',
    'KK': 'Kartu Keluarga',
    'NPWP': 'NPWP',
    'STNK': 'STNK'
};

// Helper function to check if document is expiring soon
export const isDocumentExpiringSoon = (doc: EmployeeDocument, daysThreshold: number = 30): boolean => {
    if (!doc.expiryDate) return false;
    const expiry = new Date(doc.expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= daysThreshold && daysUntilExpiry >= 0;
};

// Helper function to check if document is expired
export const isDocumentExpired = (doc: EmployeeDocument): boolean => {
    if (!doc.expiryDate) return false;
    const expiry = new Date(doc.expiryDate);
    const today = new Date();
    return expiry < today;
};
