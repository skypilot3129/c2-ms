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
        
        // Using gemini-2.5-flash for super fast and smart transaction voice parsing
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT' as any,
                    properties: {
                        senderName: {
                            type: 'STRING' as any,
                            description: 'Nama pengirim barang yang disebut. Kosongkan string jika tidak ada.',
                        },
                        receiverName: {
                            type: 'STRING' as any,
                            description: 'Nama penerima barang yang disebut. Kosongkan string jika tidak ada.',
                        },
                        tujuan: {
                            type: 'STRING' as any,
                            description: 'Kota tujuan pengiriman. Kosongkan string jika tidak ada.',
                        },
                        koli: {
                            type: 'NUMBER' as any,
                            description: 'Jumlah koli/paket. Default ke 1 jika tidak ada.',
                        },
                        berat: {
                            type: 'NUMBER' as any,
                            description: 'Berat koli/paket. Default ke 0 jika tidak ada.',
                        },
                        beratUnit: {
                            type: 'STRING' as any,
                            description: 'Satuan berat. Pilihan: "KG", "M3", "TON". Default ke "KG" jika tidak ada.',
                        },
                        tipeTransaksi: {
                            type: 'STRING' as any,
                            description: 'Tipe pengiriman. Pilihan: "regular", "borongan". Default ke "regular" jika tidak ada.',
                        },
                        harga: {
                            type: 'NUMBER' as any,
                            description: 'Tarif atau harga pengiriman. Jika tipeTransaksi adalah "borongan", ini mewakili harga total borongan. Default ke 0 jika tidak ada.',
                        },
                        pembayaran: {
                            type: 'STRING' as any,
                            description: 'Metode pembayaran. Pilihan: "Tunai", "Tagihan". Default ke "Tunai" jika tidak ada.',
                        },
                        pelunasan: {
                            type: 'STRING' as any,
                            description: 'Status pelunasan. Pilihan: "Lunas", "Belum Lunas". Default ke "Belum Lunas" jika tidak ada.',
                        },
                        isPKP: {
                            type: 'BOOLEAN' as any,
                            description: 'Apakah pengiriman ini dikenai pajak PPN (Jasa Kena Pajak)? Kembalikan true jika ada kata "pajak", "pkp", "ppn", "kena pajak", atau sejenisnya. Default ke false.',
                        },
                        isiBarang: {
                            type: 'STRING' as any,
                            description: 'Deskripsi isi paket. Kosongkan string jika tidak ada.',
                        },
                        keterangan: {
                            type: 'STRING' as any,
                            description: 'Catatan tambahan transaksi. Kosongkan string jika tidak ada.',
                        },
                    },
                    required: [
                        'senderName', 'receiverName', 'tujuan', 'koli', 'berat', 'beratUnit',
                        'tipeTransaksi', 'harga', 'pembayaran', 'pelunasan', 'isPKP', 'isiBarang', 'keterangan'
                    ],
                },
            },
        });

        const prompt = `Anda adalah asisten pencatat transaksi ekspedisi Cahaya Cargo Express. Ekstrak data transaksi dari kalimat berikut:
"${text}"

Ketentuan parsing:
1. Pilihan pembayaran HANYA "Tunai" atau "Tagihan".
2. Pilihan pelunasan HANYA "Lunas" atau "Belum Lunas".
3. Pilihan tipeTransaksi HANYA "regular" atau "borongan" (tidak boleh "express" atau "cargo").
4. Pilihan beratUnit HANYA "KG", "M3", atau "TON".
5. Jika ada penyebutan "pajak", "pkp", atau "ppn", set isPKP ke true.
6. Jika pengguna menyebut angka nominal harga (seperti "seratus lima puluh ribu" atau "150 ribu"), konversikan ke angka penuh (150000).`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        return NextResponse.json(parsed);
    } catch (error: any) {
        console.error('Error in parse-voice-transaction route:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
