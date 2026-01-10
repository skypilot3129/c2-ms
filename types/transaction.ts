import { Timestamp } from 'firebase/firestore';
import type { Branch } from './branch';

// Transaction Types
export type TipeTransaksi = 'regular' | 'borongan';
export type MetodePembayaran = 'Tunai' | 'Kredit' | 'DP';
export type CaraPelunasan = 'Cash' | 'TF' | 'Pending';
export type BeratUnit = 'KG' | 'M3';
export type StatusTransaksi = 'pending' | 'diproses' | 'dikirim' | 'selesai' | 'dibatalkan';

export interface StatusHistoryEntry {
    status: StatusTransaksi;
    timestamp: Date;
    catatan?: string;
}

// Surat Jalan data
export interface SuratJalanData {
    // Basic transport info
    tanggalPC: string;
    nomorMobil?: string;
    namaSopir?: string;
    rute?: string;

    // Sender/Receiver Info (editable from form)
    namaPengirim?: string;
    alamatPengirim?: string;
    namaPenerima?: string;
    alamatPenerima?: string;

    // Section 3: Kondisi Barang (Konsesi Diterima Dengan)
    konsesiBaik: boolean;
    konsesiRusak: boolean;
    konsesiBerkurang: boolean;
    konsesiKeterangan?: string;

    // Section 4: Simplified Insurance (Yes/No only)
    asuransi: boolean;

    // Service (transport type)
    service?: 'darat' | 'laut' | 'udara';

    // Pembayaran
    caraPembayaran: 'tunai' | 'invoice' | 'bank';
    pembayaranOngkos?: string;

    // Section 5: Dimensi (combined P x L x T)
    dimensi?: string; // Format: "100 x 50 x 30"
    beratVolume?: number;
    satuanVolume?: 'M3' | 'KG';

    // Special Notes
    catatanKhusus?: string;
}

export interface Transaction {
    id: string;
    userId: string;
    branch: Branch;  // Branch: jakarta or bandung

    // Core fields
    tanggal: Date;
    tujuan: string;
    noSTT: string;

    // Pengirim (sender)
    pengirimId: string;
    pengirimName: string;
    pengirimPhone?: string;
    pengirimAddress?: string;
    pengirimCity?: string;

    // Penerima (receiver)
    penerimaId: string;
    penerimaName: string;
    penerimaPhone?: string;
    penerimaAddress?: string;
    penerimaCity?: string;

    // Shipment details
    koli: number;
    berat: number;
    beratUnit: BeratUnit;

    // Pricing
    tipeTransaksi: TipeTransaksi;
    harga: number;              // 0 if borongan
    jumlah: number;             // Total amount in Rupiah

    // Invoice & Payment
    noInvoice: string;
    pembayaran: MetodePembayaran;
    pelunasan: CaraPelunasan;

    // Tax Info
    isTaxable?: boolean;        // PKP or not
    ppn?: number;               // Tax amount
    ppnRate?: number;           // Tax rate (e.g., 0.11)

    // Additional info
    keterangan?: string;        // Notes/description from KETERANGAN column
    isiBarang?: string;         // Item contents

    // Surat Jalan info (optional, filled when printing surat jalan)
    suratJalan?: SuratJalanData;

    // Status tracking
    status: StatusTransaksi;
    statusHistory: StatusHistoryEntry[];

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

// Form data (user input)
export interface TransactionFormData {
    branch: Branch;             // Branch selection
    tanggal: string;            // Date string from input
    tujuan: string;
    pengirimId: string;
    penerimaId: string;
    koli: number;
    berat: number;
    beratUnit: BeratUnit;
    tipeTransaksi: TipeTransaksi;
    harga: number;
    // total is calculated

    // Tax
    isTaxable: boolean;
    ppnRate: number; // 0 if not taxable
    ppn?: number;    // Explicit tax amount

    noInvoice: string;
    pembayaran: MetodePembayaran;
    pelunasan: CaraPelunasan;
    keterangan?: string;
    isiBarang?: string;
    status: StatusTransaksi;
}

// Surat Jalan Data (for delivery note printing)
export interface SuratJalanData {
    tanggalPC: string;
    nomorMobil?: string;
    namaSopir?: string;
    rute?: string;

    // Sender/Receiver Info (editable from form)
    namaPengirim?: string;
    alamatPengirim?: string;
    namaPenerima?: string;
    alamatPenerima?: string;

    // Kondisi
    konsesiBaik: boolean;
    konsesiRusak: boolean;
    konsesiBerkurang: boolean;
    konsesiKeterangan?: string;

    // Simplified Insurance (Yes/No only)
    asuransi: boolean;

    // Service (transport type)
    service?: 'darat' | 'laut' | 'udara';

    // Payment
    caraPembayaran: 'tunai' | 'invoice' | 'bank';
    pembayaranOngkos?: string;

    // Dimensi (combined P x L x T)
    dimensi?: string; // Format: "100 x 50 x 30"
    beratVolume?: number;
    satuanVolume?: 'M3' | 'KG';

    // Special Notes
    catatanKhusus?: string;
}

// Firestore document type (with Timestamp)
export interface TransactionDoc {
    userId: string;
    branch: Branch;  // Branch: jakarta or bandung
    tanggal: Timestamp;
    tujuan: string;
    noSTT: string;
    pengirimId: string;
    pengirimName: string;
    pengirimPhone?: string;
    pengirimAddress?: string;
    pengirimCity?: string;
    penerimaId: string;
    penerimaName: string;
    penerimaPhone?: string;
    penerimaAddress?: string;
    penerimaCity?: string;
    koli: number;
    berat: number;
    beratUnit: BeratUnit;
    tipeTransaksi: TipeTransaksi;
    harga: number;
    jumlah: number;

    // Tax
    isTaxable?: boolean;
    ppn?: number;
    ppnRate?: number;

    noInvoice: string;
    pembayaran: MetodePembayaran;
    pelunasan: CaraPelunasan;
    keterangan?: string;
    isiBarang?: string;
    suratJalan?: SuratJalanData;
    status: StatusTransaksi;
    statusHistory: Array<{
        status: StatusTransaksi;
        timestamp: Timestamp;
        catatan?: string;
    }>;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
