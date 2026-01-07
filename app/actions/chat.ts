'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    tool_get_dashboard_summary,
    tool_get_transaction_stats,
    tool_search_transaction,
    tool_get_recent_transactions
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
        ],
    },
];

const SYSTEM_INSTRUCTION = `
Kamu adalah "Agent Cahaya", asisten virtual cerdas untuk "Cahaya Cargo Express" (C2-MS), sebuah perusahaan logistik dan kargo.
Tugasmu adalah membantu Owner perusahaan dengan memberikan saran bisnis, wawasan strategi, dan ide marketing.
Kamu memiliki akses ke data perusahaan melalui "Tools" (Function Calling).

Panduan Penggunaan Tools:
1. Jika user bertanya tentang data (omzet, status resi, jumlah order, keuangan), JANGAN MENEBAK. Gunakan Tool yang sesuai.
2. Jika user bertanya "Berapa omzet bulan ini?", gunakan 'get_dashboard_summary'.
3. Jika user bertanya detail hutang/piutang/belum bayar, gunakan 'get_transaction_stats'.
4. Jika user bertanya status resi spesifik, gunakan 'search_transaction'.
5. Selalu jawab dengan Bahasa Indonesia yang profesional dan ramah.
6. Analisa data yang kamu terima sebelum menjawab. Berikan insight jika ada (misal: "Profit turun karena biaya naik").

Karakteristikmu:
- Profesional namun ramah dan suportif.
- Menggunakan Bahasa Indonesia, Jawa, Bandung, Makassar Casual.
- Memahami konteks logistik (pengiriman, armada, rute, biaya operasional).
- Selalu positif dan solutif.

Konteks Waktu:
- Hari ini adalah: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
`;

export type ChatMessage = {
    role: 'user' | 'model';
    parts: string;
};

export async function chatWithGemini(history: ChatMessage[], message: string) {
    if (!apiKey) {
        return { error: 'API Key not configured.' };
    }

    try {
        // User requested gemini-3-flash-preview
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
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
        // Gemini SDK handles function calling by returning a 'functionCall' part.
        // We need to execute it and send the result back.

        let finalResponseText = '';

        // Check for function calls
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            // Process all function calls
            const functionResponses = await Promise.all(functionCalls.map(async (call) => {
                const name = call.name;
                // Cast args to any to safely access dynamic properties
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
