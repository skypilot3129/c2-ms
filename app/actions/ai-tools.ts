'use server';

import { adminDb } from '@/lib/firebase-admin';
import { formatRupiah } from '@/lib/currency';
import { Timestamp } from 'firebase-admin/firestore';

// --- Tool 1: Dashboard Summary ---
export async function tool_get_dashboard_summary(startDateStr?: string, endDateStr?: string) {
    try {
        const now = new Date();
        const start = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
        const end = endDateStr ? new Date(endDateStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Fetching Transactions via Admin SDK
        // Note: Admin SDK doesn't use the 'query' modular syntax the same way for these helpers
        // We will implement a simplified version of getDashboardStats here directly for the AI
        // efficiently using Admin SDK.

        const txSnap = await adminDb.collection('transactions').get();
        const expSnap = await adminDb.collection('expenses').get();

        const transactions = txSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                amount: data.jumlah || 0,
                status: data.status,
                createdAt: data.createdAt?.toDate() || new Date(),
                pengirimName: data.pengirimName
            };
        });

        const expenses = expSnap.docs.map(doc => {
            const data = doc.data();
            return {
                amount: data.amount || 0,
                date: data.date?.toDate() || new Date(),
            };
        });

        // Filtering
        const currentTx = transactions.filter(t => t.createdAt >= start && t.createdAt <= end && t.status !== 'dibatalkan');
        const currentExp = expenses.filter(e => e.date >= start && e.date <= end);

        const totalRevenue = currentTx.reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = currentExp.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalRevenue - totalExpenses;
        const activeShipments = transactions.filter(t => ['pending', 'diproses', 'dikirim'].includes(t.status)).length;

        // Top Clients (Simplified)
        const clientMap = new Map<string, number>();
        currentTx.forEach(t => {
            const name = t.pengirimName || 'Unknown';
            clientMap.set(name, (clientMap.get(name) || 0) + t.amount);
        });
        const topClients = Array.from(clientMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, amount]) => `${name} (${formatRupiah(amount)})`);

        // Status Counts
        const statusCounts: Record<string, number> = {};
        currentTx.forEach(t => {
            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        });
        const statusSummary = Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`);

        return {
            period: `${start.toLocaleDateString('id-ID')} s/d ${end.toLocaleDateString('id-ID')}`,
            summary: {
                pendapatan: formatRupiah(totalRevenue),
                pengeluaran: formatRupiah(totalExpenses),
                profit_bersih: formatRupiah(netProfit),
                transaksi_aktif: activeShipments
            },
            status_pengiriman: statusSummary,
            top_pelanggan: topClients
        };

    } catch (error: any) {
        console.error('Error in tool_get_dashboard_summary:', error);
        return { error: `Gagal akses data: ${error.message}` };
    }
}

// --- Tool 2: Transaction Stats ---
export async function tool_get_transaction_stats(startDateStr?: string, endDateStr?: string) {
    try {
        const now = new Date();
        const start = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
        const end = endDateStr ? new Date(endDateStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const snapshot = await adminDb.collection('transactions').get();
        const transactions = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    status: data.status,
                    pelunasan: data.pelunasan,
                    noInvoice: data.noInvoice,
                    jumlah: data.jumlah || 0
                };
            })
            .filter(t => t.createdAt >= start && t.createdAt <= end && t.status !== 'dibatalkan');

        let totalUnpaid = 0;
        let countUnpaid = 0;
        let countPaid = 0;
        let countReadyToBill = 0;
        let totalReadyToBill = 0;

        transactions.forEach(t => {
            const isPaid = t.pelunasan === 'Cash' || t.pelunasan === 'TF';
            const hasInvoice = t.noInvoice && t.noInvoice.length > 0;

            if (isPaid) {
                countPaid++;
            } else {
                countUnpaid++;
                totalUnpaid += t.jumlah;
            }

            if (!hasInvoice) {
                countReadyToBill++;
                totalReadyToBill += t.jumlah;
            }
        });

        return {
            period: `${start.toLocaleDateString('id-ID')} s/d ${end.toLocaleDateString('id-ID')}`,
            total_transaksi: transactions.length,
            analisis_keuangan: {
                sudah_lunas: `${countPaid} resi`,
                belum_lunas: `${countUnpaid} resi (Total: ${formatRupiah(totalUnpaid)})`,
                belum_diinvoice: `${countReadyToBill} resi (Potensi Tagihan: ${formatRupiah(totalReadyToBill)})`
            }
        };

    } catch (error: any) {
        return { error: error.message };
    }
}

// --- Tool 3: Search Transaction ---
export async function tool_search_transaction(keyword: string) {
    try {
        const snapshot = await adminDb.collection('transactions')
            .where('noSTT', '==', keyword)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            // Get last history item safely
            const lastHistory = data.statusHistory && data.statusHistory.length > 0
                ? data.statusHistory[data.statusHistory.length - 1]
                : null;

            return {
                found: true,
                type: 'STT',
                data: {
                    no_stt: data.noSTT,
                    pengirim: data.pengirimName,
                    penerima: data.penerimaName,
                    status: data.status,
                    tanggal: data.createdAt?.toDate().toLocaleDateString('id-ID'),
                    posisi: lastHistory ? lastHistory.catatan : 'Tidak ada catatan'
                }
            };
        }

        return { found: false, message: `Tidak ditemukan transaksi dengan nomor STT '${keyword}'` };

    } catch (error: any) {
        return { error: error.message };
    }
}

// --- Tool 4: Recent Transactions ---
export async function tool_get_recent_transactions(limitCount: number = 5) {
    try {
        const snapshot = await adminDb.collection('transactions')
            .orderBy('createdAt', 'desc')
            .limit(limitCount)
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                no_stt: data.noSTT,
                pengirim: data.pengirimName,
                tujuan: data.tujuan,
                status: data.status,
                tanggal: data.createdAt?.toDate().toLocaleDateString('id-ID')
            };
        });
    } catch (error: any) {
        return { error: error.message };
    }
}
