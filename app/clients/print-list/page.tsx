'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToClients, searchClients } from '@/lib/firestore';
import type { Client } from '@/types/client';
import { User } from 'lucide-react';

function PrintClientListContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [clients, setClients] = useState<Client[]>([]);
    const [filteredClients, setFilteredClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    const filterSearch = searchParams.get('search') || '';

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToClients((data) => {
            setClients(data);
            setLoading(false);
        }, user.uid);
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        let result = searchClients(clients, filterSearch);
        result.sort((a, b) => a.name.localeCompare(b.name));
        setFilteredClients(result);
    }, [clients, filterSearch]);

    useEffect(() => {
        if (!loading && filteredClients.length > 0) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, filteredClients]);

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data client...</div>;

    return (
        <div className="bg-white min-h-screen p-8 text-sm text-gray-800 font-sans">
            <div className="border-b-2 border-gray-800 pb-6 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">Database Client</h1>
                        <p className="text-gray-500">Cahaya Cargo Express Management System</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-600">Tanggal Cetak</p>
                        <p className="text-lg font-bold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-gray-400 text-xs mt-1">Total: {filteredClients.length} Client</p>
                    </div>
                </div>
            </div>

            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        <th className="py-3 font-bold uppercase text-xs tracking-wider w-12">No</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Nama Client</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Telepon</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Kota</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Alamat & Catatan</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredClients.map((client, index) => (
                        <tr key={client.id} className="break-inside-avoid">
                            <td className="py-3 text-gray-500 bg-white">{index + 1}</td>
                            <td className="py-3 font-semibold bg-white">{client.name}</td>
                            <td className="py-3 bg-white">{client.phone || '-'}</td>
                            <td className="py-3 bg-white">{client.city || '-'}</td>
                            <td className="py-3 bg-white">
                                <div>{client.address || '-'}</div>
                                {client.notes && <div className="text-gray-500 text-xs italic mt-1">"{client.notes}"</div>}
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

export default function PrintClientPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PrintClientListContent />
        </Suspense>
    );
}
