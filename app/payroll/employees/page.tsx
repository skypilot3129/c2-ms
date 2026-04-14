'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToEmployees } from '@/lib/firestore-employees';
import { subscribeToEmployeeAdvances, updateEmployeeAdvance, saveMonthlySalaryRecord, subscribeToMonthlySalaries } from '@/lib/firestore-payroll-ops';
import type { Employee } from '@/types/employee';
import type { AttendanceDay, EmployeeAdvance, MonthlySalaryRecord } from '@/types/payroll-ops';
import { DAILY_RATE, LATE_MILD_DEDUCTION, LATE_SEVERE_DEDUCTION, computeDayPay, ATTENDANCE_TYPE_LABELS } from '@/types/payroll-ops';
import { getEmployeeAttendance } from '@/lib/firestore-attendance';
import { getPeriodDateRange } from '@/types/payroll';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, Calendar, Save, Printer, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, AlertTriangle, Edit2, Check, Minus,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const monthName = (period: string) => {
  const [y, m] = period.split('-');
  const names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${names[+m - 1]} ${y}`;
};

const daysInMonth = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

const buildEmptyAttendance = (period: string, cycle: string): AttendanceDay[] => {
  const [y, m] = period.split('-').map(Number);
  const totalDays = new Date(y, m, 0).getDate();
  
  let start = 1;
  let end = totalDays;
  
  if (cycle === 'P1') {
    end = 15;
  } else if (cycle === 'P2') {
    start = 16;
  }
  
  const days: AttendanceDay[] = [];
  for (let i = start; i <= end; i++) {
    const d = String(i).padStart(2, '0');
    const date = `${y}-${String(m).padStart(2, '0')}-${d}`;
    const dayOfWeek = new Date(date).getDay(); // 0=Sun 6=Sat
    days.push({
      date,
      type: dayOfWeek === 0 ? 'absent' : 'present', // default Sunday off
      overridden: false,
    } as AttendanceDay);
  }
  return days;
};

const TYPE_COLORS: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  late_mild: 'bg-amber-100 text-amber-700 border-amber-300',
  late_severe: 'bg-orange-100 text-orange-700 border-orange-300',
  absent: 'bg-gray-100 text-gray-400 border-gray-200',
};

const CYCLE: AttendanceDay['type'][] = ['present', 'late_mild', 'late_severe', 'absent'];

const computeSalary = (att: AttendanceDay[], advances: EmployeeAdvance[], period: string) => {
  const daysPresent = att.filter(d => d.type !== 'absent').length;
  const lateMild = att.filter(d => d.type === 'late_mild' && !d.overridden).length;
  const lateSevere = att.filter(d => d.type === 'late_severe' && !d.overridden).length;
  const basePay = daysPresent * DAILY_RATE;
  const lateMildDed = lateMild * LATE_MILD_DEDUCTION;
  const lateSevereDed = lateSevere * LATE_SEVERE_DEDUCTION;
  const activeAdvances = advances.filter(a => a.status === 'active');
  const advanceDed = activeAdvances.reduce((s, a) => s + a.amount, 0);
  const grossPay = basePay - lateMildDed - lateSevereDed;
  const netPay = grossPay - advanceDed;
  return {
    daysPresent,
    daysLateMild: lateMild,
    daysLateSevere: lateSevere,
    daysAbsent: att.filter(d => d.type === 'absent').length,
    basePay,
    lateMildDeduction: lateMildDed,
    lateSevereDeduction: lateSevereDed,
    advanceDeduction: advanceDed,
    advanceIds: activeAdvances.map(a => a.id),
    grossPay,
    netPay: Math.max(0, netPay),
  };
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmployeeSalaryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [period, setPeriod] = useState(defaultPeriod);
  const [cycle, setCycle] = useState<'P1' | 'P2' | 'FULL'>('P1');
  const fullPeriod = useMemo(() => cycle === 'FULL' ? period : `${period}-${cycle}`, [period, cycle]);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [savedRecords, setSavedRecords] = useState<MonthlySalaryRecord[]>([]);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceDay[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    const u1 = subscribeToEmployees(data => setEmployees(data.filter(e => e.role === 'helper' && e.status === 'active')));
    const u2 = subscribeToEmployeeAdvances(setAdvances);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    const u = subscribeToMonthlySalaries(fullPeriod, setSavedRecords);
    return u;
  }, [fullPeriod]);

  // Init attendance per employee from saved or empty
  useEffect(() => {
    const map: Record<string, AttendanceDay[]> = {};
    employees.forEach(emp => {
      const saved = savedRecords.find(r => r.employeeId === emp.id);
      map[emp.id] = saved ? saved.attendance : buildEmptyAttendance(period, cycle);
    });
    setAttendance(map);
  }, [employees, savedRecords, period, cycle]);

  const toggleDay = useCallback((empId: string, idx: number) => {
    setAttendance(prev => {
      const days = [...prev[empId]];
      const current = days[idx];
      const nextType = CYCLE[(CYCLE.indexOf(current.type) + 1) % CYCLE.length];
      days[idx] = { ...current, type: nextType, overridden: false };
      return { ...prev, [empId]: days };
    });
  }, []);

  const handleSyncAttendance = async () => {
    setSyncing(true);
    try {
      // Determine date range based on cycle
      const [y, m] = period.split('-').map(Number);
      const totalDays = new Date(y, m, 0).getDate();
      let startDay = 1, endDay = totalDays;
      
      if (cycle === 'P1') endDay = 15;
      else if (cycle === 'P2') startDay = 16;
      
      const startStr = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      const endStr = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      
      const newMap = { ...attendance };
      
      for (const emp of employees) {
        const realData = await getEmployeeAttendance(emp.id, startStr, endStr);
        const baseDays = buildEmptyAttendance(period, cycle);
        
        realData.forEach(real => {
           const idx = baseDays.findIndex(d => d.date === real.date);
           if (idx !== -1) {
             let mappedType: AttendanceDay['type'] = 'absent';
             if (real.status === 'present') mappedType = 'present';
             else if (real.status === 'late_mild') mappedType = 'late_mild';
             else if (real.status === 'late_severe') mappedType = 'late_severe';
             else if (real.status === 'late') {
               const regularShift = real.shifts.find(s => s.type === 'regular');
               if (regularShift) {
                 const checkInHour = new Date(regularShift.checkIn).getHours();
                 mappedType = checkInHour < 11 ? 'late_mild' : 'late_severe';
               } else {
                 mappedType = 'late_mild';
               }
             } else if (real.status === 'leave' || real.status === 'absent') {
               mappedType = 'absent';
             }
             
             const existingOverridden = newMap[emp.id]?.[idx]?.overridden || false;
             
             baseDays[idx] = {
               ...baseDays[idx],
               type: mappedType,
               overridden: existingOverridden
             };
           }
        });
        newMap[emp.id] = baseDays;
      }
      
      setAttendance(newMap);
      alert(`Berhasil menarik data absensi karyawan (${cycle === 'P1' ? 'Tgl 1-15' : cycle === 'P2' ? 'Tgl 16-Selesai' : 'Sebulan'}).`);
    } catch (e) {
      console.error(e);
      alert('Gagal menyinkronkan data.');
    } finally {
      setSyncing(false);
    }
  };

  const toggleOverride = useCallback((empId: string, idx: number) => {
    setAttendance(prev => {
      const days = [...prev[empId]];
      days[idx] = { ...days[idx], overridden: !days[idx].overridden };
      return { ...prev, [empId]: days };
    });
  }, []);

  const empAdvances = (empId: string) => advances.filter(a => a.employeeId === empId && a.status === 'active');

  const handleSave = async (emp: Employee) => {
    const att = attendance[emp.id] || buildEmptyAttendance(period, cycle);
    const calc = computeSalary(att, empAdvances(emp.id), fullPeriod);
    setSaving(emp.id);
    try {
      await saveMonthlySalaryRecord({
        employeeId: emp.id,
        employeeName: emp.fullName,
        period: fullPeriod,
        attendance: att,
        ...calc,
        notes: '',
      });
      // Mark deducted advances
      for (const id of calc.advanceIds) {
        await updateEmployeeAdvance(id, { status: 'deducted', deductedMonth: fullPeriod });
      }
      alert(`Gaji ${emp.fullName} berhasil disimpan!`);
    } catch { alert('Gagal menyimpan'); }
    finally { setSaving(null); }
  };

  const handlePrint = (emp: Employee) => {
    const att = attendance[emp.id] || [];
    const calc = computeSalary(att, empAdvances(emp.id), fullPeriod);
    const savedRec = savedRecords.find(r => r.employeeId === emp.id);
    const data = encodeURIComponent(JSON.stringify({ emp, att, calc, period: fullPeriod, savedAt: savedRec?.updatedAt }));
    router.push(`/payroll/employees/print?data=${data}`);
  };

  return (
    <ProtectedRoute>
      <div className="space-y-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/payroll" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft size={16} /> Kembali
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Users size={20} className="text-blue-600" /> Gaji Karyawan
            </h1>
            <p className="text-xs text-gray-500">Input absensi & hitung gaji bulanan helper</p>
          </div>
          {/* Period selector */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2">
               <Calendar size={14} className="text-gray-400 ml-1" />
               <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                 className="px-2 py-2 bg-transparent text-sm outline-none font-medium" />
            </div>
            <select 
              value={cycle} 
              onChange={e => setCycle(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="P1">Siklus 1 (Tgl 1-15)</option>
              <option value="P2">Siklus 2 (Tgl 16-Akhir)</option>
              <option value="FULL">Sebulan Penuh</option>
            </select>
            <button onClick={handleSyncAttendance} disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 shadow-sm">
              <Clock size={16} /> {syncing ? 'Menarik...' : 'Tarik Data Absensi'}
            </button>
          </div>
        </div>

        {/* Employee Cards */}
        {employees.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p>Tidak ada karyawan aktif (role: helper) ditemukan.</p>
          </div>
        )}

        {employees.map(emp => {
          const att = attendance[emp.id] || [];
          const calc = computeSalary(att, empAdvances(emp.id), period);
          const isOpen = expandedEmp === emp.id;
          const isSaved = !!savedRecords.find(r => r.employeeId === emp.id);

          return (
            <div key={emp.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Card Header */}
              <div
                className="px-4 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedEmp(isOpen ? null : emp.id)}
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                  {emp.fullName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm">{emp.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {calc.daysPresent}h hadir · {calc.daysLateMild}h telat ringan · {calc.daysLateSevere}h telat berat
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-blue-600 text-sm">{formatRupiah(calc.netPay)}</p>
                  {isSaved && <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 justify-end"><CheckCircle2 size={10} />Tersimpan</span>}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>

              {/* Expanded Content */}
              {isOpen && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Info aturan */}
                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex gap-2">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5 text-blue-500" />
                    <span>Ketuk tanggal untuk ganti status. Aktifkan <strong>Kelonggaran (✓)</strong> agar tetap dapat Rp 50.000 meski telat.</span>
                  </div>

                  {/* Attendance Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => (
                      <div key={d} className="text-center text-[9px] font-bold text-gray-400 py-1">{d}</div>
                    ))}
                    {/* Empty cells for first day of month */}
                    {(() => {
                      const firstDay = new Date(att[0]?.date + 'T00:00:00').getDay();
                      return Array.from({ length: firstDay }, (_, i) => <div key={'e' + i} />);
                    })()}
                    {att.map((day, idx) => {
                      const isLate = day.type === 'late_mild' || day.type === 'late_severe';
                      const pay = computeDayPay(day);
                      const d = new Date(day.date + 'T00:00:00');
                      const isSun = d.getDay() === 0;
                      return (
                        <div key={day.date} className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => toggleDay(emp.id, idx)}
                            className={`w-full aspect-square rounded-lg border text-[10px] font-bold transition-all ${TYPE_COLORS[day.type]} ${isSun ? 'opacity-60' : ''}`}
                          >
                            {d.getDate()}
                          </button>
                          {isLate && !day.overridden && (
                            <button
                              onClick={() => toggleOverride(emp.id, idx)}
                              title="Aktifkan kelonggaran"
                              className="w-full text-[8px] py-0.5 rounded bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                            >override</button>
                          )}
                          {isLate && day.overridden && (
                            <button
                              onClick={() => toggleOverride(emp.id, idx)}
                              title="Hapus kelonggaran"
                              className="w-full text-[8px] py-0.5 rounded bg-emerald-100 text-emerald-600 font-bold transition-colors"
                            >✓ full</button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {Object.entries(TYPE_COLORS).map(([k, cls]) => (
                      <span key={k} className={`px-2 py-0.5 rounded border ${cls} font-medium`}>{ATTENDANCE_TYPE_LABELS[k as keyof typeof ATTENDANCE_TYPE_LABELS]}</span>
                    ))}
                  </div>

                  {/* Salary Breakdown */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    <h4 className="font-bold text-gray-700 text-xs mb-3">Rincian Gaji</h4>
                    <div className="flex justify-between"><span className="text-gray-500">{calc.daysPresent} hari × Rp 50.000</span><span className="font-medium">{formatRupiah(calc.basePay)}</span></div>
                    {calc.daysLateMild > 0 && <div className="flex justify-between text-amber-700"><span>{calc.daysLateMild} telat ringan × -Rp 10.000</span><span>-{formatRupiah(calc.lateMildDeduction)}</span></div>}
                    {calc.daysLateSevere > 0 && <div className="flex justify-between text-orange-700"><span>{calc.daysLateSevere} telat berat × -Rp 20.000</span><span>-{formatRupiah(calc.lateSevereDeduction)}</span></div>}
                    <div className="flex justify-between font-semibold border-t border-gray-200 pt-2"><span>Gaji Bersih (sebelum bon)</span><span>{formatRupiah(calc.grossPay)}</span></div>
                    {calc.advanceDeduction > 0 && <div className="flex justify-between text-red-600"><span>Potongan Bon ({empAdvances(emp.id).length}x)</span><span>-{formatRupiah(calc.advanceDeduction)}</span></div>}
                    <div className="flex justify-between font-bold text-blue-700 border-t border-gray-200 pt-2 text-base"><span>TOTAL DITERIMA</span><span>{formatRupiah(calc.netPay)}</span></div>
                  </div>

                  {/* Advances active */}
                  {empAdvances(emp.id).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500">Bon Aktif (akan dipotong):</p>
                      {empAdvances(emp.id).map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-xs font-medium text-red-800">{a.description}</p>
                            <p className="text-[10px] text-red-500">{new Date(a.date).toLocaleDateString('id-ID')}</p>
                          </div>
                          <span className="font-bold text-red-700 text-sm">{formatRupiah(a.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => handlePrint(emp)}
                      className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                      <Printer size={14} /> Cetak PDF
                    </button>
                    <button onClick={() => handleSave(emp)} disabled={saving === emp.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all">
                      <Save size={14} /> {saving === emp.id ? 'Menyimpan...' : isSaved ? 'Perbarui' : 'Simpan Gaji'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Summary card */}
        {savedRecords.length > 0 && (
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-lg shadow-blue-600/20">
            <p className="text-blue-100 text-xs font-medium mb-2">Total Gaji {monthName(period)} ({cycle}) — {savedRecords.length} karyawan</p>
            <p className="text-3xl font-bold">{formatRupiah(savedRecords.reduce((s, r) => s + r.netPay, 0))}</p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
