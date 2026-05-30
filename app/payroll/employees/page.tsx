'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRupiah } from '@/lib/currency';
import { 
  ArrowLeft, Users, Calendar, Printer, Plus, Trash2, HelpCircle 
} from 'lucide-react';

interface EmployeeRow {
  id: string;
  fullName: string;
  employeeId: string;
  role: string;
  status: string;
  daysPresent: number;
  daysLateMild: number;
  daysLateSevere: number;
  daysAbsent: number;
  grossPay: number;
  advanceDeduction: number;
  netPay: number;
}

const INITIAL_EMPLOYEES: EmployeeRow[] = [
  {
    id: '1',
    fullName: 'FAJAR',
    employeeId: 'EMP-036',
    role: 'helper',
    status: 'active',
    daysPresent: 25,
    daysLateMild: 0,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 1250000,
    advanceDeduction: 300000,
    netPay: 950000
  },
  {
    id: '2',
    fullName: 'ALDO',
    employeeId: 'EMP-037',
    role: 'helper',
    status: 'active',
    daysPresent: 23,
    daysLateMild: 0,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 1150000,
    advanceDeduction: 300000,
    netPay: 850000
  },
  {
    id: '3',
    fullName: 'PAWEIT',
    employeeId: 'EMP-024',
    role: 'helper',
    status: 'active',
    daysPresent: 22,
    daysLateMild: 0,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 1100000,
    advanceDeduction: 300000,
    netPay: 800000
  },
  {
    id: '4',
    fullName: 'AHMAD YANI',
    employeeId: 'EMP-027',
    role: 'helper',
    status: 'active',
    daysPresent: 22,
    daysLateMild: 0,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 1100000,
    advanceDeduction: 0,
    netPay: 1100000
  },
  {
    id: '5',
    fullName: 'DIAS FERDIANSAH',
    employeeId: 'EMP-022',
    role: 'helper',
    status: 'active',
    daysPresent: 22,
    daysLateMild: 2,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 1180000,
    advanceDeduction: 200000,
    netPay: 980000
  },
  {
    id: '6',
    fullName: 'YUDHA ARFIAN',
    employeeId: 'EMP-023',
    role: 'helper',
    status: 'active',
    daysPresent: 22,
    daysLateMild: 0,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 1100000,
    advanceDeduction: 100000,
    netPay: 1000000
  },
  {
    id: '7',
    fullName: 'MOCHAMAD WACHID',
    employeeId: 'EMP-026',
    role: 'helper',
    status: 'active',
    daysPresent: 20,
    daysLateMild: 2,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 1080000,
    advanceDeduction: 300000,
    netPay: 780000
  },
  {
    id: '8',
    fullName: 'ABD MANAB',
    employeeId: 'EMP-025',
    role: 'helper',
    status: 'active',
    daysPresent: 19,
    daysLateMild: 0,
    daysLateSevere: 0,
    daysAbsent: 0,
    grossPay: 950000,
    advanceDeduction: 0,
    netPay: 950000
  }
];

