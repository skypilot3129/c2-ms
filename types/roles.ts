// User roles in the system
export type UserRole = 'owner' | 'admin' | 'branch_manager' | 'driver' | 'helper' | 'staff';

// Role labels for UI
export const ROLE_LABELS: Record<UserRole, string> = {
    'owner': 'Pemilik',
    'admin': 'Administrator',
    'branch_manager': 'Kepala Cabang',
    'driver': 'Supir',
    'helper': 'Helper/Kernet',
    'staff': 'Staff'
};

// Role hierarchy (higher number = more privileges)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
    'owner': 100,
    'admin': 80,
    'branch_manager': 60,
    'staff': 40,
    'driver': 20,
    'helper': 20
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
        case 'owner':
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

        case 'branch_manager':
            return {
                ...permissions,
                canViewDashboardOwner: false,        // No access to owner dashboard
                canManageTransactions: false,        // No access to transactions
                canManageClients: false,             // No access to clients
                canManageVoyages: false,             // No access to voyages
                canViewFinance: false,               // No access to finance
                canManageFinance: false,             // No access to finance management
                canManageFleet: false,               // No access to fleet
                canManageEmployees: true,            // Can manage employees
                canViewOwnAttendance: true,          // Can view own attendance
                canViewAllAttendance: true           // Can view all employee attendance
            };

        case 'staff':
            return {
                ...permissions,
                canManageTransactions: false,
                canManageClients: false
            };

        case 'driver':
        case 'helper':
            return permissions; // Only attendance

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
