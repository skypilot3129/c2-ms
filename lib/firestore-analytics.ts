/**
 * Analytics functions for Dashboard BI
 */

import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy,
    limit
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction } from '@/types/transaction';
import type { Expense } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';

export interface DashboardStats {
    // Financials with trends
    totalRevenue: number;
    previousRevenue: number;
    revenueGrowth: number; // Percentage

    totalExpenses: number;
    previousExpenses: number;
    expensesGrowth: number; // Percentage

    netProfit: number;
    previousProfit: number;
    profitGrowth: number; // Percentage

    // Operations
    activeShipments: number;

    // Charts & Lists
    recentActivity: Array<{
        id: string;
        type: 'transaction' | 'expense';
        description: string;
        amount: number;
        date: Date;
        status?: string;
    }>;

    // Period Stats (Daily or Monthly depending on range)
    periodStats: Array<{
        name: string;
        date: string; // ISO date for sorting
        revenue: number;
        expenses: number;
    }>;

    shipmentStatusStats: Array<{
        name: string;
        value: number;
        color: string;
    }>;

    // Advanced Reporting
    topClients: Array<{
        id: string;
        name: string;
        revenue: number;
        transactionCount: number;
    }>;

    routeProfitability: Array<{
        route: string;
        revenue: number;
        expenses: number;
        profit: number;
        margin: number;
        shipmentCount: number;
    }>;
}

/**
 * Filter items by date range
 */
const filterByDate = <T extends { date: Date }>(items: T[], start: Date, end: Date) => {
    return items.filter(item => item.date >= start && item.date <= end);
};

/**
 * Calculate growth percentage
 */
const calculateGrowth = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

/**
 * Get aggregated dashboard stats for a user with date range
 */
