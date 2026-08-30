export interface OwnerShipExpense {
    id?: string;
    voyageId: string;
    voyageNumber: string;
    shipName: string;
    departureDate: string; // YYYY-MM-DD
    route: string;
    tiket: number;
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
    totalRevenue: number; // Omzet otomatis dari data STT di Pemberangkatan
    tiket: number;
    opsMakassar: number;
    opsSurabaya: number;
    gajiSopir: number;
    sewaMobil: number;
    opsTambahan: number;
    totalExpenses: number; // Tiket + Ops MKS + Ops SBY + Gaji Sopir + Sewa Mobil + Ops Tambahan
    netProfit: number; // totalRevenue - totalExpenses
    profitMargin: number; // (netProfit / totalRevenue) * 100
    notes?: string;
    hasManualExpense: boolean;
}
