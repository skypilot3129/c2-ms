// Volume calculation types for Cahaya Cargo Express

export interface VolumeCalculation {
    length: number;           // cm
    width: number;            // cm
    height: number;           // cm
    actualWeight: number;     // kg (per item)
    quantity: number;         // number of items
    itemName: string;         // name or type of item
    volume: number;           // total cm³
    volumetricWeight: number; // total kg
    chargeableWeight: number; // total kg
    weightType: 'actual' | 'volumetric';
    barcode?: string;         // optional barcode scanner code
}

export interface VolumeCalculatorFormData {
    length: number;
    width: number;
    height: number;
    actualWeight: number;
    quantity: number;
    itemName: string;
    barcode?: string;
}

export interface VolumeCalculationResult {
    items: VolumeCalculation[];
    totalVolume: number;
    totalActualWeight: number;
    totalVolumetricWeight: number;
    totalChargeableWeight: number;
}

// Koli item with sequence number (used in sessions)
export interface KoliItem extends VolumeCalculation {
    koliNumber: number;
}

// A saved calculator session stored in Firestore
export interface VolumeSession {
    id: string;
    senderName: string;
    pricePerKg: number;
    koliList: KoliItem[];
    totalWeight: number;
    totalPrice: number;
    notes?: string;
    createdBy: string;        // userId
    createdByName?: string;   // display name
    createdAt: Date;
    updatedAt: Date;
}

// Constants
export const VOLUMETRIC_DIVISOR = 4000; // Standard for Cahaya Cargo Express
