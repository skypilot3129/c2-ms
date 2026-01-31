/**
 * Volume Calculator Utilities for Cahaya Cargo Express
 * 
 * Standard calculation:
 * - Volumetric Weight = (Length × Width × Height) / 4000
 * - Chargeable Weight = MAX(Actual Weight, Volumetric Weight)
 */

import type { VolumeCalculation, VolumeCalculatorFormData, VolumeCalculationResult } from '@/types/volume-calculation';
import { VOLUMETRIC_DIVISOR } from '@/types/volume-calculation';

/**
 * Calculate volume from dimensions
 * @param length Length in cm
 * @param width Width in cm
 * @param height Height in cm
 * @returns Volume in cm³
 */
export function calculateVolume(length: number, width: number, height: number): number {
    return length * width * height;
}

/**
 * Calculate volumetric weight from volume
 * @param volume Volume in cm³
 * @returns Volumetric weight in kg
 */
export function calculateVolumetricWeight(volume: number): number {
    return volume / VOLUMETRIC_DIVISOR;
}

/**
 * Determine chargeable weight
 * @param actualWeight Actual weight in kg
 * @param volumetricWeight Volumetric weight in kg
 * @returns Chargeable weight (the higher of the two)
 */
export function calculateChargeableWeight(actualWeight: number, volumetricWeight: number): number {
    return Math.max(actualWeight, volumetricWeight);
}

/**
 * Complete volume calculation for a single item
 * @param formData Form data with dimensions and actual weight
 * @returns Complete calculation result
 */
export function calculateDimensions(formData: VolumeCalculatorFormData): VolumeCalculation {
    const { length, width, height, actualWeight } = formData;

    // Calculate volume
    const volume = calculateVolume(length, width, height);

    // Calculate volumetric weight
    const volumetricWeight = calculateVolumetricWeight(volume);

    // Determine chargeable weight
    const chargeableWeight = calculateChargeableWeight(actualWeight, volumetricWeight);

    // Determine which weight type is used
    const weightType: 'actual' | 'volumetric' = chargeableWeight === actualWeight ? 'actual' : 'volumetric';

    return {
        length,
        width,
        height,
        actualWeight,
        volume,
        volumetricWeight,
        chargeableWeight,
        weightType
    };
}

/**
 * Calculate total for multiple items
 * @param formData Form data with quantity
 * @returns Calculation result with totals
 */
export function calculateMultipleItems(formData: VolumeCalculatorFormData): VolumeCalculationResult {
    const quantity = formData.quantity || 1;
    const singleItem = calculateDimensions(formData);

    const items: VolumeCalculation[] = Array(quantity).fill(singleItem);

    return {
        items,
        totalVolume: singleItem.volume * quantity,
        totalActualWeight: singleItem.actualWeight * quantity,
        totalVolumetricWeight: singleItem.volumetricWeight * quantity,
        totalChargeableWeight: singleItem.chargeableWeight * quantity
    };
}

/**
 * Format weight for display
 * @param weight Weight in kg
 * @param decimals Number of decimal places
 * @returns Formatted weight string
 */
export function formatWeight(weight: number, decimals: number = 2): string {
    return weight.toFixed(decimals);
}

/**
 * Format volume for display
 * @param volume Volume in cm³
 * @returns Formatted volume string
 */
export function formatVolume(volume: number): string {
    return volume.toLocaleString('id-ID');
}

/**
 * Validate input dimensions
 * @param length Length in cm
 * @param width Width in cm
 * @param height Height in cm
 * @param actualWeight Actual weight in kg
 * @returns Validation result
 */
export function validateDimensions(
    length: number,
    width: number,
    height: number,
    actualWeight: number
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (length <= 0) errors.push('Panjang harus lebih dari 0');
    if (width <= 0) errors.push('Lebar harus lebih dari 0');
    if (height <= 0) errors.push('Tinggi harus lebih dari 0');
    if (actualWeight <= 0) errors.push('Berat aktual harus lebih dari 0');

    if (length > 10000) errors.push('Panjang terlalu besar (max 10000 cm)');
    if (width > 10000) errors.push('Lebar terlalu besar (max 10000 cm)');
    if (height > 10000) errors.push('Tinggi terlalu besar (max 10000 cm)');
    if (actualWeight > 100000) errors.push('Berat terlalu besar (max 100000 kg)');

    return {
        valid: errors.length === 0,
        errors
    };
}
