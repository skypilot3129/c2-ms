'use client';

import React, { useState } from 'react';
import type { CargoStackItem, CargoZone, CargoLayer, CargoSide } from '@/types/loading-session';
import { formatRupiah } from '@/lib/currency';
import {
    Box, Plus, Trash2, Layers, Truck, AlertTriangle, ShieldCheck,
    RotateCw, ArrowDown, Eye, CheckCircle2, ChevronRight, Scale, Info,
    Maximize2, Minimize2, Ruler, ArrowUp
} from 'lucide-react';

interface Truck3dVisualizerProps {
    cargoItems: CargoStackItem[];
    onSaveCargoItems: (updated: CargoStackItem[]) => void;
    fleetType?: string;
    plateNumber?: string;
    readOnly?: boolean;
}

const ZONE_LABELS: Record<CargoZone, { label: string; sub: string; color: string }> = {
    front: { label: 'DEPAN (Sumbu Depan)', sub: 'Sisi Kabin Truk', color: 'border-blue-500 bg-blue-500/10' },
    middle: { label: 'TENGAH (Pusat Beban)', sub: 'Sumbu Roda Tengah', color: 'border-purple-500 bg-purple-500/10' },
    rear: { label: 'BELAKANG (Pintu Muat)', sub: 'Sumbu Roda Ganda', color: 'border-amber-500 bg-amber-500/10' }
};

const HEIGHT_TIERS: Array<{ key: CargoLayer; label: string; meters: string; desc: string; color: string }> = [
    { key: 'atasan', label: 'ATASAN (Puncak Teratas)', meters: '2.20 – 3.30m', desc: 'Muatan Ringan / Busa / Kasur', color: 'border-amber-500/40 text-amber-300' },
    { key: 'tengah', label: 'TENGAH (Sumbu Pagar)', meters: '1.00 – 2.20m', desc: 'Muatan Karton / Dus / Karung', color: 'border-purple-500/40 text-purple-300' },
    { key: 'dasaran', label: 'DASARAN (Lantai Bak)', meters: '0.00 – 1.00m', desc: 'Muatan Berat / Besi / Batu / Dus Tebal', color: 'border-blue-500/40 text-blue-300' },
];

const COLOR_PRESETS = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
    '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'
];

