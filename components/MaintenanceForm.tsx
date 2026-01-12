'use client';

import { useState, useEffect } from 'react';
import { Fleet, MaintenanceLog, ServiceType } from '@/types/fleet';
import { addMaintenanceLog, updateMaintenanceLog } from '@/lib/firestore-fleet';
import { X } from 'lucide-react';

interface MaintenanceFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    logToEdit?: MaintenanceLog;
    fleets: Fleet[];
    userId: string;
}

const SERVICE_TYPES: ServiceType[] = [
    'Service Rutin',
    'Ganti Oli',
    'Ban',
    'Sparepart',
    'Perbaikan Berat',
    'Lainnya'
];

export default function MaintenanceForm({
    onSuccess,
    onCancel,
    logToEdit,
    fleets,
    userId
}: MaintenanceFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fleetId: logToEdit?.fleetId || '',
        date: logToEdit?.date ? new Date(logToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        serviceType: logToEdit?.serviceType || 'Service Rutin' as ServiceType,
        description: logToEdit?.description || '',
        cost: logToEdit?.cost || 0,
        provider: logToEdit?.provider || '',
    });

    const selectedFleet = fleets.find(f => f.id === formData.fleetId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.fleetId) {
            alert('Pilih kendaraan terlebih dahulu');
            return;
        }

        if (formData.cost <= 0) {
            alert('Biaya harus lebih dari 0');
            return;
        }

        setLoading(true);
        try {
            const fleet = fleets.find(f => f.id === formData.fleetId);
            if (!fleet) {
                alert('Kendaraan tidak ditemukan');
                return;
            }

            const logData = {
                fleetId: formData.fleetId,
                fleetName: `${fleet.plateNumber} - ${fleet.name}`,
                date: new Date(formData.date),
                serviceType: formData.serviceType,
                description: formData.description,
                cost: formData.cost,
                provider: formData.provider,
            };

            if (logToEdit) {
                await updateMaintenanceLog(logToEdit.id, logData);
                alert('Riwayat maintenance berhasil diupdate!');
            } else {
                await addMaintenanceLog(userId, logData);
                alert('Riwayat maintenance berhasil ditambahkan!');
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving maintenance log:', error);
            alert('Gagal menyimpan riwayat maintenance');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {logToEdit ? 'Edit Maintenance' : 'Tambah Maintenance'}
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Fleet Selection */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">
                            Kendaraan <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.fleetId}
                            onChange={(e) => setFormData(prev => ({ ...prev, fleetId: e.target.value }))}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">Pilih Kendaraan</option>
                            {fleets.map(fleet => (
                                <option key={fleet.id} value={fleet.id}>
                                    {fleet.plateNumber} - {fleet.name} ({fleet.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">
                            Tanggal <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Service Type */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">
                            Jenis Service <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.serviceType}
                            onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value as ServiceType }))}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        >
                            {SERVICE_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Provider */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">
                            Bengkel/Provider <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.provider}
                            onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                            placeholder="Nama bengkel"
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Cost */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">
                            Biaya <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.cost}
                            onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                            placeholder="0"
                            required
                            min="0"
                            step="1000"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">
                            Deskripsi <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Detail pekerjaan yang dilakukan..."
                            required
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Menyimpan...' : logToEdit ? 'Update' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
