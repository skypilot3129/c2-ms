'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
    ArrowLeft, Trash2, Printer, FolderOpen,
    PackageSearch, Clock, Scale, DollarSign, User, Search, RefreshCw
} from 'lucide-react';
import { getVolumeSessions, deleteVolumeSession } from '@/lib/firestore-volume-sessions';
import { formatWeight } from '@/lib/volume-calculator';
import type { VolumeSession } from '@/types/volume-calculation';

export default function VolumeHistoryPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [sessions, setSessions] = useState<VolumeSession[]>([]);
    const [fetching, setFetching] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !user) router.push('/login');
    }, [user, loading, router]);

    const fetchSessions = async () => {
        setFetching(true);
        try {
            const data = await getVolumeSessions();
            setSessions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (user) fetchSessions();
    }, [user]);

    const handleDelete = async (id: string, senderName: string) => {
        if (!confirm(`Hapus sesi "${senderName}"? Data tidak bisa dikembalikan.`)) return;
        setDeletingId(id);
        try {
            await deleteVolumeSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
        } catch (e) {
            alert('Gagal menghapus sesi. Coba lagi.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleLoad = (session: VolumeSession) => {
        router.push(`/tools/volume-calculator?session=${session.id}`);
    };

    const handlePrint = (session: VolumeSession) => {
        const dataString = encodeURIComponent(JSON.stringify(session.koliList));
        const priceString = session.pricePerKg.toString();
        const senderString = encodeURIComponent(session.senderName);
        router.push(`/tools/volume-calculator/print?data=${dataString}&price=${priceString}&sender=${senderString}`);
    };

    const filtered = sessions.filter(s =>
        s.senderName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="container mx-auto px-4 py-8 max-w-5xl">

                {/* Header */}
                <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Link href="/tools/volume-calculator">
                                <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors font-medium">
                                    <ArrowLeft size={16} /> Kalkulator
                                </button>
                            </Link>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <PackageSearch size={30} className="text-blue-600" />
                            Riwayat Perhitungan
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm">Semua sesi kalkulator volume yang telah disimpan</p>
                    </div>
                    <button
                        onClick={fetchSessions}
                        disabled={fetching}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Search */}
                <div className="mb-6 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari nama pengirim..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium shadow-sm"
                    />
                </div>

                {/* Content */}
                {fetching ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                        <p className="text-sm font-medium">Memuat riwayat...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
                        <PackageSearch size={48} strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="font-semibold text-gray-600 text-lg">
                                {searchQuery ? 'Tidak ada hasil' : 'Belum ada sesi tersimpan'}
                            </p>
                            <p className="text-sm mt-1">
                                {searchQuery ? 'Coba kata kunci lain' : 'Gunakan tombol "Simpan Sesi" di kalkulator untuk menyimpan data'}
                            </p>
                        </div>
                        {!searchQuery && (
                            <Link href="/tools/volume-calculator">
                                <button className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">
                                    Buka Kalkulator
                                </button>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(session => (
                            <div
                                key={session.id}
                                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all overflow-hidden"
                            >
                                {/* Card Header */}
                                <div className="p-5 pb-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="bg-blue-100 p-2.5 rounded-xl shrink-0">
                                                <User size={20} className="text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 text-lg truncate">{session.senderName}</h3>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                                    <Clock size={12} />
                                                    <span>
                                                        {session.createdAt.toLocaleDateString('id-ID', {
                                                            day: '2-digit', month: 'long', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                    {session.createdByName && (
                                                        <span className="text-gray-300">·</span>
                                                    )}
                                                    {session.createdByName && (
                                                        <span>oleh {session.createdByName}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handlePrint(session)}
                                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                title="Print sesi ini"
                                            >
                                                <Printer size={15} /> Print
                                            </button>
                                            <button
                                                onClick={() => handleLoad(session)}
                                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                title="Muat ke kalkulator"
                                            >
                                                <FolderOpen size={15} /> Muat
                                            </button>
                                            <button
                                                onClick={() => handleDelete(session.id, session.senderName)}
                                                disabled={deletingId === session.id}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                                title="Hapus sesi"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="mt-4 grid grid-cols-3 gap-3">
                                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Jumlah Koli</p>
                                            <p className="text-2xl font-black text-gray-900">{session.koliList.length}</p>
                                        </div>
                                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <Scale size={12} className="text-blue-500" />
                                                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Total Berat</p>
                                            </div>
                                            <p className="text-2xl font-black text-blue-700">{formatWeight(session.totalWeight)} <span className="text-sm font-bold text-blue-400">kg</span></p>
                                        </div>
                                        <div className="bg-green-50 rounded-xl p-3 text-center">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <DollarSign size={12} className="text-green-500" />
                                                <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Est. Biaya</p>
                                            </div>
                                            <p className="text-lg font-black text-green-700 truncate">
                                                {session.totalPrice > 0 ? `Rp ${session.totalPrice.toLocaleString('id-ID')}` : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Koli Preview */}
                                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50">
                                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Daftar Barang</p>
                                    <div className="flex flex-wrap gap-2">
                                        {session.koliList.slice(0, 6).map(koli => (
                                            <span
                                                key={koli.koliNumber}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700"
                                            >
                                                <span className="text-gray-400 font-bold">#{koli.koliNumber}</span>
                                                {koli.itemName}
                                                <span className="text-blue-600 font-bold">{formatWeight(koli.chargeableWeight)} kg</span>
                                            </span>
                                        ))}
                                        {session.koliList.length > 6 && (
                                            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-500">
                                                +{session.koliList.length - 6} lainnya
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer count */}
                {!fetching && filtered.length > 0 && (
                    <p className="text-center text-sm text-gray-400 mt-8">
                        Menampilkan {filtered.length} dari {sessions.length} sesi
                    </p>
                )}
            </div>
        </div>
    );
}
