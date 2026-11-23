import type { Branch } from './branch';
import type { UserRole } from './roles';
import type { BeratUnit, CaraPelunasan, MetodePembayaran, TipeTransaksi } from './transaction';

export type WaAgentRole = UserRole;

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
    modelName: 'gemini-2.5-flash',
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

