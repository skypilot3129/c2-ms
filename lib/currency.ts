// Currency formatting utilities for Indonesian Rupiah

/**
 * Format number to Indonesian Rupiah currency
 * @param amount - Number to format
 * @returns Formatted string (e.g., "Rp 6.480.000")
 */
export const formatRupiah = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

/**
 * Parse Rupiah string to number
 * @param value - String to parse (e.g., "6.480.000" or "Rp 6.480.000")
 * @returns Parsed number
 */
export const parseRupiah = (value: string): number => {
    // Remove all non-digit characters
    const cleanValue = value.replace(/\D/g, '');
    return parseInt(cleanValue) || 0;
};

/**
 * Format number for input display (no currency symbol)
 * @param value - String or number to format
 * @returns Formatted string with thousand separators
 */
export const formatRupiahInput = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseRupiah(value) : value;
    if (numValue === 0) return '';
    return numValue.toLocaleString('id-ID');
};

/**
 * Convert number to Indonesian words (terbilang)
 * @param angka - Number to convert
 * @returns Indonesian words + "Rupiah"
 */
export const terbilang = (angka: number): string => {
    const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];
    const belasan = ['Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas', 'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'];

    if (angka === 0) return 'Nol Rupiah';

    const terbilangRekursif = (n: number): string => {
        if (n < 10) return satuan[n];
        if (n < 20) return belasan[n - 10];
        if (n < 100) {
            const puluhan = Math.floor(n / 10);
            const sisa = n % 10;
            return satuan[puluhan] + ' Puluh' + (sisa > 0 ? ' ' + satuan[sisa] : '');
        }
        if (n < 200) {
            const sisa = n % 100;
            return 'Seratus' + (sisa > 0 ? ' ' + terbilangRekursif(sisa) : '');
        }
        if (n < 1000) {
            const ratusan = Math.floor(n / 100);
            const sisa = n % 100;
            return satuan[ratusan] + ' Ratus' + (sisa > 0 ? ' ' + terbilangRekursif(sisa) : '');
        }
        if (n < 2000) {
            const sisa = n % 1000;
            return 'Seribu' + (sisa > 0 ? ' ' + terbilangRekursif(sisa) : '');
        }
        if (n < 1000000) {
            const ribuan = Math.floor(n / 1000);
            const sisa = n % 1000;
            return terbilangRekursif(ribuan) + ' Ribu' + (sisa > 0 ? ' ' + terbilangRekursif(sisa) : '');
        }
        if (n < 1000000000) {
            const jutaan = Math.floor(n / 1000000);
            const sisa = n % 1000000;
            return terbilangRekursif(jutaan) + ' Juta' + (sisa > 0 ? ' ' + terbilangRekursif(sisa) : '');
        }
        // Milyar
        const milyaran = Math.floor(n / 1000000000);
        const sisa = n % 1000000000;
        return terbilangRekursif(milyaran) + ' Milyar' + (sisa > 0 ? ' ' + terbilangRekursif(sisa) : '');
    };

    return terbilangRekursif(angka) + ' Rupiah';
};

/**
 * Calculate total from harga and koli for regular transactions
 * @param harga - Price per unit
 * @param koli - Number of packages
 * @param tipeTransaksi - Transaction type
 * @returns Calculated total (0 if borongan, since manual input)
 */
export const calculateJumlah = (
    harga: number,
    koli: number,
    tipeTransaksi: 'regular' | 'borongan'
): number => {
    if (tipeTransaksi === 'borongan') return 0; // Manual input required
    return harga * koli;
};
