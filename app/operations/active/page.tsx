'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Play, CheckSquare, Plus, Clock, Users } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { getEmployees } from '@/lib/firestore-employees';
import { getAttendanceByDate } from '@/lib/firestore-attendance';
import { 
    getMonthlySchedule, 
    createTruckOperation,
    updateTruckOperationStatus, 
    subscribeToDailyOperations 
} from '@/lib/firestore-operations';
import type { Employee } from '@/types/employee';
import type { Attendance } from '@/types/attendance';
import type { MonthlySchedule, TruckOperation } from '@/types/truck-operation';

export default function ActiveOperationsPage() {
    const { user, employee: currentUser, role, loading: authLoading } = useAuth();
    const router = useRouter();

    const [todayStr] = useState(() => new Date().toISOString().split('T')[0]);
    const [monthStr] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [presentHelpers, setPresentHelpers] = useState<Attendance[]>([]);
    const [monthlySchedule, setMonthlySchedule] = useState<MonthlySchedule | null>(null);
    const [operations, setOperations] = useState<TruckOperation[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);
    
    // Form state
    const [truckNumber, setTruckNumber] = useState('');
    const [selectedStackers, setSelectedStackers] = useState<string[]>([]);
    const [selectedEscort, setSelectedEscort] = useState('');

    useEffect(() => {
        if (authLoading) return;
        
        let unsub = () => {};
        if (user && ['admin', 'pengurus'].includes(role)) {
            loadInitialData();
            unsub = subscribeToDailyOperations(todayStr, setOperations);
        } else if (!user) {
            router.push('/');
        }
        return () => unsub();
    }, [user, role, authLoading, todayStr, router]);

    const loadInitialData = async () => {
        try {
            const [emps, atts, sched] = await Promise.all([
                getEmployees(),
                getAttendanceByDate(todayStr),
                getMonthlySchedule(monthStr)
            ]);
            
            setEmployees(emps);
            
            // Filter helpers who are present
            const presentAttr = atts.filter(a => ['present', 'late'].includes(a.status));
            setPresentHelpers(presentAttr);
            
            setMonthlySchedule(sched);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getEmpName = (id: string) => employees.find(e => e.id === id)?.fullName || 'Tidak Diketahui';

    // Get today's active loaders based on the monthly schedule
    const activeLoaders = (monthlySchedule?.loaderIds || []).filter(loaderId => 
        presentHelpers.some(att => att.employeeId === loaderId)
    );

    // Get available stackers from the pool who are present today
    const availableStackers = (monthlySchedule?.stackerPoolIds || []).filter(stackerId =>
        presentHelpers.some(att => att.employeeId === stackerId)
    );

    const handleStartOperation = async () => {
        if (!user) return;
        if (selectedStackers.length === 0) {
            alert('Wajib memilih minimal 1 penyusun!');
            return;
        }

        try {
            await createTruckOperation({
                date: todayStr,
                truckNumber: truckNumber.trim() || 'Truk Reguler',
                status: 'loading',
                stackerIds: selectedStackers,
                loaderIds: activeLoaders,
                escortId: selectedEscort || null,
                startTime: new Date(),
                endTime: null,
                createdBy: currentUser?.employeeId || user?.email || 'admin'
            });
            
            setShowNewModal(false);
            setTruckNumber('');
            setSelectedStackers([]);
            setSelectedEscort('');
        } catch (error) {
            console.error('Error starting operation:', error);
            alert('Gagal memulai sesi muat.');
        }
    };

    const handleFinishOperation = async (id: string) => {
        if (!confirm('Akhiri sesi pemuatan truk ini?')) return;
        try {
            await updateTruckOperationStatus(id, 'completed', { endTime: new Date() });
        } catch (error) {
            console.error('Error finishing op:', error);
            alert('Gagal mengakhiri operasi.');
        }
    };

    const toggleStacker = (id: string) => {
        setSelectedStackers(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= 2) {
                alert('Maksimal hanya 2 penyusun (stacker) per truk!');
                return prev;
            }
            return [...prev, id];
        });
    };

    if (authLoading || (!user) || !['admin', 'pengurus'].includes(role)) return null;

    return (
        <ProtectedRoute>
            <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Operasi Hari Ini</h1>
                        <p className="text-gray-500">Mulai pemuatan atau pantau aktivitas truk aktif.</p>
                    </div>
                    
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                    >
                        <Plus size={20} />
                        Mulai Muat Baru
                    </button>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border">
                        Memuat data operasional...
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {operations.length === 0 ? (
                            <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                                <Truck size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium">Belum ada aktivitas muat truk hari ini.</p>
                            </div>
                        ) : operations.map(op => (
                            <div key={op.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                                op.status === 'loading' ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
                            }`}>
                                <div className={`p-4 border-b flex justify-between items-center ${
                                    op.status === 'loading' ? 'bg-blue-50' : 'bg-gray-50'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        <Truck size={20} className={op.status === 'loading' ? 'text-blue-600' : 'text-gray-500'} />
                                        <h3 className="font-bold text-gray-800">{op.truckNumber}</h3>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                        op.status === 'loading' ? 'bg-blue-100 text-blue-700' : 
                                        op.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {op.status === 'loading' ? 'Sedang Muat' : 'Selesai'}
                                    </span>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="flex justify-between items-center text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Clock size={16} />
                                            <span>Mulai: {op.startTime ? op.startTime.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                                        </div>
                                        {op.endTime && (
                                            <div className="flex items-center gap-1">
                                                <CheckSquare size={16} />
                                                <span>Selesai: {op.endTime.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Penyusun</p>
                                            <div className="flex flex-wrap gap-1">
                                                {op.stackerIds.map(id => (
                                                    <span key={id} className="bg-purple-50 text-purple-700 border border-purple-100 text-sm px-2 py-1 rounded-md font-medium">
                                                        {getEmpName(id)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1 flex justify-between">
                                                <span>Tim Pemuat</span>
                                                <span>{op.loaderIds.length} orang</span>
                                            </p>
                                            <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded line-clamp-2" title={op.loaderIds.map(getEmpName).join(', ')}>
                                                {op.loaderIds.length > 0 
                                                    ? op.loaderIds.map(getEmpName).join(', ')
                                                    : 'Tidak ada tim muat'}
                                            </div>
                                        </div>

                                        {op.escortId && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Pengawal</p>
                                                <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                    {getEmpName(op.escortId)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {op.status === 'loading' && (
                                        <button
                                            onClick={() => handleFinishOperation(op.id!)}
                                            className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition-colors"
                                        >
                                            Selesaikan Pemuatan
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Buka Sesi Baru */}
            {showNewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b">
                            <h2 className="text-xl font-bold">Mulai Muat Baru</h2>
                            <p className="text-sm text-gray-500">Pilih penyusun dan tim muat akan otomatis ditarik dari absensi hari ini.</p>
                        </div>
                        
                        <div className="p-4 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plat Truk / Tujuan (Opsional)</label>
                                <input 
                                    type="text" 
                                    value={truckNumber}
                                    onChange={e => setTruckNumber(e.target.value)}
                                    placeholder="Contoh: B 1234 CD"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex justify-between items-center text-blue-800">
                                <div className="flex items-center gap-2">
                                    <Users size={18} />
                                    <span className="font-medium">Tim Muat Hadir Hari Ini</span>
                                </div>
                                <span className="font-bold text-lg">{activeLoaders.length}</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Penyusun (Maks 2)</label>
                                {availableStackers.length === 0 ? (
                                    <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
                                        Tidak ada calon penyusun yang hadir hari ini. Pastikan sudah diatur di Jadwal Bulanan.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {availableStackers.map(id => (
                                            <label key={id} className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                                                selectedStackers.includes(id) ? 'bg-purple-50 border-purple-300' : 'hover:bg-gray-50'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedStackers.includes(id)}
                                                    onChange={() => toggleStacker(id)}
                                                    className="mr-2 text-purple-600 rounded"
                                                />
                                                <span className="text-sm font-medium">{getEmpName(id)}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Pengawal (Opsional)</label>
                                <select 
                                    value={selectedEscort}
                                    onChange={e => setSelectedEscort(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg bg-white"
                                >
                                    <option value="">-- Tidak ada pengawal --</option>
                                    {presentHelpers.map(att => (
                                        <option key={att.employeeId} value={att.employeeId}>
                                            {getEmpName(att.employeeId)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setShowNewModal(false)}
                                className="px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-100"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleStartOperation}
                                disabled={selectedStackers.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Play size={18} />
                                Mulai Operasi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}
