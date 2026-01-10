'use server';

import { adminAuth } from '@/lib/firebase-admin';
import { generateDefaultPassword } from '@/types/roles';

/**
 * Create Firebase Auth user for employee (Server Action)
 */
export async function createAuthUser(email: string, fullName: string): Promise<{
    success: boolean;
    uid?: string;
    password?: string;
    error?: string;
}> {
    try {
        const password = generateDefaultPassword(fullName);

        // Create user in Firebase Auth
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: fullName,
            emailVerified: false
        });

        console.log(`[User Management] Created auth user: ${email} (${userRecord.uid})`);

        return {
            success: true,
            uid: userRecord.uid,
            password // Return for display to admin
        };
    } catch (error: any) {
        console.error('[User Management] Error creating auth user:', error);

        if (error.code === 'auth/email-already-exists') {
            return {
                success: false,
                error: 'Email sudah terdaftar. Gunakan email lain.'
            };
        }

        return {
            success: false,
            error: error.message || 'Gagal membuat auth user'
        };
    }
}

/**
 * Update Firebase Auth user display name
 */
export async function updateAuthUserName(uid: string, displayName: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        await adminAuth.updateUser(uid, { displayName });

        console.log(`[User Management] Updated display name for ${uid}`);

        return { success: true };
    } catch (error: any) {
        console.error('[User Management] Error updating user:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Reset employee password
 */
export async function resetEmployeePassword(uid: string, fullName: string): Promise<{
    success: boolean;
    newPassword?: string;
    error?: string;
}> {
    try {
        const newPassword = generateDefaultPassword(fullName);

        await adminAuth.updateUser(uid, { password: newPassword });

        console.log(`[User Management] Reset password for ${uid}`);

        return {
            success: true,
            newPassword
        };
    } catch (error: any) {
        console.error('[User Management] Error resetting password:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Disable/Enable Firebase Auth account
 */
export async function toggleAuthAccount(uid: string, disabled: boolean): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        await adminAuth.updateUser(uid, { disabled });

        console.log(`[User Management] ${disabled ? 'Disabled' : 'Enabled'} account ${uid}`);

        return { success: true };
    } catch (error: any) {
        console.error('[User Management] Error toggling account:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Delete Firebase Auth user
 */
export async function deleteAuthUser(uid: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        await adminAuth.deleteUser(uid);

        console.log(`[User Management] Deleted auth user ${uid}`);

        return { success: true };
    } catch (error: any) {
        console.error('[User Management] Error deleting user:', error);
        return {
            success: boolean,
            error: error.message
        };
    }
}
