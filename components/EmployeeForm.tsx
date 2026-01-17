'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { addEmployee, updateEmployee, peekNextEmployeeId, generateEmployeeId } from '@/lib/firestore-employees';
import { createAuthUser } from '@/app/actions/user-management';
import type { Employee, EmployeeFormData, EmployeeRole, EmployeeStatus, DocumentType, EmployeeDocument } from '@/types/employee';
import { EMPLOYEE_ROLE_LABELS, EMPLOYEE_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from '@/types/employee';
import { generateEmployeeEmail } from '@/types/roles';

interface EmployeeFormProps {
    employee?: Employee | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EmployeeForm({ employee, onClose, onSuccess }: EmployeeFormProps) {
    const [loading, setLoading] = useState(false);
    const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; password: string } | null>(null);
    const [formData, setFormData] = useState<EmployeeFormData>({
        employeeId: '',
        fullName: '',
        role: 'staff',
        status: 'active',
        joinDate: new Date(),
        contact: {
            phone: '',
            email: '',
            address: '',
            city: '',
            emergencyContactName: '',
            emergencyContactPhone: ''
        },
        documents: [],
        salaryConfig: {
            baseSalary: 0,
            allowance: 0,
            tripCommission: 0,
            commissionType: 'fixed'
        },
        photoUrl: '',
        jobdesk: '',
        notes: '',
        email: '',
        accountStatus: 'pending'
    });

    useEffect(() => {
        if (employee) {
            setFormData({
                employeeId: employee.employeeId,
                fullName: employee.fullName,
                role: employee.role,
                status: employee.status,
                joinDate: employee.joinDate,
                contact: employee.contact,
                documents: employee.documents,
                salaryConfig: employee.salaryConfig,
                photoUrl: employee.photoUrl,
                jobdesk: employee.jobdesk,
                notes: employee.notes,
                email: employee.email || '',
                authUid: employee.authUid,
                accountStatus: employee.accountStatus || 'pending'
            });
        } else {
            // Preview next ID (without incrementing counter)
            peekNextEmployeeId().then(id => {
                setFormData(prev => ({ ...prev, employeeId: id }));
            });
        }
    }, [employee]);

    // Auto-generate email when name changes
    useEffect(() => {
        if (!employee && formData.fullName) {
            const generatedEmail = generateEmployeeEmail(formData.fullName);
            setFormData(prev => ({ ...prev, email: generatedEmail }));
        }
    }, [formData.fullName, employee]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (employee) {
                await updateEmployee(employee.id, formData);
                onSuccess();
                onClose();
            } else {
                // Generate actual ID (this increments counter)
                const newId = await generateEmployeeId();

                // Create Firebase Auth user
                const authResult = await createAuthUser(formData.email, formData.fullName);

                if (!authResult.success) {
                    alert(authResult.error || 'Gagal membuat akun login');
                    setLoading(false);
                    return;
                }

                // Save employee with auth UID
                const employeeData = {
                    ...formData,
                    employeeId: newId,
                    authUid: authResult.uid,
                    accountStatus: 'active' as const
                };

                await addEmployee(employeeData);

                // Show credentials to admin
                setGeneratedCredentials({
                    email: formData.email,
                    password: authResult.password || ''
                });

                // Don't close immediately - show credentials first
            }
        } catch (error) {
            alert('Gagal menyimpan data karyawan');
            setLoading(false);
        } finally {
            if (employee) {
                setLoading(false);
            }
        }
    };

    const addDocument = () => {
        setFormData(prev => ({
            ...prev,
            documents: [...prev.documents, { type: 'KTP', number: '', expiryDate: null }]
        }));
    };

    const removeDocument = (index: number) => {
        setFormData(prev => ({
            ...prev,
            documents: prev.documents.filter((_, i) => i !== index)
        }));
    };

    const updateDocument = (index: number, field: keyof EmployeeDocument, value: any) => {
        setFormData(prev => ({
            ...prev,
            documents: prev.documents.map((doc, i) =>
                i === index ? { ...doc, [field]: value } : doc
            )
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">
                        {employee ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-gray-900">Informasi Dasar</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ID Karyawan
                                </label>
                                <input
                                    type="text"
                                    value={formData.employeeId}
                                    disabled
                                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama Lengkap *
                                </label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Posisi *</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as EmployeeRole }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    {Object.entries(EMPLOYEE_ROLE_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as EmployeeStatus }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Masuk *</label>
                                <input
                                    type="date"
                                    value={formData.joinDate.toISOString().split('T')[0]}
                                    onChange={(e) => setFormData(prev => ({ ...prev, joinDate: new Date(e.target.value) }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Auth Account Info (New Employee Only) */}
                    {!employee && (
                        <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h3 className="font-medium text-gray-900">Akun Login Karyawan</h3>
                            <div className="text-sm text-blue-700 mb-2">
                                Sistem akan membuat akun login otomatis untuk karyawan ini.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Login *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                    placeholder="nama@cahayacargo.com"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Password default: <code className="bg-gray-100 px-1 rounded">{formData.fullName.split(' ')[0].toLowerCase()}2026</code>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-gray-900">Kontak</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">No. HP *</label>
                                <input
                                    type="tel"
                                    value={formData.contact.phone}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        contact: { ...prev.contact, phone: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.contact.email}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        contact: { ...prev.contact, email: e.target.value }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                            <textarea
                                value={formData.contact.address}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, address: e.target.value }
                                }))}
                                rows={2}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kontak Darurat</label>
                                <input
                                    type="text"
                                    value={formData.contact.emergencyContactName}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        contact: { ...prev.contact, emergencyContactName: e.target.value }
                                    }))}
                                    placeholder="Nama"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                                <input
                                    type="tel"
                                    value={formData.contact.emergencyContactPhone}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        contact: { ...prev.contact, emergencyContactPhone: e.target.value }
                                    }))}
                                    placeholder="No. HP"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Documents */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium text-gray-900">Dokumen</h3>
                            <button
                                type="button"
                                onClick={addDocument}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                                <Plus size={16} />
                                Tambah Dokumen
                            </button>
                        </div>

                        {formData.documents.map((doc, index) => (
                            <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-gray-50">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                    <select
                                        value={doc.type}
                                        onChange={(e) => updateDocument(index, 'type', e.target.value as DocumentType)}
                                        className="px-2 py-1.5 border rounded bg-white text-sm"
                                    >
                                        {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>

                                    <input
                                        type="text"
                                        value={doc.number}
                                        onChange={(e) => updateDocument(index, 'number', e.target.value)}
                                        placeholder="Nomor Dokumen"
                                        className="px-2 py-1.5 border rounded text-sm"
                                    />

                                    <input
                                        type="date"
                                        value={doc.expiryDate || ''}
                                        onChange={(e) => updateDocument(index, 'expiryDate', e.target.value || null)}
                                        placeholder="Tanggal Kadaluarsa"
                                        className="px-2 py-1.5 border rounded text-sm"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeDocument(index)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Salary Config */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-gray-900">Konfigurasi Gaji</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gaji Pokok</label>
                                <input
                                    type="number"
                                    value={formData.salaryConfig.baseSalary}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        salaryConfig: { ...prev.salaryConfig, baseSalary: Number(e.target.value) }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Uang Makan/Harian</label>
                                <input
                                    type="number"
                                    value={formData.salaryConfig.allowance}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        salaryConfig: { ...prev.salaryConfig, allowance: Number(e.target.value) }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Komisi Trip</label>
                                <select
                                    value={formData.salaryConfig.commissionType}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        salaryConfig: { ...prev.salaryConfig, commissionType: e.target.value as 'fixed' | 'percentage' }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="fixed">Tetap per Trip</option>
                                    <option value="percentage">Persentase dari Omzet</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nilai Komisi {formData.salaryConfig.commissionType === 'percentage' ? '(%)' : '(Rp)'}
                                </label>
                                <input
                                    type="number"
                                    value={formData.salaryConfig.tripCommission}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        salaryConfig: { ...prev.salaryConfig, tripCommission: Number(e.target.value) }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            {/* Job Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Job Description / Tugas & Tanggung Jawab
                                </label>
                                <textarea
                                    value={formData.jobdesk}
                                    onChange={(e) => setFormData(prev => ({ ...prev, jobdesk: e.target.value }))}
                                    rows={5}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder={`Contoh:\n• Mengelola inventory gudang\n• Membuat laporan harian\n• Koordinasi dengan driver\n• Memastikan kualitas layanan`}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Karyawan dapat melihat job description ini di halaman profil mereka
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Catatan tambahan tentang karyawan ini..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                            {loading ? 'Menyimpan...' : (employee ? 'Update' : 'Simpan')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Credentials Modal */}
            {generatedCredentials && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-green-600 mb-4">✅ Karyawan Berhasil Ditambahkan!</h3>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                            <p className="font-medium text-yellow-800 mb-2">⚠️ Kredensial Login (Catat!)</p>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-gray-600">Email:</span>
                                    <div className="font-mono bg-white px-2 py-1 rounded border mt-1">
                                        {generatedCredentials.email}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-gray-600">Password:</span>
                                    <div className="font-mono bg-white px-2 py-1 rounded border mt-1">
                                        {generatedCredentials.password}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">
                            Berikan kredensial ini kepada karyawan untuk login ke sistem.
                        </p>

                        <button
                            onClick={() => {
                                setGeneratedCredentials(null);
                                onSuccess();
                                onClose();
                            }}
                            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            OK, Saya Sudah Catat
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
