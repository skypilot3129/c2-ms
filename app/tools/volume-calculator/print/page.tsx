'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatWeight, formatVolume } from '@/lib/volume-calculator';
import { Package, Phone, Mail, MapPin } from 'lucide-react';

interface KoliData {
    koliNumber: number;
    length: number;
    width: number;
    height: number;
    actualWeight: number;
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
    const [printDate, setPrintDate] = useState('');

    useEffect(() => {
        // Get data from URL params
        const koliData = searchParams.get('data');
        const price = searchParams.get('price');

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
        <div className="min-h-screen bg-white p-8">
            {/* Header - Company Info */}
            <div className="border-b-2 border-gray-800 pb-6 mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">CAHAYA CARGO EXPRESS</h1>
                        <p className="text-sm text-gray-600 mb-1">Jasa Pengiriman Barang Terpercaya</p>
                    </div>
                    <div className="text-right text-sm">
                        <div className="flex items-center justify-end gap-2 mb-1">
                            <Phone size={14} />
                            <span>+62 xxx-xxxx-xxxx</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                            <Mail size={14} />
                            <span>info@cahayacargo.com</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <MapPin size={14} />
                            <span>Surabaya, Indonesia</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Title */}
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">RINCIAN PERHITUNGAN VOLUME</h2>
                <p className="text-sm text-gray-600">Tanggal: {printDate}</p>
            </div>

            {/* Formula Info */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-gray-900 mb-2">Standar Perhitungan:</h3>
                <p className="text-sm text-gray-700 mb-1">
                    <strong>Berat Volume (kg)</strong> = (Panjang × Lebar × Tinggi) / 4,000
                </p>
                <p className="text-sm text-gray-700">
                    <strong>Berat Tagihan</strong> = Nilai tertinggi antara Berat Aktual dan Berat Volume
                </p>
            </div>

            {/* Koli Details Table */}
            <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Package size={18} />
                    Detail Koli
                </h3>
                <table className="w-full border-collapse border border-gray-400">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-gray-400 px-3 py-2 text-left text-sm">No</th>
                            <th className="border border-gray-400 px-3 py-2 text-left text-sm">Dimensi (cm)</th>
                            <th className="border border-gray-400 px-3 py-2 text-right text-sm">Volume (cm³)</th>
                            <th className="border border-gray-400 px-3 py-2 text-right text-sm">Berat Aktual (kg)</th>
                            <th className="border border-gray-400 px-3 py-2 text-right text-sm">Berat Volume (kg)</th>
                            <th className="border border-gray-400 px-3 py-2 text-right text-sm">Berat Tagihan (kg)</th>
                            <th className="border border-gray-400 px-3 py-2 text-center text-sm">Tipe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {koliList.map((koli) => (
                            <tr key={koli.koliNumber}>
                                <td className="border border-gray-400 px-3 py-2 text-sm font-semibold">
                                    #{koli.koliNumber}
                                </td>
                                <td className="border border-gray-400 px-3 py-2 text-sm">
                                    {koli.length} × {koli.width} × {koli.height}
                                </td>
                                <td className="border border-gray-400 px-3 py-2 text-sm text-right">
                                    {formatVolume(koli.volume)}
                                </td>
                                <td className="border border-gray-400 px-3 py-2 text-sm text-right">
                                    {formatWeight(koli.actualWeight)}
                                </td>
                                <td className="border border-gray-400 px-3 py-2 text-sm text-right">
                                    {formatWeight(koli.volumetricWeight)}
                                </td>
                                <td className="border border-gray-400 px-3 py-2 text-sm text-right font-bold">
                                    {formatWeight(koli.chargeableWeight)}
                                </td>
                                <td className="border border-gray-400 px-3 py-2 text-sm text-center">
                                    {koli.weightType === 'actual' ? 'Aktual' : 'Volume'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-bold">
                            <td colSpan={5} className="border border-gray-400 px-3 py-2 text-sm text-right">
                                TOTAL BERAT TAGIHAN:
                            </td>
                            <td className="border border-gray-400 px-3 py-2 text-sm text-right">
                                {formatWeight(totalWeight)}
                            </td>
                            <td className="border border-gray-400 px-3 py-2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Pricing Summary */}
            {pricePerKg > 0 && (
                <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-3">Rincian Biaya</h3>
                    <div className="border-2 border-gray-800 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-700">Total Berat:</span>
                            <span className="text-sm font-semibold">{formatWeight(totalWeight)} kg</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-700">Harga per kg:</span>
                            <span className="text-sm font-semibold">Rp {pricePerKg.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="border-t-2 border-gray-400 mt-3 pt-3">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-900">TOTAL BIAYA:</span>
                                <span className="text-2xl font-bold text-gray-900">
                                    Rp {totalPrice.toLocaleString('id-ID')}
                                </span>
                            </div>
                            <p className="text-xs text-gray-600 text-right mt-1">
                                ({formatWeight(totalWeight)} kg × Rp {pricePerKg.toLocaleString('id-ID')})
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Notes */}
            <div className="mt-8 pt-6 border-t border-gray-300">
                <p className="text-xs text-gray-600 italic">
                    * Dokumen ini dibuat secara otomatis oleh sistem Kalkulator Volume Cahaya Cargo Express
                </p>
                <p className="text-xs text-gray-600 italic">
                    * Perhitungan menggunakan standar divisor 4,000 untuk berat volume
                </p>
            </div>

            {/* Print Button (Hidden on Print) */}
            <div className="no-print mt-6 flex gap-3">
                <button
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                    Print / Save as PDF
                </button>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                    Kembali
                </button>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .no-print {
            display: none !important;
          }
          
          @page {
            size: A4;
            margin: 1cm;
          }
          
          table {
            page-break-inside: avoid;
          }
          
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
        </div>
    );
}

export default function PrintVolumeCalculation() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white p-8 flex items-center justify-center">
                <p className="text-gray-600">Loading...</p>
            </div>
        }>
            <PrintContent />
        </Suspense>
    );
}
