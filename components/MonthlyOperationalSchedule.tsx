'use client';

import { useState } from 'react';
import { Calendar, Moon, Sun, Users, ChevronDown, ChevronUp, Clock, Shield, AlertTriangle, Info } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
interface ScheduleEntry {
    day: string;        // e.g. "Rabu"
    date: string;       // e.g. "1 April"
    type: 'lembur' | 'stay';
    crew: string[];
}

interface WeekBlock {
    label: string;      // e.g. "Minggu 1"
    range: string;      // e.g. "1 – 5 April"
    entries: ScheduleEntry[];
}

interface StaySummary {
    name: string;
    count: number;
    dates: string[];
}

// ── April 2026 Schedule Data ───────────────────────────────────────────
const SCHEDULE_MONTH = 'April 2026';

const WEEKS: WeekBlock[] = [
    {
        label: 'Minggu 1', range: '1 – 5 April',
        entries: [
            { day: 'Rabu',   date: '1 April',  type: 'lembur', crew: ['Dandi','Wachid','Aldo','Fajar','Paweit','Dias'] },
            { day: 'Kamis',  date: '2 April',  type: 'stay',   crew: ['Fian','Pamek'] },
            { day: 'Sabtu',  date: '4 April',  type: 'lembur', crew: ['Fian','Wachid','Aldo','Paweit','Pamek','Dias'] },
            { day: 'Minggu', date: '5 April',  type: 'stay',   crew: ['Dandi','Fajar'] },
        ]
    },
    {
        label: 'Minggu 2', range: '6 – 12 April',
        entries: [
            { day: 'Rabu',   date: '8 April',  type: 'lembur', crew: ['Fian','Dandi','Aldo','Fajar','Paweit','Pamek'] },
            { day: 'Kamis',  date: '9 April',  type: 'stay',   crew: ['Dias','Paweit'] },
            { day: 'Sabtu',  date: '11 April', type: 'lembur', crew: ['Dandi','Wachid','Aldo','Fajar','Pamek','Dias'] },
            { day: 'Minggu', date: '12 April', type: 'stay',   crew: ['Aldo','Wachid'] },
        ]
    },
    {
        label: 'Minggu 3', range: '13 – 19 April',
        entries: [
            { day: 'Rabu',   date: '15 April', type: 'lembur', crew: ['Fian','Wachid','Fajar','Paweit','Pamek','Dias'] },
            { day: 'Kamis',  date: '16 April', type: 'stay',   crew: ['Dandi','Pamek'] },
            { day: 'Sabtu',  date: '18 April', type: 'lembur', crew: ['Fian','Dandi','Wachid','Aldo','Fajar','Paweit'] },
            { day: 'Minggu', date: '19 April', type: 'stay',   crew: ['Dias','Fajar'] },
        ]
    },
    {
        label: 'Minggu 4', range: '20 – 26 April',
        entries: [
            { day: 'Rabu',   date: '22 April', type: 'lembur', crew: ['Dandi','Wachid','Aldo','Paweit','Pamek','Dias'] },
            { day: 'Kamis',  date: '23 April', type: 'stay',   crew: ['Fian','Aldo'] },
            { day: 'Sabtu',  date: '25 April', type: 'lembur', crew: ['Fian','Dandi','Fajar','Paweit','Pamek','Dias'] },
            { day: 'Minggu', date: '26 April', type: 'stay',   crew: ['Wachid','Paweit'] },
        ]
    },
    {
        label: 'Minggu 5', range: '27 – 30 April',
        entries: [
            { day: 'Rabu',   date: '29 April', type: 'lembur', crew: ['Fian','Wachid','Aldo','Fajar','Pamek','Dias'] },
            { day: 'Kamis',  date: '30 April', type: 'stay',   crew: ['Dandi','Fajar'] },
        ]
    },
];

const STAY_SUMMARY: StaySummary[] = [
    { name: 'Fian',   count: 2, dates: ['2 Apr','23 Apr'] },
    { name: 'Dandi',  count: 3, dates: ['5 Apr','16 Apr','30 Apr'] },
    { name: 'Dias',   count: 2, dates: ['9 Apr','19 Apr'] },
    { name: 'Wachid', count: 2, dates: ['12 Apr','26 Apr'] },
    { name: 'Aldo',   count: 2, dates: ['12 Apr','23 Apr'] },
    { name: 'Fajar',  count: 3, dates: ['5 Apr','19 Apr','30 Apr'] },
    { name: 'Paweit', count: 2, dates: ['9 Apr','26 Apr'] },
    { name: 'Pamek',  count: 2, dates: ['2 Apr','16 Apr'] },
];

// ── Helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS: Record<string, string> = {
    Fian:   'from-blue-500   to-blue-600',
    Dandi:  'from-emerald-500 to-emerald-600',
    Dias:   'from-amber-500  to-amber-600',
    Wachid: 'from-rose-500   to-rose-600',
    Aldo:   'from-violet-500 to-violet-600',
    Fajar:  'from-cyan-500   to-cyan-600',
    Paweit: 'from-orange-500 to-orange-600',
    Pamek:  'from-pink-500   to-pink-600',
};

function getInitials(name: string) {
    return name.slice(0, 2).toUpperCase();
}

