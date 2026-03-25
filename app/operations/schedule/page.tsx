'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Save, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getEmployees } from '@/lib/firestore-employees';
import { getMonthlySchedule, saveMonthlySchedule } from '@/lib/firestore-operations';
import { useAuth } from '@/context/AuthContext';
import type { Employee } from '@/types/employee';
import type { MonthlySchedule } from '@/types/truck-operation';

export default function MonthlySchedulePage() {
    const { user, employee: currentUser, role, loading: authLoading } = useAuth();
    const router = useRouter();

    const [month, setMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });
    
    const [helpers, setHelpers] = useState<Employee[]>([]);
    const [loaderIds, setLoaderIds] = useState<string[]>([]);
    const [stackerPoolIds, setStackerPoolIds] = useState<string[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (authLoading) return;
        
        if (user && ['admin', 'pengurus'].includes(role)) {
            loadData();
        } else if (!user) {
            router.push('/');
        }
    }, [user, role, authLoading, month, router]);

    const loadData = async () => {
        setLoading(true);
        setMessage(null);
        try {
            // Load helpers
            const empData = await getEmployees();
            const activeHelpers = empData.filter(e => e.role === 'helper' && e.status === 'active');
            setHelpers(activeHelpers);
            
            // Load schedule for selected month
            const schedule = await getMonthlySchedule(month);
            if (schedule) {
                setLoaderIds(schedule.loaderIds);
                setStackerPoolIds(schedule.stackerPoolIds);
            } else {
                setLoaderIds([]);
                setStackerPoolIds([]);
            }
        } catch (error) {
            console.error('Error loading schedule data:', error);
            setMessage({ type: 'error', text: 'Gagal memuat data.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        
        setSaving(true);
        setMessage(null);
        try {
            const schedule: MonthlySchedule = {
                month,
                loaderIds,
                stackerPoolIds,
                updatedBy: currentUser?.employeeId || user?.email || 'admin'
            };
            
            await saveMonthlySchedule(schedule);
            setMessage({ type: 'success', text: 'Jadwal bulanan berhasil disimpan!' });
            
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error saving schedule:', error);
            setMessage({ type: 'error', text: 'Gagal menyimpan jadwal.' });
        } finally {
            setSaving(false);
        }
    };

    const toggleLoader = (id: string) => {
        setLoaderIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleStacker = (id: string) => {
        setStackerPoolIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(x => x !== id);
            }
            if (prev.length >= 4) {
                alert('Maksimal hanya 4 orang calon penyusun.');
                return prev;
            }
            return [...prev, id];
        });
    };

    if (authLoading || (!user) || !['admin', 'pengurus'].includes(role)) {
        return null;
    }

    return (
        <ProtectedRoute>
            <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Jadwal Muat Bulanan</h1>
                        <p className="text-gray-500">Pilih tim muat dan 4 calon penyusun per bulan.</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white px-3 py-2 border rounded-lg shadow-sm">
                        <Calendar size={20} className="text-blue-500" />
                        <input 
                            type="month" 
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            className="boder-none outline-none font-medium bg-transparent"
                        />
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg flex items-center gap-2 ${
                        message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        {message.text}
                    </div>
                )}

                {loading ? (
                    <div className="py-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border">
                        Memuat data karyawan...
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Loaders Selection */}
                        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                    <UserCheck size={18} className="text-blue-500" />
                                    Tim Muat ({loaderIds.length})
                                </h2>
                            </div>
                            <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                                {helpers.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">Belum ada helper aktif.</p>
                                ) : helpers.map(emp => (
                                    <label key={emp.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                        loaderIds.includes(emp.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'
                                    }`}>
                                        <input 
                                            type="checkbox"
                                            checked={loaderIds.includes(emp.id)}
                                            onChange={() => toggleLoader(emp.id)}
                                            className="mr-3 w-4 h-4 text-blue-600 rounded"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-800">{emp.fullName}</p>
                                            <p className="text-xs text-gray-500">{emp.employeeId}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Stackers Selection */}
                        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                    <UserCheck size={18} className="text-purple-500" />
                                    Calon Penyusun ({stackerPoolIds.length}/4)
                                </h2>
                            </div>
                            <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                                {helpers.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">Belum ada helper aktif.</p>
                                ) : helpers.map(emp => {
                                    const isStacker = stackerPoolIds.includes(emp.id);
                                    // Normally stackers should be within loaders, but we show all just in case
                                    const isLoader = loaderIds.includes(emp.id);
                                    
                                    return (
                                        <label key={`stacker-${emp.id}`} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                            isStacker ? 'bg-purple-50 border-purple-200' : 'hover:bg-gray-50 border-gray-100'
                                        } ${!isLoader && !isStacker ? 'opacity-50' : ''}`}>
                                            <input 
                                                type="checkbox"
                                                checked={isStacker}
                                                onChange={() => toggleStacker(emp.id)}
                                                className="mr-3 w-4 h-4 text-purple-600 rounded"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800">{emp.fullName}</p>
                                                <p className="text-xs text-gray-500">
                                                    {!isLoader && 'Bukan Tim Muat'}
                                                </p>
                                            </div>
                                            {isStacker && (
                                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                                                    Penyusun
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        <Save size={20} />
                        {saving ? 'Menyimpan...' : `Simpan Jadwal ${month}`}
                    </button>
                </div>
            </div>
        </ProtectedRoute>
    );
}
