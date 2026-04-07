/**
 * Voyage (Pemberangkatan) Types
 * For tracking shipments/voyages and their operational costs
 */

export type VoyageStatus = 'planned' | 'in-progress' | 'completed' | 'cancelled';

export type ExpenseCategory =
    // Operasional Lapangan
    | 'bbm_solar'
    | 'parkir_tol'
    | 'makan_tim'
    | 'perlengkapan_kerja'
    | 'biaya_pelabuhan'
    | 'tiket'
    | 'transit'
    | 'sewa_mobil'
    | 'gaji_sopir'
    // Maintenance Kendaraan
    | 'servis_rutin'
    | 'ganti_oli'
    | 'ban'
    | 'spare_part'
    // Kantor & Umum
    | 'gaji_karyawan'
    | 'listrik_air_internet'
    | 'sewa_kantor'
    | 'atk_kantor'
    | 'pulsa_kuota'
    | 'konsumsi_rapat'
    | 'iuran_retribusi'
    // Legacy (keep for backward compat)
    | 'operasional_surabaya'
    | 'operasional_makassar'
    | 'maintenance'
    | 'lainnya';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    // Operasional Lapangan
    bbm_solar: 'BBM / Solar',
    parkir_tol: 'Parkir & Tol',
    makan_tim: 'Makan Tim Muat',
    perlengkapan_kerja: 'Perlengkapan Kerja',
    biaya_pelabuhan: 'Biaya Pelabuhan',
    tiket: 'Tiket',
    transit: 'Transit',
    sewa_mobil: 'Sewa Mobil',
    gaji_sopir: 'Gaji Sopir',
    // Maintenance
    servis_rutin: 'Servis Rutin',
    ganti_oli: 'Ganti Oli',
    ban: 'Ban Kendaraan',
    spare_part: 'Spare Part',
    // Kantor & Umum
    gaji_karyawan: 'Gaji Karyawan',
    listrik_air_internet: 'Listrik / Air / Internet',
    sewa_kantor: 'Sewa Kantor / Gudang',
    atk_kantor: 'ATK Kantor',
    pulsa_kuota: 'Pulsa & Kuota',
    konsumsi_rapat: 'Konsumsi Rapat',
    iuran_retribusi: 'Iuran & Retribusi',
    // Legacy
    operasional_surabaya: 'Operasional Surabaya',
    operasional_makassar: 'Operasional Makassar',
    maintenance: 'Maintenance Armada',
    lainnya: 'Lainnya',
};

// Category groups for UI display
export const EXPENSE_CATEGORY_GROUPS: { label: string; categories: ExpenseCategory[] }[] = [
    {
        label: '🚛 Operasional Lapangan',
        categories: ['bbm_solar', 'parkir_tol', 'makan_tim', 'perlengkapan_kerja', 'biaya_pelabuhan', 'tiket', 'transit', 'sewa_mobil', 'gaji_sopir'],
    },
    {
        label: '🔧 Maintenance Kendaraan',
        categories: ['servis_rutin', 'ganti_oli', 'ban', 'spare_part'],
    },
    {
        label: '🏢 Kantor & Umum',
        categories: ['gaji_karyawan', 'listrik_air_internet', 'sewa_kantor', 'atk_kantor', 'pulsa_kuota', 'konsumsi_rapat', 'iuran_retribusi'],
    },
    {
        label: '📦 Lainnya',
        categories: ['operasional_surabaya', 'operasional_makassar', 'maintenance', 'lainnya'],
    },
];

// Approval status for expenses
export type ExpenseStatus = 'draft' | 'pending' | 'approved' | 'rejected';

// Petty Cash Top-Up (Pemasukan Kas)
export interface PettyCashTopUp {
    id: string;
    userId: string;
    amount: number;
    description: string;
    date: Date;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PettyCashTopUpDoc {
    userId: string;
    amount: number;
    description: string;
    date: any;
    createdBy: string;
    createdAt: any;
    updatedAt: any;
}

export interface PettyCashTopUpFormData {
    amount: number;
    description: string;
    date: string;
}

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
    type: ExpenseType;
    voyageId?: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: Date;
    receiptUrl?: string;
    status: ExpenseStatus;    // approval status
    approvedBy?: string;      // user id of approver
    rejectedReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Firestore document structure for Expense
export interface ExpenseDoc {
    userId: string;
    type?: ExpenseType;
    voyageId?: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: any;
    receiptUrl?: string;
    status?: ExpenseStatus;   // optional for backward compat (default to 'approved')
    approvedBy?: string;
    rejectedReason?: string;
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
    status?: ExpenseStatus;
}

// Voyage summary for analytics
export interface VoyageSummary {
    voyage: Voyage;
    transactionCount: number;
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    expensesByCategory: Record<ExpenseCategory, number>;
}

// Budget per category per month
export interface CategoryBudget {
    month: string; // YYYY-MM
    budgets: Partial<Record<ExpenseCategory, number>>;
    updatedAt: Date;
}

// ── Daily Expense Plan (Perencanaan Pengeluaran Harian) ──
export type PlanItemStatus = 'planned' | 'done' | 'canceled';

export interface ExpensePlanItem {
    id: string;           // local UUID for list key
    category: ExpenseCategory;
    description: string;
    estimatedAmount: number;
    status: PlanItemStatus;
}

export interface ExpensePlan {
    id: string;
    date: string;         // YYYY-MM-DD – the day being planned for
    userId: string;
    items: ExpensePlanItem[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ExpensePlanDoc {
    date: string;
    userId: string;
    items: ExpensePlanItem[];
    notes?: string;
    createdAt: any;
    updatedAt: any;
}

