import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';

export type ResolvedPaymentState = 'lunas' | 'invoiced_unpaid' | 'uninvoiced';

export interface ResolvedTransactionPayment {
    state: ResolvedPaymentState;
    isPaid: boolean;
    isOverdue: boolean;
    linkedInvoice: Invoice | null;
    displayInvoiceNumber: string;
    paidVia: 'invoice' | 'direct' | null;
    paymentLabel: string;
    paidAt?: Date;
    paidBy?: string;
    paymentMethod?: string;
    effectiveAmount: number;
}

export interface InvoiceLookup {
    byTransactionId: Map<string, Invoice>;
    byInvoiceId: Map<string, Invoice>;
    byInvoiceNumber: Map<string, Invoice>;
}

export interface VoyagePaymentSummary {
    totalSttCount: number;
    paidCount: number;
    invoicedUnpaidCount: number;
    uninvoicedCount: number;
    unpaidCount: number;
    totalRevenue: number;
    paidRevenue: number;
    unpaidRevenue: number;
    collectionPercent: number;
    linkedInvoices: Invoice[];
}

export const getTransactionEffectiveAmount = (tx: Transaction): number => {
    const subtotal = Number(tx.jumlah) || 0;
    const ppn = tx.isTaxable || (tx.ppn && Number(tx.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
    return subtotal + ppn;
};

export const isTransactionDirectlyPaid = (tx: Transaction): boolean => {
    const pel = (tx.pelunasan || '').toString().trim().toLowerCase();
    return pel === 'cash' || pel === 'tf' || pel === 'lunas' || pel.includes('transfer');
};

export const buildInvoiceLookup = (invoices: Invoice[]): InvoiceLookup => {
    const byTransactionId = new Map<string, Invoice>();
    const byInvoiceId = new Map<string, Invoice>();
    const byInvoiceNumber = new Map<string, Invoice>();

    const activeInvoices = invoices.filter(inv => inv.status !== 'Cancelled');

    // Sort so 'Paid' invoices take precedence if duplicate refs ever exist, otherwise newest issueDate
    const sorted = [...activeInvoices].sort((a, b) => {
        if (a.status === 'Paid' && b.status !== 'Paid') return -1;
        if (b.status === 'Paid' && a.status !== 'Paid') return 1;
        const dateA = a.issueDate instanceof Date ? a.issueDate.getTime() : new Date(a.issueDate).getTime();
        const dateB = b.issueDate instanceof Date ? b.issueDate.getTime() : new Date(b.issueDate).getTime();
        return (dateB || 0) - (dateA || 0);
    });

    sorted.forEach(inv => {
        byInvoiceId.set(inv.id, inv);

        const invNoKey = (inv.invoiceNumber || '').trim().toLowerCase();
        if (invNoKey && !byInvoiceNumber.has(invNoKey)) {
            byInvoiceNumber.set(invNoKey, inv);
        }

        (inv.transactionIds || []).forEach(txId => {
            if (txId && !byTransactionId.has(txId)) {
                byTransactionId.set(txId, inv);
            }
        });
    });

    return { byTransactionId, byInvoiceId, byInvoiceNumber };
};

export const resolveTransactionPaymentInfo = (
    tx: Transaction,
    lookup: InvoiceLookup,
    todayStart?: Date
): ResolvedTransactionPayment => {
    const invFromTxIds = lookup.byTransactionId.get(tx.id);
    const invFromInvoiceId = tx.invoiceId ? lookup.byInvoiceId.get(tx.invoiceId) : undefined;
    const invFromInvNum = tx.invoiceNumber?.trim()
        ? lookup.byInvoiceNumber.get(tx.invoiceNumber.trim().toLowerCase())
        : undefined;
    const invFromNoInvoice = tx.noInvoice?.trim()
        ? lookup.byInvoiceNumber.get(tx.noInvoice.trim().toLowerCase())
        : undefined;

    const linkedInvoice = invFromTxIds || invFromInvoiceId || invFromInvNum || invFromNoInvoice || null;

    const effectiveAmount = getTransactionEffectiveAmount(tx);
    const isPaidViaInvoice = linkedInvoice?.status === 'Paid';
    const isPaidDirect = isTransactionDirectlyPaid(tx);
    const isPaid = isPaidViaInvoice || isPaidDirect;

    let isOverdue = false;
    if (!isPaid && linkedInvoice?.dueDate) {
        const due = linkedInvoice.dueDate instanceof Date
            ? linkedInvoice.dueDate
            : new Date(linkedInvoice.dueDate);
        if (!isNaN(due.getTime())) {
            const refToday = todayStart || (() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                return d;
            })();
            isOverdue = due < refToday;
        }
    }

    const state: ResolvedPaymentState = isPaid
        ? 'lunas'
        : linkedInvoice
        ? 'invoiced_unpaid'
        : 'uninvoiced';

    const displayInvoiceNumber = linkedInvoice?.invoiceNumber || tx.invoiceNumber || tx.noInvoice || '-';

    let paidVia: 'invoice' | 'direct' | null = null;
    let paymentLabel = 'Belum Ada Invoice';
    let paidAt: Date | undefined;
    let paidBy: string | undefined;
    let paymentMethod: string | undefined;

    if (isPaid) {
        if (linkedInvoice && isPaidViaInvoice) {
            paidVia = 'invoice';
            paidAt = linkedInvoice.paidAt || linkedInvoice.paymentDate || linkedInvoice.updatedAt;
            paidBy = linkedInvoice.paidBy;
            paymentMethod = linkedInvoice.paymentMethod || (tx.pelunasan === 'TF' ? 'Transfer' : tx.pelunasan === 'Cash' ? 'Cash' : undefined);
            paymentLabel = `Lunas via Inv #${linkedInvoice.invoiceNumber}`;
        } else if (linkedInvoice) {
            paidVia = 'invoice';
            paymentMethod = tx.pelunasan === 'TF' ? 'Transfer' : 'Cash';
            paymentLabel = `Lunas (${paymentMethod}) • Inv #${linkedInvoice.invoiceNumber}`;
        } else {
            paidVia = 'direct';
            paymentMethod = tx.pelunasan === 'TF' ? 'Transfer' : 'Cash';
            paymentLabel = `Lunas Langsung (${paymentMethod})`;
        }
    } else if (linkedInvoice) {
        paymentLabel = isOverdue
            ? `Jatuh Tempo • Inv #${linkedInvoice.invoiceNumber}`
            : `Belum Lunas • Inv #${linkedInvoice.invoiceNumber}`;
    } else {
        paymentLabel = 'Belum Ada Invoice';
    }

    return {
        state,
        isPaid,
        isOverdue,
        linkedInvoice,
        displayInvoiceNumber,
        paidVia,
        paymentLabel,
        paidAt,
        paidBy,
        paymentMethod,
        effectiveAmount,
    };
};

export const summarizeVoyagePayments = (
    linkedTransactions: Transaction[],
    lookup: InvoiceLookup
): VoyagePaymentSummary => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let paidCount = 0;
    let invoicedUnpaidCount = 0;
    let uninvoicedCount = 0;
    let totalRevenue = 0;
    let paidRevenue = 0;
    let unpaidRevenue = 0;

    const invMap = new Map<string, Invoice>();

    linkedTransactions.forEach(tx => {
        const info = resolveTransactionPaymentInfo(tx, lookup, today);
        totalRevenue += info.effectiveAmount;

        if (info.linkedInvoice) {
            invMap.set(info.linkedInvoice.id, info.linkedInvoice);
        }

        if (info.isPaid) {
            paidCount++;
            paidRevenue += info.effectiveAmount;
        } else {
            unpaidRevenue += info.effectiveAmount;
            if (info.state === 'invoiced_unpaid') {
                invoicedUnpaidCount++;
            } else {
                uninvoicedCount++;
            }
        }
    });

    const totalSttCount = linkedTransactions.length;
    const unpaidCount = invoicedUnpaidCount + uninvoicedCount;
    const collectionPercent = totalSttCount > 0 ? Math.round((paidCount / totalSttCount) * 100) : 0;

    return {
        totalSttCount,
        paidCount,
        invoicedUnpaidCount,
        uninvoicedCount,
        unpaidCount,
        totalRevenue,
        paidRevenue,
        unpaidRevenue,
        collectionPercent,
        linkedInvoices: Array.from(invMap.values()),
    };
};

