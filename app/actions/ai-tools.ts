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

// Branch Info Map for STT generation
const BRANCHES_MAP: Record<string, { displayName: string, initialCounter: number }> = {
    surabaya: {
        displayName: 'Surabaya (Pusat)',
        initialCounter: 17641  // Next will be 17642
    },
    bandung: {
        displayName: 'Bandung',
        initialCounter: 1032   // Next will be 1033
    },
    makassar: {
        displayName: 'Makassar',
        initialCounter: 550    // Next will be 00551
    }
};

// --- Tool 5: Search Clients ---
export async function tool_search_clients(keyword: string) {
    try {
        const snapshot = await adminDb.collection('clients').get();
        const term = keyword.toLowerCase().trim();
        const clients = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                phone: data.phone || '',
                address: data.address || '',
                city: data.city || '',
            };
        });

        if (!term) return clients;

        const filtered = clients.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.phone.toLowerCase().includes(term) ||
            c.city.toLowerCase().includes(term) ||
            c.address.toLowerCase().includes(term)
        );

        return filtered;
    } catch (error: any) {
        console.error('Error in tool_search_clients:', error);
        return { error: error.message };
    }
}

// --- Tool 6: Create Client ---
export async function tool_create_client(
    name: string,
    phone: string = '',
    address: string = '',
    city: string = '',
    userId: string = 'system-ai'
) {
    try {
        if (!name.trim()) {
            return { error: 'Nama client tidak boleh kosong.' };
        }

        const now = Timestamp.now();
        const clientData = {
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            city: city.trim(),
            notes: 'Daftar otomatis via Agent Cahaya',
            userId,
            createdAt: now,
            updatedAt: now,
        };

        const docRef = await adminDb.collection('clients').add(clientData);
        return {
            success: true,
            id: docRef.id,
            name: clientData.name,
            message: `Client '${clientData.name}' berhasil didaftarkan secara otomatis.`
        };
    } catch (error: any) {
        console.error('Error in tool_create_client:', error);
        return { error: error.message };
    }
}

