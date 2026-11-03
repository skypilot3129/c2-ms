export interface OwnerShipExpense {
    id?: string;
    voyageId: string;
    voyageNumber: string;
    shipName: string;
    departureDate: string; // YYYY-MM-DD
    route: string;
    penjualanMakassar?: number; // Penjualan / omzet tambahan di Makassar (menambah omzet kapal)
    tiket: number;              // Biaya Tiket Kapal (Surabaya)
    tiketMakassar?: number;     // Biaya Tiket Makassar
    opsMakassar: number;
    opsSurabaya: number;
    gajiSopir: number;
    sewaMobil: number;
    opsTambahan: number;
    notes?: string;
    updatedAt?: Date;
    updatedBy?: string;
}

export interface OwnerShipSummaryRow {
    voyageId: string;
    voyageNumber: string;
    shipName: string;
    departureDate: Date;
    departureDateStr: string;
    route: string;
    vehicleNumbers: string[];
    status: string;
    sttCount: number;
    omzetStt: number;          // Omzet otomatis muatan STT kapal dari Surabaya
    penjualanMakassar: number; // Penjualan / omzet tambahan di Makassar
    totalRevenue: number;      // Total Omzet Keseluruhan: omzetStt + penjualanMakassar
    tiket: number;             // Tiket Kapal (Surabaya)
    tiketMakassar: number;     // Tiket Makassar
    opsMakassar: number;
    opsSurabaya: number;
    gajiSopir: number;
    sewaMobil: number;
    opsTambahan: number;
    totalExpenses: number;     // Tiket + Tiket Mks + Ops MKS + Ops SBY + Gaji Sopir + Sewa Mobil + Ops Tambahan
    netProfit: number;         // totalRevenue - totalExpenses
    profitMargin: number;      // (netProfit / totalRevenue) * 100
    notes?: string;
    hasManualExpense: boolean;
}
