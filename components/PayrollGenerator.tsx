'use client';

import { useState } from 'react';
import { Calculator, ChevronDown, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Employee } from '@/types/employee';
import type { PayrollCalculation, PayrollPeriod, MonthlyPayrollFormData } from '@/types/payroll';
import { getCurrentPeriod, formatPeriod } from '@/types/payroll';
import { formatRupiah } from '@/lib/currency';
import { calculateBulkPayroll } from '@/lib/payroll-calculator';
import { saveMonthlyPayroll, payrollExistsForPeriod } from '@/lib/firestore-payroll';

interface PayrollGeneratorProps {
    employees: Employee[];
    onSuccess: () => void;
}

export default function PayrollGenerator({ employees, onSuccess }: PayrollGeneratorProps) {
    const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod>(getCurrentPeriod());
    const [calculations, setCalculations] = useState<PayrollCalculation[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Generate period options (current month + last 6 months)
    const periodOptions: PayrollPeriod[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        periodOptions.push(`${year}-${month}`);
    }

    const handleGenerate = async () => {
        setError(null);
        setIsGenerating(true);

        try {
            // Check if payroll already exists
            const exists = await payrollExistsForPeriod(selectedPeriod);
            if (exists) {
                setError(`Payroll untuk ${formatPeriod(selectedPeriod)} sudah pernah dibuat. Silakan pilih periode lain.`);
                setIsGenerating(false);
                return;
            }

            // Calculate payroll for all active employees
            const activeEmployees = employees.filter(e => e.status === 'active');
            const calcs = await calculateBulkPayroll(activeEmployees, selectedPeriod);

            setCalculations(calcs);
            setShowPreview(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal generate payroll');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setError(null);
        setIsSaving(true);

        try {
            const totalGrossPay = calculations.reduce((sum, c) => sum + c.grossPay, 0);
            const totalNetPay = calculations.reduce((sum, c) => sum + c.netPay, 0);

            const payrollData: MonthlyPayrollFormData = {
                period: selectedPeriod,
                calculations,
                totalGrossPay,
                totalNetPay,
                totalEmployees: calculations.length,
                status: 'draft',
                notes: `Generated on ${new Date().toLocaleDateString('id-ID')}`
            };

            await saveMonthlyPayroll(payrollData);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal menyimpan payroll');
        } finally {
            setIsSaving(false);
        }
    };

    const totalGross = calculations.reduce((sum, c) => sum + c.grossPay, 0);
    const totalNet = calculations.reduce((sum, c) => sum + c.netPay, 0);

    return (
        <div className="space-y-6">
            {/* Period Selection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Calculator size={20} className="text-blue-600" />
                    Generate Payroll
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pilih Periode
                        </label>
                        <div className="relative">
                            <select
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value as PayrollPeriod)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-800 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {periodOptions.map(period => (
                                    <option key={period} value={period}>
                                        {formatPeriod(period)}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Menghitung...
                            </>
                        ) : (
                            <>
                                <Calculator size={20} />
                                Generate Payroll
                            </>
                        )}
                    </button>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Results */}
            {showPreview && calculations.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800">
                            Preview Payroll - {formatPeriod(selectedPeriod)}
                        </h3>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Total Karyawan</p>
                            <p className="text-2xl font-bold text-gray-800">{calculations.length}</p>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <p className="text-sm text-emerald-700 mb-1">Total Gross Pay</p>
                            <p className="text-xl font-bold text-emerald-800">{formatRupiah(totalGross)}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <p className="text-sm text-blue-700 mb-1">Total Net Pay</p>
                            <p className="text-xl font-bold text-blue-800">{formatRupiah(totalNet)}</p>
                        </div>
                    </div>

                    {/* Calculations Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Karyawan</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Hari Kerja</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Lembur</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Gross Pay</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Net Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {calculations.map((calc, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-800">{calc.employeeName}</p>
                                                    <p className="text-xs text-gray-500">{calc.employeeId}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-700">
                                                {calc.daysWorked} hari
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-700">
                                                {calc.overtimeEvents}x
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">
                                                {formatRupiah(calc.grossPay)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                                                {formatRupiah(calc.netPay)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowPreview(false)}
                            className="flex-1 py-3 px-6 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    Simpan Payroll
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