export const getDashboardStats = async (
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<DashboardStats> => {
    // Default to this month if no dates provided
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Calculate previous period for comparison
    const duration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - duration);
    const prevEnd = new Date(start.getTime() - 1);

    // 1. Fetch ALL data (Optimization: In production, use compound queries to filter on server)
    const txQuery = query(collection(db, 'transactions'));
    // const txQuery = query(collection(db, 'transactions'), where('userId', '==', userId));
    const txSnapshot = await getDocs(txQuery);
    const allTransactions = txSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Map 'tanggal' or 'createdAt' to 'date' for uniform filtering
        date: doc.data().createdAt?.toDate() || new Date(),
        amount: doc.data().jumlah || 0,
        status: doc.data().status,
        pengirimName: doc.data().pengirimName || 'Unknown',
        // We really should link transactions to routes/voyages for route profitability
        // But transactions don't strictly have a route field on themselves in the current model, 
        // they are assigned to voyages. 
        // However, we can try to infer or use the voyage lookup if needed. 
        // Actually, let's check if transaction has 'tujuan'.
        tujuan: doc.data().tujuan,
        noSTT: doc.data().noSTT
    })) as any[];

    const expQuery = query(collection(db, 'expenses'));
    // const expQuery = query(collection(db, 'expenses'), where('userId', '==', userId));
    const expSnapshot = await getDocs(expQuery);
    const allExpenses = expSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        amount: doc.data().amount || 0,
        category: doc.data().category,
        voyageId: doc.data().voyageId // Linked to voyage
    })) as any[];


    // --- Current Period Data ---
    const currentTx = filterByDate(allTransactions, start, end).filter(t => t.status !== 'dibatalkan');
    const currentExp = filterByDate(allExpenses, start, end);

    // --- Previous Period Data ---
    const prevTx = filterByDate(allTransactions, prevStart, prevEnd).filter(t => t.status !== 'dibatalkan');
    const prevExp = filterByDate(allExpenses, prevStart, prevEnd);

    // 2. Financials
    const totalRevenue = currentTx.reduce((sum, t) => sum + t.amount, 0);
    const previousRevenue = prevTx.reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = currentExp.reduce((sum, e) => sum + e.amount, 0);
    const previousExpenses = prevExp.reduce((sum, e) => sum + e.amount, 0);

    const netProfit = totalRevenue - totalExpenses;
    const previousProfit = previousRevenue - previousExpenses;

    // 3. Operational Stats
    const activeShipments = allTransactions.filter(t =>
        ['pending', 'diproses', 'dikirim'].includes(t.status)
    ).length;

    const statusCounts = { pending: 0, diproses: 0, dikirim: 0, selesai: 0, dibatalkan: 0 };
    // Status stats usually reflect ALL active or recent state, but let's scope it to the selected period
    // so user can see "How many shipments were completed THIS MONTH"
    currentTx.forEach(t => {
        if (statusCounts[t.status as keyof typeof statusCounts] !== undefined) {
            statusCounts[t.status as keyof typeof statusCounts]++;
        }
    });
    // Also include filtered-out cancelled ones for the chart
    filterByDate(allTransactions, start, end).filter(t => t.status === 'dibatalkan').forEach(() => statusCounts.dibatalkan++);

    const shipmentStatusStats = [
        { name: 'Pending', value: statusCounts.pending, color: '#F59E0B' },
        { name: 'Diproses', value: statusCounts.diproses, color: '#3B82F6' },
        { name: 'Dikirim', value: statusCounts.dikirim, color: '#8B5CF6' },
        { name: 'Selesai', value: statusCounts.selesai, color: '#10B981' },
        { name: 'Dibatalkan', value: statusCounts.dibatalkan, color: '#EF4444' }
    ].filter(s => s.value > 0);

    // 4. Period Stats (Chart)
    // If range <= 31 days, show Daily. Else show Monthly.
    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    const isDaily = dayDiff <= 31;

    const statsMap = new Map<string, { revenue: number, expenses: number, date: string, name: string }>();

    const formatDateKey = (d: Date) => {
        if (isDaily) return {
            key: d.toLocaleDateString('en-CA'), // YYYY-MM-DD
            label: d.getDate().toString()
        };
        return {
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: d.toLocaleDateString('id-ID', { month: 'short' })
        };
    };

    // Initialize map with 0s for the whole range? 
    // For simplicity, we just aggregate what we have, but sorting will fix order.
    // Better: Helper to generate keys? Let's stick to sparse data for now to save logic complexity.

    currentTx.forEach(t => {
        const { key, label } = formatDateKey(t.date);
        const curr = statsMap.get(key) || { revenue: 0, expenses: 0, date: key, name: label };
        curr.revenue += t.amount;
        statsMap.set(key, curr);
    });

    currentExp.forEach(e => {
        const { key, label } = formatDateKey(e.date);
        const curr = statsMap.get(key) || { revenue: 0, expenses: 0, date: key, name: label };
        curr.expenses += e.amount;
        statsMap.set(key, curr);
    });

    const periodStats = Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 5. Top Clients (by Revenue)
    const clientMap = new Map<string, { id: string, name: string, revenue: number, transactionCount: number }>();
    currentTx.forEach(t => {
        const name = t.pengirimName;
        const curr = clientMap.get(name) || { id: name, name, revenue: 0, transactionCount: 0 };
        curr.revenue += t.amount;
        curr.transactionCount += 1;
        clientMap.set(name, curr);
    });
    const topClients = Array.from(clientMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // 6. Route Profitability
    // We need to fetch Voyages to get routes. 
    // And link Expenses (via voyageId) and Transactions (via voyage transaction assignment).
    // This is getting complex because Transactions in `allTransactions` might not have `voyageId` populated directly 
    // if we didn't store it on the transaction doc. 
    // In our system, Voyage has `transactionIds`. Transaction DOES NOT have `voyageId`.
    // So we need to fetch Voyages for this user.

    const voyageQuery = query(collection(db, 'voyages'));
    // const voyageQuery = query(collection(db, 'voyages'), where('userId', '==', userId));
    const voyageSnapshot = await getDocs(voyageQuery);
    const validVoyageIds = new Set<string>(); // Voyages that fall within or overlap the period? 
    // Or just strictly analyze voyages that DEPARTED in this period.

    const currentVoyages = voyageSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        departureDate: doc.data().departureDate // String YYYY-MM-DD
    })).filter((v: any) => {
        const d = new Date(v.departureDate);
        return d >= start && d <= end;
    });

    const routeMap = new Map<string, { route: string, revenue: number, expenses: number, count: number }>();

    // For each relevant voyage, calculate stats
    for (const v of currentVoyages as any[]) {
        const route = v.route;

        // Revenue: Sum of transactions in this voyage
        // Optimization: Create a lookup map for allTransactions by ID first
        const voyageTxAmount = (v.transactionIds || []).reduce((sum: number, txId: string) => {
            const tx = allTransactions.find(t => t.id === txId);
            return sum + (tx ? tx.amount : 0);
        }, 0);

        // Expenses: Sum of expenses with this voyageId
        const voyageExpAmount = allExpenses
            .filter(e => e.voyageId === v.id)
            .reduce((sum, e) => sum + e.amount, 0);

        const curr = routeMap.get(route) || { route, revenue: 0, expenses: 0, count: 0 };
        curr.revenue += voyageTxAmount;
        curr.expenses += voyageExpAmount;
        curr.count += 1;
        routeMap.set(route, curr);
    }

    const routeProfitability = Array.from(routeMap.values()).map(r => ({
        ...r,
        profit: r.revenue - r.expenses,
        margin: r.revenue > 0 ? ((r.revenue - r.expenses) / r.revenue) * 100 : 0,
        shipmentCount: r.count // This is essentially "voyage count" here, not shipment count. Renaming variable?
        // Actually let's keep it count of voyages for that route
    })).sort((a, b) => b.profit - a.profit);


    // 7. Recent Activity (Current Period only)
    const recentTx = currentTx
        .map(t => ({
            id: t.id,
            type: 'transaction' as const,
            description: `Kargo - ${t.noSTT}`,
            amount: t.amount,
            date: t.date,
            status: t.status
        }));
    const recentExp = currentExp
        .map(e => ({
            id: e.id,
            type: 'expense' as const,
            description: `Expense - ${EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category}`,
            amount: -e.amount,
            date: e.date,
            status: 'completed'
        }));

    const recentActivity = [...recentTx, ...recentExp]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10); // Increase to 10

    return {
        totalRevenue,
        previousRevenue,
        revenueGrowth: calculateGrowth(totalRevenue, previousRevenue),

        totalExpenses,
        previousExpenses,
        expensesGrowth: calculateGrowth(totalExpenses, previousExpenses),

        netProfit,
        previousProfit,
        profitGrowth: calculateGrowth(netProfit, previousProfit),

        activeShipments,
        recentActivity,
        periodStats, // Replaces monthlyStats
        shipmentStatusStats,

        topClients,
        routeProfitability
    };
};

