import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const SETTINGS_COLLECTION = 'settings';
const TAX_SETTINGS_DOC = 'tax_settings';

export interface TaxSettings {
    isPKP: boolean;
    defaultPPNRate: number; // e.g. 0.11
    companyName?: string;
    companyNPWP?: string;
    companyAddress?: string;
}

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
        defaultPPNRate: 0.11, // 11%
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
