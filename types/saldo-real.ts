export type RealBankAccount = 'perusahaan' | 'mandiri' | 'bri' | 'bca';

export type RealMutationType = 'in' | 'out' | 'transfer';

export type RealMutationSource = 'manual' | 'penagihan_ika' | 'transfer';

export interface BankAccountInfo {
    id: RealBankAccount;
    name: string;
    accountNumber: string;
    accountHolder: string;
    shortName: string;
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    gradient: string;
}

export const REAL_BANK_ACCOUNTS: Record<RealBankAccount, BankAccountInfo> = {
    perusahaan: {
        id: 'perusahaan',
        name: 'Bank Perusahaan (Kas Utama)',
        accountNumber: 'KAS-UTAMA',
        accountHolder: 'CV. CAHAYA CARGO EXPRESS',
        shortName: 'Perusahaan',
        color: 'slate',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
        textColor: 'text-slate-800',
        gradient: 'from-slate-800 to-slate-950',
    },
    bca: {
        id: 'bca',
        name: 'Bank BCA',
        accountNumber: '1870444342',
        accountHolder: 'MARTINI',
        shortName: 'BCA',
        color: 'blue',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        textColor: 'text-blue-700',
        gradient: 'from-blue-700 to-indigo-900',
    },
    bri: {
        id: 'bri',
        name: 'Bank BRI',
        accountNumber: '0328 0107 3891 501',
        accountHolder: 'MARTINI',
        shortName: 'BRI',
        color: 'sky',
        bgColor: 'bg-sky-50',
        borderColor: 'border-sky-300',
        textColor: 'text-sky-700',
        gradient: 'from-sky-600 to-blue-800',
    },
    mandiri: {
        id: 'mandiri',
        name: 'Bank Mandiri',
        accountNumber: '14000 2408 7851',
        accountHolder: 'MARTINI',
        shortName: 'Mandiri',
        color: 'amber',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-300',
        textColor: 'text-amber-700',
        gradient: 'from-amber-600 to-yellow-800',
    },
};

export const IKA_SYNC_START_DATE = '2026-08-23';

export interface RealBalanceSettings {
    id?: string;
    userId?: string;
    modalAwalPerusahaan: number;
    modalAwalBca: number;
    modalAwalBri: number;
    modalAwalMandiri: number;
    effectiveDate?: string;
    updatedAt?: Date;
    updatedBy?: string;
}

export interface RealBalanceMutation {
    id: string;
    userId: string;
    date: string; // YYYY-MM-DD
    type: RealMutationType; // 'in' | 'out' | 'transfer'
    source: RealMutationSource; // 'manual' | 'penagihan_ika' | 'transfer'
    bank: RealBankAccount;
    targetBank?: RealBankAccount; // for transfer
    amount: number;
    category: string; // 'Penagihan IKA', 'Setoran Tunai', 'Penarikan Kas', 'Operasional', 'Pindah Saldo', dll.
    description: string;
    refNumber?: string; // No Resi, No Invoice, No Referensi Bank
    invoiceId?: string; // ID invoice jika dari Penagihan IKA
    clientName?: string;
    paidBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface RealBalanceSummary {
    bank: RealBankAccount;
    info: BankAccountInfo;
    modalAwal: number;
    totalIn: number;
    totalOut: number;
    saldoReal: number;
}