/**
 * Generate CSV from dashboard stats
 */
export const generateCSV = (stats: DashboardStats, rangeLabel: string): string => {
    // 1. Summary Section
    let csv = `Laporan Dashboard C2-MS\n`;
    csv += `Periode,${rangeLabel}\n`;
    csv += `Total Pendapatan,${stats.totalRevenue}\n`;
    csv += `Total Pengeluaran,${stats.totalExpenses}\n`;
    csv += `Profit Bersih,${stats.netProfit}\n\n`;

    // 2. Daily/Monthly Stats
    csv += `Rincian Per Periode\n`;
    csv += `Tanggal/Bulan,Pendapatan,Pengeluaran\n`;
    stats.periodStats.forEach(row => {
        csv += `${row.name},${row.revenue},${row.expenses}\n`;
    });
    csv += `\n`;

    // 3. Top Clients
    csv += `Top 5 Pelanggan\n`;
    csv += `Nama,Jumlah Transaksi,Total Pendapatan\n`;
    stats.topClients.forEach(client => {
        csv += `${client.name},${client.transactionCount},${client.revenue}\n`;
    });
    csv += `\n`;

    // 4. Route Profitability
    csv += `Profitabilitas Rute\n`;
    csv += `Rute,Margin (%),Profit\n`;
    stats.routeProfitability.forEach(route => {
        csv += `${route.route},${route.margin.toFixed(2)}%,${route.profit}\n`;
    });

    return csv;
};
