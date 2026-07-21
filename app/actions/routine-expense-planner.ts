'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface RoutineCategoryStat {
    category: string;
    categoryLabel: string;
    avgMonthly: number;
    transactionCount: number;
    lastDate: string;
    frequencyLabel: string;
}

export interface ScheduledRoutineItem {
    id: string;
    targetDate: string; // YYYY-MM-DD or "Setiap Tanggal X"
    categoryLabel: string;
    description: string;
    estimatedAmount: number;
    priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
    cycle: 'Harian' | 'Mingguan' | 'Bulanan' | 'Insidental';
    notes: string;
}

export interface RoutinePlannerPayload {
    targetPeriodLabel: string; // e.g. "Agustus 2026"
    totalHistoricalExpenses: number;
    routineCategories: RoutineCategoryStat[];
    recentExpenses: Array<{
        description: string;
        categoryLabel: string;
        amount: number;
        date: string;
    }>;
}

export interface RoutinePlannerResult {
    executiveSummary: string;
    totalProjectedRoutineCost: number;
    scheduledItems: ScheduledRoutineItem[];
    optimizationStrategies: string[];
    cashFlowAdvice: string;
    error?: string;
}

const apiKey = process.env.GEMINI_API_KEY;

export async function generateRoutineExpensePlanWithGemini(
    payload: RoutinePlannerPayload
): Promise<RoutinePlannerResult> {
    if (!apiKey) {
        return {
            executiveSummary: "API Key Gemini belum dikonfigurasi di environment variables.",
            totalProjectedRoutineCost: 0,
            scheduledItems: [],
            optimizationStrategies: ["Pastikan GEMINI_API_KEY diset di .env.local."],
            cashFlowAdvice: "Membutuhkan GEMINI_API_KEY untuk pemrosesan AI.",
            error: "GEMINI_API_KEY missing"
        };
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
Anda adalah seorang Chief Financial Officer (CFO) & Perencana Keuangan Ekspedisi Logistik "CV. CAHAYA CARGO EXPRESS".

Tugas Anda: Buatkan **ANALISA PENGELUARAN RUTIN** dan **RENCANA JADWAL DETAILED PENGELUARAN RUTIN** untuk periode mendatang: **${payload.targetPeriodLabel}** berdasarkan histori data pengeluaran kas kecil perusahaan.

DATA HISTORI PENGELUARAN RUTIN:
- Total Pengeluaran Histori: Rp ${payload.totalHistoricalExpenses.toLocaleString('id-ID')}
- Pola Pengeluaran per Kategori:
${payload.routineCategories.map(c => `- ${c.categoryLabel}: Rata-rata Rp ${c.avgMonthly.toLocaleString('id-ID')}/bulan (${c.transactionCount}x transaksi, frekuensi: ${c.frequencyLabel}, terakhir: ${c.lastDate})`).join('\n')}

TRANSAKSI TERAKHIR SEBAGAI ACUAN:
${payload.recentExpenses.slice(0, 10).map((e, idx) => `${idx + 1}. [${e.date}] ${e.description} (${e.categoryLabel}) - Rp ${e.amount.toLocaleString('id-ID')}`).join('\n')}

Instruksi Tugas:
1. Analisa beban pengeluaran rutin operasional (seperti BBM/Solar armada, gaji/uang makan sopir, listrik/air/internet kantor, sewa kantor/armada, maintenance rutin, ATK, retribusi/parkir/tol).
2. Buatkan **DAFTAR JADWAL RENCANA PENGELUARAN RUTIN MENDATANG** yang rinci untuk periode **${payload.targetPeriodLabel}** dengan perkiraan tanggal bayar, nominal estimasi, tingkat prioritas, dan siklusnya.
3. Berikan **STRATEGI EFISIENSI PENGELUARAN RUTIN** (3-4 langkah nyata).
4. Berikan **SARAN KONTROL ARUS KAS (CASH FLOW ADVICE)** untuk mencegah krisis likuiditas pada minggu-minggu pembayaran puncak.

Kembalikan respon DALAM FORMAT JSON VALID tanpa markdown codeblock wrapper lain (hanya JSON murni) dengan struktur persis seperti berikut:
{
  "executiveSummary": "Analisa rinci mengenai karakteristik dan total beban pengeluaran rutin perusahaan.",
  "totalProjectedRoutineCost": 15500000,
  "scheduledItems": [
    {
      "id": "sched-1",
      "targetDate": "Setiap Tanggal 5",
      "categoryLabel": "BBM/Solar",
      "description": "Pengisian BBM Solar Armada Trucking Rute Surabaya-Makassar",
      "estimatedAmount": 4500000,
      "priority": "TINGGI",
      "cycle": "Mingguan",
      "notes": "Pengisian dilakukan bertahap di SPBU resmi dengan nota digital."
    },
    {
      "id": "sched-2",
      "targetDate": "Setiap Tanggal 10",
      "categoryLabel": "Listrik/Air/Internet",
      "description": "Pembayaran Tagihan Listrik & Internet Fiber Optic Gudang Central",
      "estimatedAmount": 1200000,
      "priority": "TINGGI",
      "cycle": "Bulanan",
      "notes": "Bayar sebelum tanggal 15 untuk menghindari denda denda keterlambatan."
    }
  ],
  "optimizationStrategies": [
    "Strategi penghematan 1",
    "Strategi penghematan 2",
    "Strategi penghematan 3"
  ],
  "cashFlowAdvice": "Saran penjadwalan likuiditas kas kecil."
}

Catatan:
- Pastikan priority diisi salah satu dari: "TINGGI", "SEDANG", "RENDAH".
- Pastikan cycle diisi salah satu dari: "Harian", "Mingguan", "Bulanan", "Insidental".
- Gunakan bahasa Indonesia bisnis formal yang tajam, akurat, dan dapat dieksekusi oleh tim operasional keuangan.
`;

        const response = await model.generateContent(prompt);
        const textResponse = response.response.text();

        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as RoutinePlannerResult;
            return {
                executiveSummary: parsed.executiveSummary || "Rencana pengeluaran rutin berhasil disusun.",
                totalProjectedRoutineCost: parsed.totalProjectedRoutineCost || 0,
                scheduledItems: parsed.scheduledItems || [],
                optimizationStrategies: parsed.optimizationStrategies || [],
                cashFlowAdvice: parsed.cashFlowAdvice || "Jaga cadangan saldo kas kecil minimal 20% dari estimasi beban rutin.",
            };
        } else {
            throw new Error("Gagal menguraikan JSON dari balasan Gemini AI.");
        }
    } catch (error: any) {
        console.error("Error generating routine expense plan:", error);
        return {
            executiveSummary: "Terjadi kendala saat menghubungkan dengan AI Gemini.",
            totalProjectedRoutineCost: 0,
            scheduledItems: [],
            optimizationStrategies: ["Coba tekan tombol 'Analisa Ulang Rencana AI'."],
            cashFlowAdvice: "Silakan periksa koneksi atau coba beberapa saat lagi.",
            error: error?.message || "Unknown AI error"
        };
    }
}
