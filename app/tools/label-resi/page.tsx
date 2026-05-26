'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Transaction } from '@/types/transaction';
import ProtectedRoute from '@/components/ProtectedRoute';
import Code39Barcode from '@/components/Code39Barcode';
import { ArrowLeft, Printer, Search, Barcode, User, MapPin, Package, RefreshCw, Layers } from 'lucide-react';

export default function LabelResiPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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
            <style dangerouslySetInnerHTML={{ __html: `
                /* CSS layout for A6 Print mode */
                @media print {
                    @page {
                        size: A6 portrait;
                        margin: 0;
                    }
                    body {
                        background: #fff !important;
                        color: #000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-page {
                        display: flex !important;
                        flex-direction: column;
                        justify-content: space-between;
                        box-sizing: border-box;
                        width: 105mm;
                        height: 148mm;
                        padding: 6mm 8mm;
                        page-break-after: always;
                        break-after: page;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        position: relative;
                        overflow: hidden;
                    }
                }
                
                /* Layout for screen preview of labels */
                .label-preview-card {
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
                                    Cetak Label Resi (A6)
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">Cetak label sticker thermal A6 per STT</p>
                            </div>
                            {selectedTx && (
                                <button
                                    onClick={handlePrint}
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Printer size={18} />
                                    Cetak PDF (Label A6)
                                </button>
                            )}
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

                        {/* Right Column: Label A6 Preview */}
                        <div className="lg:col-span-7 flex flex-col items-center">
                            
                            {!selectedTx ? (
                                <div className="w-full bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center flex flex-col items-center justify-center min-h-[300px]">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                        <Barcode size={32} />
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-800 mb-1">Preview Label A6</h4>
                                    <p className="text-gray-500 text-sm max-w-sm">
                                        Silakan pilih STT dari daftar transaksi terbaru atau cari berdasarkan Nomor STT di kolom pencarian sebelah kiri.
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full space-y-6">
                                    
                                    <div className="bg-gray-100 p-6 rounded-3xl border border-gray-200 flex flex-col items-center gap-8 overflow-y-auto max-h-[70vh]">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Preview Gulungan Sticker ({selectedTx.koli} Lembar)</p>
                                            <p className="text-[10px] text-gray-400">Tampilan di bawah mewakili kertas sticker thermal A6 portrait yang akan dicetak</p>
                                        </div>

                                        {/* Generating N pages for Koli quantity */}
                                        {Array.from({ length: selectedTx.koli || 1 }, (_, index) => {
                                            const koliNum = index + 1;
                                            return (
                                                <div key={koliNum} className="label-preview-card">
                                                    
                                                    {/* Background Watermark/Large CCE */}
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none">
                                                        <span className="font-black text-[120px] tracking-widest">CCE</span>
                                                    </div>

                                                    {/* Header */}
                                                    <div className="flex justify-between items-start border-b-2 border-black pb-2.5 relative z-10">
                                                        <div>
                                                            <h3 className="font-black text-sm tracking-wide text-black">CAHAYA CARGO EXPRESS</h3>
                                                            <p className="text-[9px] text-gray-500 font-medium tracking-tight uppercase">Jasa Pengiriman Terpercaya</p>
                                                        </div>
                                                        <span className="font-black text-2xl text-black tracking-widest">CCE</span>
                                                    </div>

                                                    {/* Main STT & Barcode Area */}
                                                    <div className="text-center py-4 flex-1 flex flex-col justify-center items-center gap-3 relative z-10">
                                                        <div className="space-y-0.5">
                                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">No. STT / Resi</p>
                                                            <h2 className="font-mono font-black text-4xl text-black tracking-widest">
                                                                {selectedTx.noSTT}
                                                            </h2>
                                                        </div>
                                                        
                                                        {/* Small Barcode Component */}
                                                        <div className="w-[80%] max-w-[200px] h-[36px] bg-white p-1 rounded-sm border border-gray-150">
                                                            <Code39Barcode value={selectedTx.noSTT} height={32} />
                                                        </div>
                                                    </div>

                                                    {/* Footer & Paging details */}
                                                    <div className="border-t-2 border-black pt-2.5 flex flex-col justify-between gap-2.5 relative z-10">
                                                        
                                                        {/* Small Sender info */}
                                                        <div className="text-[10px] text-gray-750 text-gray-800 leading-tight">
                                                            <span className="font-bold text-gray-500 text-[8px] uppercase tracking-wider block mb-0.5">Pengirim</span>
                                                            <p className="font-bold">{selectedTx.pengirimName}</p>
                                                            {selectedTx.pengirimPhone && (
                                                                <p className="text-gray-500 mt-0.5">Telp: {selectedTx.pengirimPhone}</p>
                                                            )}
                                                            <p className="text-gray-550 text-gray-600 mt-0.5 uppercase font-bold text-[9px] tracking-wide">Tujuan: {selectedTx.tujuan}</p>
                                                        </div>

                                                        {/* Big Koli Paging */}
                                                        <div className="bg-black text-white text-center py-2 rounded-lg">
                                                            <span className="font-black text-2xl tracking-widest block uppercase">
                                                                KOLI {koliNum} / {selectedTx.koli}
                                                            </span>
                                                        </div>

                                                    </div>

                                                </div>
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
                        return (
                            <div key={koliNum} className="print-page">
                                
                                {/* Watermark Background */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none',
                                    opacity: 0.05,
                                    zIndex: 0
                                }}>
                                    <span style={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: '100pt', letterSpacing: '2px' }}>CCE</span>
                                </div>

                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid black', paddingBottom: '8px', zIndex: 10 }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontWeight: 900, fontSize: '12pt', color: 'black' }}>CAHAYA CARGO EXPRESS</h3>
                                        <p style={{ margin: '1px 0 0 0', fontSize: '7.5pt', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Jasa Pengiriman Terpercaya</p>
                                    </div>
                                    <span style={{ fontWeight: 900, fontSize: '18pt', color: 'black', letterSpacing: '1px' }}>CCE</span>
                                </div>

                                {/* Middle: Massive STT and small barcode */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', margin: '20px 0', zIndex: 10 }}>
                                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                        <p style={{ margin: 0, fontSize: '8pt', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>No. STT / Resi</p>
                                        <h2 style={{ margin: '4px 0 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '30pt', color: 'black', letterSpacing: '2px' }}>
                                            {selectedTx.noSTT}
                                        </h2>
                                    </div>
                                    
                                    {/* Barcode component */}
                                    <div style={{ width: '180px', height: '34px', background: 'white' }}>
                                        <Code39Barcode value={selectedTx.noSTT} height={32} />
                                    </div>
                                </div>

                                {/* Footer & Paging details */}
                                <div style={{ borderTop: '2px solid black', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
                                    
                                    {/* Small Sender info */}
                                    <div style={{ fontSize: '8pt', color: '#000', lineHeight: 1.3 }}>
                                        <span style={{ fontWeight: 'bold', color: '#888', fontSize: '7pt', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Pengirim</span>
                                        <p style={{ margin: 0, fontWeight: 'bold' }}>{selectedTx.pengirimName}</p>
                                        {selectedTx.pengirimPhone && (
                                            <p style={{ margin: '1px 0 0 0', color: '#555' }}>Telp: {selectedTx.pengirimPhone}</p>
                                        )}
                                        <p style={{ margin: '3px 0 0 0', color: '#111', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '7.5pt' }}>Tujuan: {selectedTx.tujuan}</p>
                                    </div>

                                    {/* Big Koli Paging */}
                                    <div style={{ background: 'black', color: 'white', textAlign: 'center', padding: '6px 0', borderRadius: '6px' }}>
                                        <span style={{ fontWeight: 900, fontSize: '18pt', letterSpacing: '2px', display: 'block', textTransform: 'uppercase' }}>
                                            KOLI {koliNum} / {selectedTx.koli}
                                        </span>
                                    </div>

                                </div>

                            </div>
                        );
                    })}
                </div>
            )}
        </ProtectedRoute>
    );
}
