'use client';

import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Save, Navigation, ToggleLeft, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import { getAttendanceLocationSettings, updateAttendanceLocationSettings } from '@/lib/firestore-settings';
import type { AttendanceLocationSettings } from '@/lib/firestore-settings';
import { getCurrentPosition, calculateDistance, formatDistance } from '@/lib/geolocation';
import type { OfficeLocation } from '@/types/attendance';

export default function AttendanceLocationSettingsComponent() {
    const [settings, setSettings] = useState<AttendanceLocationSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gettingLocation, setGettingLocation] = useState<string | null>(null); // location id being updated
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await getAttendanceLocationSettings();
            setSettings(data);
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await updateAttendanceLocationSettings(settings);
            setSuccessMsg('Pengaturan berhasil disimpan!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            alert('Gagal menyimpan pengaturan. Coba lagi.');
        } finally {
            setSaving(false);
        }
    };

    const toggleEnabled = () => {
        if (!settings) return;
        setSettings({ ...settings, enabled: !settings.enabled });
    };

    const updateLocation = (id: string, field: keyof OfficeLocation, value: string | number) => {
        if (!settings) return;
        setSettings({
            ...settings,
            locations: settings.locations.map(loc =>
                loc.id === id ? { ...loc, [field]: value } : loc
            ),
        });
    };

    const addLocation = () => {
        if (!settings) return;
        const newId = `loc_${Date.now()}`;
        setSettings({
            ...settings,
            locations: [
                ...settings.locations,
                {
                    id: newId,
                    name: '',
                    lat: 0,
                    lng: 0,
                    radius: settings.defaultRadius || 100,
                },
            ],
        });
    };

    const removeLocation = (id: string) => {
        if (!settings) return;
        if (settings.locations.length <= 1) {
            alert('Minimal harus ada satu lokasi.');
            return;
        }
        setSettings({
            ...settings,
            locations: settings.locations.filter(loc => loc.id !== id),
        });
    };

    const useCurrentLocation = async (locationId: string) => {
        setGettingLocation(locationId);
        try {
            const position = await getCurrentPosition();
            updateLocation(locationId, 'lat', parseFloat(position.lat.toFixed(6)));
            updateLocation(locationId, 'lng', parseFloat(position.lng.toFixed(6)));
        } catch (error: any) {
            alert(error.message || 'Gagal mendapatkan lokasi.');
        } finally {
            setGettingLocation(null);
        }
    };

    const updateDefaultRadius = (radius: number) => {
        if (!settings) return;
        setSettings({ ...settings, defaultRadius: radius });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <MapPin size={20} className="text-blue-500" />
                            Validasi Lokasi Absensi
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Jika aktif, karyawan hanya bisa absen di lokasi yang ditentukan
                        </p>
                    </div>
                    <button
                        onClick={toggleEnabled}
                        className="flex items-center gap-2"
                    >
                        {settings.enabled ? (
                            <ToggleRight size={40} className="text-blue-500" />
                        ) : (
                            <ToggleLeft size={40} className="text-gray-400" />
                        )}
                    </button>
                </div>

                {settings.enabled && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-blue-700">
                                Pastikan koordinat lokasi sudah benar sebelum mengaktifkan fitur ini.
                                Karyawan yang berada di luar radius tidak akan bisa check-in/check-out.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Default Radius */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
                <h3 className="font-semibold text-gray-900 mb-4">Radius Default</h3>
                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        value={settings.defaultRadius}
                        onChange={(e) => updateDefaultRadius(parseInt(e.target.value) || 100)}
                        min={10}
                        max={5000}
                        className="w-32 px-3 py-2 border rounded-lg text-sm"
                    />
                    <span className="text-sm text-gray-500">meter</span>
                    <div className="flex gap-2 ml-auto">
                        {[50, 100, 200, 500].map(r => (
                            <button
                                key={r}
                                onClick={() => updateDefaultRadius(r)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${settings.defaultRadius === r
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {r}m
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Locations List */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Lokasi Kantor</h3>
                    <button
                        onClick={addLocation}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-blue-600 transition-colors"
                    >
                        <Plus size={16} />
                        Tambah Lokasi
                    </button>
                </div>

                <div className="space-y-4">
                    {settings.locations.map((loc, index) => (
                        <div key={loc.id} className="border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-400 uppercase">
                                    Lokasi #{index + 1}
                                </span>
                                <button
                                    onClick={() => removeLocation(loc.id)}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Hapus lokasi"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Lokasi</label>
                                <input
                                    type="text"
                                    value={loc.name}
                                    onChange={(e) => updateLocation(loc.id, 'name', e.target.value)}
                                    placeholder="Contoh: Kantor Pusat Surabaya"
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>

                            {/* Coordinates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={loc.lat}
                                        onChange={(e) => updateLocation(loc.id, 'lat', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={loc.lng}
                                        onChange={(e) => updateLocation(loc.id, 'lng', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            {/* Use current location button */}
                            <button
                                onClick={() => useCurrentLocation(loc.id)}
                                disabled={gettingLocation === loc.id}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {gettingLocation === loc.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Navigation size={14} />
                                )}
                                {gettingLocation === loc.id ? 'Mendapatkan lokasi...' : 'Gunakan Lokasi Saat Ini'}
                            </button>

                            {/* Radius */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Radius (meter)
                                </label>
                                <input
                                    type="number"
                                    value={loc.radius}
                                    onChange={(e) => updateLocation(loc.id, 'radius', parseInt(e.target.value) || 100)}
                                    min={10}
                                    max={5000}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Save Button */}
            <div className="sticky bottom-4">
                {successMsg && (
                    <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 text-center font-medium">
                        {successMsg}
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg"
                >
                    {saving ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <Save size={20} />
                    )}
                    {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
            </div>
        </div>
    );
}
