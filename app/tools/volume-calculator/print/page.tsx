'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatWeight, formatVolume } from '@/lib/volume-calculator';
import { Package, Phone, Mail, MapPin } from 'lucide-react';

interface KoliData {
    koliNumber: number;
    itemName: string;
    length: number;
    width: number;
    height: number;
    actualWeight: number;
    quantity: number;
    volume: number;
    volumetricWeight: number;
    chargeableWeight: number;
    weightType: 'actual' | 'volumetric';
}

function PrintContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [koliList, setKoliList] = useState<KoliData[]>([]);
    const [pricePerKg, setPricePerKg] = useState(0);
    const [senderName, setSenderName] = useState('');
    const [printDate, setPrintDate] = useState('');

    useEffect(() => {
        // Get data from URL params
        const koliData = searchParams.get('data');
        const price = searchParams.get('price');
        const sender = searchParams.get('sender');

        if (koliData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(koliData));
                setKoliList(parsed);
            } catch (error) {
                console.error('Failed to parse koli data:', error);
            }
        }

        if (price) {
            setPricePerKg(parseFloat(price));
        }

        if (sender) {
            setSenderName(decodeURIComponent(sender));
        }

        // Set print date
        const now = new Date();
        const formatted = now.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        setPrintDate(formatted);

        // Auto print after short delay
        const timer = setTimeout(() => {
            window.print();
        }, 500);

        return () => clearTimeout(timer);
    }, [searchParams]);

    const totalWeight = koliList.reduce((sum, koli) => sum + koli.chargeableWeight, 0);
    const totalPrice = totalWeight * pricePerKg;

    return (
        <div className="print-container bg-white">
            {/* Header - Company Info */}
            <div className="border-b-2 border-gray-800 pb-4 mb-5">
                <div className="flex flex-row justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-1">CAHAYA CARGO</h1>
                        <p className="text-sm font-bold text-gray-600">Jasa Pengiriman Barang Terpercaya</p>
                    </div>
                    <div className="text-right text-xs text-gray-700 bg-gray-50 p-2 border border-gray-200 rounded">
                        <div className="flex items-center justify-end gap-2 mb-1">
                            <Phone size={12} />
                            <span>+62 xxx-xxxx-xxxx</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                            <Mail size={12} />
                            <span>info@cahayacargo.com</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <MapPin size={12} />
                            <span>Surabaya, Indonesia</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-none">RINCIAN VOLUME</h2>
                    <p className="text-xs text-gray-500 mt-1">Ref: CCE-VOL-{new Date().getTime().toString().slice(-6)}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-2">Tanggal: {printDate}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-bold">Nama Pengirim</p>
                    <p className="text-xl font-black text-gray-900 border-b border-gray-300 inline-block pb-1">{senderName || '-'}</p>
                </div>
            </div>

            {/* Koli Details Table */}
            <div className="mb-6">
                <div className="bg-gray-100 px-3 py-2 border border-gray-400 border-b-0 flex items-center gap-2">
                    <Package size={16} />
                    <h3 className="font-bold text-gray-900 text-sm">DAFTAR KOLI BARANG</h3>
                </div>
                <table className="w-full border-collapse border border-gray-400 text-sm">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-gray-400 px-2 py-2 text-center w-[5%] font-bold">No</th>
                            <th className="border border-gray-400 px-2 py-2 text-left w-[25%] font-bold">Nama Barang</th>
                            <th className="border border-gray-400 px-2 py-2 text-center w-[8%] font-bold">Qty</th>
                            <th className="border border-gray-400 px-2 py-2 text-center w-[15%] font-bold">Dimensi (cm)</th>
                            <th className="border border-gray-400 px-2 py-2 text-right w-[12%] font-bold">Aktual</th>
                            <th className="border border-gray-400 px-2 py-2 text-right w-[12%] font-bold">Volume</th>
                            <th className="border border-gray-400 px-2 py-2 text-right w-[15%] font-bold">Tagihan</th>
                            <th className="border border-gray-400 px-1 py-2 text-center w-[8%] font-bold">Tipe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {koliList.map((koli) => (
                            <tr key={koli.koliNumber}>
                                <td className="border border-gray-400 px-2 py-1.5 text-center font-bold">
                                    {koli.koliNumber}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 align-middle leading-tight">
                                    {koli.itemName}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-center font-medium">
                                    {koli.quantity}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-center text-xs">
                                    {koli.length}×{koli.width}×{koli.height}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-right font-medium">
                                    {formatWeight(koli.actualWeight * koli.quantity)} kg
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-right font-medium">
                                    {formatWeight(koli.volumetricWeight)} kg
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-right font-bold bg-gray-50">
                                    {formatWeight(koli.chargeableWeight)} kg
                                </td>
                                <td className="border border-gray-400 px-1 py-1.5 text-center text-[10px] font-bold uppercase w-10 overflow-hidden">
                                    {koli.weightType === 'actual' ? 'AKT' : 'VOL'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-600">
                            <td colSpan={6} className="border border-gray-400 px-3 py-2 text-right tracking-tight">
                                TOTAL BERAT TAGIHAN:
                            </td>
                            <td className="border border-gray-400 px-2 py-2 text-right text-lg text-gray-900 border-b-4 border-gray-900">
                                {formatWeight(totalWeight)} kg
                            </td>
                            <td className="border border-gray-400 px-1 py-2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Pricing Summary */}
            {pricePerKg > 0 && (
                <div className="w-full flex justify-end mb-6 shrink-0">
                    <div className="w-[45%] border-2 border-gray-800 rounded p-4 bg-gray-50 page-break-avoid">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-gray-600">Total Berat:</span>
                            <span className="text-sm font-bold text-gray-900">{formatWeight(totalWeight)} kg</span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-gray-600">Tarif per kg:</span>
                            <span className="text-sm font-bold text-gray-900">Rp {pricePerKg.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="border-t border-gray-400 mt-2 pt-2">
                            <div className="flex justify-between items-end">
                                <span className="text-sm font-black text-gray-900">ESTIMASI BIAYA:</span>
                                <span className="text-xl font-black text-gray-900">
                                    Rp {totalPrice.toLocaleString('id-ID')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Rules */}
            <div className="mt-auto pt-4 border-t border-dashed border-gray-400 page-break-avoid text-xs text-gray-600 flex gap-4">
               <div className="w-2/3">
                    <h4 className="font-bold text-gray-800 mb-1">Catatan Tagihan:</h4>
                    <p>- Berat Tagihan ditentukan dari nilai tertinggi antara Berat Aktual dan Berat Volume.</p>
                    <p>- Rumus Berat Volume: P(cm) × L(cm) × T(cm) / 4000.</p>
                    <p>- Dokumen ini hanya merupakan rincian volume dan BUKAN bukti pembayaran sah.</p>
               </div>
               <div className="w-1/3 text-center flex flex-col justify-end pt-8">
                    <div className="border-b border-gray-800 w-3/4 mx-auto mb-1"></div>
                    <p className="font-bold text-gray-800">Petugas</p>
               </div>
            </div>

            {/* Print Button (Hidden on Print) */}
            <div className="no-print fixed bottom-4 right-4 flex gap-3 shadow-xl bg-white p-3 rounded-lg border border-gray-200">
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold transition-colors"
                >
                    Kembali
                </button>
                <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors flex items-center gap-2"
                >
                    <Package size={16} /> Print (A4)
                </button>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                        background-color: white;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }

                    .no-print {
                        display: none !important;
                    }

                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    
                    .print-container {
                        width: 100%;
                        max-width: 210mm;
                        padding: 0;
                        margin: 0 auto;
                        box-sizing: border-box;
                    }

                    table {
                        page-break-inside: auto;
                    }

                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }

                    thead {
                        display: table-header-group;
                    }

                    tfoot {
                        display: table-footer-group;
                    }

                    .page-break-avoid {
                        page-break-inside: avoid;
                    }
                }
                
                /* Screen view styles for preview */
                @media screen {
                    body {
                        background-color: #f3f4f6;
                    }
                    .print-container {
                        max-width: 210mm;
                        min-height: 297mm;
                        margin: 2rem auto;
                        padding: 20mm 15mm;
                        background: white;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        display: flex;
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
}

export default function PrintVolumeCalculation() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                    <p className="font-bold text-gray-800">Menyiapkan Dokumen Rincian...</p>
                </div>
            </div>
        }>
            <PrintContent />
        </Suspense>
    );
}