export default function EmployeeSalaryPage() {
  const { role } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState('2026-05');
  const [cycle, setCycle] = useState<'P1' | 'P2' | 'FULL'>('FULL');
  const [rows, setRows] = useState<EmployeeRow[]>(INITIAL_EMPLOYEES);

  // Calculations for dynamic totals
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, cur) => {
        acc.daysPresent += Number(cur.daysPresent || 0);
        acc.daysLateMild += Number(cur.daysLateMild || 0);
        acc.daysLateSevere += Number(cur.daysLateSevere || 0);
        acc.daysAbsent += Number(cur.daysAbsent || 0);
        acc.grossPay += Number(cur.grossPay || 0);
        acc.advanceDeduction += Number(cur.advanceDeduction || 0);
        acc.netPay += Number(cur.netPay || 0);
        return acc;
      },
      {
        daysPresent: 0,
        daysLateMild: 0,
        daysLateSevere: 0,
        daysAbsent: 0,
        grossPay: 0,
        advanceDeduction: 0,
        netPay: 0,
      }
    );
  }, [rows]);

  if (role !== 'admin' && role !== 'pengurus') {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <p className="text-gray-600">Akses ditolak. Hanya Owner dan Admin yang dapat mengakses payroll.</p>
            <button onClick={() => router.push('/')} className="mt-4 text-blue-600 hover:underline">
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const handleAddRow = () => {
    const nextId = String(Date.now());
    const newRow: EmployeeRow = {
      id: nextId,
      fullName: '',
      employeeId: `EMP-0${rows.length + 10}`,
      role: 'helper',
      status: 'active',
      daysPresent: 0,
      daysLateMild: 0,
      daysLateSevere: 0,
      daysAbsent: 0,
      grossPay: 0,
      advanceDeduction: 0,
      netPay: 0
    };
    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleChange = (index: number, field: keyof EmployeeRow, value: any) => {
    setRows(prev => {
      const newRows = [...prev];
      const row = { ...newRows[index] };

      if (field === 'fullName' || field === 'employeeId' || field === 'role' || field === 'status') {
        (row as any)[field] = value;
      } else {
        const numVal = Math.max(0, Number(value) || 0);
        (row as any)[field] = numVal;

        // Auto-estimation for Gross Pay and Net Pay based on rules
        // Hadir: Rp 50.000 | Telat R: Rp 40.000 | Telat B: Rp 30.000
        if (['daysPresent', 'daysLateMild', 'daysLateSevere', 'advanceDeduction'].includes(field)) {
          const pres = field === 'daysPresent' ? numVal : Number(row.daysPresent || 0);
          const mild = field === 'daysLateMild' ? numVal : Number(row.daysLateMild || 0);
          const severe = field === 'daysLateSevere' ? numVal : Number(row.daysLateSevere || 0);
          const adv = field === 'advanceDeduction' ? numVal : Number(row.advanceDeduction || 0);

          const estGross = (pres * 50000) + (mild * 40000) + (severe * 30000);
          const estNet = Math.max(0, estGross - adv);

          row.grossPay = estGross;
          row.netPay = estNet;
        } else if (field === 'grossPay') {
          const gross = numVal;
          const adv = Number(row.advanceDeduction || 0);
          row.netPay = Math.max(0, gross - adv);
        }
      }

      newRows[index] = row;
      return newRows;
    });
  };

  const handlePrintLabel = (row: EmployeeRow) => {
    if (!row.fullName.trim()) {
      alert("Harap isi nama karyawan terlebih dahulu.");
      return;
    }
    const data = encodeURIComponent(JSON.stringify({
      emp: {
        fullName: row.fullName.toUpperCase(),
        employeeId: row.employeeId,
        role: row.role,
        status: row.status
      },
      att: [],
      calc: {
        daysPresent: row.daysPresent,
        daysLateMild: row.daysLateMild,
        daysLateSevere: row.daysLateSevere,
        daysAbsent: row.daysAbsent,
        basePay: row.daysPresent * 50000,
        lateMildDeduction: row.daysLateMild * 10000,
        lateSevereDeduction: row.daysLateSevere * 20000,
        grossPay: row.grossPay,
        advanceDeduction: row.advanceDeduction,
        netPay: row.netPay
      },
      period: `${period}-${cycle}`
    }));
    router.push(`/payroll/employees/print-label?data=${data}`);
  };

  const handlePrintAllLabels = () => {
    const validRows = rows.filter(r => r.fullName.trim());
    if (validRows.length === 0) {
      alert("Tidak ada data karyawan yang valid untuk dicetak.");
      return;
    }
    const list = validRows.map(row => ({
      emp: {
        fullName: row.fullName.toUpperCase(),
        employeeId: row.employeeId,
        role: row.role,
        status: row.status
      },
      att: [],
      calc: {
        daysPresent: row.daysPresent,
        daysLateMild: row.daysLateMild,
        daysLateSevere: row.daysLateSevere,
        daysAbsent: row.daysAbsent,
        basePay: row.daysPresent * 50000,
        lateMildDeduction: row.daysLateMild * 10000,
        lateSevereDeduction: row.daysLateSevere * 20000,
        grossPay: row.grossPay,
        advanceDeduction: row.advanceDeduction,
        netPay: row.netPay
      },
      period: `${period}-${cycle}`
    }));
    const data = encodeURIComponent(JSON.stringify({ list }));
    router.push(`/payroll/employees/print-label?data=${data}`);
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div className="flex items-center gap-3">
            <Link href="/payroll" className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users size={24} className="text-blue-600" />
                Cetak Label Gaji Karyawan A6
              </h1>
              <p className="text-xs text-gray-500">Isi data secara manual untuk mencetak sticker slip gaji thermal</p>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2">
              <Calendar size={14} className="text-gray-400 ml-1" />
              <input 
                type="month" 
                value={period} 
                onChange={e => setPeriod(e.target.value)}
                className="px-2 py-2 bg-transparent text-sm outline-none font-medium" 
              />
            </div>
            <select 
              value={cycle} 
              onChange={e => setCycle(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="FULL">Sebulan Penuh</option>
              <option value="P1">Siklus 1 (Tgl 1-15)</option>
              <option value="P2">Siklus 2 (Tgl 16-Akhir)</option>
            </select>
            <button 
              onClick={handlePrintAllLabels}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/10"
            >
              <Printer size={16} /> Cetak Semua Label A6
            </button>
          </div>
        </div>

        {/* Informative Alert Rules */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 flex items-start gap-2.5 max-w-4xl shadow-sm">
          <HelpCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-blue-900">Ketentuan Perhitungan Otomatis (Tetap Bisa Diedit Manual):</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Hadir Tepat Waktu: <strong>Rp 50.000 / hari</strong></li>
              <li>Telat Ringan (TL): <strong>Rp 40.000 / hari</strong> (Potong Rp 10.000)</li>
              <li>Telat Berat (TB): <strong>Rp 30.000 / hari</strong> (Potong Rp 20.000)</li>
              <li>Gaji Kotor & Gaji Bersih dapat diketik langsung (di-override) untuk penyesuaian khusus.</li>
            </ul>
          </div>
        </div>

        {/* Manual Input Table Container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden max-w-7xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-center w-[50px]">No</th>
                  <th className="px-4 py-3">Nama Karyawan</th>
                  <th className="px-3 py-3 w-[120px]">ID</th>
                  <th className="px-2 py-3 text-center w-[70px]">Hadir</th>
                  <th className="px-2 py-3 text-center w-[70px]">Telat R</th>
                  <th className="px-2 py-3 text-center w-[70px]">Telat B</th>
                  <th className="px-2 py-3 text-center w-[70px]">Absen</th>
                  <th className="px-3 py-3 w-[130px]">Gaji Kotor</th>
                  <th className="px-3 py-3 w-[130px]">Potongan Bon</th>
                  <th className="px-3 py-3 w-[130px]">Gaji Bersih</th>
                  <th className="px-4 py-3 text-center w-[160px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-sm">
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-center font-bold text-gray-400">{index + 1}</td>
                    
                    {/* Employee Name */}
                    <td className="px-4 py-3.5">
                      <input 
                        type="text" 
                        value={row.fullName}
                        onChange={e => handleChange(index, 'fullName', e.target.value)}
                        placeholder="NAMA KARYAWAN"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm font-bold uppercase placeholder:font-normal"
                      />
                    </td>

                    {/* ID */}
                    <td className="px-3 py-3.5">
                      <input 
                        type="text" 
                        value={row.employeeId}
                        onChange={e => handleChange(index, 'employeeId', e.target.value)}
                        placeholder="EMP-XXX"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm font-mono font-bold"
                      />
                    </td>

                    {/* Hadir */}
                    <td className="px-2 py-3.5 text-center">
                      <input 
                        type="number" 
                        value={row.daysPresent === 0 ? '' : row.daysPresent}
                        onChange={e => handleChange(index, 'daysPresent', e.target.value)}
                        placeholder="0"
                        className="w-full px-1 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-center font-bold"
                      />
                    </td>

                    {/* Telat R */}
                    <td className="px-2 py-3.5 text-center">
                      <input 
                        type="number" 
                        value={row.daysLateMild === 0 ? '' : row.daysLateMild}
                        onChange={e => handleChange(index, 'daysLateMild', e.target.value)}
                        placeholder="0"
                        className="w-full px-1 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-center font-bold text-amber-700"
                      />
                    </td>

                    {/* Telat B */}
                    <td className="px-2 py-3.5 text-center">
                      <input 
                        type="number" 
                        value={row.daysLateSevere === 0 ? '' : row.daysLateSevere}
                        onChange={e => handleChange(index, 'daysLateSevere', e.target.value)}
                        placeholder="0"
                        className="w-full px-1 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-center font-bold text-orange-700"
                      />
                    </td>

                    {/* Absen */}
                    <td className="px-2 py-3.5 text-center">
                      <input 
                        type="number" 
                        value={row.daysAbsent === 0 ? '' : row.daysAbsent}
                        onChange={e => handleChange(index, 'daysAbsent', e.target.value)}
                        placeholder="0"
                        className="w-full px-1 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-center font-bold text-gray-400"
                      />
                    </td>

                    {/* Gaji Kotor */}
                    <td className="px-3 py-3.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">Rp</span>
                        <input 
                          type="number" 
                          value={row.grossPay === 0 ? '' : row.grossPay}
                          onChange={e => handleChange(index, 'grossPay', e.target.value)}
                          placeholder="0"
                          className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-right font-bold text-emerald-800"
                        />
                      </div>
                    </td>

                    {/* Potongan Bon */}
                    <td className="px-3 py-3.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">Rp</span>
                        <input 
                          type="number" 
                          value={row.advanceDeduction === 0 ? '' : row.advanceDeduction}
                          onChange={e => handleChange(index, 'advanceDeduction', e.target.value)}
                          placeholder="0"
                          className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-right font-bold text-red-700"
                        />
                      </div>
                    </td>

                    {/* Gaji Bersih */}
                    <td className="px-3 py-3.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">Rp</span>
                        <input 
                          type="number" 
                          value={row.netPay === 0 ? '' : row.netPay}
                          onChange={e => handleChange(index, 'netPay', e.target.value)}
                          placeholder="0"
                          className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-right font-bold text-blue-700 bg-blue-50/30"
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => handlePrintLabel(row)}
                          title="Cetak Label Karyawan ini"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-650 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-all"
                        >
                          <Printer size={13} /> Cetak A6
                        </button>
                        {rows.length > 1 && (
                          <button 
                            onClick={() => handleRemoveRow(row.id)}
                            title="Hapus Karyawan"
                            className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr className="bg-gray-100/60 font-black border-t-2 border-gray-200 text-gray-800">
                  <td colSpan={2} className="px-4 py-4 text-right text-xs uppercase tracking-wider">TOTAL</td>
                  <td className="px-3 py-4"></td>
                  <td className="px-2 py-4 text-center text-sm">{totals.daysPresent}</td>
                  <td className="px-2 py-4 text-center text-sm text-amber-800">{totals.daysLateMild}</td>
                  <td className="px-2 py-4 text-center text-sm text-orange-850">{totals.daysLateSevere}</td>
                  <td className="px-2 py-4 text-center text-sm text-gray-400">{totals.daysAbsent}</td>
                  <td className="px-3 py-4 text-right text-sm text-emerald-800">{formatRupiah(totals.grossPay)}</td>
                  <td className="px-3 py-4 text-right text-sm text-red-800">{formatRupiah(totals.advanceDeduction)}</td>
                  <td className="px-3 py-4 text-right text-sm text-blue-800">{formatRupiah(totals.netPay)}</td>
                  <td className="px-4 py-4"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table bottom tools */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <button 
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm"
            >
              <Plus size={14} className="text-blue-600" /> Tambah Baris Karyawan
            </button>
            <p className="text-xs text-gray-400 font-semibold">{rows.length} Karyawan Terdaftar</p>
          </div>
        </div>

        {/* Global Summary Card with Print Callout */}
        <div className="max-w-4xl bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1.5">
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider">Total Rekap Gaji Bersih ({rows.length} Karyawan)</p>
            <h2 className="text-3xl font-black">{formatRupiah(totals.netPay)}</h2>
            <p className="text-blue-150 text-[10px] text-blue-200 font-medium">Bulan: {period} &bull; Siklus: {cycle === 'FULL' ? 'Sebulan Penuh' : cycle === 'P1' ? 'Siklus 1' : 'Siklus 2'}</p>
          </div>
          <button 
            onClick={handlePrintAllLabels}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-blue-700 rounded-xl text-sm font-black hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 shadow-md shadow-black/10 shrink-0"
          >
            <Printer size={18} /> Cetak Semua Label A6
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
