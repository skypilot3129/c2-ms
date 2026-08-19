'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export interface OcrMakassarResult {
    success: boolean;
    date?: string; // YYYY-MM-DD
    bongkarMobilTim?: string;
    bongkarItems?: Array<{ name: string; amount: number }>;
    pemuatanMobilTim?: string;
    pemuatanItems?: Array<{ name: string; amount: number; note?: string }>;
    transitItems?: Array<{
        resiNumber?: string;
        koliDetails?: string;
        customerName?: string;
        destination?: string;
        amount: number;
    }>;
    depositItems?: Array<{
        resiNumber?: string;
        description?: string;
        amount: number;
    }>;
    notes?: string;
    error?: string;
}

/**
 * Server Action to parse handwritten / printed receipts or notes
 * for Makassar Operational Expenses using Gemini 2.5 Flash.
 * Accepts multiple base64 image strings.
 */
export async function parseMakassarOpsImage(
    base64Images: string[]
): Promise<OcrMakassarResult> {
    if (!apiKey) {
        return {
            success: false,
            error: 'GEMINI_API_KEY tidak dikonfigurasi di server env.'
        };
    }

    if (!base64Images || base64Images.length === 0) {
        return {
            success: false,
            error: 'Tidak ada gambar yang diunggah.'
        };
    }

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
            }
        });

        // Convert base64 data strings into Gemini GenerativePart format
        const imageParts = base64Images.map(b64 => {
            // Clean base64 string if data URL prefix exists
            const cleanB64 = b64.includes('base64,') ? b64.split('base64,')[1] : b64;
            let mimeType = 'image/jpeg';
            if (b64.startsWith('data:image/png')) mimeType = 'image/png';
            if (b64.startsWith('data:image/webp')) mimeType = 'image/webp';
            if (b64.startsWith('data:image/heic')) mimeType = 'image/heic';

            return {
                inlineData: {
                    data: cleanB64,
                    mimeType: mimeType
                }
            };
        });

        const prompt = `
Anda adalah sistem AI OCR profesional untuk ekspedisi kargo "CAHAYA CARGO EXPRESS MAKASSAR".
Tugas Anda adalah memindai dan mengekstrak foto catatan tangan/nota pengeluaran operasional cabang Makassar.

Foto dapat berisi salah satu atau gabungan dari section berikut:
1. OPERASIONAL BONGKAR MAKASSAR:
   - Nama Tim/Mobil (misal: "HERUL + ISDAR ALMET")
   - Biaya-biaya: Buruh, Bensin/Solar, Makan, Tol, Pelabuhan, Karantina, Buruh DHS, Forklift, Listrik, PDAM, dll.
2. OPERASIONAL PEMUATAN MAKASSAR:
   - Nama Tim/Mobil (misal: "ALFIAN + HAERUDDIN + RISWAN")
   - Biaya-biaya: Bensin/Tol, Buruh JNT, Pengawas JNT, Pelabuhan, Uang Jalan Sopir/Petugas (Alfian, Haerudin, Riswan), dll.
3. BARANG TRANSIT EKSPEDISI LANJUTAN:
   - Rincian Resi: Nomor resi (misal: 18915, 18097, 18898, 18899, 18890), Koli/Berat/Volume (misal: 10Q / 50KG, 18Q / 365V), Pengirim/Customer (misal: Bp LORENS, HAIKAL, C. MANDIRI, CHT, PENTAWIRA), Kota Tujuan (misal: MANADO, MOROWALI, KAB. WAJO, KOTAMOBAGU, GORONTALO), serta Jumlah Biaya Transit (Rp).
4. REKAPITULASI & DEPOSIT KANTOR:
   - Tanggal (misal: "TGL: 04-07-2026" atau "04-08-2026") -> konversi ke format ISO YYYY-MM-DD (e.g. 2026-07-04 atau 2026-08-04).
   - Deposit Kantor (misal: Resi 18880 = 1.078.000).

Wajib kembalikan format JSON persis sesuai struktur berikut tanpa teks markdown tambahan:
{
  "date": "YYYY-MM-DD", 
  "bongkarMobilTim": "string",
  "bongkarItems": [
    { "name": "Buruh Bongkar", "amount": 1100000 },
    { "name": "Bensin / Solar", "amount": 500000 }
  ],
  "pemuatanMobilTim": "string",
  "pemuatanItems": [
    { "name": "Bensin / Tol", "amount": 100000, "note": "0654" },
    { "name": "Buruh JNT", "amount": 1500000 }
  ],
  "transitItems": [
    { "resiNumber": "18915", "koliDetails": "10Q / 50KG", "customerName": "Bp LORENS", "destination": "MANADO", "amount": 150000 }
  ],
  "depositItems": [
    { "resiNumber": "18880", "description": "Deposit Kantor", "amount": 1078000 }
  ],
  "notes": "string"
}

Catatan Penting:
- Angka biaya harus berupa number murni (misal: 1500000 bukan "1.500.000").
- Jika tanggal tidak tertera di foto, kosongkan field "date".
- Jika item bertanda "-" atau kosong, berikan amount: 0.
`;

        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();

        // Parse JSON output
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                success: false,
                error: 'Format JSON dari AI tidak valid.'
            };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            success: true,
            date: parsed.date || undefined,
            bongkarMobilTim: parsed.bongkarMobilTim || '',
            bongkarItems: Array.isArray(parsed.bongkarItems) ? parsed.bongkarItems : [],
            pemuatanMobilTim: parsed.pemuatanMobilTim || '',
            pemuatanItems: Array.isArray(parsed.pemuatanItems) ? parsed.pemuatanItems : [],
            transitItems: Array.isArray(parsed.transitItems) ? parsed.transitItems : [],
            depositItems: Array.isArray(parsed.depositItems) ? parsed.depositItems : [],
            notes: parsed.notes || ''
        };

    } catch (err: any) {
        console.error('OCR Makassar error:', err);
        return {
            success: false,
            error: err?.message || 'Gagal memproses gambar dengan AI OCR.'
        };
    }
}