// ── Component ──────────────────────────────────────────────────────────
export default function MonthlyOperationalSchedule() {
    const [expandedWeek, setExpandedWeek] = useState<number | null>(0);
    const [showRules, setShowRules] = useState(false);

    const toggle = (idx: number) => setExpandedWeek(prev => prev === idx ? null : idx);

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-1">
                    <Calendar size={24} />
                    <h2 className="text-xl font-extrabold tracking-tight">Jadwal Operasional</h2>
                </div>
                <p className="text-blue-100 text-sm font-medium">{SCHEDULE_MONTH}</p>

                {/* Quick legend */}
                <div className="flex flex-wrap gap-3 mt-4">
                    <span className="flex items-center gap-1.5 text-xs bg-white/20 backdrop-blur px-3 py-1.5 rounded-full font-semibold">
                        <Moon size={14} /> Lembur (Rabu & Sabtu) – 6 Orang
                    </span>
                    <span className="flex items-center gap-1.5 text-xs bg-white/20 backdrop-blur px-3 py-1.5 rounded-full font-semibold">
                        <Sun size={14} /> Stay (Kamis & Minggu) – 2 Orang
                    </span>
                </div>
            </div>

            {/* ── Rules Accordion ── */}
            <button
                onClick={() => setShowRules(!showRules)}
                className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left transition-colors hover:bg-amber-100"
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <Info size={16} />
                    Aturan Penugasan
                </span>
                {showRules ? <ChevronUp size={18} className="text-amber-600" /> : <ChevronDown size={18} className="text-amber-600" />}
            </button>

            {showRules && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 text-sm text-amber-900 -mt-2 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                        <Moon size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        <p><strong>Lembur (Rabu & Sabtu):</strong> Diikuti 6 orang. Lembur sampai pagi; setelahnya status fleksibel, namun wajib responsif jika ada bongkaran darurat.</p>
                    </div>
                    <div className="flex gap-2">
                        <Sun size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        <p><strong>Stay (Kamis & Minggu):</strong> Diikuti 2 orang. Wajib standby penuh jam 09:00 – 17:00.</p>
                    </div>
                    <div className="flex gap-2">
                        <Shield size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        <p><strong>Aturan Istirahat:</strong> Petugas Stay di hari Kamis/Minggu tidak boleh lembur di hari sebelumnya (Rabu/Sabtu).</p>
                    </div>
                    <div className="flex gap-2">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        <p><strong>Distribusi:</strong> Fian, Dandi, dan Dias tidak dijadwalkan Stay di hari yang sama karena bertugas sebagai penyusun.</p>
                    </div>
                </div>
            )}

            {/* ── Weekly Accordion Cards ── */}
            <div className="space-y-3">
                {WEEKS.map((week, wIdx) => {
                    const isOpen = expandedWeek === wIdx;
                    return (
                        <div key={wIdx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                            {/* Accordion Header */}
                            <button
                                onClick={() => toggle(wIdx)}
                                className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow">
                                        {wIdx + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{week.label}</p>
                                        <p className="text-xs text-gray-500">{week.range}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 font-medium">{week.entries.length} jadwal</span>
                                    {isOpen
                                        ? <ChevronUp size={18} className="text-gray-400" />
                                        : <ChevronDown size={18} className="text-gray-400" />}
                                </div>
                            </button>

                            {/* Accordion Body */}
                            {isOpen && (
                                <div className="border-t divide-y divide-gray-100 animate-in slide-in-from-top-1 duration-150">
                                    {week.entries.map((entry, eIdx) => (
                                        <div key={eIdx} className="px-4 py-3.5">
                                            {/* Row header */}
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div className="flex items-center gap-2">
                                                    {entry.type === 'lembur'
                                                        ? <Moon size={16} className="text-indigo-500" />
                                                        : <Sun size={16} className="text-amber-500" />}
                                                    <span className="font-semibold text-gray-800 text-sm">{entry.day}, {entry.date}</span>
                                                </div>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                    entry.type === 'lembur'
                                                        ? 'bg-indigo-100 text-indigo-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {entry.type === 'lembur' ? `Lembur (${entry.crew.length})` : `Stay (${entry.crew.length})`}
                                                </span>
                                            </div>

                                            {/* Crew chips */}
                                            <div className="flex flex-wrap gap-2">
                                                {entry.crew.map(name => (
                                                    <div key={name} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-3 py-1 transition-transform hover:scale-105">
                                                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${AVATAR_COLORS[name] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-[10px] font-bold text-white shadow-inner`}>
                                                            {getInitials(name)}
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-700">{name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Stay-Frequency Summary ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                    <Users size={18} className="text-blue-600" />
                    <h3 className="font-bold text-gray-800 text-sm">Ringkasan Frekuensi Stay</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
                    {STAY_SUMMARY.map(s => (
                        <div key={s.name} className="bg-white p-3 flex flex-col items-center text-center transition-colors hover:bg-blue-50">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${AVATAR_COLORS[s.name] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-sm font-bold text-white shadow mb-1.5`}>
                                {getInitials(s.name)}
                            </div>
                            <p className="font-bold text-gray-800 text-sm leading-tight">{s.name}</p>
                            <p className="text-xs text-gray-500 font-medium">{s.count}× stay</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{s.dates.join(', ')}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Footer note ── */}
            <p className="text-xs text-gray-400 text-center italic px-4">
                *) Petugas yang tidak tercantum di hari Rabu/Sabtu otomatis libur lembur untuk persiapan tugas Stay.
            </p>
        </div>
    );
}
