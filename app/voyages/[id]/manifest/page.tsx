'use client';

import { use, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getVoyageById } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Voyage } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Printer } from 'lucide-react';

// A4 Portrait usable height at 96dpi with 8mm margins each side
// A4 = 297mm. Total margin = 16mm. Usable = 281mm ≈ 1062px at 96dpi (1mm = 3.7795px)
const A4_USABLE_HEIGHT_PX = 281 * 3.7795;

export default function ManifestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);

    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const voyageData = await getVoyageById(id);
                if (!voyageData) return;
                setVoyage(voyageData);

                const txPromises = voyageData.transactionIds.map(txId => getTransactionById(txId));
                const txData = await Promise.all(txPromises);
                setTransactions(txData.filter((tx): tx is Transaction => tx !== null));
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    // Auto-scale to fit A4 portrait (one page) after data loads
    useEffect(() => {
        if (loading || !contentRef.current) return;

        // Small delay to allow DOM to fully render
        const timer = setTimeout(() => {
            if (!contentRef.current) return;
            const naturalHeight = contentRef.current.scrollHeight;
            if (naturalHeight > A4_USABLE_HEIGHT_PX) {
                setZoom(A4_USABLE_HEIGHT_PX / naturalHeight);
            } else {
                setZoom(1);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [loading, transactions]);

    if (loading) return <div className="p-8 text-center">Memuat Manifest...</div>;
    if (!voyage) return <div className="p-8 text-center">Data tidak ditemukan</div>;

    // Sort transactions by STT number ascending
    const sortedTransactions = [...transactions].sort((a, b) =>
        a.noSTT.localeCompare(b.noSTT, 'id', { numeric: true, sensitivity: 'base' })
    );

    const totalKoli = sortedTransactions.reduce((sum, t) => sum + t.koli, 0);
    const totalBerat = sortedTransactions.reduce((sum, t) => sum + t.berat, 0);

    // Resolve vehicle numbers: prefer vehicleNumbers array, fallback to deprecated vehicleNumber
    const vehicleNumbers: string[] =
        voyage.vehicleNumbers && voyage.vehicleNumbers.length > 0
            ? voyage.vehicleNumbers
            : voyage.vehicleNumber
            ? [voyage.vehicleNumber]
            : [];

    const printDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
        <ProtectedRoute>
            {/* Print Page CSS */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .manifest-scale-wrapper {
                        zoom: ${zoom};
                    }
                }
            `}</style>

            <div className="min-h-screen bg-gray-100 text-black">

                {/* No-Print Toolbar */}
                <div className="no-print bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm sticky top-0 z-10">
                    <Link href={`/voyages/${id}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm">
                        <ArrowLeft size={18} />
                        Kembali
                    </Link>
                    <div className="flex items-center gap-3">
                        {zoom < 1 && (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                                Konten diskalakan ke {(zoom * 100).toFixed(0)}% agar muat 1 halaman
                            </span>
                        )}
                        <button
                            onClick={() => window.print()}
                            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-600/20 text-sm"
                        >
                            <Printer size={16} />
                            Cetak Manifest
                        </button>
                    </div>
                </div>

                {/* A4 Preview Frame */}
                <div className="no-print flex justify-center py-8 px-4">
                    <div
                        className="bg-white shadow-2xl"
                        style={{
                            width: '210mm',
                            minHeight: '297mm',
                            padding: '8mm',
                        }}
                    >
                        {/* Scaleable Manifest Content */}
                        <div
                            className="manifest-scale-wrapper"
                            ref={contentRef}
                            style={{
                                zoom: zoom,
                                transformOrigin: 'top left',
                            }}
                        >
                            <ManifestContent
                                voyage={voyage}
                                sortedTransactions={sortedTransactions}
                                vehicleNumbers={vehicleNumbers}
                                totalKoli={totalKoli}
                                totalBerat={totalBerat}
                                printDate={printDate}
                            />
                        </div>
                    </div>
                </div>

                {/* Print Output (fullscreen, no preview wrapper) */}
                <div
                    className="hidden print:block manifest-scale-wrapper"
                    style={{ zoom: zoom }}
                >
                    <ManifestContent
                        voyage={voyage}
                        sortedTransactions={sortedTransactions}
                        vehicleNumbers={vehicleNumbers}
                        totalKoli={totalKoli}
                        totalBerat={totalBerat}
                        printDate={printDate}
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}

// ─── Extracted Manifest Content Component ───────────────────────────────────
function ManifestContent({
    voyage,
    sortedTransactions,
    vehicleNumbers,
    totalKoli,
    totalBerat,
    printDate,
}: {
    voyage: Voyage;
    sortedTransactions: Transaction[];
    vehicleNumbers: string[];
    totalKoli: number;
    totalBerat: number;
    printDate: string;
}) {
    return (
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#000' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '4px', marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>
                    MANIFEST MUATAN KAPAL
                </div>
                <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '1px' }}>CAHAYA CARGO EXPRESS</div>
                <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>Jl. Pelabuhan No. 1 — Cargo & Shipping Services</div>
            </div>

            {/* Voyage Info: 2-column compact table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: '5px', border: '1px solid #ccc', padding: '4px 6px', background: '#f9f9f9' }}>
                <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
                    <tbody>
                        <InfoRow label="Nama Kapal" value={voyage.shipName || '-'} />
                        <InfoRow label="No. Voyage" value={voyage.voyageNumber} />
                        <InfoRow
                            label="Nopol Kendaraan"
                            value={vehicleNumbers.length > 0 ? vehicleNumbers.join(', ') : '-'}
                        />
                    </tbody>
                </table>
                <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
                    <tbody>
                        <InfoRow label="Rute" value={voyage.route} bold />
                        <InfoRow label="Tgl. Berangkat" value={new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
                        <InfoRow
                            label="Status"
                            value={voyage.status === 'in-progress' ? 'Dalam Perjalanan' : voyage.status === 'completed' ? 'Selesai' : 'Direncanakan'}
                        />
                    </tbody>
                </table>
            </div>

            {/* Cargo Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', marginBottom: '4px' }}>
                <thead>
                    <tr style={{ background: '#e5e7eb' }}>
                        <th style={thStyle({ width: '18px', textAlign: 'center' })}>No</th>
                        <th style={thStyle({ textAlign: 'left', width: '70px' })}>No. STT</th>
                        <th style={thStyle({ textAlign: 'left', width: '90px' })}>Pengirim</th>
                        <th style={thStyle({ textAlign: 'left' })}>
                            Penerima
                            <div style={{ fontWeight: 'normal', fontSize: '7px', color: '#555' }}>Tujuan / Alamat / Telp</div>
                        </th>
                        <th style={thStyle({ width: '26px', textAlign: 'center' })}>Koli</th>
                        <th style={thStyle({ width: '36px', textAlign: 'center' })}>Berat<br/>(Kg)</th>
                        <th style={thStyle({ textAlign: 'left', width: '80px' })}>Isi Barang</th>
                        <th style={thStyle({ width: '28px', textAlign: 'center' })}>Ket.</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedTransactions.map((tx, index) => (
                        <tr key={tx.id} style={{ background: index % 2 === 0 ? '#fff' : '#f9fafb' }}>
                            <td style={tdStyle({ textAlign: 'center' })}>{index + 1}</td>
                            <td style={tdStyle({ fontFamily: 'monospace', fontSize: '7.5px' })}>{tx.noSTT}</td>
                            <td style={tdStyle({})}>
                                <div style={{ fontWeight: 600 }}>{tx.pengirimName}</div>
                                {tx.pengirimPhone && (
                                    <div style={{ fontSize: '7px', color: '#555' }}>☎ {tx.pengirimPhone}</div>
                                )}
                            </td>
                            <td style={tdStyle({})}>
                                <div style={{ fontWeight: 600 }}>{tx.penerimaName}</div>
                                <div style={{ fontSize: '7px', color: '#444', marginTop: '1px' }}>📍 {tx.tujuan}</div>
                                {tx.penerimaAddress && (
                                    <div style={{ fontSize: '7px', color: '#555', marginTop: '1px' }}>
                                        {tx.penerimaAddress}
                                        {tx.penerimaCity && tx.penerimaCity !== tx.tujuan ? `, ${tx.penerimaCity}` : ''}
                                    </div>
                                )}
                                {tx.penerimaPhone && (
                                    <div style={{ fontSize: '7px', color: '#555', marginTop: '1px' }}>☎ {tx.penerimaPhone}</div>
                                )}
                            </td>
                            <td style={tdStyle({ textAlign: 'center', fontWeight: 600 })}>{tx.koli}</td>
                            <td style={tdStyle({ textAlign: 'center', fontWeight: 600 })}>{tx.berat}</td>
                            <td style={tdStyle({})}>{tx.isiBarang || '-'}</td>
                            <td style={tdStyle({ textAlign: 'center' })}>{tx.keterangan || ''}</td>
                        </tr>
                    ))}
                    {/* Totals */}
                    <tr style={{ background: '#e5e7eb', fontWeight: 700 }}>
                        <td colSpan={4} style={{ ...tdStyle({}), textAlign: 'right' }}>TOTAL</td>
                        <td style={tdStyle({ textAlign: 'center' })}>{totalKoli}</td>
                        <td style={tdStyle({ textAlign: 'center' })}>{totalBerat}</td>
                        <td style={tdStyle({})}></td>
                        <td style={tdStyle({})}></td>
                    </tr>
                </tbody>
            </table>

            {/* Summary Bar */}
            <div style={{ display: 'flex', gap: '24px', fontSize: '8.5px', marginBottom: '6px', border: '1px solid #ccc', padding: '3px 6px', background: '#f9f9f9' }}>
                <div><strong>Total Resi:</strong> {sortedTransactions.length} STT</div>
                <div><strong>Total Koli:</strong> {totalKoli}</div>
                <div><strong>Total Berat:</strong> {totalBerat} Kg</div>
                <div style={{ marginLeft: 'auto', color: '#555', fontSize: '7.5px' }}>Dicetak: {printDate}</div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center', fontSize: '8.5px', marginTop: '8px' }}>
                {['Pengurus Barang', 'Kepala Gudang', 'Supir / Nahkoda', 'Mengetahui'].map(label => (
                    <div key={label}>
                        <div style={{ marginBottom: '32px', fontWeight: 500 }}>{label}</div>
                        <div style={{ borderTop: '1.5px solid black', paddingTop: '2px', width: '75%', margin: '0 auto', fontSize: '7.5px', color: '#666' }}>
                            ( ...................... )
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Style Helpers ───────────────────────────────────────────────────────────
function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        border: '1px solid black',
        padding: '2px 3px',
        textAlign: 'left',
        verticalAlign: 'top',
        fontWeight: 700,
        ...extra,
    };
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        border: '1px solid black',
        padding: '2px 3px',
        verticalAlign: 'top',
        ...extra,
    };
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <tr>
            <td style={{ fontWeight: 700, paddingRight: '4px', paddingTop: '1px', paddingBottom: '1px', whiteSpace: 'nowrap', verticalAlign: 'top', width: '90px' }}>
                {label}
            </td>
            <td style={{ paddingTop: '1px', paddingBottom: '1px', verticalAlign: 'top', fontWeight: bold ? 700 : 400 }}>
                : {value}
            </td>
        </tr>
    );
}
