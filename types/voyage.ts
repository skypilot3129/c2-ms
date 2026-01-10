/**
 * Voyage (Pemberangkatan) Types
 * For tracking shipments/voyages and their operational costs
 */

export type VoyageStatus = 'planned' | 'in-progress' | 'completed' | 'cancelled';

export type ExpenseCategory =
    | 'tiket'
    | 'operasional_surabaya'
    | 'operasional_makassar'
    | 'transit'
    | 'sewa_mobil'
    | 'gaji_sopir'
    | 'gaji_karyawan'
    | 'listrik_air_internet'
    | 'sewa_kantor'
    | 'maintenance'
    | 'lainnya';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    tiket: 'Tiket',
    operasional_surabaya: 'Operasional Surabaya',
    operasional_makassar: 'Operasional Makassar',
    transit: 'Transit',
    sewa_mobil: 'Sewa Mobil',
    gaji_sopir: 'Gaji Sopir',
    gaji_karyawan: 'Gaji Karyawan',
    listrik_air_internet: 'Listrik/Air/Internet',
    sewa_kantor: 'Sewa Kantor',
    maintenance: 'Maintenance Armada',
    lainnya: 'Lainnya',
};

// Voyage interface
export interface Voyage {
    id: string;
    userId: string;
    voyageNumber: string;
    departureDate: Date;
    arrivalDate?: Date;
    route: string;
    shipName?: string;
    vehicleNumbers: string[];  // Multiple vehicles
    vehicleNumber?: string;  // Deprecated, for backward compatibility
    status: VoyageStatus;
    transactionIds: string[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Firestore document structure
export interface VoyageDoc {
    userId: string;
    voyageNumber: string;
    departureDate: any;
    arrivalDate?: any;
    route: string;
    shipName?: string;
    vehicleNumbers?: string[];  // Multiple vehicles
    vehicleNumber?: string;  // Deprecated, for backward compatibility
    status: VoyageStatus;
    transactionIds: string[];
    notes?: string;
    createdAt: any;
    updatedAt: any;
}

// Form data for creating/editing voyage
export interface VoyageFormData {
    departureDate: string;
    arrivalDate?: string;
    route: string;
    shipName?: string;
    vehicleNumbers?: string[];  // Multiple vehicles
    vehicleNumber?: string;  // Deprecated, for backward compatibility
    status: VoyageStatus;
    notes?: string;
}

export type ExpenseType = 'voyage' | 'general';

// Expense interface
export interface Expense {
    id: string;
    userId: string;
    type: ExpenseType; // New field
    voyageId?: string; // Optional now
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: Date;
    receiptUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Firestore document structure for Expense
export interface ExpenseDoc {
    userId: string;
    type?: ExpenseType; // Optional in DB for backward compat (default to voyage)
    voyageId?: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: any;
    receiptUrl?: string;
    createdAt: any;
    updatedAt: any;
}

// Form data for expense
export interface ExpenseFormData {
    type: ExpenseType;
    voyageId?: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: string;
    receiptUrl?: string;
}

// Voyage summary for analytics
export interface VoyageSummary {
    voyage: Voyage;
    transactionCount: number;
    totalRevenue: number; // Sum of all transaction amounts
    totalExpenses: number; // Sum of all expenses
    profit: number; // Revenue - Expenses
    expensesByCategory: Record<ExpenseCategory, number>;
}
