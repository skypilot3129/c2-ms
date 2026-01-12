'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToFleets, subscribeToMaintenanceLogs, deleteMaintenanceLog } from '@/lib/firestore-fleet';
import type { Fleet, MaintenanceLog } from '@/types/fleet';
import ProtectedRoute from '@/components/ProtectedRoute';
import MaintenanceForm from '@/components/MaintenanceForm';
import { ArrowLeft, Plus, Pencil, Trash2, Wrench, Filter } from 'lucide-react';
import { formatRupiah } from '@/lib/currency';

export default function MaintenanceHistoryPage() {
    const { user } = useAuth();
    const [fleets, setFleets] = useState<Fleet[]>([]);
    const [logs, setLogs] = useState<MaintenanceLog[]>([]);
    const [selectedFleetId, setSelectedFleetId] = useState<string>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingLog, setEditingLog] = useState<MaintenanceLog | undefined>();
    const [loading, setLoading] = useState(true);

    // Load fleets
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToFleets(user.uid, (data) => {
            setFleets(data);
        });
        return () => unsubscribe();
    }, [user]);

    // Load maintenance logs
    useEffect(() => {
        if (!user) return;
        const fleetFilter = selectedFleetId === 'all' ? null : selectedFleetId;
        const unsubscribe = subscribeToMaintenanceLogs(user.uid, fleetFilter, (data) => {
            setLogs(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, selectedFleetId]);

    const handleEdit = (log: MaintenanceLog) => {
        setEditingLog(log);
        setShowForm(true);
    };

    const handleDelete = async (log: MaintenanceLog) => {
        if (!confirm(`Yakin ingin menghapus riwayat maintenance ${log.fleetName}?`)) return;

        try {
            await deleteMaintenanceLog(log.id);
            alert('Riwayat maintenance berhasil dihapus');
        } catch (error) {
            console.error('Error deleting log:', error);
            alert('Gagal menghapus riwayat maintenance');
        }
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingLog(undefined);
    };

    const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <Link href="/fleets" className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-2">
                            <ArrowLeft size={16} />
                            Kembali ke Armada
                        </Link>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3 mt-4">
                            <Wrench size={36} />
                            Riwayat Maintenance
                        </h1>
                        <p className="text-gray-600 mt-2">Kelola dan pantau riwayat maintenance armada</p>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <p className="text-sm text-gray-500 mb-1">Total Riwayat</p>
                            <p className="text-3xl font-bold text-blue-600">{logs.length}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <p className="text-sm text-gray-500 mb-1">Total Biaya</p>
                            <p className="text-3xl font-bold text-red-600">{formatRupiah(totalCost)}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <p className="text-sm text-gray-500 mb-1">Armada Terdaftar</p>
                            <p className="text-3xl font-bold text-purple-600">{fleets.length}</p>
                        </div>
                    </div>

                    {/* Actions & Filter */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <Filter size={20} className="text-gray-500" />
                                <select
                                    value={selectedFleetId}
                                    onChange={(e) => setSelectedFleetId(e.target.value)}
                                    className="px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="all">Semua Kendaraan</option>
                                    {fleets.map(fleet => (
                                        <option key={fleet.id} value={fleet.id}>
                                            {fleet.plateNumber} - {fleet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => { setEditingLog(undefined); setShowForm(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg transition-all"
                            >
                                <Plus size={20} />
                                Tambah Maintenance
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                        {logs.length === 0 ? (
                            <div className="text-center py-16">
                                <Wrench size={64} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500 text-lg mb-2">Belum ada riwayat maintenance</p>
                                <p className="text-gray-400 text-sm">Klik tombol "Tambah Maintenance" untuk memulai</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Jenis Service</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Bengkel</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Deskripsi</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Biaya</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    {new Date(log.date).toLocaleDateString('id-ID', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-semibold text-gray-800">{log.fleetName}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                                                        {log.serviceType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-700">{log.provider}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{log.description}</td>
                                                <td className="px-6 py-4 text-right font-semibold text-red-600">
                                                    {formatRupiah(log.cost)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(log)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(log)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Form Modal */}
                {showForm && user && (
                    <MaintenanceForm
                        onSuccess={handleFormSuccess}
                        onCancel={() => { setShowForm(false); setEditingLog(undefined); }}
                        logToEdit={editingLog}
                        fleets={fleets}
                        userId={user.uid}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}
