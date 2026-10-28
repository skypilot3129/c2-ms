'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChanged, loginWithEmail, logoutUser } from '@/lib/auth';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserRole } from '@/types/roles';
import type { Employee, EmployeeDoc } from '@/types/employee';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    role: UserRole;
    employee: Employee | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<UserRole>('owner');
    const [employee, setEmployee] = useState<Employee | null>(null);

    useEffect(() => {
        // Subscribe to auth state changes
        const unsubscribe = onAuthChanged(async (user) => {
            setUser(user);

            if (user) {
                // Fetch employee record to determine role
                try {
                    let q = query(
                        collection(db, 'employees'),
                        where('authUid', '==', user.uid)
                    );
                    let snapshot = await getDocs(q);

                    // If not found by authUid, check by email
                    if (snapshot.empty && user.email) {
                        q = query(
                            collection(db, 'employees'),
                            where('email', '==', user.email)
                        );
                        snapshot = await getDocs(q);
                    }

                    if (!snapshot.empty) {
                        const doc = snapshot.docs[0];
                        const data = doc.data() as EmployeeDoc;

                        const empData: Employee = {
                            id: doc.id,
                            employeeId: data.employeeId,
                            fullName: data.fullName,
                            role: data.role,
                            status: data.status,
                            joinDate: data.joinDate?.toDate() || new Date(),
                            contact: data.contact,
                            documents: data.documents || [],
                            salaryConfig: data.salaryConfig,
                            photoUrl: data.photoUrl,
                            jobdesk: data.jobdesk,
                            notes: data.notes,
                            authUid: data.authUid || user.uid,
                            email: data.email || user.email || '',
                            accountStatus: data.accountStatus || 'pending',
                            createdAt: data.createdAt?.toDate() || new Date(),
                            updatedAt: data.updatedAt?.toDate() || new Date(),
                        };

                        setEmployee(empData);
                        setRole(data.role);
                    } else {
                        // User exists in Firebase Auth, but NOT in employees collection:
                        // As stated: "petugas owner yang sekarang di data akun email mereka tidak ada karena email mereka di daftarkan manual langsung di firebase database sebelum modul akun dibuat"
                        setEmployee(null);
                        setRole('owner');
                    }
                } catch (error) {
                    console.error('Error fetching employee data:', error);
                    setRole('owner'); // Fallback to owner
                }
            } else {
                setEmployee(null);
                setRole('owner');
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        setLoading(true);
        try {
            await loginWithEmail(email, password);
            // User state will be updated by onAuthChanged listener
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await logoutUser();
            // User state will be updated by onAuthChanged listener
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, role, employee, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
