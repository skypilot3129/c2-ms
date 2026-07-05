import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
    try {
        const { text } = await request.json();
        if (!text || text.trim() === '') {
            return NextResponse.json({ error: 'Teks kosong' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API Key tidak terkonfigurasi' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Using gemini-2.5-flash for super fast and smart natural language parsing
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT' as any,
                    properties: {
                        itemName: {
                            type: 'STRING' as any,
                            description: 'Nama barang atau tipe barang yang disebut. Jika tidak disebutkan secara eksplisit, kembalikan "Paket".',
                        },
                        length: {
                            type: 'NUMBER' as any,
                            description: 'Panjang barang dalam satuan centimeter (cm). Hanya angka.',
                        },
                        width: {
                            type: 'NUMBER' as any,
                            description: 'Lebar barang dalam satuan centimeter (cm). Hanya angka.',
                        },
                        height: {
                            type: 'NUMBER' as any,
                            description: 'Tinggi barang dalam satuan centimeter (cm). Hanya angka.',
                        },
                        actualWeight: {
                            type: 'NUMBER' as any,
                            description: 'Berat aktual barang dalam satuan kilogram (kg). Hanya angka.',
                        },
                        quantity: {
                            type: 'NUMBER' as any,
                            description: 'Jumlah koli atau kuantitas barang. Default ke 1 jika tidak disebutkan.',
                        },
                    },
                    required: ['itemName', 'length', 'width', 'height', 'actualWeight', 'quantity'],
                },
            },
        });

        const prompt = `Anda adalah asisten pencatat koli untuk logistik ekspedisi. Ekstrak data dimensi koli/barang dari teks berikut:
"${text}"

Ketentuan penting:
1. Konversi satuan panjang/lebar/tinggi ke CENTIMETER (cm). Contoh: jika pengguna menyebut "setengah meter" atau "0.5 meter", konversi menjadi 50.
2. Konversi penyebutan angka dalam kata (contoh: "dua puluh lima") menjadi digit numerik (25).
3. Jika nama barang tidak disebutkan, isi dengan "Paket".
4. Kembalikan data sesuai skema JSON yang diminta.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        return NextResponse.json(parsed);
    } catch (error: any) {
        console.error('Error in parse-voice route:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
