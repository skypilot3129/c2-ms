'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import type { Voyage, VoyageStatus } from '@/types/voyage';
import { Ship } from 'lucide-react';

function PrintVoyageListContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [filteredVoyages, setFilteredVoyages] = useState<Voyage[]>([]);
    const [loading, setLoading] = useState(true);

    const filterStatus = searchParams.get('status') as VoyageStatus | 'all' || 'all';
    const filterSearch = searchParams.get('search') || '';

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        let result = voyages;

        if (filterStatus !== 'all') {
            result = result.filter(v => v.status === filterStatus);
        }

        if (filterSearch) {
            const lowerTerm = filterSearch.toLowerCase();
            result = result.filter(v =>
                v.route.toLowerCase().includes(lowerTerm) ||
                v.voyageNumber.toLowerCase().includes(lowerTerm) ||
                v.shipName?.toLowerCase().includes(lowerTerm) ||
                v.vehicleNumber?.toLowerCase().includes(lowerTerm)
            );
        }

        setFilteredVoyages(result);
    }, [voyages, filterStatus, filterSearch]);

    useEffect(() => {
        if (!loading && filteredVoyages.length > 0) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, filteredVoyages]);

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data pemberangkatan...</div>;

    return (
        <div className="bg-white min-h-screen p-8 text-sm text-gray-800 font-sans">
            <div className="border-b-2 border-gray-800 pb-6 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">Laporan Pemberangkatan</h1>
                        <p className="text-gray-500">Cahaya Cargo Express Management System</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-600">Tanggal Cetak</p>
                        <p className="text-lg font-bold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-gray-400 text-xs mt-1">Status Filter: {filterStatus === 'all' ? 'Semua' : filterStatus}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Data</p>
                    <p className="text-2xl font-bold text-gray-800">{filteredVoyages.length}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active / Jalan</p>
                    <p className="text-2xl font-bold text-orange-600">{filteredVoyages.filter(v => v.status === 'in-progress').length}</p>
                </div>
            </div>

            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        <th className="py-3 font-bold uppercase text-xs tracking-wider w-12">No</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">No Voyage</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Tanggal</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Rute</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Kapal / Kendraaan</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Status</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Muatan</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredVoyages.map((v, index) => (
                        <tr key={v.id} className="break-inside-avoid">
                            <td className="py-3 text-gray-500">{index + 1}</td>
                            <td className="py-3 font-mono font-semibold">{v.voyageNumber}</td>
                            <td className="py-3">{new Date(v.departureDate).toLocaleDateString('id-ID')}</td>
                            <td className="py-3 font-semibold">{v.route}</td>
                            <td className="py-3">
                                {v.shipName && <div>⚓ {v.shipName}</div>}
                                {v.vehicleNumber && <div className="text-xs text-gray-500">🚚 {v.vehicleNumber}</div>}
                            </td>
                            <td className="py-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold border 
                                    ${v.status === 'completed' ? 'text-green-700 border-green-200 bg-green-50' :
                                        v.status === 'in-progress' ? 'text-orange-700 border-orange-200 bg-orange-50' :
                                            v.status === 'cancelled' ? 'text-red-700 border-red-200 bg-red-50' :
                                                'text-blue-700 border-blue-200 bg-blue-50'}`}
                                >
                                    {v.status}
                                </span>
                            </td>
                            <td className="py-3 text-center text-gray-500">
                                {v.transactionIds?.length || 0} Resi
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-12 pt-8 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                <span>Dicetak melalui C2-MS System</span>
                <span>Halaman 1 dari 1</span>
            </div>
        </div>
    );
}

export default function PrintVoyagePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PrintVoyageListContent />
        </Suspense>
    );
}
