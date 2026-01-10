'use client';

import { useState, useEffect } from 'react';
import { User, Phone, Calendar, AlertTriangle, Edit, Trash2, Plus } from 'lucide-react';
import { subscribeToEmployees, deleteEmployee } from '@/lib/firestore-employees';
import type { Employee, EmployeeRole } from '@/types/employee';
import { EMPLOYEE_ROLE_LABELS, EMPLOYEE_STATUS_LABELS, isDocumentExpiringSoon } from '@/types/employee';

interface EmployeeListProps {
    onEdit: (employee: Employee) => void;
    onAdd: () => void;
    roleFilter?: EmployeeRole;
}

export default function EmployeeList({ onEdit, onAdd, roleFilter }: EmployeeListProps) {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeToEmployees((data) => {
            setEmployees(data);
            setLoading(false);
        }, roleFilter);

        return () => unsubscribe();
    }, [roleFilter]);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Hapus karyawan "${name}"?\nData ini tidak bisa dikembalikan.`)) return;

        try {
            await deleteEmployee(id);
        } catch (error) {
            alert('Gagal menghapus karyawan. Pastikan tidak ada data terkait.');
        }
    };

    // Check if employee has expiring documents
    const hasExpiringDocs = (emp: Employee) => {
        return (emp.documents || []).some(doc => isDocumentExpiringSoon(doc));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-gray-500">Memuat data karyawan...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold">Daftar Karyawan</h2>
                    <p className="text-sm text-gray-500">{employees.length} karyawan terdaftar</p>
                </div>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                    <Plus size={18} />
                    Tambah Karyawan
                </button>
            </div>

            {/* Table */}
            {employees.length === 0 ? (
                <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                    Belum ada karyawan terdaftar. Tambahkan karyawan pertama Anda!
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ID</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nama</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Posisi</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Kontak</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tanggal Masuk</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {employees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm">{emp.employeeId}</span>
                                            {hasExpiringDocs(emp) && (
                                                <span title="Ada dokumen yang akan expired">
                                                    <AlertTriangle size={16} className="text-amber-500" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <User size={16} className="text-gray-400" />
                                            <span className="font-medium">{emp.fullName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.role === 'driver' ? 'bg-blue-100 text-blue-800' :
                                            emp.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                            {EMPLOYEE_ROLE_LABELS[emp.role] || emp.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 text-sm text-gray-600">
                                            <Phone size={14} />
                                            <span>{emp.contact?.phone || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-800' :
                                            emp.status === 'suspended' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                            {EMPLOYEE_STATUS_LABELS[emp.status] || emp.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 text-sm text-gray-600">
                                            <Calendar size={14} />
                                            <span>{emp.joinDate ? emp.joinDate.toLocaleDateString('id-ID') : '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => onEdit(emp)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp.id, emp.fullName)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                title="Hapus"
                                            >
                                                <Trash2 size={16} />
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
    );
}
