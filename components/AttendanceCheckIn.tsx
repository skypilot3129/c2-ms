'use client';

import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Calendar, AlertCircle, MapPin, Navigation, Loader2, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { checkIn, checkOut, getTodayAttendance } from '@/lib/firestore-attendance';
import { getAttendanceLocationSettings } from '@/lib/firestore-settings';
import type { AttendanceLocationSettings } from '@/lib/firestore-settings';
import { getCurrentPosition, findNearestLocation, formatDistance, isWithinAnyLocation } from '@/lib/geolocation';
import type { Attendance, ShiftType, GeoLocation } from '@/types/attendance';
import { SHIFT_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types/attendance';

interface AttendanceCheckInProps {
    employeeId: string;
    employeeName: string;
}

type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'error' | 'disabled';

export default function AttendanceCheckIn({ employeeId, employeeName }: AttendanceCheckInProps) {
    const [loading, setLoading] = useState(false);
    const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
    const [selectedShift, setSelectedShift] = useState<ShiftType>('regular');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [notes, setNotes] = useState('');

    // Location states
    const [locationSettings, setLocationSettings] = useState<AttendanceLocationSettings | null>(null);
    const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
    const [currentPosition, setCurrentPosition] = useState<GeoLocation | null>(null);
    const [locationError, setLocationError] = useState<string>('');
    const [nearestInfo, setNearestInfo] = useState<{
        locationName: string;
        distance: number;
        isWithin: boolean;
    } | null>(null);

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Load location settings
    useEffect(() => {
        loadLocationSettings();
    }, []);

    // Load today's attendance
    useEffect(() => {
        loadTodayAttendance();
    }, [employeeId]);

    const loadLocationSettings = async () => {
        try {
            const settings = await getAttendanceLocationSettings();
            setLocationSettings(settings);

            if (settings.enabled) {
                // Auto-request location
                requestLocation();
            } else {
                setLocationStatus('disabled');
            }
        } catch (error) {
            console.error('Error loading location settings:', error);
            setLocationStatus('disabled');
        }
    };

    const requestLocation = async () => {
        setLocationStatus('loading');
        setLocationError('');

        try {
            const position = await getCurrentPosition();
            setCurrentPosition(position);
            setLocationStatus('granted');

            // Check nearest location
            if (locationSettings) {
                const nearest = findNearestLocation(position, locationSettings.locations);
                if (nearest) {
                    setNearestInfo({
                        locationName: nearest.location.name,
                        distance: nearest.distance,
                        isWithin: nearest.isWithin,
                    });
                }
            }
        } catch (error: any) {
            setLocationStatus('error');
            setLocationError(error.message || 'Gagal mendapatkan lokasi');
        }
    };

    const loadTodayAttendance = async () => {
        try {
            const record = await getTodayAttendance(employeeId);
            setTodayRecord(record);
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    };

    const isLocationValid = (): boolean => {
        // If location validation is disabled, always valid
        if (!locationSettings?.enabled) return true;
        // If we have a position and it's within a valid location
        if (currentPosition && locationSettings) {
            return isWithinAnyLocation(currentPosition, locationSettings.locations);
        }
        return false;
    };

    const handleCheckIn = async () => {
        if (!selectedShift) return;

        // Re-check location before check-in
        if (locationSettings?.enabled) {
            if (!isLocationValid()) {
                alert('Anda harus berada di lokasi kantor yang ditentukan untuk melakukan check-in.');
                return;
            }
        }

        setLoading(true);
        try {
            await checkIn(employeeId, selectedShift, notes, currentPosition || undefined);
            await loadTodayAttendance();
            setNotes('');
        } catch (error) {
            alert('Gagal check-in. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        // Re-check location before check-out
        if (locationSettings?.enabled) {
            if (!isLocationValid()) {
                alert('Anda harus berada di lokasi kantor yang ditentukan untuk melakukan check-out.');
                return;
            }
        }

        setLoading(true);
        try {
            await checkOut(employeeId, currentPosition || undefined);
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

    const canCheckInOut = isLocationValid() || !locationSettings?.enabled;

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

            {/* Location Status Card */}
            {locationSettings?.enabled && (
                <div className={`rounded-xl p-4 mb-6 shadow-sm border ${locationStatus === 'granted' && nearestInfo?.isWithin
                        ? 'bg-green-50 border-green-200'
                        : locationStatus === 'granted' && !nearestInfo?.isWithin
                            ? 'bg-red-50 border-red-200'
                            : locationStatus === 'loading'
                                ? 'bg-blue-50 border-blue-200'
                                : locationStatus === 'error' || locationStatus === 'denied'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-gray-50 border-gray-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${locationStatus === 'granted' && nearestInfo?.isWithin
                                ? 'bg-green-100'
                                : locationStatus === 'granted' && !nearestInfo?.isWithin
                                    ? 'bg-red-100'
                                    : locationStatus === 'loading'
                                        ? 'bg-blue-100'
                                        : 'bg-red-100'
                            }`}>
                            {locationStatus === 'loading' ? (
                                <Loader2 size={20} className="text-blue-500 animate-spin" />
                            ) : locationStatus === 'granted' && nearestInfo?.isWithin ? (
                                <CheckCircle2 size={20} className="text-green-600" />
                            ) : locationStatus === 'granted' && !nearestInfo?.isWithin ? (
                                <XCircle size={20} className="text-red-600" />
                            ) : (
                                <MapPin size={20} className="text-red-500" />
                            )}
                        </div>

                        <div className="flex-1">
                            {locationStatus === 'loading' && (
                                <>
                                    <p className="text-sm font-medium text-blue-800">Mendapatkan Lokasi...</p>
                                    <p className="text-xs text-blue-600">Mohon tunggu dan izinkan akses GPS</p>
                                </>
                            )}
                            {locationStatus === 'granted' && nearestInfo && (
                                <>
                                    <p className={`text-sm font-medium ${nearestInfo.isWithin ? 'text-green-800' : 'text-red-800'}`}>
                                        {nearestInfo.isWithin ? '✅ Dalam Jangkauan' : '❌ Di Luar Jangkauan'}
                                    </p>
                                    <p className={`text-xs ${nearestInfo.isWithin ? 'text-green-600' : 'text-red-600'}`}>
                                        {nearestInfo.locationName} • {formatDistance(nearestInfo.distance)}
                                    </p>
                                </>
                            )}
                            {(locationStatus === 'error' || locationStatus === 'denied') && (
                                <>
                                    <p className="text-sm font-medium text-red-800">Lokasi Tidak Tersedia</p>
                                    <p className="text-xs text-red-600">{locationError}</p>
                                </>
                            )}
                        </div>

                        {(locationStatus === 'error' || locationStatus === 'denied' || (locationStatus === 'granted' && !nearestInfo?.isWithin)) && (
                            <button
                                onClick={requestLocation}
                                className="px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                            >
                                <Navigation size={12} />
                                Refresh
                            </button>
                        )}
                    </div>

                    {/* Requirement notice */}
                    <div className="mt-3 pt-3 border-t border-current/10">
                        <div className="flex items-center gap-1.5 text-xs opacity-70">
                            <Shield size={12} />
                            <span>Validasi lokasi aktif — absensi hanya bisa dilakukan di area kantor</span>
                        </div>
                    </div>
                </div>
            )}

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
                            disabled={loading || !canCheckInOut}
                            className={`w-full py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${canCheckInOut
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <LogOut size={20} />
                            {loading ? 'Memproses...' : !canCheckInOut ? 'Lokasi Tidak Valid' : 'CHECK OUT'}
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
                            disabled={loading || !canCheckInOut}
                            className={`w-full py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${canCheckInOut
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <LogIn size={20} />
                            {loading ? 'Memproses...' : !canCheckInOut ? 'Lokasi Tidak Valid' : 'CHECK IN'}
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
