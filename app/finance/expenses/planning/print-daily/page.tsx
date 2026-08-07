'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import { EXPENSE_CATEGORY_LABELS, ExpensePlan } from '@/types/voyage';
import { getExpensePlanByDate, getExpensePlansByDateRange, subscribeToExpenses } from '@/lib/firestore-expenses';
import { ArrowLeft, Printer, Calendar, MapPin, Phone } from 'lucide-react';

interface DayPlanGroup {
    date: string;
    formattedDate: string;
    dayName: string;
    plan: ExpensePlan | null;
    totalAmount: number;
}

const STATUS_LABEL: Record<string, { label: string; badgeClass: string }> = {
    planned: { label: 'Direncanakan', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    done:    { label: 'Terealisasi',   badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    canceled:{ label: 'Dibatalkan',    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200' },
};

function PrintDailyPlanContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const mode = searchParams.get('mode') || 'single'; // 'single' | 'weekly'
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startDateParam = searchParams.get('startDate') || targetDate;
    const endDateParam = searchParams.get('endDate') || targetDate;

    const [loading, setLoading] = useState(true);
    const [singlePlan, setSinglePlan] = useState<ExpensePlan | null>(null);
    const [weeklyPlans, setWeeklyPlans] = useState<DayPlanGroup[]>([]);
    const [actualExpensesMap, setActualExpensesMap] = useState<Record<string, number>>({});
    const [printDateStr, setPrintDateStr] = useState<string>('');

    // Format current timestamp for header print info
    useEffect(() => {
        const now = new Date();
        setPrintDateStr(now.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
    }, []);

    // Load data based on mode
    useEffect(() => {
        if (!user) return;
        let isMounted = true;
        setLoading(true);

        const loadData = async () => {
            try {
                if (mode === 'single') {
                    // Try session storage first for instant render
                    const cached = sessionStorage.getItem(`cce_plan_${targetDate}`);
                    if (cached) {
                        setSinglePlan(JSON.parse(cached));
                    } else {
                        const fetched = await getExpensePlanByDate(targetDate, user.uid);
                        if (isMounted) setSinglePlan(fetched);
                    }
                } else if (mode === 'weekly') {
                    // Generate full 7 days sequence from startDateParam
                    const start = new Date(startDateParam + 'T00:00:00');
                    const days: DayPlanGroup[] = [];

                    // Fetch plans in range
                    const fetchedPlans = await getExpensePlansByDateRange(startDateParam, endDateParam, user.uid);
                    const planMap = new Map<string, ExpensePlan>();
                    fetchedPlans.forEach(p => planMap.set(p.date, p));

                    // Build 7 days
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(start);
                        d.setDate(d.getDate() + i);
                        const dateStr = d.toISOString().split('T')[0];

                        const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
                        const formattedDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                        const plan = planMap.get(dateStr) || null;

                        const totalAmount = plan
                            ? plan.items.filter(it => it.status !== 'canceled').reduce((sum, item) => sum + item.estimatedAmount, 0)
                            : 0;

                        days.push({ date: dateStr, formattedDate, dayName, plan, totalAmount });
                    }

                    if (isMounted) setWeeklyPlans(days);
                }
            } catch (err) {
                console.error('Error loading print data:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();

        // Subscribe to actual expenses for comparisons
        const unsub = subscribeToExpenses(user.uid, (expenses) => {
            const map: Record<string, number> = {};
            expenses.forEach(e => {
                const ds = typeof e.date === 'string' ? e.date.split('T')[0] : new Date(e.date).toISOString().split('T')[0];
                map[ds] = (map[ds] || 0) + e.amount;
            });
            if (isMounted) setActualExpensesMap(map);
        });

        return () => {
            isMounted = false;
            unsub();
        };
    }, [user, mode, targetDate, startDateParam, endDateParam]);

    const handlePrint = () => {
        window.print();
    };

    // Date label for single mode
    const singleDateLabel = new Date(targetDate + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Week range label for weekly mode
    const weekRangeLabel = `${new Date(startDateParam + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(endDateParam + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    // Single mode totals
    const singleTotalEstimated = singlePlan
        ? singlePlan.items.filter(i => i.status !== 'canceled').reduce((s, i) => s + i.estimatedAmount, 0)
        : 0;
    const singleTotalActual = actualExpensesMap[targetDate] || 0;

    // Weekly mode grand totals
    const weeklyTotalEstimated = weeklyPlans.reduce((sum, day) => sum + day.totalAmount, 0);
    const weeklyTotalItems = weeklyPlans.reduce((sum, day) => sum + (day.plan ? day.plan.items.filter(i => i.status !== 'canceled').length : 0), 0);

    return (
        <div className="bg-gray-100 min-h-screen text-gray-900 font-sans print:bg-white print:p-0">
            {/* Embedded Print CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 portrait; margin: 12mm 12mm 12mm 12mm; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10pt; }
                    .no-print { display: none !important; }
                    .print-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; border-radius: 0 !important; }
                    .page-break { page-break-after: always; }
                }
                .print-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
                .print-table th, .print-table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
                .print-table th { background-color: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 8pt; color: #374151; }
            `}} />

            {/* Top Toolbar (Hidden on Print) */}
            <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/expenses/planning')}
                            className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                            title="Kembali ke Perencanaan"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="font-bold text-gray-900 text-sm">
                                Preview Cetak PDF Rencana Pengeluaran {mode === 'weekly' ? 'Mingguan' : 'Harian'}
                            </h1>
                            <p className="text-xs text-gray-500">
                                {mode === 'weekly' ? `Jadwal Mingguan (${weekRangeLabel})` : singleDateLabel}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Printer size={16} /> Cetak / Save PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Print Content Document Container */}
            <div className="max-w-4xl mx-auto my-6 p-8 bg-white rounded-2xl shadow-md border border-gray-200 print-card print:m-0 print:border-none print:p-0">
                
                {/* ── Document Header (Kop Surat Resmi) ── */}
                <div className="border-b-2 border-gray-800 pb-4 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">{COMPANY_INFO.name}</h1>
                            <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                <MapPin size={12} className="inline shrink-0" /> {COMPANY_INFO.address}, {COMPANY_INFO.city}
                            </p>
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                                <Phone size={12} className="inline shrink-0" /> Telepon: {COMPANY_INFO.phone}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="inline-block bg-violet-100 text-violet-900 text-[10px] font-black uppercase px-3 py-1 rounded-full mb-1">
                                {mode === 'weekly' ? 'Jadwal Mingguan' : 'Rencana Harian'}
                            </div>
                            <p className="text-[10px] text-gray-400">Dicetak: {printDateStr}</p>
                        </div>
                    </div>
                </div>

                {/* Document Title Banner */}
                <div className="text-center bg-gray-50 py-3 rounded-xl border border-gray-200 mb-6">
                    <h2 className="text-base font-extrabold text-gray-900 tracking-wide uppercase">
                        {mode === 'weekly' ? 'JADWAL RENCANA PENGELUARAN KAS MINGGUAN' : 'LAPORAN RENCANA PENGELUARAN HARIAN'}
                    </h2>
                    <p className="text-xs text-violet-700 font-bold mt-0.5">
                        {mode === 'weekly' ? `Periode: ${weekRangeLabel}` : `Tanggal: ${singleDateLabel}`}
                    </p>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-gray-500">
                        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-xs font-semibold">Memuat Data Perencanaan...</p>
                    </div>
                ) : mode === 'single' ? (
                    /* ────────────────────────────────────────────────────────
                       MODE SINGLE DATE (Cetak Per Tanggal)
                       ──────────────────────────────────────────────────────── */
                    <div className="space-y-6">
                        {/* Summary Cards Row */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                                <p className="text-[10px] text-violet-700 font-bold uppercase">Total Estimasi Rencana</p>
                                <p className="text-lg font-extrabold text-violet-950 mt-0.5">{formatRupiah(singleTotalEstimated)}</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <p className="text-[10px] text-blue-700 font-bold uppercase">Realisasi Pengeluaran Actual</p>
                                <p className="text-lg font-extrabold text-blue-950 mt-0.5">{formatRupiah(singleTotalActual)}</p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                <p className="text-[10px] text-gray-600 font-bold uppercase">Total Item Terdaftar</p>
                                <p className="text-lg font-extrabold text-gray-900 mt-0.5">
                                    {singlePlan ? singlePlan.items.length : 0} Item
                                </p>
                            </div>
                        </div>

                        {/* Items Table */}
                        {!singlePlan || singlePlan.items.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 border border-dashed border-gray-300 rounded-xl">
                                <p className="text-sm font-semibold">Belum Ada Rencana Pengeluaran Tersimpan Pada Tanggal Ini</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                                    Rincian Item Pengeluaran Harian
                                </h3>
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th className="w-10 text-center">No</th>
                                            <th className="w-40">Kategori</th>
                                            <th>Keterangan / Deskripsi Pengeluaran</th>
                                            <th className="w-28 text-center">Status</th>
                                            <th className="w-36 text-right">Estimasi (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {singlePlan.items.map((item, idx) => (
                                            <tr key={item.id || idx}>
                                                <td className="text-center font-medium text-gray-500">{idx + 1}</td>
                                                <td className="font-semibold text-gray-800">
                                                    {EXPENSE_CATEGORY_LABELS[item.category] || item.category}
                                                </td>
                                                <td className="font-medium text-gray-900">{item.description || '-'}</td>
                                                <td className="text-center">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${STATUS_LABEL[item.status]?.badgeClass || 'bg-gray-50 text-gray-600'}`}>
                                                        {STATUS_LABEL[item.status]?.label || item.status}
                                                    </span>
                                                </td>
                                                <td className="text-right font-mono font-bold text-gray-900">
                                                    {formatRupiah(item.estimatedAmount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-bold">
                                            <td colSpan={4} className="text-right uppercase text-xs">Total Estimasi Rencana:</td>
                                            <td className="text-right font-mono text-violet-800 text-sm">
                                                {formatRupiah(singleTotalEstimated)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Operational Notes */}
                        {singlePlan?.notes && (
                            <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl text-xs">
                                <p className="font-bold text-amber-900 uppercase text-[10px] mb-1">📝 Catatan Operasional Rencana:</p>
                                <p className="text-amber-950 font-medium whitespace-pre-wrap">{singlePlan.notes}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ────────────────────────────────────────────────────────
                       MODE WEEKLY SCHEDULE (Cetak Jadwal Per Minggu)
                       ──────────────────────────────────────────────────────── */
                    <div className="space-y-6">
                        {/* Weekly Grand Summary Header Card */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                                <p className="text-[10px] text-violet-700 font-bold uppercase">Total Estimasi Mingguan</p>
                                <p className="text-xl font-black text-violet-950 mt-0.5">{formatRupiah(weeklyTotalEstimated)}</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                <p className="text-[10px] text-emerald-700 font-bold uppercase">Total Hari Terjadwal</p>
                                <p className="text-xl font-black text-emerald-950 mt-0.5">
                                    {weeklyPlans.filter(d => d.plan && d.plan.items.length > 0).length} / 7 Hari
                                </p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <p className="text-[10px] text-blue-700 font-bold uppercase">Total Item Pengeluaran</p>
                                <p className="text-xl font-black text-blue-950 mt-0.5">{weeklyTotalItems} Item</p>
                            </div>
                        </div>

                        {/* Daily Plans List breakdown (Senin - Minggu) */}
                        <div className="space-y-5">
                            {weeklyPlans.map((dayGroup) => {
                                const validItems = dayGroup.plan ? dayGroup.plan.items.filter(i => i.status !== 'canceled') : [];
                                return (
                                    <div key={dayGroup.date} className="border border-gray-300 rounded-xl overflow-hidden print:border-gray-400">
                                        {/* Day Header */}
                                        <div className="bg-gray-100 px-4 py-2.5 border-b border-gray-300 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-violet-700" />
                                                <span className="font-extrabold text-xs text-gray-900 uppercase">
                                                    {dayGroup.dayName}, {dayGroup.formattedDate}
                                                </span>
                                            </div>
                                            <div className="font-mono font-bold text-xs text-violet-800">
                                                Subtotal: {formatRupiah(dayGroup.totalAmount)}
                                            </div>
                                        </div>

                                        {/* Items Table for this day */}
                                        {validItems.length === 0 ? (
                                            <div className="px-4 py-3 text-xs text-gray-400 italic bg-white">
                                                - Tidak ada rencana pengeluaran tersimpan -
                                            </div>
                                        ) : (
                                            <table className="print-table border-none">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-gray-200">
                                                        <th className="w-8 text-center">#</th>
                                                        <th className="w-36">Kategori</th>
                                                        <th>Deskripsi Pengeluaran</th>
                                                        <th className="w-24 text-center">Status</th>
                                                        <th className="w-32 text-right">Estimasi (Rp)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {validItems.map((item, itemIdx) => (
                                                        <tr key={item.id || itemIdx}>
                                                            <td className="text-center font-medium text-gray-500">{itemIdx + 1}</td>
                                                            <td className="font-semibold text-gray-800">
                                                                {EXPENSE_CATEGORY_LABELS[item.category] || item.category}
                                                            </td>
                                                            <td className="font-medium text-gray-900">{item.description}</td>
                                                            <td className="text-center">
                                                                <span className={`text-[8.5pt] font-bold px-1.5 py-0.5 rounded border ${STATUS_LABEL[item.status]?.badgeClass || ''}`}>
                                                                    {STATUS_LABEL[item.status]?.label || item.status}
                                                                </span>
                                                            </td>
                                                            <td className="text-right font-mono font-bold text-gray-900">
                                                                {formatRupiah(item.estimatedAmount)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                        {dayGroup.plan?.notes && (
                                            <div className="px-4 py-2 bg-amber-50/50 border-t border-gray-200 text-[10px] text-amber-900">
                                                <strong>Catatan:</strong> {dayGroup.plan.notes}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Standard Approval & Signature Section (Kolem Tanda Tangan) ── */}
                <div className="mt-12 pt-6 border-t border-gray-300 print:mt-10">
                    <div className="grid grid-cols-3 gap-6 text-center text-xs">
                        <div>
                            <p className="font-bold text-gray-700 uppercase">Dibuat Oleh,</p>
                            <p className="text-[10px] text-gray-400 mb-16">Staf Admin / Keuangan</p>
                            <div className="border-b border-gray-400 w-36 mx-auto"></div>
                            <p className="font-semibold text-gray-900 mt-1">( .................................... )</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-700 uppercase">Diperiksa Oleh,</p>
                            <p className="text-[10px] text-gray-400 mb-16">Manager Operasional</p>
                            <div className="border-b border-gray-400 w-36 mx-auto"></div>
                            <p className="font-semibold text-gray-900 mt-1">( .................................... )</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-700 uppercase">Disetujui Oleh,</p>
                            <p className="text-[10px] text-gray-400 mb-16">Pimpinan / Direksi</p>
                            <div className="border-b border-gray-400 w-36 mx-auto"></div>
                            <p className="font-semibold text-gray-900 mt-1">{COMPANY_INFO.signatureName || '( HILAL BAFAGIH )'}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function PrintDailyPlanPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Memuat Halaman Cetak...</div>}>
            <PrintDailyPlanContent />
        </Suspense>
    );
}