// --- Tool 7: Create Transaction (Buat Resi) ---
export async function tool_create_transaction(params: {
    branch?: string;
    tanggal?: string;
    tujuan: string;
    pengirimId: string;
    penerimaName: string;
    penerimaPhone?: string;
    penerimaAddress?: string;
    penerimaCity?: string;
    koli?: number;
    berat?: number;
    beratUnit?: string;
    tipeTransaksi?: string;
    harga?: number;
    jumlah?: number;
    pembayaran?: string;
    pelunasan?: string;
    isiBarang?: string;
    keterangan?: string;
    isTaxable?: boolean;
    userId?: string;
}) {
    try {
        const {
            branch = 'surabaya',
            tanggal,
            tujuan,
            pengirimId,
            penerimaName,
            penerimaPhone = '',
            penerimaAddress = '',
            penerimaCity = '',
            koli = 1,
            berat = 0,
            beratUnit = 'KG',
            tipeTransaksi = 'regular',
            harga = 0,
            jumlah = 0,
            pembayaran = 'Tunai',
            pelunasan = 'Pending',
            isiBarang = '',
            keterangan = '',
            isTaxable = false,
            userId = 'system-ai'
        } = params;

        if (!pengirimId) return { error: 'Pengirim ID harus disertakan.' };
        if (!penerimaName) return { error: 'Nama penerima harus diisi.' };
        if (!tujuan) return { error: 'Tujuan pengiriman harus diisi.' };

        // Fetch pengirim client data
        const clientSnap = await adminDb.collection('clients').doc(pengirimId).get();
        if (!clientSnap.exists) {
            return { error: `Client pengirim dengan ID '${pengirimId}' tidak ditemukan.` };
        }
        const clientData = clientSnap.data() || {};

        // Calculate totals based on transaction type
        let finalJumlah = Number(jumlah);
        if (tipeTransaksi === 'regular') {
            finalJumlah = Number(harga) * Number(berat);
        }

        // Calculate tax (PPN 1.1%)
        const ppnRate = isTaxable ? 0.011 : 0;
        const ppn = isTaxable ? Math.round(finalJumlah * ppnRate) : 0;

        const branchInfo = BRANCHES_MAP[branch] || BRANCHES_MAP['surabaya'];
        const counterRef = adminDb.collection('metadata').doc('stt_counters');
        const invoiceCounterRef = adminDb.collection('metadata').doc('invoice_counters');
        const counterKey = isTaxable ? 'global_pkp' : 'global';

        // Run transaction to generate unique STT and Invoice numbers
        const numbers = await adminDb.runTransaction(async (dbTx) => {
            // 1. Get STT Counter
            const counterDoc = await dbTx.get(counterRef);
            let currentNumber = branchInfo.initialCounter + 1;
            if (counterDoc.exists) {
                const data = counterDoc.data() || {};
                const counterData = data[branch] || {};
                const existingNumber = counterData.currentNumber || branchInfo.initialCounter;
                currentNumber = existingNumber + 1;
            }

            // 2. Get Invoice Counter
            const invoiceDoc = await dbTx.get(invoiceCounterRef);
            let nextInvoice = isTaxable ? 5177 : 12366;
            if (invoiceDoc.exists) {
                const data = invoiceDoc.data() || {};
                const lastNumber = isTaxable
                    ? (data[counterKey]?.currentNumber || 5176)
                    : (data[counterKey]?.currentNumber || 12365);
                nextInvoice = lastNumber + 1;
            }

            // Update counters in database
            dbTx.set(counterRef, {
                [branch]: {
                    currentNumber,
                    prefix: 'STT',
                    branchName: branchInfo.displayName,
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            dbTx.set(invoiceCounterRef, {
                [counterKey]: {
                    currentNumber: nextInvoice,
                    prefix: isTaxable ? 'INV-PKP' : 'INV',
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            return { currentNumber, nextInvoice };
        });

        const sttNumber = `STT${String(numbers.currentNumber).padStart(6, '0')}`;
        const invoiceNumber = isTaxable
            ? `INV-PKP${String(numbers.nextInvoice).padStart(5, '0')}`
            : `INV${String(numbers.nextInvoice).padStart(6, '0')}`;

        const now = Timestamp.now();
        let tanggalTimestamp = now;
        if (tanggal) {
            tanggalTimestamp = Timestamp.fromDate(new Date(tanggal));
        }

        const transactionDoc = {
            userId,
            branch,
            tanggal: tanggalTimestamp,
            tujuan,
            noSTT: sttNumber,

            // Pengirim
            pengirimId,
            pengirimName: clientData.name || '',
            pengirimPhone: clientData.phone || '',
            pengirimAddress: clientData.address || '',
            pengirimCity: clientData.city || '',

            // Penerima
            penerimaId: '',
            penerimaName: penerimaName.trim(),
            penerimaPhone: penerimaPhone.trim(),
            penerimaAddress: penerimaAddress.trim(),
            penerimaCity: penerimaCity.trim(),

            koli: Number(koli),
            berat: Number(berat),
            beratUnit,
            tipeTransaksi,
            harga: Number(harga),
            jumlah: finalJumlah,

            isTaxable,
            ppnRate,
            ppn,

            noInvoice: invoiceNumber,
            pembayaran,
            pelunasan,
            keterangan,
            isiBarang,
            status: 'pending',
            statusHistory: [{
                status: 'pending',
                timestamp: now,
                catatan: 'Transaksi dibuat otomatis via Agent Cahaya',
            }],
            createdAt: now,
            updatedAt: now,
        };

        const txRef = await adminDb.collection('transactions').add(transactionDoc);

        return {
            success: true,
            id: txRef.id,
            noSTT: sttNumber,
            noInvoice: invoiceNumber,
            pengirimName: clientData.name,
            penerimaName: penerimaName,
            jumlah: finalJumlah,
            ppn: ppn,
            message: `Berhasil mencatat resi ${sttNumber} (Invoice: ${invoiceNumber})`
        };

    } catch (error: any) {
        console.error('Error in tool_create_transaction:', error);
        return { error: error.message };
    }
}
