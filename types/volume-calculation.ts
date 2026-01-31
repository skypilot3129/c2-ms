// Volume calculation types for Cahaya Cargo Express

export interface VolumeCalculation {
    length: number;           // cm
    width: number;            // cm
    height: number;           // cm
    actualWeight: number;     // kg
    volume: number;           // cm³
    volumetricWeight: number; // kg
    chargeableWeight: number; // kg
    weightType: 'actual' | 'volumetric';
}

export interface VolumeCalculatorFormData {
    length: number;
    width: number;
    height: number;
    actualWeight: number;
    quantity?: number;
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
