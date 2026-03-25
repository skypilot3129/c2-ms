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

// KTP Identity (data sesuai KTP)
export interface KTPIdentity {
    nik: string;
    namaLengkap: string;
    tempatLahir: string;
    tanggalLahir: string; // YYYY-MM-DD
    jenisKelamin: 'Laki-laki' | 'Perempuan';
    alamatKTP: string;
    rt: string;
    rw: string;
    kelurahan: string;
    kecamatan: string;
    kabupatenKota: string;
    provinsi: string;
    agama: string;
    statusPerkawinan: 'Belum Kawin' | 'Kawin' | 'Cerai Hidup' | 'Cerai Mati';
    pekerjaan: string;
    kewarganegaraan: string;
}

// Salary Configuration
export interface SalaryConfig {
    baseSalary: number;        // Gaji Pokok (untuk admin/pengurus)
    dailyRate: number;         // Upah harian helper (Rp 50.000)
    allowance: number;         // Uang Makan/Harian
    lateDeduction1: number;    // Potongan telat 1-2 jam (Rp 10.000)
    lateDeduction2: number;    // Potongan telat >2 jam (Rp 20.000)
    truckOperationalBudget: number; // Budget per truck (Rp 700.000)
    stackingBonus: number;     // Bonus susun barang dari budget truck (Rp 50.000)
    tripCommission: number;    // Per trip or percentage
    commissionType: 'fixed' | 'percentage';
}

// Default salary config for helper
export const DEFAULT_HELPER_SALARY: SalaryConfig = {
    baseSalary: 0,
    dailyRate: 50000,
    allowance: 0,
    lateDeduction1: 10000,
    lateDeduction2: 20000,
    truckOperationalBudget: 700000,
    stackingBonus: 50000,
    tripCommission: 0,
    commissionType: 'fixed',
};

// Default salary config for admin/pengurus
export const DEFAULT_STAFF_SALARY: SalaryConfig = {
    baseSalary: 0,
    dailyRate: 0,
    allowance: 0,
    lateDeduction1: 0,
    lateDeduction2: 0,
    truckOperationalBudget: 0,
    stackingBonus: 0,
    tripCommission: 0,
    commissionType: 'fixed',
};

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
    ktpIdentity?: KTPIdentity; // Data identitas KTP
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

// Gender labels
export const GENDER_LABELS = {
    'Laki-laki': 'Laki-laki',
    'Perempuan': 'Perempuan',
};

// Marital status labels
export const MARITAL_STATUS_LABELS = {
    'Belum Kawin': 'Belum Kawin',
    'Kawin': 'Kawin',
    'Cerai Hidup': 'Cerai Hidup',
    'Cerai Mati': 'Cerai Mati',
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
