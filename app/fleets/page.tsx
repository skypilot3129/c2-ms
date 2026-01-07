'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    Truck,
    Plus,
    Search,
    MoreVertical,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    MapPin,
    Trash2,
    Edit2,
    X,
    Calendar,
    DollarSign,
    FileText,
    ArrowLeft
} from 'lucide-react';
import {
    subscribeToFleets,
    addFleet,
    updateFleet,
    deleteFleet,
    subscribeToMaintenanceLogs,
    addMaintenanceLog,
    updateFleetStatus
} from '@/lib/firestore-fleet';
import { Fleet, FleetStatus, ServiceType, MaintenanceLog } from '@/types/fleet';
import { formatRupiah } from '@/lib/currency';

export default function FleetsPage() {
    const { user } = useAuth();
    const router = useRouter();

    // Data State
    const [fleets, setFleets] = useState<Fleet[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals State
    const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);
    const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [selectedFleetForMaint, setSelectedFleetForMaint] = useState<Fleet | null>(null);

    // Forms State
    const [fleetForm, setFleetForm] = useState({ name: '', plateNumber: '', type: '', driverName: '', status: 'Available' as FleetStatus });
    const [maintForm, setMaintForm] = useState({ serviceType: 'Service Rutin' as ServiceType, description: '', cost: '', provider: '', date: new Date().toISOString().split('T')[0] });
    const [submitting, setSubmitting] = useState(false);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<MaintenanceLog[]>([]);
    const [selectedFleetForHistory, setSelectedFleetForHistory] = useState<Fleet | null>(null);

    // Subscribe to history when modal opens
    useEffect(() => {
        if (!user || !selectedFleetForHistory || !isHistoryModalOpen) return;

        const unsubscribe = subscribeToMaintenanceLogs(user.uid, selectedFleetForHistory.id, (data) => {
            setHistoryLogs(data);
        });

        return () => unsubscribe();
    }, [user, selectedFleetForHistory, isHistoryModalOpen]);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToFleets(user.uid, (data) => {
            setFleets(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // -- Derived Data --
    const filteredFleets = useMemo(() => {
        return fleets.filter(f =>
            f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.plateNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [fleets, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: fleets.length,
            available: fleets.filter(f => f.status === 'Available').length,
            onTrip: fleets.filter(f => f.status === 'On Trip').length,
            maintenance: fleets.filter(f => f.status === 'Maintenance').length,
        };
    }, [fleets]);

    // -- Handlers --

    const handleOpenAddFleet = () => {
        setEditingFleet(null);
        setFleetForm({ name: '', plateNumber: '', type: '', driverName: '', status: 'Available' });
        setIsFleetModalOpen(true);
    };

    const handleOpenEditFleet = (fleet: Fleet) => {
        setEditingFleet(fleet);
        setFleetForm({
            name: fleet.name,
            plateNumber: fleet.plateNumber,
            type: fleet.type,
            driverName: fleet.driverName || '',
            status: fleet.status
        });
        setIsFleetModalOpen(true);
    };

    const handleSaveFleet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || submitting) return;
        setSubmitting(true);
        try {
            if (editingFleet) {
                await updateFleet(editingFleet.id, fleetForm);
            } else {
                await addFleet(user.uid, fleetForm);
            }
            setIsFleetModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan data armada');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteFleet = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus armada ini?')) return;
        try {
            await deleteFleet(id);
        } catch (error) {
            console.error(error);
            alert('Gagal menghapus armada');
        }
    };

    const handleOpenMaintenance = (fleet: Fleet) => {
        setSelectedFleetForHistory(null); // Reset history selection just in case
        setSelectedFleetForMaint(fleet);
        setMaintForm({ serviceType: 'Service Rutin', description: '', cost: '', provider: '', date: new Date().toISOString().split('T')[0] });
        setIsMaintenanceModalOpen(true);
    };

    const handleOpenHistory = (fleet: Fleet) => {
        setSelectedFleetForHistory(fleet);
        setIsHistoryModalOpen(true);
    };

    const handleSaveMaintenance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedFleetForMaint || submitting) return;
        setSubmitting(true);
        try {
            await addMaintenanceLog(user.uid, {
                fleetId: selectedFleetForMaint.id,
                fleetName: selectedFleetForMaint.name, // Denormalized name
                date: new Date(maintForm.date),
                serviceType: maintForm.serviceType,
                description: maintForm.description,
                cost: Number(maintForm.cost),
                provider: maintForm.provider
            });

            // Auto-update status only if currently available? Or maybe ask user?
            // For now, let's just log it. 
            // Optional: If 'Perbaikan Berat', maybe set to Maintenance automatically?
            if (maintForm.serviceType === 'Perbaikan Berat') {
                await updateFleetStatus(selectedFleetForMaint.id, 'Maintenance');
            }

            setIsMaintenanceModalOpen(false);
            alert('Maintenance log recorded successfully!');
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan log maintenance');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: FleetStatus) => {
        switch (status) {
            case 'Available': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'On Trip': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Maintenance': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50 pb-20">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-30 transition-shadow duration-200">
                    <div className="container mx-auto px-4 sm:px-6 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <button
                                    onClick={() => router.push('/')}
                                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                                        <Truck className="text-rose-600" size={24} /> Manajemen Armada
                                    </h1>
                                    <p className="text-slate-500 text-xs sm:text-sm">Kelola aset kendaraan dan jadwal perawatan</p>
                                </div>
                            </div>
                            <button
                                onClick={handleOpenAddFleet}
                                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                            >
                                <Plus size={18} /> Tambah Armada
                            </button>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Armada</p>
                            <p className="text-xl sm:text-2xl font-bold text-slate-800">{stats.total}</p>
                        </div>
                        <div className="bg-white p-3 sm:p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/30">
                            <p className="text-emerald-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Siap Jalan</p>
                            <p className="text-xl sm:text-2xl font-bold text-emerald-700">{stats.available}</p>
                        </div>
                        <div className="bg-white p-3 sm:p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/30">
                            <p className="text-blue-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Sedang Jalan</p>
                            <p className="text-xl sm:text-2xl font-bold text-blue-700">{stats.onTrip}</p>
                        </div>
                        <div className="bg-white p-3 sm:p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/30">
                            <p className="text-rose-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Dalam Perbaikan</p>
                            <p className="text-xl sm:text-2xl font-bold text-rose-700">{stats.maintenance}</p>
                        </div>
                    </div>

                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 flex-1">
                            <Search className="text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Cari nama armada atau plat nomor..."
                                className="bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 flex-1 w-full text-sm sm:text-base"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Grid List */}
                    {loading ? (
                        <div className="text-center py-20 text-slate-400 animate-pulse">Loading fleet data...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {filteredFleets.map(fleet => (
                                <div key={fleet.id} className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden relative group flex flex-col">
                                    <div className="p-4 sm:p-5 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0">
                                                    <Truck size={20} className="sm:hidden" />
                                                    <Truck size={24} className="hidden sm:block" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-base sm:text-lg line-clamp-1">{fleet.name}</h3>
                                                    <p className="text-slate-500 text-[10px] sm:text-sm font-mono bg-slate-100 px-2 py-0.5 rounded inline-block mt-1 font-medium">{fleet.plateNumber}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap ${getStatusColor(fleet.status)}`}>
                                                {fleet.status === 'Available' ? 'Ready' : fleet.status}
                                            </span>
                                        </div>

                                        <div className="space-y-2 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <div className="flex justify-between text-xs sm:text-sm">
                                                <span className="text-slate-500">Tipe</span>
                                                <span className="font-medium text-slate-700">{fleet.type}</span>
                                            </div>
                                            <div className="flex justify-between text-xs sm:text-sm">
                                                <span className="text-slate-500">Driver</span>
                                                <span className="font-medium text-slate-700 truncate max-w-[120px]">{fleet.driverName || '-'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 mt-auto">
                                            <button
                                                onClick={() => handleOpenMaintenance(fleet)}
                                                className="col-span-2 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors border border-amber-200"
                                            >
                                                <Wrench size={14} className="sm:w-4 sm:h-4" /> Service
                                            </button>
                                            <button
                                                onClick={() => handleOpenHistory(fleet)}
                                                className="flex items-center justify-center p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-100 hover:border-indigo-100 bg-white"
                                                title="Riwayat Maintenance"
                                            >
                                                <FileText size={18} />
                                            </button>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleOpenEditFleet(fleet)}
                                                    className="flex-1 flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFleet(fleet.id)}
                                                    className="flex-1 flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && filteredFleets.length === 0 && (
                        <div className="text-center py-16 sm:py-20">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                                <Truck size={32} />
                            </div>
                            <h3 className="text-slate-800 font-bold mb-1">Belum ada armada</h3>
                            <p className="text-slate-500 text-sm px-4">Tambahkan kendaraan pertama Anda untuk mulai mengelola.</p>
                        </div>
                    )}
                </div>

                {/* --- Modals --- */}

                {/* Fleet Modal */}
                {isFleetModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-800">
                                    {editingFleet ? 'Edit Armada' : 'Tambah Armada Baru'}
                                </h3>
                                <button onClick={() => setIsFleetModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSaveFleet} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Armada / Kode</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                        placeholder="Contoh: Truck Box A"
                                        value={fleetForm.name}
                                        onChange={e => setFleetForm({ ...fleetForm, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Polisi</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono uppercase"
                                        placeholder="B 1234 XYZ"
                                        value={fleetForm.plateNumber}
                                        onChange={e => setFleetForm({ ...fleetForm, plateNumber: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipe</label>
                                        <select
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                            value={fleetForm.type}
                                            onChange={e => setFleetForm({ ...fleetForm, type: e.target.value })}
                                        >
                                            <option value="">Pilih Tipe</option>
                                            <option value="Blind Van">Blind Van</option>
                                            <option value="Pickup Box">Pickup Box</option>
                                            <option value="CDD Box">CDD Box</option>
                                            <option value="CDD Bak">CDD Bak</option>
                                            <option value="Fuso">Fuso</option>
                                            <option value="Wingbox">Wingbox</option>
                                            <option value="Lainnya">Lainnya</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status Awal</label>
                                        <select
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                            value={fleetForm.status}
                                            onChange={e => setFleetForm({ ...fleetForm, status: e.target.value as FleetStatus })}
                                        >
                                            <option value="Available">Available</option>
                                            <option value="On Trip">On Trip</option>
                                            <option value="Maintenance">Maintenance</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Driver Default (Opsional)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                        placeholder="Nama Supir"
                                        value={fleetForm.driverName}
                                        onChange={e => setFleetForm({ ...fleetForm, driverName: e.target.value })}
                                    />
                                </div>
                                <div className="pt-4 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsFleetModalOpen(false)}
                                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 shadow-lg shadow-rose-600/20 disabled:opacity-50"
                                    >
                                        {submitting ? 'Menyimpan...' : 'Simpan Armada'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Maintenance Modal */}
                {isMaintenanceModalOpen && selectedFleetForMaint && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        <Wrench size={18} className="text-amber-600" /> Catat Maintenance
                                    </h3>
                                    <p className="text-xs text-amber-700 mt-0.5">{selectedFleetForMaint.name} ({selectedFleetForMaint.plateNumber})</p>
                                </div>
                                <button onClick={() => setIsMaintenanceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSaveMaintenance} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                            value={maintForm.date}
                                            onChange={e => setMaintForm({ ...maintForm, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Service</label>
                                        <select
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                            value={maintForm.serviceType}
                                            onChange={e => setMaintForm({ ...maintForm, serviceType: e.target.value as ServiceType })}
                                        >
                                            <option value="Service Rutin">Service Rutin</option>
                                            <option value="Ganti Oli">Ganti Oli</option>
                                            <option value="Ban">Ganti Ban</option>
                                            <option value="Sparepart">Sparepart</option>
                                            <option value="Perbaikan Berat">Perbaikan Berat</option>
                                            <option value="Lainnya">Lainnya</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi / Keterangan</label>
                                    <textarea
                                        required
                                        rows={3}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                        placeholder="Detail pekerjaan..."
                                        value={maintForm.description}
                                        onChange={e => setMaintForm({ ...maintForm, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Biaya (Rp)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-2.5 text-slate-400 font-bold">Rp</span>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                                            placeholder="0"
                                            value={maintForm.cost}
                                            onChange={e => setMaintForm({ ...maintForm, cost: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Bengkel / Provider</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                        placeholder="Nama Bengkel"
                                        value={maintForm.provider}
                                        onChange={e => setMaintForm({ ...maintForm, provider: e.target.value })}
                                    />
                                </div>

                                <div className="bg-blue-50 p-3 rounded-lg flex gap-3 text-xs text-blue-700 items-start">
                                    <FileText size={16} className="mt-0.5 shrink-0" />
                                    <p>Biaya maintenance ini akan otomatis tercatat sebagai <strong>Pengeluaran (Expense)</strong> di laporan keuangan.</p>
                                </div>

                                <div className="pt-4 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsMaintenanceModalOpen(false)}
                                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 shadow-lg shadow-amber-600/20 disabled:opacity-50"
                                    >
                                        {submitting ? 'Menyimpan...' : 'Simpan Log'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </ProtectedRoute>
    );
}
