// User roles in the system
export type UserRole = 'admin' | 'pengurus' | 'helper';

// Role labels for UI
export const ROLE_LABELS: Record<UserRole, string> = {
    'admin': 'Administrator',
    'pengurus': 'Pengurus',
    'helper': 'Helper',
};

// Role hierarchy (higher number = more privileges)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
    'admin': 100,
    'pengurus': 60,
    'helper': 20,
};

// Check if user has minimum required role
export const hasMinimumRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

// Feature permissions
export interface FeaturePermissions {
    canViewDashboardOwner: boolean;
    canManageTransactions: boolean;
    canManageClients: boolean;
    canManageVoyages: boolean;
    canViewFinance: boolean;
    canManageFinance: boolean;
    canManageFleet: boolean;
    canManageEmployees: boolean;
    canViewOwnAttendance: boolean;
    canViewAllAttendance: boolean;
}

// Get permissions for a role
export const getRolePermissions = (role: UserRole): FeaturePermissions => {
    const permissions: FeaturePermissions = {
        canViewDashboardOwner: false,
        canManageTransactions: false,
        canManageClients: false,
        canManageVoyages: false,
        canViewFinance: false,
        canManageFinance: false,
        canManageFleet: false,
        canManageEmployees: false,
        canViewOwnAttendance: true, // Everyone can view their own attendance
        canViewAllAttendance: false
    };

    switch (role) {
        case 'admin':
            return {
                canViewDashboardOwner: true,
                canManageTransactions: true,
                canManageClients: true,
                canManageVoyages: true,
                canViewFinance: true,
                canManageFinance: true,
                canManageFleet: true,
                canManageEmployees: true,
                canViewOwnAttendance: true,
                canViewAllAttendance: true
            };

        case 'pengurus':
            return {
                ...permissions,
                canManageEmployees: true,
                canViewOwnAttendance: true,
                canViewAllAttendance: true
            };

        case 'helper':
            return permissions; // Only attendance + profile

        default:
            return permissions;
    }
};

// Helper: Generate email from name
export const generateEmployeeEmail = (fullName: string): string => {
    const firstName = fullName.trim().split(' ')[0].toLowerCase();
    const cleanName = firstName.replace(/[^a-z]/g, '');
    return `${cleanName}@cahayacargo.com`;
};

// Helper: Generate default password
export const generateDefaultPassword = (fullName: string): string => {
    const firstName = fullName.trim().split(' ')[0].toLowerCase();
    const cleanName = firstName.replace(/[^a-z]/g, '');
    return `${cleanName}2026`;
};

// Helper: Check if email is employee email
export const isEmployeeEmail = (email: string): boolean => {
    return email.endsWith('@cahayacargo.com');
};
