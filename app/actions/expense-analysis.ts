'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CategoryBreakdownItem {
    category: string;
    categoryLabel: string;
    amount: number;
    percentage: number;
    count: number;
}

export interface TopExpenseItem {
    description: string;
    amount: number;
    categoryLabel: string;
    date: string;
}

export interface ExpenseAnalysisPayload {
    periodLabel: string;
    totalExpenses: number;
    totalTopups: number;
    netCashFlow: number;
    totalCount: number;
    categoryBreakdown: CategoryBreakdownItem[];
    topExpenses: TopExpenseItem[];
    statusCounts: {
        approved: number;
        pending: number;
        draft: number;
        rejected: number;
    };
}

export interface ExpenseAnalysisResult {
    summary: string;
    categoryInsights: string[];
    anomaliesOrRisks: string[];
    savingsRecommendations: string[];
    healthScore: number;
    healthStatus: string;
    conclusion: string;
    error?: string;
}

const apiKey = process.env.GEMINI_API_KEY;

export async function analyzeExpensesWithGemini(
    payload: ExpenseAnalysisPayload
): Promise<ExpenseAnalysisResult> {
    if (!apiKey) {
        return {
            summary: "API Key Gemini belum dikonfigurasi di environment variables.",
            categoryInsights: ["Periksa konfigurasi GEMINI_API_KEY."],
            anomaliesOrRisks: ["API key tidak ditemukan."],
            savingsRecommendations: ["Pastikan GEMINI_API_KEY sudah diset pada .env.local."],
            healthScore: 0,
            healthStatus: "TIDAK TERSEDIA",
            conclusion: "Integrasi AI membutuhkan GEMINI_API_KEY yang valid.",
            error: "GEMINI_API_KEY missing"
        };
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
Anda adalah seorang Chief Financial Officer (CFO) & Analis Keuangan Senior untuk perusahaan ekspedisi & kargo logistik "CV. CAHAYA CARGO EXPRESS".

Tugas Anda: Berikan analisa pengeluaran kas kecil / pengeluaran umum perusahaan untuk periode **${payload.periodLabel}**.

DATA KEUANGAN PERIODE ${payload.periodLabel}:
- Total Pengeluaran Kas Kecil: Rp ${payload.totalExpenses.toLocaleString('id-ID')}
- Total Pemasukan / Top-Up Kas: Rp ${payload.totalTopups.toLocaleString('id-ID')}
- Arus Kas Netto (Topup - Pengeluaran): Rp ${payload.netCashFlow.toLocaleString('id-ID')}
- Jumlah Total Transaksi Pengeluaran: ${payload.totalCount} transaksi
- Rincian Status Transaksi: Approved (${payload.statusCounts.approved}), Pending (${payload.statusCounts.pending}), Draft (${payload.statusCounts.draft}), Rejected (${payload.statusCounts.rejected})

RINCIAN PENGELUARAN PER KATEGORI:
${payload.categoryBreakdown.map(c => `- ${c.categoryLabel}: Rp ${c.amount.toLocaleString('id-ID')} (${c.percentage.toFixed(1)}%, ${c.count} transaksi)`).join('\n')}

5 TRANSAKSI PENGELUARAN TERBESAR:
${payload.topExpenses.map((t, idx) => `${idx + 1}. [${t.date}] ${t.description} (${t.categoryLabel}) - Rp ${t.amount.toLocaleString('id-ID')}`).join('\n')}

Instruksi Output:
Kembalikan respon DALAM FORMAT JSON VALID tanpa markdown codeblock wrapper lain (hanya JSON murni) dengan struktur persis seperti berikut:
{
  "summary": "Ringkasan eksekutif 2-3 kalimat mengenai performa pengeluaran periode ini.",
  "categoryInsights": [
    "Poin analisa mendalam kategori pengeluaran terbesar 1",
    "Poin analisa distribusi biaya 2",
    "Poin analisa tren pengeluaran 3"
  ],
  "anomaliesOrRisks": [
    "Potensi anomali atau biaya tak terduga 1",
    "Risiko efisiensi atau lonjakan biaya 2"
  ],
  "savingsRecommendations": [
    "Langkah konkret efisiensi biaya 1",
    "Rekomendasi tindakan penghematan 2",
    "Saran kontrol internal kas kecil 3"
  ],
  "healthScore": 85,
  "healthStatus": "SANGAT EFISIEN",
  "conclusion": "Kesimpulan penutup dan rekomendasi manajemen untuk bulan berikutnya."
}

Catatan:
- Gunakan bahasa Indonesia formal bisnis yang tajam, profesional, dan berbobot.
- Pastikan nilai healthScore berupa angka bulat antara 1 sampai 100.
- healthStatus harus singkat (contoh: "SEHAT", "SANGAT EFISIEN", "WASPADA BOROS", "PERLU KONTROL").
`;

        const response = await model.generateContent(prompt);
        const textResponse = response.response.text();

        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as ExpenseAnalysisResult;
            return {
                summary: parsed.summary || "Analisa berhasil dibuat.",
                categoryInsights: parsed.categoryInsights || [],
                anomaliesOrRisks: parsed.anomaliesOrRisks || [],
                savingsRecommendations: parsed.savingsRecommendations || [],
                healthScore: parsed.healthScore || 80,
                healthStatus: parsed.healthStatus || "EFISIEN",
                conclusion: parsed.conclusion || "Gunakan analisa ini untuk pengendalian anggaran.",
            };
        } else {
            throw new Error("Gagal menguraikan JSON dari balasan Gemini AI.");
        }
    } catch (error: any) {
        console.error("Error generating Gemini expense analysis:", error);
        return {
            summary: "Terjadi kendala saat menghubungi layanan AI Gemini.",
            categoryInsights: ["Pastikan koneksi internet stabil."],
            anomaliesOrRisks: ["Gagal memproses AI secara real-time."],
            savingsRecommendations: ["Coba tekan tombol 'Analisa Ulang AI'."],
            healthScore: 50,
            healthStatus: "TIDAK LENGKAP",
            conclusion: "Silakan coba re-generate analisa beberapa saat lagi.",
            error: error?.message || "Unknown AI error"
        };
    }
}