export default function Truck3dVisualizer({
    cargoItems,
    onSaveCargoItems,
    fleetType = 'Truk Fuso Long Bak',
    plateNumber = 'B 9872 CCE',
    readOnly = false
}: Truck3dVisualizerProps) {
    const [viewMode, setViewMode] = useState<'3d' | 'side' | 'top'>('3d');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CargoStackItem | null>(null);

    // Form Modal State for Adding New Cargo Item
    const [showAddModal, setShowAddModal] = useState(false);
    const [sttNumber, setSttNumber] = useState('');
    const [clientName, setClientName] = useState('');
    const [destination, setDestination] = useState('');
    const [koliCount, setKoliCount] = useState(10);
    const [weightKg, setWeightKg] = useState(250);
    const [cbm, setCbm] = useState(1.2);
    const [targetZone, setTargetZone] = useState<CargoZone>('front');
    const [targetLayer, setTargetLayer] = useState<CargoLayer>('dasaran');
    const [targetSide, setTargetSide] = useState<CargoSide>('center');
    const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);

    // Totals calculations
    const totalKoli = cargoItems.reduce((sum, item) => sum + item.koliCount, 0);
    const totalWeightKg = cargoItems.reduce((sum, item) => sum + item.weightKg, 0);
    const totalCbm = cargoItems.reduce((sum, item) => sum + item.cbm, 0);
    const maxCapacityCbm = 52; // Standard CCE Fuso 3.3m High ~52 CBM
    const cbmPercentage = Math.min(100, Math.round((totalCbm / maxCapacityCbm) * 100));

    // Balance calculations
    const frontWeight = cargoItems.filter(i => i.zone === 'front').reduce((s, i) => s + i.weightKg, 0);
    const middleWeight = cargoItems.filter(i => i.zone === 'middle').reduce((s, i) => s + i.weightKg, 0);
    const rearWeight = cargoItems.filter(i => i.zone === 'rear').reduce((s, i) => s + i.weightKg, 0);

    const frontPct = totalWeightKg > 0 ? Math.round((frontWeight / totalWeightKg) * 100) : 33;
    const middlePct = totalWeightKg > 0 ? Math.round((middleWeight / totalWeightKg) * 100) : 34;
    const rearPct = totalWeightKg > 0 ? Math.round((rearWeight / totalWeightKg) * 100) : 33;

    // Weight imbalance alert
    const isUnbalanced = (frontPct > 55) || (rearPct > 55);

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sttNumber || !destination) {
            alert('Harap isi No STT dan Kota Tujuan!');
            return;
        }

        const newItem: CargoStackItem = {
            id: `ITEM-${Date.now()}`,
            sttNumber: sttNumber.toUpperCase().startsWith('STT') ? sttNumber.toUpperCase() : `STT-${sttNumber}`,
            clientName: clientName || 'Umum',
            destination: destination.toUpperCase(),
            koliCount: Number(koliCount) || 1,
            weightKg: Number(weightKg) || 10,
            cbm: Number(cbm) || 0.1,
            zone: targetZone,
            layer: targetLayer,
            heightLevelMeters: targetLayer === 'dasaran' ? 0.8 : targetLayer === 'tengah' ? 1.8 : 3.0,
            side: targetSide,
            color: selectedColor,
        };

        const updated = [...cargoItems, newItem];
        onSaveCargoItems(updated);

        // Reset inputs
        setSttNumber('');
        setClientName('');
        setDestination('');
        setShowAddModal(false);
    };

    const handleDeleteItem = (id: string) => {
        if (confirm('Hapus item koli ini dari bak truk?')) {
            const updated = cargoItems.filter(i => i.id !== id);
            onSaveCargoItems(updated);
            if (selectedItem?.id === id) setSelectedItem(null);
        }
    };

    const getItemsInCell = (zone: CargoZone, layer: CargoLayer) => {
        return cargoItems.filter(i => {
            const matchZone = i.zone === zone;
            const matchLayer = (i.layer === layer) ||
                (layer === 'dasaran' && i.layer === 'bottom') ||
                (layer === 'tengah' && i.layer === 'middle') ||
                (layer === 'atasan' && i.layer === 'top');
            return matchZone && matchLayer;
        });
    };

    const containerStyle = isFullScreen
        ? "fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto space-y-6"
        : "bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6";

    return (
        <div className={containerStyle}>
            
            {/* Header Control Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 font-black">
                        <Truck size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-white tracking-wide">SKETSA 3D BAK TRUK (TINGGI 3.30 METER)</h3>
                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                FULL STUDIO KETINGGIAN CCE
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                            Unit: <strong className="text-slate-200">{fleetType}</strong> • Plat: <strong className="text-emerald-400 font-mono">{plateNumber}</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Perspective Selector Buttons */}
                    <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('3d')}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                viewMode === '3d'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Box size={14} /> 3D Isometric (3 Tier Tinggi)
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('side')}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                viewMode === 'side'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Eye size={14} /> Elevasi Samping (3.30m)
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('top')}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                viewMode === 'top'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <ArrowDown size={14} /> Denah Atas (Lantai)
                        </button>
                    </div>

                    {/* Fullscreen Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                        {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        {isFullScreen ? 'Kecilkan Studio' : 'Full Screen Halaman Penuh'}
                    </button>

                    {!readOnly && (
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <Plus size={16} /> + Tumpuk Koli Baru
                        </button>
                    )}
                </div>
            </div>

            {/* Capacity & Weight Balance Metrics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Koli Dimuat</p>
                    <p className="text-2xl font-black text-amber-400 font-mono mt-1">{totalKoli} <span className="text-xs text-slate-400 font-sans font-normal">Koli</span></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Berat Tonase</p>
                    <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{(totalWeightKg / 1000).toFixed(2)} <span className="text-xs text-slate-400 font-sans font-normal">Ton ({totalWeightKg.toLocaleString()} kg)</span></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>Kapasitas (Max 3.30m)</span>
                        <span className="text-indigo-400">{cbmPercentage}%</span>
                    </div>
                    <p className="text-2xl font-black text-indigo-300 font-mono mt-1">{totalCbm.toFixed(1)} <span className="text-xs text-slate-400 font-sans font-normal">/ {maxCapacityCbm} m³</span></p>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500" style={{ width: `${cbmPercentage}%` }}></div>
                    </div>
                </div>
                <div className={`border p-4 rounded-2xl ${isUnbalanced ? 'bg-red-950/40 border-red-800 text-red-200' : 'bg-slate-900 border-slate-800 text-slate-200'}`}>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                            <Scale size={12} className={isUnbalanced ? 'text-red-400' : 'text-emerald-400'} /> Keseimbangan Beban Sumbu
                        </span>
                        {isUnbalanced && <span className="text-red-400 font-black animate-pulse">BERAT SEBELAH!</span>}
                    </div>
                    <div className="mt-2 text-[11px] font-mono space-y-1">
                        <div className="flex justify-between">
                            <span>Depan: {frontPct}%</span>
                            <span>Tengah: {middlePct}%</span>
                            <span>Belakang: {rearPct}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                            <div className="bg-blue-500 h-full" style={{ width: `${frontPct}%` }}></div>
                            <div className="bg-purple-500 h-full" style={{ width: `${middlePct}%` }}></div>
                            <div className="bg-amber-500 h-full" style={{ width: `${rearPct}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 3D / ISOMETRIC TRUCK CARGO CANVAS CONTAINER ── */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-slate-400 font-mono z-20">
                    <Ruler size={12} className="text-indigo-400" />
                    <span>Sketsa Presisi CCE: Maksimal Tinggi Bak 3.30 Meter (3 Tier Penataan)</span>
                </div>

                {/* ── MODE 1: 3D ISOMETRIC TRUCK BED STACKING CANVAS (3.30m HEIGHT) ── */}
                {viewMode === '3d' && (
                    <div className="py-8 px-4 overflow-x-auto">
                        <div className="min-w-[850px] max-w-5xl mx-auto relative pt-10 pb-8">
                            
                            {/* FRONT CABIN OF THE TRUCK */}
                            <div className="flex items-center mb-4">
                                <div className="w-36 h-36 bg-gradient-to-r from-slate-800 to-slate-700 border-2 border-slate-600 rounded-l-3xl p-3 flex flex-col justify-between shadow-2xl relative">
                                    <div className="w-12 h-10 bg-blue-400/30 border border-blue-400/50 rounded-lg self-end flex items-center justify-center text-[9px] font-bold text-blue-200">
                                        Kabin Fuso
                                    </div>
                                    <div className="text-[9px] font-mono text-slate-300">
                                        <div>TINGGI BAK:</div>
                                        <div className="text-emerald-400 font-black text-xs">3.30 METER</div>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 font-mono">
                                        <span>DRIVER</span>
                                        <span className="w-4 h-4 rounded-full bg-slate-900 border border-slate-500"></span>
                                    </div>
                                    {/* Wheel Front */}
                                    <div className="absolute -bottom-5 left-6 w-10 h-10 bg-slate-900 border-4 border-slate-600 rounded-full flex items-center justify-center font-bold text-[8px] text-slate-500">
                                        R1
                                    </div>
                                </div>
                                <div className="h-36 w-4 bg-slate-800 border-y border-slate-700"></div>

                                {/* CARGO TRUCK BED MAIN FRAME (3 ZONES x 3 HEIGHT TIERS) */}
                                <div className="flex-1 bg-slate-900 border-4 border-slate-700 rounded-r-2xl p-3 relative shadow-inner">
                                    
                                    {/* Side Wooden/Metal Frame Gate Bars with Height Markers */}
                                    <div className="absolute inset-x-0 top-0 h-2.5 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 border-b border-amber-900"></div>
                                    <div className="absolute inset-x-0 top-12 h-1 bg-amber-500/30 border-t border-dashed border-amber-500/40"></div>
                                    <div className="absolute inset-x-0 top-24 h-1 bg-purple-500/30 border-t border-dashed border-purple-500/40"></div>
                                    <div className="absolute inset-x-0 bottom-0 h-2.5 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 border-t border-amber-900"></div>

                                    {/* 3 ZONES GRID CONTAINER */}
                                    <div className="grid grid-cols-3 gap-4 relative z-10 my-2">
                                        {(['front', 'middle', 'rear'] as CargoZone[]).map((zoneKey) => {
                                            const zoneInfo = ZONE_LABELS[zoneKey];

                                            return (
                                                <div key={zoneKey} className={`border-2 rounded-2xl p-3 bg-slate-950/90 backdrop-blur-sm ${zoneInfo.color}`}>
                                                    <div className="text-center border-b border-slate-800 pb-2 mb-3">
                                                        <span className="text-[11px] font-black text-white tracking-wider block">{zoneInfo.label}</span>
                                                        <span className="text-[9px] text-slate-400 font-mono block">{zoneInfo.sub}</span>
                                                    </div>

                                                    {/* 3 HEIGHT TIERS: Atasan (2.2-3.3m), Tengah (1-2.2m), Dasaran (0-1m) */}
                                                    <div className="space-y-2.5">
                                                        {HEIGHT_TIERS.map((tier) => {
                                                            const items = getItemsInCell(zoneKey, tier.key);

                                                            return (
                                                                <div
                                                                    key={tier.key}
                                                                    className="min-h-[76px] border border-slate-800 rounded-xl p-2 bg-slate-900/80 hover:border-indigo-500/50 transition-colors flex flex-wrap gap-1.5 content-start relative"
                                                                >
                                                                    <div className="w-full flex justify-between items-center text-[8px] font-mono font-bold pb-1 border-b border-slate-800/60 mb-1">
                                                                        <span className={tier.color}>{tier.label}</span>
                                                                        <span className="text-slate-500 font-black">{tier.meters}</span>
                                                                    </div>

                                                                    {items.length === 0 ? (
                                                                        <div className="w-full text-center py-3 text-[9px] text-slate-600 italic">
                                                                            Kosong ({tier.meters})
                                                                        </div>
                                                                    ) : (
                                                                        items.map(item => (
                                                                            <div
                                                                                key={item.id}
                                                                                onClick={() => setSelectedItem(item)}
                                                                                style={{ backgroundColor: item.color || '#3B82F6' }}
                                                                                className={`px-2.5 py-1.5 rounded-lg text-white font-bold text-[10px] shadow-lg hover:scale-105 transition-transform cursor-pointer border border-white/20 flex items-center justify-between gap-2 ${
                                                                                    selectedItem?.id === item.id ? 'ring-2 ring-white scale-105' : ''
                                                                                }`}
                                                                            >
                                                                                <div>
                                                                                    <div className="font-mono text-[9px] font-black tracking-tight">{item.sttNumber}</div>
                                                                                    <div className="text-[8px] opacity-90">{item.destination} • {item.koliCount} koli</div>
                                                                                </div>
                                                                                {!readOnly && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleDeleteItem(item.id);
                                                                                        }}
                                                                                        className="text-white/70 hover:text-white p-0.5"
                                                                                        title="Hapus koli"
                                                                                    >
                                                                                        <Trash2 size={12} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Double Tandem Rear Wheels */}
                                    <div className="absolute -bottom-6 right-28 w-10 h-10 bg-slate-900 border-4 border-slate-600 rounded-full flex items-center justify-center font-bold text-[8px] text-slate-500">
                                        R2
                                    </div>
                                    <div className="absolute -bottom-6 right-10 w-10 h-10 bg-slate-900 border-4 border-slate-600 rounded-full flex items-center justify-center font-bold text-[8px] text-slate-500">
                                        R3
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MODE 2: TAMPAK SAMPING ELEVASI TRUK (HEIGHT 3.30m PROFILE) ── */}
                {viewMode === 'side' && (
                    <div className="py-6 px-4">
                        <div className="max-w-4xl mx-auto border-2 border-slate-700 rounded-2xl p-5 bg-slate-950 space-y-4">
                            <div className="text-center">
                                <h4 className="font-black text-sm text-white uppercase tracking-wider">
                                    PROFIL ELEVASI TINGGI BAK TRUK (3.30 METER DASAR KE PUNCAK)
                                </h4>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                    Dasaran (0.00-1.00m) • Tengah (1.00-2.20m) • Atasan (2.20-3.30m)
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 h-64 border border-slate-800 rounded-xl p-3 bg-slate-900 relative">
                                {(['front', 'middle', 'rear'] as CargoZone[]).map(zone => (
                                    <div key={zone} className="border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between bg-slate-950/60 relative">
                                        <span className="text-[10px] font-black text-indigo-400 text-center uppercase border-b border-slate-800 pb-1">
                                            {zone.toUpperCase()}
                                        </span>

                                        <div className="flex-1 flex flex-col justify-between py-2">
                                            {HEIGHT_TIERS.map(tier => {
                                                const items = getItemsInCell(zone, tier.key);
                                                return (
                                                    <div key={tier.key} className="border border-dashed border-slate-800/80 p-1 rounded bg-slate-900/40 text-[8px]">
                                                        <span className="text-slate-500 font-mono block">{tier.label} ({tier.meters})</span>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {items.map(i => (
                                                                <span key={i.id} style={{ backgroundColor: i.color || '#3B82F6' }} className="px-1.5 py-0.5 rounded text-white font-mono font-bold">
                                                                    {i.sttNumber} ({i.koliCount}k)
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MODE 3: TAMPAK ATAS DENAH LANTAI TRUK ── */}
                {viewMode === 'top' && (
                    <div className="py-6 px-4">
                        <div className="max-w-3xl mx-auto border-2 border-slate-700 rounded-2xl p-4 bg-slate-950">
                            <h4 className="font-bold text-xs text-slate-300 mb-3 text-center uppercase tracking-wider">
                                DENAH LANTAI BAK TRUK (TAMPAK ATAS)
                            </h4>
                            <div className="grid grid-cols-3 gap-3 h-44 border border-slate-800 rounded-xl p-3 bg-slate-900">
                                {(['front', 'middle', 'rear'] as CargoZone[]).map(zone => (
                                    <div key={zone} className="border border-indigo-500/30 rounded-lg p-3 bg-slate-950/80 flex flex-col justify-center items-center text-center">
                                        <span className="text-xs font-black text-white uppercase">{zone}</span>
                                        <span className="text-[10px] text-amber-400 font-mono font-bold mt-1">
                                            {cargoItems.filter(i => i.zone === zone).reduce((s, i) => s + i.koliCount, 0)} Koli
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-mono">
                                            {cargoItems.filter(i => i.zone === zone).reduce((s, i) => s + i.weightKg, 0)} Kg
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Selected Cargo Inspector Drawer */}
            {selectedItem && (
                <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: selectedItem.color || '#3B82F6' }}>
                            <Box size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-black text-white font-mono text-base">{selectedItem.sttNumber}</h4>
                                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/40">
                                    Tujuan: {selectedItem.destination}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Client: <strong className="text-white">{selectedItem.clientName}</strong> • {selectedItem.koliCount} Koli • {selectedItem.weightKg} Kg • {selectedItem.cbm} CBM
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">
                            Posisi: Zona <strong>{selectedItem.zone.toUpperCase()}</strong> / Layer <strong>{selectedItem.layer.toUpperCase()}</strong>
                        </span>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() => handleDeleteItem(selectedItem.id)}
                                className="bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-red-500/40 transition-all flex items-center gap-1"
                            >
                                <Trash2 size={13} /> Hapus dari Bak
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL FORM: ADD NEW CARGO KOLI */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl text-white">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Box className="text-emerald-400" size={20} /> Tambah Penataan Koli ke Bak Truk
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-white font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddItem} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">No STT / Resi *</label>
                                    <input
                                        type="text"
                                        value={sttNumber}
                                        onChange={(e) => setSttNumber(e.target.value)}
                                        placeholder="Contoh: STT-9872"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Kota Tujuan *</label>
                                    <input
                                        type="text"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                        placeholder="Contoh: MEDAN / SURABAYA"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nama Client / Pengirim</label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    placeholder="Nama Pengirim (Opsional)"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Jumlah Koli</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={koliCount}
                                        onChange={(e) => setKoliCount(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold font-mono focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Berat (Kg)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={weightKg}
                                        onChange={(e) => setWeightKg(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold font-mono focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Volume (CBM / m³)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        value={cbm}
                                        onChange={(e) => setCbm(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold font-mono focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Zone & Height Layer Placement Selector */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-indigo-400 mb-1">Zona Bak Truk</label>
                                    <select
                                        value={targetZone}
                                        onChange={(e) => setTargetZone(e.target.value as CargoZone)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="front">DEPAN (Kabin Truk)</option>
                                        <option value="middle">TENGAH (Sumbu Roda)</option>
                                        <option value="rear">BELAKANG (Pintu Muat)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-indigo-400 mb-1">Tingkat Tinggi (s/d 3.30m)</label>
                                    <select
                                        value={targetLayer}
                                        onChange={(e) => setTargetLayer(e.target.value as CargoLayer)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="dasaran">DASARAN (0.00 - 1.00m)</option>
                                        <option value="tengah">TENGAH (1.00 - 2.20m)</option>
                                        <option value="atasan">ATASAN (2.20 - 3.30m)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Color Selector */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Warna Label Visual</label>
                                <div className="flex gap-2">
                                    {COLOR_PRESETS.map(hex => (
                                        <button
                                            key={hex}
                                            type="button"
                                            onClick={() => setSelectedColor(hex)}
                                            style={{ backgroundColor: hex }}
                                            className={`w-7 h-7 rounded-full transition-transform ${
                                                selectedColor === hex ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30"
                                >
                                    Simpan ke Bak
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
