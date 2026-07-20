'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    tool_get_dashboard_summary,
    tool_get_transaction_stats,
    tool_search_transaction,
    tool_get_recent_transactions,
    tool_search_clients,
    tool_create_client,
    tool_create_transaction
} from './ai-tools';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// --- Tool Definitions (Schema) ---
// Using 'any' to bypass strict SDK type checks that conflict with simple object schema
const tools: any[] = [
    {
        functionDeclarations: [
            {
                name: "get_dashboard_summary",
                description: "Get high-level business stats: Revenue (Omzet), Expenses, Profit, and Active Shipments for a period.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        startDate: { type: "STRING", description: "Start date (YYYY-MM-DD)." },
                        endDate: { type: "STRING", description: "End date (YYYY-MM-DD)." },
                    },
                },
            },
            {
                name: "get_transaction_stats",
                description: "Get detailed transaction analysis: Count of Unpaid (Belum Lunas), Paid (Lunas), and Uninvoiced (Belum di-invoice) shipments.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        startDate: { type: "STRING", description: "Start date (YYYY-MM-DD)." },
                        endDate: { type: "STRING", description: "End date (YYYY-MM-DD)." },
                    },
                },
            },
            {
                name: "search_transaction",
                description: "Search for a specific transaction by STT Number (No Resi). Returns status and details.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        keyword: { type: "STRING", description: "The STT Number (e.g., STT017642)." },
                    },
                    required: ["keyword"],
                },
            },
            {
                name: "get_recent_transactions",
                description: "Get a list of the most recent transactions/shipments.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        limit: { type: "NUMBER", description: "Number of items to return (default 5)." },
                    },
                },
            },
            {
                name: "search_clients",
                description: "Search for clients in the database by name, phone, city, or address.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        keyword: { type: "STRING", description: "The keyword to search for (e.g. client name, phone, or city)." },
                    },
                    required: ["keyword"],
                },
            },
            {
                name: "create_client",
                description: "Register a new client in the database.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Full name of the client." },
                        phone: { type: "STRING", description: "Phone number (optional)." },
                        address: { type: "STRING", description: "Full address (optional)." },
                        city: { type: "STRING", description: "City (optional)." },
                    },
                    required: ["name"],
                },
            },
            {
                name: "create_transaction",
                description: "Create a new cargo shipping receipt (STT / Resi) in the database.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        branch: { type: "STRING", description: "Branch ID: 'surabaya', 'bandung', or 'makassar'. Default is 'surabaya'." },
                        tanggal: { type: "STRING", description: "Transaction date in YYYY-MM-DD format. Default is today." },
                        tujuan: { type: "STRING", description: "Destination city." },
                        pengirimId: { type: "STRING", description: "Firestore document ID of the sender client (must be retrieved first)." },
                        penerimaName: { type: "STRING", description: "Name of the receiver." },
                        penerimaPhone: { type: "STRING", description: "Phone number of the receiver (optional)." },
                        penerimaAddress: { type: "STRING", description: "Full address of the receiver (optional)." },
                        penerimaCity: { type: "STRING", description: "City of the receiver (optional)." },
                        koli: { type: "NUMBER", description: "Number of packages/koli (default is 1)." },
                        berat: { type: "NUMBER", description: "Weight or volume size (default is 0)." },
                        beratUnit: { type: "STRING", description: "Unit: 'KG', 'KG/VOLUME', or 'M3' (default is 'KG')." },
                        tipeTransaksi: { type: "STRING", description: "Type: 'regular' (by weight) or 'borongan' (manual/flat price). Default is 'regular'." },
                        harga: { type: "NUMBER", description: "Price per unit (optional, regular only). Keep 0 or empty for new client (without history)." },
                        jumlah: { type: "NUMBER", description: "Total flat price (optional, borongan only). Leave empty or ask user first." },
                        pembayaran: { type: "STRING", description: "Payment method: 'Tunai', 'Kredit', or 'DP'. Default is 'Tunai'." },
                        pelunasan: { type: "STRING", description: "Payment status: 'Pending', 'Cash', or 'TF'. Default is 'Pending'." },
                        isiBarang: { type: "STRING", description: "Description of the cargo contents." },
                        keterangan: { type: "STRING", description: "Additional notes (optional)." },
                        isTaxable: { type: "BOOLEAN", description: "Is taxable (PPN 1.1% applies). Default is false." }
                    },
                    required: ["tujuan", "pengirimId", "penerimaName"]
                },
            },
        ],
    },
];

