'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { CargoStackItem, CargoZone, CargoLayer, CargoSide } from '@/types/loading-session';
import { formatRupiah } from '@/lib/currency';
import {
    Box, Plus, Trash2, Layers, Truck, AlertTriangle, ShieldCheck,
    RotateCw, ArrowDown, Eye, CheckCircle2, ChevronRight, Scale, Info,
    Maximize2, Minimize2, Ruler, ArrowUp, ArrowLeft, ArrowRight, Sparkles,
    Move, Sliders, Maximize, RefreshCw, GripVertical
} from 'lucide-react';

interface Truck3dVisualizerProps {
    cargoItems: CargoStackItem[];
    onSaveCargoItems: (updated: CargoStackItem[]) => void;
    fleetType?: string;
    plateNumber?: string;
    readOnly?: boolean;
}

const COLOR_PRESETS = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
    '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'
];

export default function Truck3dVisualizer({
    cargoItems,
    onSaveCargoItems,
    fleetType = 'Truk Fuso Long (9m + 1m Gayoran)',
    plateNumber = 'B 9872 CCE',
    readOnly = false
}: Truck3dVisualizerProps) {
    const [viewMode, setViewMode] = useState<'3d' | 'top'>('3d');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(cargoItems[0]?.id || null);

    // Canvas container ref for mouse coordinate math
    const canvasRef = useRef<HTMLDivElement | null>(null);

    // Mouse Dragging & Resizing States
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; initialPosX: number; initialPosY: number; initialW: number; initialH: number }>({
        mouseX: 0, mouseY: 0, initialPosX: 0, initialPosY: 0, initialW: 16, initialH: 24
    });

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

    const selectedItem = cargoItems.find(i => i.id === selectedItemId);

    // Totals calculations
    const totalKoli = cargoItems.reduce((sum, item) => sum + item.koliCount, 0);
    const totalWeightKg = cargoItems.reduce((sum, item) => sum + item.weightKg, 0);
    const totalCbm = cargoItems.reduce((sum, item) => sum + item.cbm, 0);
    const maxCapacityCbm = 60; // 10 Meter Long Bed (3.3m High) ~60 CBM
    const cbmPercentage = Math.min(100, Math.round((totalCbm / maxCapacityCbm) * 100));

    // Balance calculations based on item position (posX 0 to 100)
    const frontWeight = cargoItems.filter(i => (i.posX ?? 20) <= 35 || i.zone === 'front' || i.zone === 'cabin_top').reduce((s, i) => s + i.weightKg, 0);
    const middleWeight = cargoItems.filter(i => (i.posX ?? 50) > 35 && (i.posX ?? 50) <= 70).reduce((s, i) => s + i.weightKg, 0);
    const rearWeight = cargoItems.filter(i => (i.posX ?? 80) > 70).reduce((s, i) => s + i.weightKg, 0);

    const frontPct = totalWeightKg > 0 ? Math.round((frontWeight / totalWeightKg) * 100) : 33;
    const middlePct = totalWeightKg > 0 ? Math.round((middleWeight / totalWeightKg) * 100) : 34;
    const rearPct = totalWeightKg > 0 ? Math.round((rearWeight / totalWeightKg) * 100) : 33;

    // Weight imbalance alert
    const isUnbalanced = (frontPct > 55) || (rearPct > 55);

    // Dynamic zone resolver from position
    const resolveZoneAndLayer = (posX: number, posY: number) => {
        let zone: CargoZone = 'front';
        if (posX < 12) zone = 'cabin_top';
        else if (posX < 36) zone = 'front';
        else if (posX < 66) zone = 'middle';
        else if (posX < 88) zone = 'rear';
        else zone = 'tailgate_extension';

        let layer: CargoLayer = 'dasaran';
        if (posY < 30) layer = 'dasaran';
        else if (posY < 65) layer = 'tengah';
        else layer = 'atasan';

        return { zone, layer };
    };

    // MOUSE DRAG & RESIZE ENGINE
    const handlePointerDownBox = (e: React.PointerEvent, item: CargoStackItem, isResizeHandle: boolean = false) => {
        if (readOnly) return;
        e.stopPropagation();
        setSelectedItemId(item.id);
        setActiveBoxId(item.id);

        setDragStart({
            mouseX: e.clientX,
            mouseY: e.clientY,
            initialPosX: item.posX ?? 30,
            initialPosY: item.posY ?? 20,
            initialW: item.widthPct ?? 16,
            initialH: item.heightPct ?? 24,
        });

        if (isResizeHandle) {
            setIsResizing(true);
        } else {
            setIsDragging(true);
        }
    };

    useEffect(() => {
        const handlePointerMoveGlobal = (e: PointerEvent) => {
            if (!activeBoxId || (!isDragging && !isResizing) || !canvasRef.current) return;

            const rect = canvasRef.current.getBoundingClientRect();
            const deltaXPixel = e.clientX - dragStart.mouseX;
            const deltaYPixel = e.clientY - dragStart.mouseY;

            // Convert pixels to canvas percentage
            const deltaXPct = (deltaXPixel / rect.width) * 100;
            const deltaYPct = (deltaYPixel / rect.height) * 100;

            const updated = cargoItems.map(item => {
                if (item.id === activeBoxId) {
                    if (isDragging) {
                        const newPosX = Math.max(0, Math.min(94, dragStart.initialPosX + deltaXPct));
                        const newPosY = Math.max(2, Math.min(85, dragStart.initialPosY - deltaYPct)); // inverted Y
                        const { zone, layer } = resolveZoneAndLayer(newPosX, newPosY);
                        return {
                            ...item,
                            posX: newPosX,
                            posY: newPosY,
                            zone,
                            layer,
                        };
                    } else if (isResizing) {
                        const newW = Math.max(6, Math.min(35, dragStart.initialW + deltaXPct));
                        const newH = Math.max(10, Math.min(60, dragStart.initialH - deltaYPct));
                        return {
                            ...item,
                            widthPct: newW,
                            heightPct: newH,
                        };
                    }
                }
                return item;
            });

            onSaveCargoItems(updated);
        };

        const handlePointerUpGlobal = () => {
            setIsDragging(false);
            setIsResizing(false);
            setActiveBoxId(null);
        };

        if (isDragging || isResizing) {
            window.addEventListener('pointermove', handlePointerMoveGlobal);
            window.addEventListener('pointerup', handlePointerUpGlobal);
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMoveGlobal);
            window.removeEventListener('pointerup', handlePointerUpGlobal);
        };
    }, [isDragging, isResizing, activeBoxId, dragStart, cargoItems]);

    // Helper to add new item
    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sttNumber || !destination) {
            alert('Harap isi No STT dan Kota Tujuan!');
            return;
        }

        let defaultPosX = 20;
        let defaultPosY = 15;

        if (targetZone === 'cabin_top') { defaultPosX = 4; defaultPosY = 75; }
        else if (targetZone === 'front') { defaultPosX = 22; }
        else if (targetZone === 'middle') { defaultPosX = 50; }
        else if (targetZone === 'rear') { defaultPosX = 76; }
        else if (targetZone === 'tailgate_extension') { defaultPosX = 92; }

        if (targetLayer === 'dasaran') { defaultPosY = 12; }
        else if (targetLayer === 'tengah') { defaultPosY = 46; }
        else if (targetLayer === 'atasan') { defaultPosY = 78; }

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
            posX: defaultPosX,
            posY: defaultPosY,
            widthPct: 16,
            heightPct: 24,
            color: selectedColor,
        };

        const updated = [...cargoItems, newItem];
        onSaveCargoItems(updated);
        setSelectedItemId(newItem.id);

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
            if (selectedItemId === id) setSelectedItemId(updated[0]?.id || null);
        }
    };

    const containerStyle = isFullScreen
        ? "fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto space-y-6 animate-fade-in"
        : "bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6";

    return (
        <div className={containerStyle}>
            
            {/* Header Control Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 font-black">
                        <Truck size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-white tracking-wide">KANVAS 3D DRAG & DROP + RESIZE MOUSE</h3>
                            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                DRAG BEBAS DENGAN MOUSE
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
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                viewMode === '3d'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Box size={14} /> Kanvas 3D Drag & Drop
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('top')}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                viewMode === 'top'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <ArrowDown size={14} /> Denah Atas
                        </button>
                    </div>

                    {/* Fullscreen Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                        {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        {isFullScreen ? 'Kecilkan Studio' : 'Full Screen Studio'}
                    </button>

                    {!readOnly && (
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <Plus size={16} /> + Tambah Tumpukan Koli Baru
                        </button>
                    )}
                </div>
            </div>

            {/* Metrics HUD Bar */}
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
                        <span>Kapasitas (Max 10m x 3.3m)</span>
                        <span className="text-indigo-400">{cbmPercentage}%</span>
                    </div>
                    <p className="text-2xl font-black text-indigo-300 font-mono mt-1">{totalCbm.toFixed(1)} <span className="text-xs text-slate-400 font-sans font-normal">/ {maxCapacityCbm} m³</span></p>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-500" style={{ width: `${cbmPercentage}%` }}></div>
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

            {/* ── 3D DYNAMIC FREEFORM CANVAS CONTAINER ── */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 relative overflow-hidden select-none">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                        <Sparkles size={14} className="text-emerald-400 animate-pulse" />
                        <span>Kanvas Drag & Drop Bebas Mouse: Klik & tahan kotak untuk menggeser • Tarik sudut kanan atas untuk memperpanjang ukuran</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                        Panjang: 10 Meter • Tinggi: 3.30 Meter
                    </div>
                </div>

                {/* ── MAIN 3D TRUCK BED FREEFORM CANVAS AREA ── */}
                <div className="py-6 overflow-x-auto">
                    <div className="min-w-[1000px] max-w-6xl mx-auto relative pt-12 pb-10">
                        
                        {/* TRUCK CHASSIS OUTLINE & MEASUREMENT GRID CONTAINER */}
                        <div
                            ref={canvasRef}
                            className="relative w-full h-[340px] bg-slate-950/95 border-2 border-slate-700 rounded-3xl shadow-2xl p-4 overflow-hidden flex items-end"
                        >
                            
                            {/* Height Markers Labels (Left Axis) */}
                            <div className="absolute top-3 left-3 z-10 flex flex-col gap-16 text-[9px] font-mono text-slate-500 font-bold border-l border-slate-800 pl-2 pointer-events-none">
                                <span className="text-amber-400">▲ 3.30m (Atasan)</span>
                                <span className="text-purple-400">▲ 2.20m (Tengah)</span>
                                <span className="text-blue-400">▲ 1.00m (Dasaran)</span>
                            </div>

                            {/* Distance Length Markers (Bottom Axis) */}
                            <div className="absolute inset-x-0 bottom-1.5 px-4 flex justify-between text-[9px] font-mono text-slate-500 font-bold border-t border-slate-800 pt-1 z-10 pointer-events-none">
                                <span>0m (Driver)</span>
                                <span>3m (Depan)</span>
                                <span>6m (Tengah)</span>
                                <span>9m (Pintu Belakang)</span>
                                <span className="text-emerald-400 font-black">10m (Gayoran)</span>
                            </div>

                            {/* Zone Guide Lines Background */}
                            <div className="absolute inset-0 flex pointer-events-none opacity-20">
                                <div className="w-[12%] border-r border-dashed border-cyan-400 bg-cyan-500/10"></div>
                                <div className="w-[24%] border-r border-dashed border-blue-400 bg-blue-500/10"></div>
                                <div className="w-[30%] border-r border-dashed border-purple-400 bg-purple-500/10"></div>
                                <div className="w-[22%] border-r border-dashed border-amber-400 bg-amber-500/10"></div>
                                <div className="w-[12%] bg-emerald-500/10"></div>
                            </div>

                            {/* ── DRIVER CABIN STRUCTURAL SHAPE ── */}
                            <div className="absolute bottom-8 left-2 w-[11%] h-[170px] bg-gradient-to-t from-slate-800 to-slate-700 border-2 border-slate-600 rounded-l-2xl p-2 flex flex-col justify-between shadow-2xl z-0 pointer-events-none">
                                <div className="text-[8px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-1 py-0.5 rounded border border-cyan-500/40 text-center">
                                    ROOF KABIN
                                </div>
                                <div className="w-full h-8 bg-blue-400/20 border border-blue-400/50 rounded flex items-center justify-center text-[8px] font-bold text-blue-200">
                                    Kabin Driver
                                </div>
                                <div className="text-[8px] font-mono text-slate-400 text-center">R1 Wheel</div>
                            </div>

                            {/* ── GAYORAN TAILGATE EXTENSION GATE SHAPE ── */}
                            <div className="absolute bottom-8 right-2 w-[10%] h-[190px] border-2 border-dashed border-emerald-500/60 rounded-r-2xl bg-emerald-950/20 p-2 flex flex-col justify-between pointer-events-none z-0">
                                <span className="text-[8px] font-mono font-black text-emerald-400 text-center bg-emerald-500/20 py-0.5 rounded">
                                    GAYORAN +1M
                                </span>
                            </div>

                            {/* ── DYNAMIC 3D BOX CARGO BLOCKS RENDERING ENGINE WITH DRAG & RESIZE ── */}
                            {cargoItems.length === 0 ? (
                                <div className="w-full text-center py-20 text-slate-500 italic text-sm font-medium z-10 pointer-events-none">
                                    Bak truk 10 Meter bersih & kosong. Klik tombol <strong className="text-emerald-400 not-italic">+ Tambah Tumpukan Koli Baru</strong> di atas untuk menaruh muatan.
                                </div>
                            ) : (
                                cargoItems.map(item => {
                                    const isSelected = selectedItemId === item.id;
                                    const posX = item.posX ?? 30;
                                    const posY = item.posY ?? 20;
                                    const widthPct = item.widthPct ?? 16;
                                    const heightPct = item.heightPct ?? 24;

                                    return (
                                        <div
                                            key={item.id}
                                            onPointerDown={(e) => handlePointerDownBox(e, item, false)}
                                            style={{
                                                left: `${posX}%`,
                                                bottom: `${posY}%`,
                                                width: `${widthPct}%`,
                                                height: `${heightPct}%`,
                                                backgroundColor: item.color || '#3B82F6',
                                            }}
                                            className={`absolute rounded-xl p-2.5 text-white shadow-2xl transition-shadow border-2 z-20 flex flex-col justify-between cursor-grab active:cursor-grabbing ${
                                                isSelected ? 'ring-4 ring-white border-white scale-[1.02] shadow-indigo-500/50 z-30' : 'border-white/40 opacity-90'
                                            }`}
                                        >
                                            {/* Top Face Header */}
                                            <div className="flex items-center justify-between border-b border-white/30 pb-1">
                                                <span className="font-mono font-black text-[10px] tracking-tight">{item.sttNumber}</span>
                                                <span className="text-[8px] bg-black/40 px-1 py-0.5 rounded font-mono">{item.koliCount}k</span>
                                            </div>

                                            <div>
                                                <div className="text-[9px] font-bold truncate">{item.destination}</div>
                                                <div className="text-[8px] opacity-80 truncate">{item.clientName}</div>
                                            </div>

                                            <div className="flex justify-between items-end text-[8px] font-mono opacity-90 border-t border-white/20 pt-1">
                                                <span>{item.weightKg}kg</span>
                                                <span className="uppercase font-bold text-[7.5px]">{item.zone.slice(0, 5)}</span>
                                            </div>

                                            {/* RESIZE HANDLE CORNER WIDGET (MOUSE DRAG TO STRETCH BOX) */}
                                            {!readOnly && isSelected && (
                                                <div
                                                    onPointerDown={(e) => handlePointerDownBox(e, item, true)}
                                                    className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 border-2 border-white flex items-center justify-center cursor-nwse-resize shadow-lg hover:scale-125 transition-transform z-40"
                                                    title="Tarik dengan mouse untuk memperpanjang / memperbesar ukuran box"
                                                >
                                                    <Maximize size={12} className="rotate-45" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* ── SELECTED CARGO ITEM INTERACTIVE CONTROL DRAWER ── */}
                {selectedItem && !readOnly && (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 animate-fade-in shadow-2xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
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

                            <button
                                type="button"
                                onClick={() => handleDeleteItem(selectedItem.id)}
                                className="bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-red-500/40 transition-all flex items-center gap-1 self-start md:self-auto"
                            >
                                <Trash2 size={13} /> Hapus dari Bak
                            </button>
                        </div>

                        {/* Interactive Move Position & Scale Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                                <span className="text-slate-400 font-mono">Posisi Koordinat Visual:</span>
                                <span className="text-emerald-400 font-mono font-bold">
                                    Panjang: {(selectedItem.posX ?? 0).toFixed(0)}% • Tinggi: {(selectedItem.posY ?? 0).toFixed(0)}%
                                </span>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                                <span className="text-slate-400 font-mono">Ukuran Panjang/Tinggi Box:</span>
                                <span className="text-indigo-300 font-mono font-bold">
                                    {(selectedItem.widthPct ?? 16).toFixed(0)}% x {(selectedItem.heightPct ?? 24).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL FORM: ADD NEW CARGO KOLI */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl text-white">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Box className="text-emerald-400" size={20} /> Tambah Penataan Koli ke Bak Truk 10m
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
