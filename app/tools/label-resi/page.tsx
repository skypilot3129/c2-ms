'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Transaction } from '@/types/transaction';
import ProtectedRoute from '@/components/ProtectedRoute';
import RouteGuard from '@/components/RouteGuard';
import Code39Barcode from '@/components/Code39Barcode';
import { ArrowLeft, Printer, Search, Barcode, User, MapPin, Package, RefreshCw, Layers } from 'lucide-react';

interface TemplateProps {
    tx: Transaction;
    koliNum: number;
    totalKoli: number;
    isPreview?: boolean;
}

function adaptiveLabelPt(text: string | undefined | null, maxPt: number, minPt: number, softLimit: number): string {
    const str = String(text ?? '').trim();
    if (!str || str.length <= softLimit) return `${maxPt}pt`;
    const ratio = softLimit / str.length;
    const scaled = Math.max(minPt, Number((maxPt * Math.sqrt(ratio)).toFixed(1)));
    return `${scaled}pt`;
}

function A6Template({ tx, koliNum, totalKoli, isPreview = false }: TemplateProps) {
    const cleanedSTT = tx.noSTT.replace(/^stt[\s-]*|stt/gi, '').trim();
    const koliFontCls = totalKoli >= 100 ? 'text-2xl' : 'text-3xl';

    return (
        <div className={isPreview ? "label-preview-card-a6" : "print-page-a6"}>
            {/* Background Watermark/Large CCE */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none">
                <span className="font-black text-[120px] tracking-widest">CCE</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-black pb-2.5 relative z-10">
                <div className="text-left">
                    <h3 className="font-black text-sm tracking-wide text-black">CAHAYA CARGO EXPRESS</h3>
                    <p className="text-[9px] text-gray-500 font-semibold tracking-tight uppercase">
                        Jalan Kemudi No. 4, Surabaya | Telp: 081 337 878 138
                    </p>
                </div>
                <span className="font-black text-2xl text-black tracking-widest">CCE</span>
            </div>

            {/* Route Banner */}
            <div className="text-center py-1 border-b-2 border-black text-[10px] font-extrabold tracking-wider text-black uppercase relative z-10 bg-gray-50/50">
                BANDUNG - SURABAYA - KE SELURUH SULAWESI
            </div>

            {/* Main STT & Barcode Area */}
            <div className="text-center py-4 flex-1 flex flex-col justify-center items-center gap-4 relative z-10">
                <div className="space-y-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No. STT / Resi</p>
                    <h2 className="font-mono font-black text-5xl text-black tracking-widest leading-none">
                        {cleanedSTT}
                    </h2>
                </div>
                
                {/* Barcode Component */}
                <div className="w-[85%] max-w-[220px] h-[40px] bg-white p-1 rounded-sm border border-gray-150">
                    <Code39Barcode value={tx.noSTT} height={32} narrowWidth={1.5} wideWidth={3.8} />
                </div>
            </div>

            {/* Footer & Paging details */}
            <div className="border-t-2 border-black pt-2.5 flex flex-col justify-between gap-3 relative z-10">
                
                {/* Sender & Destination Info */}
                <div className="flex justify-between items-start text-xs text-gray-800 leading-tight">
                    <div className="w-[60%]">
                        <span className="font-bold text-gray-400 text-[8px] uppercase tracking-wider block mb-0.5">Pengirim</span>
                        <p className="font-extrabold text-sm">{tx.pengirimName}</p>
                        {tx.pengirimPhone && (
                            <p className="text-gray-500 text-[10px] mt-0.5">Telp: {tx.pengirimPhone}</p>
                        )}
                    </div>
                    <div className="w-[38%] text-right border-l border-gray-300 pl-3">
                        <span className="font-bold text-gray-400 text-[8px] uppercase tracking-wider block mb-0.5">Tujuan</span>
                        <p className="font-black text-sm uppercase text-gray-900 tracking-wide">{tx.tujuan}</p>
                    </div>
                </div>

                {/* Big Koli Paging */}
                <div className="bg-black text-white text-center py-3 rounded-xl">
                    <span className={`font-black ${koliFontCls} tracking-widest block uppercase`}>
                        KOLI {koliNum} / {totalKoli}
                    </span>
                </div>
            </div>
        </div>
    );
}

function Landscape60x40Template({ tx, koliNum, totalKoli, isPreview = false }: TemplateProps) {
    const cleanedSTT = tx.noSTT.replace(/^stt[\s-]*|stt/gi, '').trim() || tx.noSTT;
    const isHundredsOrMore = totalKoli >= 100;
    const inlineKoliText = `${koliNum}/${totalKoli}`;
    const sttFontSize = adaptiveLabelPt(cleanedSTT, 16, 10.5, 6);
    const pengirimFontSize = adaptiveLabelPt(tx.pengirimName, 8, 6, 14);
    const tujuanFontSize = adaptiveLabelPt(tx.tujuan, 8.2, 6, 11);

    const sheet = (
        <div className={isPreview ? "label-60x40-sheet label-60x40-preview-inner" : "print-page-60x40 label-60x40-sheet"}>
            {/* Band 1: Compact Single-Row High-Contrast Header (~4.6mm) */}
            <div className="l60-header">
                <div className="l60-brand">
                    <span className="l60-badge">CCE</span>
                    <span className="l60-company">CAHAYA CARGO EXPRESS</span>
                </div>
                <span className="l60-route">SBY • BDG • SULAWESI</span>
            </div>

            {/* Band 2: STT + Barcode (Left) & Generous Koli Box (Right) */}
            <div className="l60-middle">
                {/* Left Column: No. STT & Barcode */}
                <div className="l60-stt-col">
                    <div className="l60-stt-label">NO. STT / RESI</div>
                    <div className="l60-stt-val" style={{ fontSize: sttFontSize }}>
                        {cleanedSTT}
                    </div>
                    <div className="l60-barcode">
                        <Code39Barcode value={tx.noSTT} height={28} narrowWidth={1} wideWidth={2.4} />
                    </div>
                </div>

                {/* Right Column: Spacious Koli Counter (supports 3-4 digit ratusan cleanly) */}
                <div className="l60-koli-box">
                    <span className="l60-koli-lbl">KOLI</span>
                    {isHundredsOrMore ? (
                        <>
                            <span
                                className="l60-koli-num-big"
                                style={{ fontSize: koliNum >= 1000 ? '11.5pt' : '14pt' }}
                            >
                                {koliNum}
                            </span>
                            <span
                                className="l60-koli-total"
                                style={{ fontSize: totalKoli >= 1000 ? '7pt' : '8pt' }}
                            >
                                / {totalKoli}
                            </span>
                        </>
                    ) : (
                        <span
                            className="l60-koli-inline"
                            style={{ fontSize: inlineKoliText.length >= 5 ? '11.5pt' : '13.5pt' }}
                        >
                            {inlineKoliText}
                        </span>
                    )}
                </div>
            </div>

            {/* Band 3: Footer — Pengirim & Tujuan (2-line safe, never clipped) */}
            <div className="l60-footer">
                <div className="l60-foot-left">
                    <div className="l60-foot-lbl">PENGIRIM</div>
                    <div className="l60-foot-val" style={{ fontSize: pengirimFontSize }}>
                        {tx.pengirimName || '-'}
                    </div>
                </div>
                <div className="l60-foot-right">
                    <div className="l60-foot-lbl">TUJUAN</div>
                    <div className="l60-foot-val l60-foot-tujuan" style={{ fontSize: tujuanFontSize }}>
                        {tx.tujuan || '-'}
                    </div>
                </div>
            </div>
        </div>
    );

    if (isPreview) {
        return <div className="label-preview-stage-60x40">{sheet}</div>;
    }

    return sheet;
}

export default function LabelResiPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [labelSize, setLabelSize] = useState<'A6' | '60x40'>('60x40');
    const [koliFrom, setKoliFrom] = useState<number>(1);
    const [koliTo, setKoliTo] = useState<number>(1);
    const [showAllPreview, setShowAllPreview] = useState<boolean>(false);

    // Subscribe to transactions
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToTransactions((txs) => {
            setTransactions(txs);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // Filter transactions based on STT, sender, receiver
    const filteredTxs = transactions.filter(tx => {
        const cleanSearch = searchTerm.toLowerCase().trim();
        if (!cleanSearch) return false;
        
        // Match numbers directly (e.g. 18412 matching STT018412)
        const sttMatch = tx.noSTT.toLowerCase().includes(cleanSearch) || 
                         tx.noSTT.replace(/[^\d]/g, '').includes(cleanSearch);
                         
        return sttMatch ||
               tx.pengirimName.toLowerCase().includes(cleanSearch) ||
               tx.penerimaName.toLowerCase().includes(cleanSearch);
    });

    // Top 8 recent transactions to select quickly
    const recentTxs = transactions.slice(0, 8);

    const handleSelectTx = (tx: Transaction) => {
        const total = Math.max(1, tx.koli || 1);
        setSelectedTx(tx);
        setKoliFrom(1);
        setKoliTo(total);
        setShowAllPreview(false);
        setSearchTerm('');
    };

    const handlePrint = () => {
        if (!selectedTx) return;
        window.print();
    };

    const totalKoli = Math.max(1, selectedTx?.koli || 1);
    const safeFrom = Math.max(1, Math.min(koliFrom || 1, totalKoli));
    const safeTo = Math.max(safeFrom, Math.min(koliTo || totalKoli, totalKoli));
    const printCount = selectedTx ? (safeTo - safeFrom + 1) : 0;
    const koliNumbersToPrint = selectedTx
        ? Array.from({ length: printCount }, (_, idx) => safeFrom + idx)
        : [];
    const previewKoliNumbers = showAllPreview || koliNumbersToPrint.length <= 12
        ? koliNumbersToPrint
        : Array.from(new Set([
            koliNumbersToPrint[0],
            koliNumbersToPrint[Math.min(1, koliNumbersToPrint.length - 1)],
            koliNumbersToPrint[Math.floor(koliNumbersToPrint.length / 2)],
            koliNumbersToPrint[koliNumbersToPrint.length - 1],
        ]));

    return (
        <ProtectedRoute>
            <RouteGuard module="label_resi">
            <style dangerouslySetInnerHTML={{ __html: `
                @page {
                    size: ${labelSize === 'A6' ? '105mm 148mm' : '60mm 40mm'};
                    margin: 0 !important;
                }

                @media print {
                    html, body {
                        width: ${labelSize === 'A6' ? '105mm' : '60mm'} !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #__next, [data-reactroot], main {
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                        position: static !important;
                        width: ${labelSize === 'A6' ? '105mm' : '60mm'} !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-page-a6 {
                        display: flex !important;
                        flex-direction: column;
                        justify-content: space-between;
                        box-sizing: border-box;
                        width: 105mm !important;
                        height: 147.6mm !important;
                        padding: 6mm 8mm;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        position: relative;
                        overflow: hidden;
                    }
                    .print-page-60x40 {
                        display: flex !important;
                        flex-direction: column;
                        justify-content: space-between;
                        box-sizing: border-box;
                        width: 60mm !important;
                        height: 39.6mm !important;
                        padding: 1.5mm 2mm 2.2mm 2mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        position: relative;
                        overflow: hidden;
                    }
                    .print-page-a6:last-child,
                    .print-page-60x40:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                }
                
                .label-preview-card-a6 {
                    width: 105mm;
                    height: 148mm;
                    background: #ffffff;
                    border: 2px dashed #94a3b8;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    border-radius: 12px;
                    padding: 6mm 8mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    position: relative;
                    overflow: hidden;
                }

                /* Exact 1:1 60x40mm Thermal Label Styling (Xprinter XP-420B 203 DPI) */
                .label-preview-stage-60x40 {
                    width: 99mm;
                    height: 65.34mm;
                    position: relative;
                    flex-shrink: 0;
                }

                .label-60x40-sheet {
                    width: 60mm;
                    height: 39.6mm;
                    padding: 1.5mm 2mm 2.2mm 2mm;
                    box-sizing: border-box;
                    background: #ffffff;
                    color: #000000;
                    font-family: Arial, Helvetica, sans-serif;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    position: relative;
                    overflow: hidden;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .label-60x40-preview-inner {
                    transform: scale(1.65);
                    transform-origin: top left;
                    border: 1.2px dashed #94a3b8;
                    border-radius: 2mm;
                    box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.12);
                }

                .l60-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1mm;
                    border-bottom: 1.2px solid #000000;
                    padding-bottom: 0.7mm;
                    flex-shrink: 0;
                }

                .l60-brand {
                    display: flex;
                    align-items: center;
                    gap: 0.9mm;
                    min-width: 0;
                }

                .l60-badge {
                    background: #000000;
                    color: #ffffff;
                    font-size: 5.5pt;
                    font-weight: 900;
                    padding: 0.25mm 0.9mm;
                    border-radius: 0.5mm;
                    line-height: 1.1;
                    letter-spacing: 0.3px;
                    flex-shrink: 0;
                }

                .l60-company {
                    font-size: 6.2pt;
                    font-weight: 900;
                    color: #000000;
                    letter-spacing: 0.1px;
                    line-height: 1;
                    white-space: nowrap;
                }

                .l60-route {
                    font-size: 4.8pt;
                    font-weight: 800;
                    color: #000000;
                    line-height: 1;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .l60-middle {
                    display: flex;
                    justify-content: space-between;
                    align-items: stretch;
                    gap: 1.8mm;
                    padding: 1mm 0;
                    flex: 1;
                    min-height: 0;
                }

                .l60-stt-col {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 0.5mm;
                }

                .l60-stt-label {
                    font-size: 5pt;
                    font-weight: 800;
                    color: #000000;
                    letter-spacing: 0.4px;
                    line-height: 1;
                    text-transform: uppercase;
                }

                .l60-stt-val {
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: 900;
                    color: #000000;
                    letter-spacing: 0.4px;
                    line-height: 0.95;
                    white-space: nowrap;
                }

                .l60-barcode {
                    width: 100%;
                    height: 6.2mm;
                    margin-top: 0.3mm;
                    overflow: hidden;
                }

                .l60-koli-box {
                    width: 22mm;
                    flex-shrink: 0;
                    background: #000000;
                    color: #ffffff;
                    border-radius: 1.2mm;
                    padding: 0.9mm 1.1mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                }

                .l60-koli-lbl {
                    font-size: 5pt;
                    font-weight: 800;
                    letter-spacing: 0.7px;
                    line-height: 1;
                    text-transform: uppercase;
                }

                .l60-koli-num-big {
                    font-weight: 900;
                    line-height: 1;
                    margin-top: 0.5mm;
                    letter-spacing: 0.2px;
                }

                .l60-koli-total {
                    font-weight: 800;
                    line-height: 1.05;
                    margin-top: 0.4mm;
                    padding-top: 0.4mm;
                    border-top: 0.7px solid rgba(255, 255, 255, 0.7);
                    width: 100%;
                    letter-spacing: 0.2px;
                }

                .l60-koli-inline {
                    font-weight: 900;
                    line-height: 1.05;
                    margin-top: 0.8mm;
                    letter-spacing: 0.2px;
                    white-space: nowrap;
                }

                .l60-footer {
                    display: grid;
                    grid-template-columns: 56% 44%;
                    border-top: 1.2px solid #000000;
                    padding-top: 0.85mm;
                    flex-shrink: 0;
                    min-height: 9.6mm;
                }

                .l60-foot-left {
                    padding-right: 1.3mm;
                    min-width: 0;
                    overflow: hidden;
                }

                .l60-foot-right {
                    border-left: 1px solid #000000;
                    padding-left: 1.3mm;
                    text-align: right;
                    min-width: 0;
                    overflow: hidden;
                }

                .l60-foot-lbl {
                    font-size: 4.8pt;
                    font-weight: 800;
                    color: #000000;
                    letter-spacing: 0.3px;
                    line-height: 1;
                    text-transform: uppercase;
                    margin-bottom: 0.35mm;
                }

                .l60-foot-val {
                    font-weight: 800;
                    color: #000000;
                    line-height: 1.12;
                    word-break: break-word;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .l60-foot-tujuan {
                    font-weight: 900;
                    text-transform: uppercase;
                }
            ` }} />

            <div className="min-h-screen bg-gray-50 pb-16 no-print">
                {/* Header Navigation */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div>
                                <Link href="/" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                                    ← Kembali ke Home
                                </Link>
                                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    <Barcode className="text-blue-600" />
                                    Cetak Label Resi
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">Cetak label sticker thermal untuk STT</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 w-full sm:w-auto">
                                    <button
                                        onClick={() => setLabelSize('60x40')}
                                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${labelSize === '60x40' ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        60x40 (XP-420B)
                                    </button>
                                    <button
                                        onClick={() => setLabelSize('A6')}
                                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${labelSize === 'A6' ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        A6 Portrait
                                    </button>
                                </div>
                                {selectedTx && (
                                    <button
                                        onClick={handlePrint}
                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                                    >
                                        <Printer size={18} />
                                        Cetak {printCount} Label ({labelSize})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8 max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* Left Column: Selector / Search */}
                        <div className="lg:col-span-5 space-y-6">
                            
                            {/* STT Lookup Card */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
                                    <Search size={18} className="text-blue-600" />
                                    Pilih STT Transaksi
                                </h3>

                                <div className="relative mb-4">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-450 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Ketik No STT / Pengirim / Penerima..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-250 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium"
                                    />
                                </div>

                                {/* Live Search Results Dropdown-like List */}
                                {searchTerm.trim().length > 0 && (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto mb-4 divide-y divide-gray-100 bg-gray-50 shadow-inner">
                                        {filteredTxs.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-gray-500">
                                                Tidak ada STT cocok dengan kata kunci.
                                            </div>
                                        ) : (
                                            filteredTxs.map(tx => (
                                                <button
                                                    key={tx.id}
                                                    onClick={() => handleSelectTx(tx)}
                                                    className="w-full p-3 text-left hover:bg-blue-50/50 transition-colors flex justify-between items-center text-xs"
                                                >
                                                    <div>
                                                        <p className="font-mono font-bold text-blue-600 text-sm">{tx.noSTT}</p>
                                                        <p className="text-gray-500 mt-0.5">
                                                            {tx.pengirimName} → {tx.penerimaName}
                                                        </p>
                                                    </div>
                                                    <span className="bg-gray-200 px-2 py-1 rounded text-[10px] font-bold text-gray-700 uppercase">
                                                        {tx.tujuan}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Selected STT Summary */}
                                {selectedTx && (
                                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-2.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Terpilih</span>
                                            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                                {selectedTx.koli} Koli
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-mono font-black text-xl text-gray-800">{selectedTx.noSTT}</h4>
                                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                <User size={13} className="text-gray-400" />
                                                Pengirim: <span className="font-semibold text-gray-700">{selectedTx.pengirimName}</span>
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                <MapPin size={13} className="text-gray-400" />
                                                Tujuan: <span className="font-semibold text-gray-700">{selectedTx.tujuan}</span>
                                            </p>
                                        </div>

                                        {/* Optional Koli Range for large ratusan shipments */}
                                        {totalKoli > 1 && (
                                            <div className="pt-2.5 border-t border-blue-100">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                                                        <Layers size={12} className="text-blue-600" />
                                                        Rentang Cetak Koli
                                                    </span>
                                                    {(safeFrom !== 1 || safeTo !== totalKoli) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setKoliFrom(1);
                                                                setKoliTo(totalKoli);
                                                            }}
                                                            className="text-[10px] font-bold text-blue-600 hover:underline"
                                                        >
                                                            Reset Semua
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={totalKoli}
                                                        value={koliFrom}
                                                        onChange={(e) => setKoliFrom(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                        className="w-20 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white font-bold text-center text-gray-800"
                                                        aria-label="Dari Koli"
                                                    />
                                                    <span className="text-gray-400 font-bold">s/d</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={totalKoli}
                                                        value={koliTo}
                                                        onChange={(e) => setKoliTo(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                        className="w-20 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white font-bold text-center text-gray-800"
                                                        aria-label="Sampai Koli"
                                                    />
                                                    <span className="text-[11px] text-gray-500 font-medium">
                                                        ({printCount} lbr)
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Recent Transactions Checklist */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
                                    <RefreshCw size={18} className="text-gray-400" />
                                    Transaksi Terbaru
                                </h3>
                                
                                {loading ? (
                                    <div className="flex justify-center py-6">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : recentTxs.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-6">Belum ada data transaksi di sistem.</p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {recentTxs.map(tx => (
                                            <button
                                                key={tx.id}
                                                onClick={() => handleSelectTx(tx)}
                                                className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between hover:-translate-y-0.5 hover:shadow-sm ${
                                                    selectedTx?.id === tx.id 
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/10' 
                                                        : 'bg-white hover:bg-gray-50 border-gray-200'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <p className={`font-mono font-bold text-sm ${selectedTx?.id === tx.id ? 'text-white' : 'text-blue-600'}`}>
                                                        {tx.noSTT}
                                                    </p>
                                                    <p className={`text-[11px] truncate mt-0.5 ${selectedTx?.id === tx.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                                        {tx.pengirimName} &bull; {tx.tujuan}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                                                    selectedTx?.id === tx.id 
                                                        ? 'bg-white/20 text-white' 
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {tx.koli} Koli
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Right Column: Label Preview */}
                        <div className="lg:col-span-7 flex flex-col items-center">
                            
                            {!selectedTx ? (
                                <div className="w-full bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center flex flex-col items-center justify-center min-h-[300px]">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                        <Barcode size={32} />
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-800 mb-1">
                                        Preview Label {labelSize === 'A6' ? 'A6' : '60x40'}
                                    </h4>
                                    <p className="text-gray-500 text-sm max-w-sm">
                                        Silakan pilih STT dari daftar transaksi terbaru atau cari berdasarkan Nomor STT di kolom pencarian sebelah kiri.
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full space-y-6">
                                    
                                    <div className="bg-gray-100 p-6 rounded-3xl border border-gray-200 flex flex-col items-center gap-6 overflow-y-auto max-h-[75vh]">
                                        <div className="text-center space-y-1">
                                            <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">
                                                Preview Gulungan Sticker ({printCount} Lembar: Koli {safeFrom}–{safeTo} / {totalKoli})
                                            </p>
                                            <p className="text-[11px] text-gray-500">
                                                Proporsi preview 1:1 sesuai hasil cetak {labelSize === 'A6' ? 'A6 Portrait (105×148mm)' : '60×40mm Landscape (Xprinter XP-420B)'}
                                            </p>
                                            {labelSize === '60x40' && (
                                                <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 inline-block font-semibold mt-1">
                                                    Tips XP-420B: Pilih Paper Size <strong>60×40mm</strong> • Margin <strong>None</strong> • Scale <strong>100%</strong> • Background graphics <strong>ON</strong>
                                                </p>
                                            )}
                                        </div>

                                        {koliNumbersToPrint.length > 12 && (
                                            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-[11px] text-gray-600">
                                                <span>
                                                    {showAllPreview
                                                        ? `Menampilkan seluruh ${koliNumbersToPrint.length} label.`
                                                        : `Menampilkan ${previewKoliNumbers.length} sampel dari ${koliNumbersToPrint.length} label agar ringan (saat Cetak, semua ${koliNumbersToPrint.length} lembar tercetak).`}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllPreview(prev => !prev)}
                                                    className="text-blue-600 font-bold hover:underline shrink-0"
                                                >
                                                    {showAllPreview ? 'Ringkas' : 'Tampilkan Semua'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Generating preview pages */}
                                        {previewKoliNumbers.map((koliNum) =>
                                            labelSize === 'A6' ? (
                                                <A6Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={totalKoli} isPreview={true} />
                                            ) : (
                                                <Landscape60x40Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={totalKoli} isPreview={true} />
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>
                </div>
            </div>

            {/* Print Output (Clean pages, no UI wrappers, only shown when window.print() runs) */}
            {selectedTx && (
                <div className="hidden print-only">
                    {koliNumbersToPrint.map((koliNum) =>
                        labelSize === 'A6' ? (
                            <A6Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={totalKoli} isPreview={false} />
                        ) : (
                            <Landscape60x40Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={totalKoli} isPreview={false} />
                        )
                    )}
                </div>
            )}
            </RouteGuard>
        </ProtectedRoute>
    );
}
