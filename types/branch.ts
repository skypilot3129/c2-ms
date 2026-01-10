/**
 * Branch definitions for multi-branch support
 */

export type Branch = 'surabaya' | 'bandung';

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
