'use client';

import { useState, useEffect } from 'react';
import { Users, AlertTriangle, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import EmployeeList from '@/components/EmployeeList';
import EmployeeForm from '@/components/EmployeeForm';
import AttendanceReport from '@/components/AttendanceReport';
import { subscribeToEmployees } from '@/lib/firestore-employees';
import type { Employee } from '@/types/employee';

export default function EmployeesPage() {
    const { role } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'list' | 'reports'>('list');
    const [showForm, setShowForm] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToEmployees((data) => {
            setEmployees(data);
        });
        return () => unsubscribe();
    }, []);

    // Role Guard
    if (role !== 'owner' && role !== 'admin') {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-xl">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <AlertTriangle size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Dibatasi</h1>
                        <p className="text-gray-500 mb-6">Hanya Owner dan Admin yang dapat mengakses manajemen karyawan.</p>
                        <button
                            onClick={() => router.push('/')}
                            className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700 transition w-full"
                        >
                            Kembali ke Dashboard
                        </button>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    const handleAdd = () => {
        setSelectedEmployee(null);
        setShowForm(true);
    };

    const handleEdit = (employee: Employee) => {
        setSelectedEmployee(employee);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setSelectedEmployee(null);
    };

    const handleSuccess = () => {
        // Form will close itself and list will auto-update via subscription
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                <Users size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Manajemen Karyawan</h1>
                                <p className="text-sm text-gray-500">Kelola data karyawan, dokumen, dan gaji</p>
                            </div>
                        </div>
                        {/* Tabs */}
                        <div className="flex gap-2 border-b">
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'list'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Users size={16} className="inline mr-2" />
                                Daftar Karyawan
                            </button>
                            <button
                                onClick={() => setActiveTab('reports')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'reports'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FileText size={16} className="inline mr-2" />
                                Laporan Absensi
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {activeTab === 'list' && (
                        <EmployeeList
                            onAdd={handleAdd}
                            onEdit={handleEdit}
                        />
                    )}
                    {activeTab === 'reports' && (
                        <AttendanceReport employees={employees} />
                    )}
                </div>

                {/* Form Modal */}
                {showForm && (
                    <EmployeeForm
                        employee={selectedEmployee}
                        onClose={handleCloseForm}
                        onSuccess={handleSuccess}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}