const SYSTEM_INSTRUCTION = `
Kamu adalah "Agent Cahaya", asisten virtual cerdas untuk "Cahaya Cargo Express" (C2-MS), sebuah perusahaan logistik dan kargo.
Tugasmu adalah membantu Owner dan Operator dengan memberikan saran bisnis, wawasan strategi, dan merekam transaksi/resi baru secara otomatis.

PANDUAN ALUR PENCATATAN TRANSAKSI / RESI OTOMATIS:
1. Jika pengguna meminta untuk mencatat transaksi atau membuat resi/STT baru, kamu harus mencari data Pengirim (Sender) terlebih dahulu menggunakan tool 'search_clients'.
   - Contoh: "Cari pengirim Budi" atau jika pengguna berkata "Buat resi untuk pengirim Budi...", panggil 'search_clients' dengan kata kunci "Budi".
2. **Jika Pengirim Ditemukan**: Dapatkan ID pengirim tersebut.
3. **Jika Pengirim TIDAK Ditemukan**: Kamu harus mendaftarkan pengirim baru secara otomatis menggunakan tool 'create_client' dengan informasi yang tersedia.
   - PENTING: Untuk client baru yang baru dibuat ini, input 'harga' pada pengiriman harus dikosongkan (diisi 0/tidak disertakan) karena belum memiliki riwayat tarif atau harga khusus di sistem. Beritahukan hal ini kepada pengguna.
4. **Tipe Transaksi**:
   - **Regular (Timbang)**: Kumpulkan data tujuan, koli, berat, beratUnit ('KG' atau 'M3'), dan isiBarang.
   - **Borongan (Manual)**: Untuk tipe borongan, kosongkan harga/jumlah terlebih dahulu, dan **tanyakan verifikasi PPN (Jasa Kena Pajak 1,1%) secara eksplisit** kepada pengguna: *"Apakah transaksi borongan ini dikenakan PPN 1.1%?"*. Setelah pengguna menjawab, baru panggil tool 'create_transaction' dengan isTaxable=true (jika Ya) atau isTaxable=false (jika Tidak).
5. Sebelum membuat transaksi, pastikan kamu mengonfirmasikan ringkasan data resi secara sopan kepada pengguna jika ada parameter wajib yang belum jelas. Setelah semua oke atau jika pengguna memerintahkannya langsung, panggil tool 'create_transaction'.

Panduan Penggunaan Tools Lainnya:
- Jika user bertanya tentang data (omzet, status resi, jumlah order, keuangan), JANGAN MENEBAK. Gunakan Tool yang sesuai.
- Selalu jawab dengan Bahasa Indonesia yang profesional, ramah, dan solutif.

Karakteristikmu:
- Profesional namun ramah, suportif, dan tanggap.
- Menggunakan Bahasa Indonesia yang baik dan komunikatif.
- Memahami konteks logistik (pengiriman, koli, berat volume, PPN 1.1%).

Konteks Waktu:
- Hari ini adalah: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
`;

export type ChatMessage = {
    role: 'user' | 'model';
    parts: string;
};

