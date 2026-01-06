'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getVoyageById } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Voyage } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Printer } from 'lucide-react';

export default function ManifestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const voyageData = await getVoyageById(id);
                if (!voyageData) return;
                setVoyage(voyageData);

                const txPromises = voyageData.transactionIds.map(txId => getTransactionById(txId));
                const txData = await Promise.all(txPromises);
                setTransactions(txData.filter((tx): tx is Transaction => tx !== null));
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    if (loading) return <div className="p-8 text-center">Memuat Manifest...</div>;
    if (!voyage) return <div className="p-8 text-center">Data tidak ditemukan</div>;

    const totalKoli = transactions.reduce((sum, t) => sum + t.koli, 0);
    const totalBerat = transactions.reduce((sum, t) => sum + t.berat, 0);

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-white text-black p-8">
                {/* No-Print Header */}
                <div className="print:hidden mb-8 flex justify-between items-center">
                    <Link href={`/voyages/${id}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                        <ArrowLeft size={20} />
                        Kembali
                    </Link>
                    <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"
                    >
                        <Printer size={20} />
                        Cetak Manifest
                    </button>
                </div>

                {/* Manifest Content */}
                <div className="max-w-[210mm] mx-auto bg-white">
                    {/* Header */}
                    <div className="text-center border-b-2 border-black pb-4 mb-4">
                        <h1 className="text-2xl font-bold uppercase tracking-wider">MANIFEST MUATAN KAPAL</h1>
                        <p className="text-sm mt-1">CAHAYA CARGO EXPRESS</p>
                    </div>

                    {/* Voyage Info */}
                    <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                        <div>
                            <table className="w-full">
                                <tbody>
                                    <tr>
                                        <td className="font-bold py-1 w-32">Nama Kapal</td>
                                        <td>: {voyage.shipName || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold py-1">No. Voyage</td>
                                        <td>: {voyage.voyageNumber}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold py-1">Nopol Kendaraan</td>
                                        <td>: {voyage.vehicleNumber || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table className="w-full">
                                <tbody>
                                    <tr>
                                        <td className="font-bold py-1 w-32">Rute</td>
                                        <td>: {voyage.route}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold py-1">Tanggal Berangkat</td>
                                        <td>: {new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold py-1">Status</td>
                                        <td>: {voyage.status === 'in-progress' ? 'Dalam Perjalanan' : 'Selesai'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Cargo Table */}
                    <table className="w-full border-collapse border border-black text-sm mb-6">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 w-12 text-center">No</th>
                                <th className="border border-black p-2 text-left">No. STT</th>
                                <th className="border border-black p-2 text-left">Pengirim</th>
                                <th className="border border-black p-2 text-left">Penerima</th>
                                <th className="border border-black p-2 text-center">Koli</th>
                                <th className="border border-black p-2 text-center">Berat (Kg)</th>
                                <th className="border border-black p-2 text-left">Isi Barang</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx, index) => (
                                <tr key={tx.id}>
                                    <td className="border border-black p-2 text-center">{index + 1}</td>
                                    <td className="border border-black p-2 font-mono">{tx.noSTT}</td>
                                    <td className="border border-black p-2">{tx.pengirimName}</td>
                                    <td className="border border-black p-2">
                                        {tx.penerimaName}<br />
                                        <span className="text-xs text-gray-500">{tx.tujuan}</span>
                                    </td>
                                    <td className="border border-black p-2 text-center">{tx.koli}</td>
                                    <td className="border border-black p-2 text-center">{tx.berat}</td>
                                    <td className="border border-black p-2">{tx.isiBarang || '-'}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50 font-bold">
                                <td colSpan={4} className="border border-black p-2 text-right">TOTAL</td>
                                <td className="border border-black p-2 text-center">{totalKoli}</td>
                                <td className="border border-black p-2 text-center">{totalBerat}</td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-12 text-center text-sm">
                        <div>
                            <p className="mb-20">Pengurus Barang</p>
                            <div className="border-t border-black w-2/3 mx-auto"></div>
                        </div>
                        <div>
                            <p className="mb-20">Supir / Nahkoda</p>
                            <div className="border-t border-black w-2/3 mx-auto"></div>
                        </div>
                        <div>
                            <p className="mb-20">Mengetahui</p>
                            <div className="border-t border-black w-2/3 mx-auto"></div>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
