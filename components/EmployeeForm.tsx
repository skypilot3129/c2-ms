'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { addEmployee, updateEmployee, peekNextEmployeeId, generateEmployeeId } from '@/lib/firestore-employees';
import { createAuthUser } from '@/app/actions/user-management';
import type { Employee, EmployeeFormData, EmployeeRole, EmployeeStatus, DocumentType, EmployeeDocument } from '@/types/employee';
import { EMPLOYEE_ROLE_LABELS, EMPLOYEE_STATUS_LABELS, DOCUMENT_TYPE_LABELS, GENDER_LABELS, MARITAL_STATUS_LABELS } from '@/types/employee';
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
        role: 'helper',
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
            dailyRate: 50000,
            allowance: 0,
            lateDeduction1: 10000,
            lateDeduction2: 20000,
            truckOperationalBudget: 700000,
            stackingBonus: 50000,
            tripCommission: 0,
            commissionType: 'fixed'
        },
        ktpIdentity: {
            nik: '',
            namaLengkap: '',
            tempatLahir: '',
            tanggalLahir: '',
            jenisKelamin: 'Laki-laki',
            alamatKTP: '',
            rt: '',
            rw: '',
            kelurahan: '',
            kecamatan: '',
            kabupatenKota: '',
            provinsi: '',
            agama: '',
            statusPerkawinan: 'Belum Kawin',
            pekerjaan: '',
            kewarganegaraan: 'WNI'
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
                accountStatus: employee.accountStatus || 'pending',
                ktpIdentity: employee.ktpIdentity || {
                    nik: '',
                    namaLengkap: '',
                    tempatLahir: '',
                    tanggalLahir: '',
                    jenisKelamin: 'Laki-laki',
                    alamatKTP: '',
                    rt: '',
                    rw: '',
                    kelurahan: '',
                    kecamatan: '',
                    kabupatenKota: '',
                    provinsi: '',
                    agama: '',
                    statusPerkawinan: 'Belum Kawin',
                    pekerjaan: '',
                    kewarganegaraan: 'WNI'
                }
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

                    {/* Data Identitas KTP */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-gray-900 border-b pb-2">Identitas Karyawan (Sesuai KTP)</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">NIK KTP *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.nik || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, nik: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap KTP *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.namaLengkap || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, namaLengkap: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Lahir *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.tempatLahir || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, tempatLahir: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir *</label>
                                <input
                                    type="date"
                                    value={formData.ktpIdentity?.tanggalLahir || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, tanggalLahir: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin *</label>
                                <select
                                    value={formData.ktpIdentity?.jenisKelamin || 'Laki-laki'}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, jenisKelamin: e.target.value as any }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg bg-white"
                                >
                                    {Object.entries(GENDER_LABELS).map(([v, l]) => (
                                        <option key={v} value={v}>{l}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Agama *</label>
                                <select
                                    value={formData.ktpIdentity?.agama || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, agama: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg bg-white"
                                >
                                    <option value="">Pilih Agama</option>
                                    <option value="Islam">Islam</option>
                                    <option value="Kristen Protestan">Kristen Protestan</option>
                                    <option value="Katolik">Katolik</option>
                                    <option value="Hindu">Hindu</option>
                                    <option value="Buddha">Buddha</option>
                                    <option value="Konghucu">Konghucu</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Sesuai KTP *</label>
                            <textarea
                                value={formData.ktpIdentity?.alamatKTP || ''}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    ktpIdentity: { ...prev.ktpIdentity!, alamatKTP: e.target.value }
                                }))}
                                rows={2}
                                required
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">RT *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.rt || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, rt: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">RW *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.rw || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, rw: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kelurahan/Desa *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.kelurahan || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, kelurahan: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kecamatan *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.kecamatan || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, kecamatan: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kabupaten/Kota *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.kabupatenKota || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, kabupatenKota: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Provinsi *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.provinsi || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, provinsi: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status Perkawinan *</label>
                                <select
                                    value={formData.ktpIdentity?.statusPerkawinan || 'Belum Kawin'}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, statusPerkawinan: e.target.value as any }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg bg-white"
                                >
                                    {Object.entries(MARITAL_STATUS_LABELS).map(([v, l]) => (
                                        <option key={v} value={v}>{l}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pekerjaan *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.pekerjaan || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, pekerjaan: e.target.value }
                                    }))}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kewarganegaraan *</label>
                                <input
                                    type="text"
                                    value={formData.ktpIdentity?.kewarganegaraan || 'WNI'}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        ktpIdentity: { ...prev.ktpIdentity!, kewarganegaraan: e.target.value }
                                    }))}
                                    required
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
                        <h3 className="font-medium text-gray-900 border-b pb-2">
                            Konfigurasi Gaji ({formData.role === 'helper' ? 'Helper' : 'Staff / Pengurus'})
                        </h3>

                        {formData.role !== 'helper' && (
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
                        )}

                        {formData.role === 'helper' && (
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gaji Kehadiran Harian</label>
                                        <input
                                            type="number"
                                            value={formData.salaryConfig.dailyRate}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                salaryConfig: { ...prev.salaryConfig, dailyRate: Number(e.target.value) }
                                            }))}
                                            className="w-full px-3 py-2 border rounded-lg border-blue-200 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center mt-6">
                                        Standar: Rp 50.000 per hari absen
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Potongan Telat (1-2 Jam)</label>
                                        <input
                                            type="number"
                                            value={formData.salaryConfig.lateDeduction1}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                salaryConfig: { ...prev.salaryConfig, lateDeduction1: Number(e.target.value) }
                                            }))}
                                            className="w-full px-3 py-2 border rounded-lg border-amber-200 focus:border-amber-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Potongan Telat (&gt;2 Jam)</label>
                                        <input
                                            type="number"
                                            value={formData.salaryConfig.lateDeduction2}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                salaryConfig: { ...prev.salaryConfig, lateDeduction2: Number(e.target.value) }
                                            }))}
                                            className="w-full px-3 py-2 border rounded-lg border-red-200 focus:border-red-500"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Porsi Susun Barang (Bonus Truk)</label>
                                        <input
                                            type="number"
                                            value={formData.salaryConfig.stackingBonus}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                salaryConfig: { ...prev.salaryConfig, stackingBonus: Number(e.target.value) }
                                            }))}
                                            className="w-full px-3 py-2 border rounded-lg"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Total budget operasional truk: Rp 700.000</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 mt-6">
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