export async function chatWithGemini(history: ChatMessage[], message: string, userId?: string) {
    if (!apiKey) {
        return { error: 'API Key not configured.' };
    }

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-pro',
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: tools
        });

        // SDK requires history to start with 'user' role
        let validHistory = history.filter((msg, index) => {
            return true;
        });

        // Skip leading model messages until we find a user message
        while (validHistory.length > 0 && validHistory[0].role !== 'user') {
            validHistory.shift();
        }

        const chatValues = validHistory.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.parts }]
        }));

        const chat = model.startChat({
            history: chatValues,
        });

        const result = await chat.sendMessage(message);
        const response = result.response;

        // --- Handle Function Calls (Multi-turn) ---
        let finalResponseText = '';

        // Check for function calls
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            // Process all function calls
            const functionResponses = await Promise.all(functionCalls.map(async (call) => {
                const name = call.name;
                const args = call.args as any;

                console.log(`[Agent Cahaya] Calling Tool: ${name}`, args);

                let toolResult;
                if (name === 'get_dashboard_summary') {
                    toolResult = await tool_get_dashboard_summary(args.startDate, args.endDate);
                } else if (name === 'get_transaction_stats') {
                    toolResult = await tool_get_transaction_stats(args.startDate, args.endDate);
                } else if (name === 'search_transaction') {
                    toolResult = await tool_search_transaction(args.keyword);
                } else if (name === 'get_recent_transactions') {
                    toolResult = await tool_get_recent_transactions(args.limit);
                } else if (name === 'search_clients') {
                    toolResult = await tool_search_clients(args.keyword);
                } else if (name === 'create_client') {
                    toolResult = await tool_create_client(args.name, args.phone, args.address, args.city, userId);
                } else if (name === 'create_transaction') {
                    // Inject userId into transaction creation params
                    toolResult = await tool_create_transaction({
                        ...args,
                        userId
                    });
                } else {
                    toolResult = { error: 'Unknown function' };
                }

                return {
                    functionResponse: {
                        name: name,
                        response: {
                            name: name,
                            content: toolResult
                        }
                    }
                };
            }));

            // Send function output back to model
            const result2 = await chat.sendMessage(functionResponses);
            finalResponseText = result2.response.text();

        } else {
            // No function call, just text
            finalResponseText = response.text();
        }

        return { text: finalResponseText };
    } catch (error: any) {
        console.error('Error connecting to Gemini:', error);
        const errorMessage = error?.message || 'Unknown error';
        return { error: `Terjadi kesalahan (${errorMessage}). Silakan coba lagi.` };
    }
}

export async function translateVoiceAlerts(targetLanguage: string) {
    if (!apiKey) {
        return { error: 'API Key Gemini tidak dikonfigurasi di server.' };
    }

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `You are a translator assisting a warehouse logistics operator. We need to translate the Indonesian TTS voice alert prompts of a barcode scan checking system into the target language: "${targetLanguage}".
We need a JSON response containing two fields:
1. "numbers": A dictionary mapping numbers from 1 to 300 (as string keys "1", "2", etc. up to "300") to their spoken word representations in the target language. For regional languages (like Javanese, Bugis, Sundanese, Makassar, Madura) or foreign languages (like English, Chinese, Japanese, etc.), provide their natural phonetic/pronounceable words.
2. "warnings": A dictionary with the following keys and their spoken translations in the target language:
   - "cairan": Spoken translation for "Awas, cairan!" (indicating a scanned item has liquid cargo)
   - "dg": Spoken translation for "Awas, barang berbahaya!" (indicating dangerous goods)
   - "cairan_dg": Spoken translation for "Awas, cairan berbahaya!" (both liquid and dangerous goods)
   - "salah": Spoken translation for "Salah" (wrong barcode / not in manifest)
   - "duplikat": Spoken translation for "Duplikat" (already scanned koli)
   - "dobel": Spoken translation for "T O tetap sama" (duplicate barcode scan on same TO)

Example JSON structure:
{
  "numbers": {
    "1": "one",
    "2": "two",
    "300": "three hundred"
  },
  "warnings": {
    "cairan": "Caution, liquid!",
    "dg": "Caution, dangerous goods!",
    "cairan_dg": "Caution, dangerous liquid!",
    "salah": "Wrong scan",
    "duplikat": "Duplicate scan",
    "dobel": "T O remains the same"
  }
}
Please return ONLY the JSON object. Do not include markdown code block formatting or other text.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Clean up formatting if any
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJson);
        return { success: true, data };
    } catch (error: any) {
        console.error('Error translating with Gemini:', error);
        return { error: `Gagal menerjemahkan: ${error?.message || error}` };
    }
}
