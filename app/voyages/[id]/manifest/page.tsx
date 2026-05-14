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

    // Resolve vehicle numbers: prefer vehicleNumbers array, fallback to deprecated vehicleNumber string
    const vehicleNumbers: string[] =
        voyage.vehicleNumbers && voyage.vehicleNumbers.length > 0
            ? voyage.vehicleNumbers
            : voyage.vehicleNumber
            ? [voyage.vehicleNumber]
            : [];

    const printDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-white text-black">
                {/* No-Print Header */}
                <div className="print:hidden bg-gray-50 border-b px-8 py-4 flex justify-between items-center">
                    <Link href={`/voyages/${id}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium">
                        <ArrowLeft size={20} />
                        Kembali ke Detail Pemberangkatan
                    </Link>
                    <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-600/20"
                    >
                        <Printer size={18} />
                        Cetak Manifest
                    </button>
                </div>

                {/* Print Styles */}
                <style jsx global>{`
                    @media print {
                        @page { size: A4 landscape; margin: 10mm; }
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                `}</style>

                {/* Manifest Content */}
                <div className="p-8 print:p-0 max-w-[297mm] mx-auto">

                    {/* Header */}
                    <div className="text-center border-b-2 border-black pb-4 mb-5">
                        <h1 className="text-2xl font-black uppercase tracking-widest">MANIFEST MUATAN KAPAL</h1>
                        <p className="text-base font-bold mt-0.5">CAHAYA CARGO EXPRESS</p>
                        <p className="text-xs text-gray-500 mt-0.5">Jl. Pelabuhan No. 1 — Cargo & Shipping Services</p>
                    </div>

                    {/* Voyage Info Grid */}
                    <div className="grid grid-cols-2 gap-x-12 mb-5 text-sm border border-gray-300 rounded p-4 bg-gray-50">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="font-bold py-1 pr-2 w-36 align-top">Nama Kapal</td>
                                    <td className="align-top">: <span className="font-semibold">{voyage.shipName || '-'}</span></td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-1 pr-2 align-top">No. Voyage</td>
                                    <td className="align-top">: <span className="font-semibold">{voyage.voyageNumber}</span></td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-1 pr-2 align-top">Nopol Kendaraan</td>
                                    <td className="align-top">:&nbsp;
                                        {vehicleNumbers.length > 0
                                            ? vehicleNumbers.map((v, i) => (
                                                <span key={i} className="font-semibold">{v}{i < vehicleNumbers.length - 1 ? ', ' : ''}</span>
                                              ))
                                            : <span>-</span>
                                        }
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="font-bold py-1 pr-2 w-36 align-top">Rute</td>
                                    <td className="align-top">: <span className="font-semibold">{voyage.route}</span></td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-1 pr-2 align-top">Tgl. Berangkat</td>
                                    <td className="align-top">: {new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-1 pr-2 align-top">Status</td>
                                    <td className="align-top">:&nbsp;
                                        <span className={`font-semibold ${voyage.status === 'completed' ? 'text-green-700' : 'text-blue-700'}`}>
                                            {voyage.status === 'in-progress' ? 'Dalam Perjalanan' : voyage.status === 'completed' ? 'Selesai' : 'Direncanakan'}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Cargo Table */}
                    <table className="w-full border-collapse border border-black text-xs mb-5">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2 text-center w-8">No</th>
                                <th className="border border-black p-2 text-left w-28">No. STT</th>
                                <th className="border border-black p-2 text-left w-32">Pengirim</th>
                                <th className="border border-black p-2 text-left">
                                    <div>Penerima</div>
                                    <div className="font-normal text-[10px] text-gray-600">Alamat / No. Telp</div>
                                </th>
                                <th className="border border-black p-2 text-left w-24">Tujuan</th>
                                <th className="border border-black p-2 text-center w-12">Koli</th>
                                <th className="border border-black p-2 text-center w-16">Berat (Kg)</th>
                                <th className="border border-black p-2 text-left">Isi Barang</th>
                                <th className="border border-black p-2 text-center w-10">Ket.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx, index) => (
                                <tr key={tx.id} className={index % 2 === 0 ? '' : 'bg-gray-50'}>
                                    <td className="border border-black p-2 text-center align-top">{index + 1}</td>
                                    <td className="border border-black p-2 font-mono align-top text-[10px]">{tx.noSTT}</td>
                                    <td className="border border-black p-2 align-top">
                                        <div className="font-semibold">{tx.pengirimName}</div>
                                        {tx.pengirimPhone && (
                                            <div className="text-[10px] text-gray-600">📞 {tx.pengirimPhone}</div>
                                        )}
                                    </td>
                                    <td className="border border-black p-2 align-top">
                                        <div className="font-semibold">{tx.penerimaName}</div>
                                        {tx.penerimaAddress && (
                                            <div className="text-[10px] text-gray-600 mt-0.5">
                                                📍 {tx.penerimaAddress}
                                                {tx.penerimaCity ? `, ${tx.penerimaCity}` : ''}
                                            </div>
                                        )}
                                        {tx.penerimaPhone && (
                                            <div className="text-[10px] text-gray-600 mt-0.5">📞 {tx.penerimaPhone}</div>
                                        )}
                                    </td>
                                    <td className="border border-black p-2 align-top">{tx.tujuan}</td>
                                    <td className="border border-black p-2 text-center align-top font-semibold">{tx.koli}</td>
                                    <td className="border border-black p-2 text-center align-top font-semibold">{tx.berat}</td>
                                    <td className="border border-black p-2 align-top">{tx.isiBarang || '-'}</td>
                                    <td className="border border-black p-2 text-center align-top">{tx.keterangan || ''}</td>
                                </tr>
                            ))}
                            {/* Totals Row */}
                            <tr className="bg-gray-200 font-bold">
                                <td colSpan={5} className="border border-black p-2 text-right">TOTAL</td>
                                <td className="border border-black p-2 text-center">{totalKoli}</td>
                                <td className="border border-black p-2 text-center">{totalBerat}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Summary Row */}
                    <div className="flex gap-8 text-sm mb-6 border border-gray-300 rounded p-3 bg-gray-50">
                        <div><span className="font-bold">Total Resi:</span> {transactions.length} STT</div>
                        <div><span className="font-bold">Total Koli:</span> {totalKoli} Koli</div>
                        <div><span className="font-bold">Total Berat:</span> {totalBerat} Kg</div>
                        <div className="ml-auto text-xs text-gray-500">Dicetak: {printDate}</div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-4 gap-6 mt-8 text-center text-sm">
                        {['Pengurus Barang', 'Kepala Gudang', 'Supir / Nahkoda', 'Mengetahui'].map(label => (
                            <div key={label}>
                                <p className="mb-16 font-medium">{label}</p>
                                <div className="border-t-2 border-black w-3/4 mx-auto pt-1">
                                    <p className="text-xs text-gray-500">( ........................... )</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
