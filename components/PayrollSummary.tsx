'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Users, Download, Calendar } from 'lucide-react';
import type { MonthlyPayroll } from '@/types/payroll';
import { formatPeriod } from '@/types/payroll';
import { formatRupiah } from '@/lib/currency';
import {
    calculatePayrollTrends,
    calculateRoleCostBreakdown,
    exportPayrollToCSV,
    type PayrollTrend
} from '@/lib/reports-helper';

interface PayrollSummaryProps {
    payrolls: MonthlyPayroll[];
}

const ROLE_COLORS: Record<string, string> = {
    'owner': '#6366f1',
    'admin': '#8b5cf6',
    'branch_manager': '#ec4899',
    'driver': '#10b981',
    'helper': '#14b8a6',
    'staff': '#f59e0b',
};

export default function PayrollSummary({ payrolls }: PayrollSummaryProps) {
    const [trends, setTrends] = useState<PayrollTrend[]>([]);
    const [selectedPayroll, setSelectedPayroll] = useState<MonthlyPayroll | null>(null);

    useEffect(() => {
        if (payrolls.length > 0) {
            const calculatedTrends = calculatePayrollTrends(payrolls);
            setTrends(calculatedTrends);
            setSelectedPayroll(payrolls[0]); // Latest payroll
        }
    }, [payrolls]);

    if (payrolls.length === 0) {
        return (
            <div className="text-center py-12">
                <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">No payroll data available yet</p>
                <p className="text-sm text-gray-400 mt-2">Generate your first payroll to see analytics</p>
            </div>
        );
    }

    const latest = trends[trends.length - 1];
    const roleBreakdown = selectedPayroll ? calculateRoleCostBreakdown(selectedPayroll) : [];

    // Format data for charts
    const trendChartData = trends.map(t => ({
        period: formatPeriod(t.period),
        grossPay: t.totalGrossPay / 1000000, // Convert to millions
        netPay: t.totalNetPay / 1000000,
        employees: t.employeeCount
    }));

    const roleChartData = roleBreakdown.map(r => ({
        role: r.role.replace('_', ' ').toUpperCase(),
        value: r.totalCost,
        percentage: r.percentage.toFixed(1),
        color: ROLE_COLORS[r.role] || '#64748b'
    }));

    const handleExportLatest = () => {
        if (selectedPayroll) {
            exportPayrollToCSV(selectedPayroll);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Payroll Analytics</h2>
                    <p className="text-sm text-gray-500">Last {trends.length} periods</p>
                </div>
                <button
                    onClick={handleExportLatest}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                    <Download size={18} />
                    Export Latest
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <DollarSign size={20} className="text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-500">Current Period</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        {formatRupiah(latest.totalNetPay)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatPeriod(latest.period)}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <TrendingUp size={20} className="text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-500">vs Previous</p>
                    </div>
                    <p className={`text-2xl font-bold ${!latest.changeFromPrevious ? 'text-gray-800' :
                        latest.changeFromPrevious > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                        {latest.changeFromPrevious
                            ? `${latest.changeFromPrevious > 0 ? '+' : ''}${latest.changeFromPrevious.toFixed(1)}%`
                            : 'N/A'
                        }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Month-over-month</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Users size={20} className="text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-500">Avg per Employee</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        {formatRupiah(latest.averagePerEmployee)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{latest.employeeCount} employees</p>
                </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Payroll Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} label={{ value: 'Million Rp', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            formatter={(value: any) => `Rp ${value.toFixed(2)}M`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="grossPay" stroke="#3b82f6" strokeWidth={2} name="Gross Pay" dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="netPay" stroke="#10b981" strokeWidth={2} name="Net Pay" dot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Role Distribution Pie Chart */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Cost by Role</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={roleChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry: any) => `${entry.role}: ${entry.percentage}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {roleChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: any) => formatRupiah(value)} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Employee Count Trend */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Employee Count Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={trendChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip />
                            <Bar dataKey="employees" fill="#8b5cf6" name="Employees" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Breakdown */}
            {selectedPayroll && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800">
                            Detailed Breakdown - {formatPeriod(selectedPayroll.period)}
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Role</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-600">Employees</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-600">Total Cost</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-600">% of Total</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-600">Avg per Employee</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {roleBreakdown.map((role) => (
                                    <tr key={role.role} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: ROLE_COLORS[role.role] || '#64748b' }}
                                                ></div>
                                                <span className="font-medium text-gray-800 capitalize">
                                                    {role.role.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-700">{role.employeeCount}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-800">
                                            {formatRupiah(role.totalCost)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-700">
                                            {role.percentage.toFixed(1)}%
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-700">
                                            {formatRupiah(role.totalCost / role.employeeCount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
