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

function A6Template({ tx, koliNum, totalKoli, isPreview = false }: TemplateProps) {
    const cleanedSTT = tx.noSTT.replace(/^stt[\s-]*|stt/gi, '').trim();
    
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
                    <span className="font-black text-3xl tracking-widest block uppercase">
                        KOLI {koliNum} / {totalKoli}
                    </span>
                </div>
            </div>
        </div>
    );
}

function Landscape60x40Template({ tx, koliNum, totalKoli, isPreview = false }: TemplateProps) {
    const cleanedSTT = tx.noSTT.replace(/^stt[\s-]*|stt/gi, '').trim();
    
    return (
        <div className={isPreview ? "label-preview-card-60x40" : "print-page-60x40"}>
            {/* Header */}
            <div className="flex justify-between items-start border-b border-black pb-0.5 relative z-10">
                <div className="text-left">
                    <h3 className="font-black text-[10px] leading-tight text-black flex items-center gap-1">
                        <span className="font-black bg-black text-white px-0.5 py-0.2 rounded text-[8px]">CCE</span>
                        CAHAYA CARGO EXPRESS
                    </h3>
                    <p className="text-[7px] text-gray-550 font-semibold leading-none mt-0.5">
                        Jalan Kemudi No. 4, Surabaya | Telp: 081 337 878 138
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-extrabold text-[7.5px] text-gray-800 leading-none mt-0.5 tracking-tighter uppercase">
                        BANDUNG - SURABAYA - KE SELURUH SULAWESI
                    </p>
                </div>
            </div>

            {/* Middle: STT, Barcode & Koli */}
            <div className="flex justify-between items-center py-1 flex-1 relative z-10 gap-2">
                {/* Left Column: STT & Barcode */}
                <div className="w-[66%] flex flex-col justify-center items-start gap-1">
                    <div className="leading-none">
                        <p className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">No. STT / Resi</p>
                        <h2 className="font-mono font-black text-3xl text-black tracking-widest leading-none mt-0.5">
                            {cleanedSTT}
                        </h2>
                    </div>
                    <div className="w-full h-[18px] bg-white">
                        <Code39Barcode value={tx.noSTT} height={16} narrowWidth={0.8} wideWidth={2.0} />
                    </div>
                </div>
                
                {/* Right Column: Huge Koli */}
                <div className="w-[32%] bg-black text-white rounded p-1 flex flex-col justify-center items-center text-center">
                    <span className="text-[7px] font-bold tracking-widest uppercase opacity-80 leading-none">KOLI</span>
                    <span className="font-black text-lg tracking-wider block leading-tight mt-0.5">
                        {koliNum}/{totalKoli}
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-black pt-0.5 flex justify-between items-center text-[7.5px] text-black relative z-10">
                <div className="w-[55%] truncate">
                    <span className="text-[7px] text-gray-405 text-gray-500 font-bold uppercase block">Pengirim</span>
                    <span className="font-extrabold text-[9px]">{tx.pengirimName}</span>
                </div>
                <div className="w-[42%] text-right border-l border-gray-300 pl-1.5 truncate">
                    <span className="text-[7px] text-gray-405 text-gray-500 font-bold uppercase block">Tujuan</span>
                    <span className="font-black text-[9px] uppercase tracking-wider">{tx.tujuan}</span>
                </div>
            </div>
        </div>
    );
}

export default function LabelResiPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [labelSize, setLabelSize] = useState<'A6' | '60x40'>('A6');

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
        setSelectedTx(tx);
        setSearchTerm('');
    };

    const handlePrint = () => {
        if (!selectedTx) return;
        window.print();
    };

    return (
        <ProtectedRoute>
            <RouteGuard module="label_resi">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: ${labelSize === 'A6' ? 'A6 portrait' : '60mm 40mm'};
                        margin: 0 !important;
                    }
                    html, body {
                        width: ${labelSize === 'A6' ? '105mm' : '60mm'} !important;
                        height: ${labelSize === 'A6' ? '148mm' : '40mm'} !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        overflow: hidden !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    #__next, [data-reactroot], main {
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-page-a6 {
                        display: flex !important;
                        flex-direction: column;
                        justify-content: space-between;
                        box-sizing: border-box;
                        width: 105mm !important;
                        height: 148mm !important;
                        padding: 6mm 8mm;
                        page-break-after: always;
                        break-after: page;
                        page-break-inside: avoid;
                        break-inside: avoid;
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
                        height: 40mm !important;
                        padding: 1.5mm 2.5mm !important;
                        page-break-after: always;
                        break-after: page;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        position: relative;
                        overflow: hidden;
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

                .label-preview-card-60x40 {
                    width: 90mm;
                    height: 60mm;
                    background: #ffffff;
                    border: 2px dashed #94a3b8;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    padding: 3.5mm 5mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    position: relative;
                    overflow: hidden;
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
                                        onClick={() => setLabelSize('A6')}
                                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${labelSize === 'A6' ? 'bg-white text-blue-650 text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        A6 Portrait
                                    </button>
                                    <button
                                        onClick={() => setLabelSize('60x40')}
                                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${labelSize === '60x40' ? 'bg-white text-blue-650 text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        60x40 Landscape
                                    </button>
                                </div>
                                {selectedTx && (
                                    <button
                                        onClick={handlePrint}
                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                                    >
                                        <Printer size={18} />
                                        Cetak PDF ({labelSize === 'A6' ? 'A6' : '60x40'})
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
                                            <span className="text-[10px] font-bold bg-green-150 text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
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
                                    
                                    <div className="bg-gray-100 p-6 rounded-3xl border border-gray-200 flex flex-col items-center gap-8 overflow-y-auto max-h-[70vh]">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">
                                                Preview Gulungan Sticker ({selectedTx.koli} Lembar)
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                Tampilan di bawah mewakili kertas sticker thermal {labelSize === 'A6' ? 'A6 Portrait' : '60x40 Landscape'} yang akan dicetak
                                            </p>
                                        </div>

                                        {/* Generating N pages for Koli quantity */}
                                        {Array.from({ length: selectedTx.koli || 1 }, (_, index) => {
                                            const koliNum = index + 1;
                                            return labelSize === 'A6' ? (
                                                <A6Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={selectedTx.koli || 1} isPreview={true} />
                                            ) : (
                                                <Landscape60x40Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={selectedTx.koli || 1} isPreview={true} />
                                            );
                                        })}
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
                    {Array.from({ length: selectedTx.koli || 1 }, (_, index) => {
                        const koliNum = index + 1;
                        return labelSize === 'A6' ? (
                            <A6Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={selectedTx.koli || 1} isPreview={false} />
                        ) : (
                            <Landscape60x40Template key={koliNum} tx={selectedTx} koliNum={koliNum} totalKoli={selectedTx.koli || 1} isPreview={false} />
                        );
                    })}
                </div>
            )}
            </RouteGuard>
        </ProtectedRoute>
    );
}
