import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { OfficeLocation } from '@/types/attendance';

const SETTINGS_COLLECTION = 'settings';
const TAX_SETTINGS_DOC = 'tax_settings';

export interface TaxSettings {
    isPKP: boolean;
    defaultPPNRate: number; // e.g. 0.011
    companyName?: string;
    companyNPWP?: string;
    companyAddress?: string;
}

export interface AttendanceLocationSettings {
    enabled: boolean;
    locations: OfficeLocation[];
    defaultRadius: number; // meters
}

// Default office locations from company config
const DEFAULT_LOCATIONS: OfficeLocation[] = [
    {
        id: 'surabaya',
        name: 'Kantor Surabaya (Pusat)',
        lat: -7.2094, // Jl. Kalimas Baru No. 60, Surabaya
        lng: 112.7364,
        radius: 150,
    },
    {
        id: 'makassar',
        name: 'Kantor Makassar',
        lat: -5.1278, // Jl Irian No. 245 B, Makassar
        lng: 119.4125,
        radius: 150,
    },
    {
        id: 'banjarmasin',
        name: 'Kantor Banjarmasin',
        lat: -3.3169, // Jl. Gelandakan, Ps Sentra Bilanja Hancap
        lng: 114.5901,
        radius: 150,
    },
];

export const getTaxSettings = async (userId: string): Promise<TaxSettings> => {
    const docRef = doc(db, SETTINGS_COLLECTION, 'global_settings'); // Global settings
    // const docRef = doc(db, SETTINGS_COLLECTION, userId); // User-specific settings document
    const snapshot = await getDoc(docRef);

    if (snapshot.exists() && snapshot.data().tax) {
        return snapshot.data().tax as TaxSettings;
    }

    // Defaults
    return {
        isPKP: false,
        defaultPPNRate: 0.011, // 1.1%
    };
};

export const updateTaxSettings = async (userId: string, settings: TaxSettings): Promise<void> => {
    const docRef = doc(db, SETTINGS_COLLECTION, 'global_settings');
    // const docRef = doc(db, SETTINGS_COLLECTION, userId);

    // Merge with existing settings (e.g. if we have other settings later)
    await setDoc(docRef, {
        tax: settings,
        updatedAt: new Date()
    }, { merge: true });
};

/**
 * Get attendance location settings
 */
export const getAttendanceLocationSettings = async (): Promise<AttendanceLocationSettings> => {
    const docRef = doc(db, SETTINGS_COLLECTION, 'global_settings');
    const snapshot = await getDoc(docRef);

    if (snapshot.exists() && snapshot.data().attendanceLocation) {
        return snapshot.data().attendanceLocation as AttendanceLocationSettings;
    }

    // Defaults - disabled with preset office locations
    return {
        enabled: false,
        locations: DEFAULT_LOCATIONS,
        defaultRadius: 100,
    };
};

/**
 * Update attendance location settings
 */
export const updateAttendanceLocationSettings = async (
    settings: AttendanceLocationSettings
): Promise<void> => {
    const docRef = doc(db, SETTINGS_COLLECTION, 'global_settings');

    await setDoc(docRef, {
        attendanceLocation: settings,
        updatedAt: new Date()
    }, { merge: true });
};

