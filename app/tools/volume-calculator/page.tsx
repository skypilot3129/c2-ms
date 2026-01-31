'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calculator, ArrowLeft, Package } from 'lucide-react';
import VolumeCalculator from '@/components/VolumeCalculator';

export default function VolumeCalculatorPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <Calculator size={32} className="text-blue-600" />
                            Kalkulator Volume
                        </h1>
                        <Link href="/">
                            <button className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors border border-gray-300 shadow-sm">
                                <ArrowLeft size={18} />
                                Kembali ke Beranda
                            </button>
                        </Link>
                    </div>
                    <p className="text-gray-600">
                        Hitung berat tagihan berdasarkan dimensi dan berat aktual barang
                    </p>
                </div>

                {/* Calculator Component */}
                <VolumeCalculator />

                {/* Help Section */}
                <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Package size={20} className="text-blue-600" />
                        Panduan Penggunaan
                    </h3>

                    <div className="space-y-4 text-sm text-gray-700">
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">1. Ukur Dimensi Barang</h4>
                            <p>Ukur panjang, lebar, dan tinggi kemasan bagian terluar dalam satuan centimeter (cm).</p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">2. Timbang Barang</h4>
                            <p>Timbang berat aktual barang termasuk kemasan dalam satuan kilogram (kg).</p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">3. Input Data</h4>
                            <p>Masukkan semua data ke form kalkulator. Jika ada beberapa item dengan dimensi sama, isi kolom "Jumlah Item".</p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">4. Klik Hitung</h4>
                            <p>Sistem akan menghitung berat volume dan menentukan berat tagihan (yang lebih besar antara berat aktual dan berat volume).</p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-900 mb-2">Contoh Perhitungan:</h4>
                            <div className="space-y-2">
                                <p><strong>Input:</strong> 50cm × 40cm × 30cm, Berat aktual 8 kg</p>
                                <p><strong>Volume:</strong> 60,000 cm³</p>
                                <p><strong>Berat Volume:</strong> 60,000 / 4,000 = 15 kg</p>
                                <p><strong>Berat Tagihan:</strong> <span className="text-blue-700 font-bold">15 kg</span> (Berat Volume lebih besar)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 text-center text-sm text-gray-600">
                    <p>Cahaya Cargo Express • Standar Perhitungan Volume dengan Divisor 4000</p>
                </div>
            </div>
        </div>
    );
}
