'use client';

import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Calendar, AlertCircle } from 'lucide-react';
import { checkIn, checkOut, getTodayAttendance } from '@/lib/firestore-attendance';
import type { Attendance, ShiftType } from '@/types/attendance';
import { SHIFT_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types/attendance';

interface AttendanceCheckInProps {
    employeeId: string;
    employeeName: string;
}

export default function AttendanceCheckIn({ employeeId, employeeName }: AttendanceCheckInProps) {
    const [loading, setLoading] = useState(false);
    const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
    const [selectedShift, setSelectedShift] = useState<ShiftType>('regular');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [notes, setNotes] = useState('');

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Load today's attendance
    useEffect(() => {
        loadTodayAttendance();
    }, [employeeId]);

    const loadTodayAttendance = async () => {
        try {
            const record = await getTodayAttendance(employeeId);
            setTodayRecord(record);
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    };

    const handleCheckIn = async () => {
        if (!selectedShift) return;

        setLoading(true);
        try {
            await checkIn(employeeId, selectedShift, notes);
            await loadTodayAttendance();
            setNotes('');
        } catch (error) {
            alert('Gagal check-in. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        setLoading(true);
        try {
            await checkOut(employeeId);
            await loadTodayAttendance();
        } catch (error) {
            alert('Gagal check-out. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const hasActiveShift = todayRecord?.shifts.some(s => s.checkOut === null) || false;
    const lastShift = todayRecord?.shifts[todayRecord.shifts.length - 1];

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="max-w-md mx-auto">
            {/* Header Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 mb-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-sm opacity-90">Selamat Datang</p>
                        <h2 className="text-xl font-bold">{employeeName}</h2>
                    </div>
                </div>

                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                        <Calendar size={18} />
                        <span className="text-sm">{formatDate(currentTime)}</span>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-bold">{formatTime(currentTime)}</div>
                    </div>
                </div>
            </div>

            {/* Status Card */}
            {todayRecord && (
                <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <AlertCircle size={18} className="text-blue-500" />
                        Status Hari Ini
                    </h3>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Status:</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${todayRecord.status === 'present' ? 'bg-green-100 text-green-700' :
                                    todayRecord.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-700'
                                }`}>
                                {ATTENDANCE_STATUS_LABELS[todayRecord.status]}
                            </span>
                        </div>

                        {todayRecord.shifts.length > 0 && (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Check-In Pertama:</span>
                                    <span className="font-medium">{formatTime(todayRecord.shifts[0].checkIn)}</span>
                                </div>

                                {lastShift && lastShift.checkOut && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Check-Out Terakhir:</span>
                                        <span className="font-medium">{formatTime(lastShift.checkOut)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total Jam Kerja:</span>
                                    <span className="font-medium">{todayRecord.totalHours.toFixed(1)} jam</span>
                                </div>

                                {todayRecord.overtimeCount > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Lembur (Bongkar/Muat):</span>
                                        <span className="font-medium text-orange-600">{todayRecord.overtimeCount}x</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Action Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
                {hasActiveShift ? (
                    // Check Out Mode
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-green-800 text-sm font-medium mb-1">Shift Aktif</p>
                            <p className="text-green-600 text-xs">
                                {lastShift && SHIFT_TYPE_LABELS[lastShift.type]} • Dimulai {lastShift && formatTime(lastShift.checkIn)}
                            </p>
                        </div>

                        <button
                            onClick={handleCheckOut}
                            disabled={loading}
                            className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <LogOut size={20} />
                            {loading ? 'Memproses...' : 'CHECK OUT'}
                        </button>
                    </div>
                ) : (
                    // Check In Mode
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Pilih Tipe Shift
                            </label>
                            <div className="space-y-2">
                                {(['regular', 'overtime_loading', 'overtime_unloading'] as ShiftType[]).map((type) => (
                                    <label
                                        key={type}
                                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${selectedShift === type
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="shift"
                                            value={type}
                                            checked={selectedShift === type}
                                            onChange={(e) => setSelectedShift(e.target.value as ShiftType)}
                                            className="mr-3"
                                        />
                                        <span className="font-medium">{SHIFT_TYPE_LABELS[type]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Catatan (opsional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Tambahkan catatan jika perlu..."
                                rows={2}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                        </div>

                        <button
                            onClick={handleCheckIn}
                            disabled={loading}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <LogIn size={20} />
                            {loading ? 'Memproses...' : 'CHECK IN'}
                        </button>
                    </div>
                )}
            </div>

            {/* Helper Text */}
            <div className="mt-4 text-center text-sm text-gray-500">
                {hasActiveShift ? (
                    <p>Jangan lupa check-out saat shift selesai</p>
                ) : (
                    <p>Pilih tipe shift sesuai pekerjaan Anda hari ini</p>
                )}
            </div>
        </div>
    );
}
