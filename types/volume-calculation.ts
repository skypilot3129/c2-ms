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
}

export interface VolumeCalculatorFormData {
    length: number;
    width: number;
    height: number;
    actualWeight: number;
    quantity: number;
    itemName: string;
}

export interface VolumeCalculationResult {
    items: VolumeCalculation[];
    totalVolume: number;
    totalActualWeight: number;
    totalVolumetricWeight: number;
    totalChargeableWeight: number;
}

// Constants
export const VOLUMETRIC_DIVISOR = 4000; // Standard for Cahaya Cargo Express
