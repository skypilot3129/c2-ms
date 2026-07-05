/**
 * Branch definitions for multi-branch support
 */

export type Branch = 'surabaya' | 'bandung' | 'makassar';

export interface BranchInfo {
    id: Branch;
    name: string;
    displayName: string;
    initialCounter: number;
}

export const BRANCHES: Record<Branch, BranchInfo> = {
    surabaya: {
        id: 'surabaya',
        name: 'Surabaya',
        displayName: 'Surabaya (Pusat)',
        initialCounter: 17641  // Next will be 17642
    },
    bandung: {
        id: 'bandung',
        name: 'Bandung',
        displayName: 'Bandung',
        initialCounter: 1032   // Next will be 1033
    },
    makassar: {
        id: 'makassar',
        name: 'Makassar',
        displayName: 'Makassar',
        initialCounter: 550    // Next will be 00551
    }
};

/**
 * Get branch info by ID
 */
export function getBranchInfo(branchId: Branch): BranchInfo {
    return BRANCHES[branchId];
}

/**
 * Get all branches as array
 */
export function getAllBranches(): BranchInfo[] {
    return Object.values(BRANCHES);
}

export type AppModule = 
    | 'attendance'
    | 'finance'
    | 'scan_dhs'
    | 'transactions'
    | 'volume_calculator'
    | 'voyages'
    | 'employees'
    | 'payroll'
    | 'clients'
    | 'operations'
    | 'fleets'
    | 'manifest'
    | 'label_resi'
    | 'dokumen_legal'
    | 'invoice_aml'
    | 'slip_skk'
    | 'marketing_dashboard';

export const BRANCH_MODULES: Record<Branch, AppModule[]> = {
    surabaya: [
        'attendance', 'finance', 'scan_dhs', 'transactions', 'volume_calculator',
        'voyages', 'employees', 'payroll', 'clients', 'operations', 'fleets',
        'manifest', 'label_resi', 'dokumen_legal', 'invoice_aml', 'slip_skk', 'marketing_dashboard'
    ],
    bandung: [
        'attendance', 'finance', 'scan_dhs', 'transactions', 'volume_calculator',
        'voyages', 'employees', 'payroll', 'clients', 'operations', 'fleets',
        'manifest', 'label_resi', 'dokumen_legal', 'invoice_aml', 'slip_skk', 'marketing_dashboard'
    ],
    makassar: [
        'attendance',
        'finance',
        'scan_dhs',
        'transactions',
        'volume_calculator',
        'voyages',
        'employees',
        'payroll',
        'clients' // Enabled per user request
    ]
};

export function getActiveBranch(): Branch {
    const envBranch = process.env.NEXT_PUBLIC_ACTIVE_BRANCH;
    if (envBranch === 'makassar') return 'makassar';
    if (envBranch === 'bandung') return 'bandung';
    return 'surabaya';
}

export function isModuleActive(moduleName: AppModule): boolean {
    const activeBranch = getActiveBranch();
    const activeModules = BRANCH_MODULES[activeBranch];
    return activeModules.includes(moduleName);
}

