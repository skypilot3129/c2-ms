import type { Branch } from './branch';
import type { UserRole } from './roles';
import type { BeratUnit, CaraPelunasan, MetodePembayaran, StatusTransaksi, TipeTransaksi } from './transaction';
import type { ExpenseCategory, VoyageStatus } from './voyage';

export type WaAgentRole = UserRole;

export type WaThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export interface WaTokenUsage {
    promptTokens: number;
    outputTokens: number;
    thoughtTokens: number;
    cachedTokens: number;
    totalTokens: number;
    modelName?: string;
}

export interface WaAgentUser {
    id: string;
    phone: string; // Normalized E.164 digits without '+', e.g., 628123456789
    name: string;
    role: WaAgentRole;
    active: boolean;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface WaAgentConfig {
    enabled: boolean;
    openwaBaseUrl: string;
    openwaSessionId: string;
    allowGroups: boolean;
    groupPrefix: string;
    modelName: string;
    thinkingLevel?: WaThinkingLevel;
    updatedAt?: Date;
}

export interface CreateSttDraftPayload {
    branch: Branch;
    tanggal: string; // YYYY-MM-DD
    tujuan: string;
    pengirimName: string;
    pengirimPhone?: string;
    pengirimAddress?: string;
    pengirimCity?: string;
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
    pembayaran: MetodePembayaran;
    pelunasan: CaraPelunasan;
    isTaxable: boolean;
    isiBarang?: string;
    keterangan?: string;
    noSTT?: string;
}

export interface CreateInvoiceDraftPayload {
    clientId?: string;
    clientName: string;
    clientAddress?: string;
    clientPhone?: string;
    transactionIds: string[];
    noSTTs: string[];
    subtotal: number;
    ppn: number;
    totalAmount: number;
    isTaxable: boolean;
    issueDate: string; // YYYY-MM-DD
    dueDate: string; // YYYY-MM-DD
    notes?: string;
}

export interface ReplyMediaItem {
    base64: string;
    mimeType: string;
    filename?: string;
    caption?: string;
}

export interface BatchUpdateSttPricingItem {
    transactionId: string;
    noSTT: string;
    pengirimName: string;
    penerimaName: string;
    tujuan: string;
    koli: number;
    berat: number;
    beratUnit: BeratUnit;
    tipeTransaksi: TipeTransaksi;
    harga: number; // Tarif satuan untuk regular; 0 untuk borongan
    jumlah: number; // Total Rupiah (base amount sebelum PPN)
    isTaxable?: boolean;
    newStatus: StatusTransaksi;
    priceSource?: string;
}

export interface BatchUpdateSttPricingDraftPayload {
    items: BatchUpdateSttPricingItem[];
    targetStatus: StatusTransaksi;
}

export interface VoyageShipCostsInput {
    tiket?: number;
    tiketMakassar?: number;
    opsSurabaya?: number;
    opsMakassar?: number;
    gajiSopir?: number;
    sewaMobil?: number;
    opsTambahan?: number;
    penjualanMakassar?: number;
    notes?: string;
}

export interface VoyageGeneralExpenseInput {
    category: ExpenseCategory;
    amount: number;
    description: string;
    date?: string; // YYYY-MM-DD
}

export interface CreateVoyageDraftPayload {
    route: string;
    shipName: string;
    vehicleNumbers: string[]; // Bebas: nama sopir atau nopol manual
    departureDate: string; // YYYY-MM-DD
    arrivalDate?: string; // YYYY-MM-DD
    status: VoyageStatus;
    notes?: string;
    shipCosts?: VoyageShipCostsInput;
    generalExpenses?: VoyageGeneralExpenseInput[];
    transactionIds?: string[];
    noSTTs?: string[];
}

export interface SaveVoyageExpensesDraftPayload {
    voyageId: string;
    voyageNumber: string;
    shipName: string;
    route: string;
    departureDate: string; // YYYY-MM-DD
    shipCosts?: VoyageShipCostsInput;
    generalExpenses?: VoyageGeneralExpenseInput[];
}

export interface AssignSttsToVoyageDraftPayload {
    voyageId: string;
    voyageNumber: string;
    shipName: string;
    route: string;
    departureDate: string;
    items: Array<{
        transactionId: string;
        noSTT: string;
        pengirimName: string;
        penerimaName: string;
        tujuan: string;
        koli: number;
        berat: number;
        beratUnit: string;
        jumlah: number;
        status: string;
    }>;
}

export type PendingAction =
    | {
        type: 'create_stt';
        summaryText: string;
        payload: CreateSttDraftPayload;
        createdAt: number;
    }
    | {
        type: 'create_invoice';
        summaryText: string;
        payload: CreateInvoiceDraftPayload;
        createdAt: number;
    }
    | {
          type: 'batch_update_stt_pricing';
          summaryText: string;
          payload: BatchUpdateSttPricingDraftPayload;
          createdAt: number;
      }
    | {
          type: 'create_voyage';
          summaryText: string;
          payload: CreateVoyageDraftPayload;
          createdAt: number;
      }
    | {
          type: 'save_voyage_expenses';
          summaryText: string;
          payload: SaveVoyageExpensesDraftPayload;
          createdAt: number;
      }
    | {
          type: 'assign_stts_to_voyage';
          summaryText: string;
          payload: AssignSttsToVoyageDraftPayload;
          createdAt: number;
      };

export interface WaAgentHistoryItem {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export interface WaAgentSession {
    phone: string;
    history: WaAgentHistoryItem[];
    pendingAction?: PendingAction | null;
    updatedAt: Date;
}

export interface WaAgentLog {
    id: string;
    messageId?: string;
    phone: string;
    userName?: string;
    userRole?: WaAgentRole;
    source: 'whatsapp' | 'simulator';
    incomingText: string;
    replyText: string;
    toolsUsed: string[];
    tokenUsage?: WaTokenUsage;
    status: 'ok' | 'blocked' | 'disabled' | 'error';
    errorMessage?: string;
    createdAt: Date;
}

export const DEFAULT_WA_AGENT_CONFIG: WaAgentConfig = {
    enabled: false,
    openwaBaseUrl: 'http://localhost:2785',
    openwaSessionId: 'cce-admin',
    allowGroups: false,
    groupPrefix: '/cce',
    modelName: 'gemini-4-hydrogen',
    thinkingLevel: 'low',
};

/**
 * Normalize Indonesian phone numbers into digits-only format starting with 62.
 * Examples: "0812-345-6789" -> "628123456789", "+62 812..." -> "62812..."
 */
export function normalizeWaPhone(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
}

