import {
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    onAuthStateChanged,
    User,
    UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';



// Login with email and password
export const loginWithEmail = async (
    email: string,
    password: string
): Promise<UserCredential> => {
    return await signInWithEmailAndPassword(auth, email, password);
};

// Logout current user
export const logoutUser = async (): Promise<void> => {
    await signOut(auth);
};

// Get current user
export const getCurrentUser = (): User | null => {
    return auth.currentUser;
};

// Listen to auth state changes
export const onAuthChanged = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

// Get current user ID
export const getCurrentUserId = (): string | null => {
    return auth.currentUser?.uid || null;
};
