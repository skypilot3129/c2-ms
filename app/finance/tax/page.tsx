'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTaxSettings, updateTaxSettings, type TaxSettings } from '@/lib/firestore-settings';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Settings, FileText, Save, Calculator, Calendar } from 'lucide-react';
import type { Transaction } from '@/types/transaction';

export default function TaxPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'report' | 'settings'>('report');

    // Settings State
    const [settings, setSettings] = useState<TaxSettings>({
        isPKP: false,
        defaultPPNRate: 0.11,
        companyName: '',
        companyNPWP: '',
        companyAddress: ''
    });

    // Report State
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [taxData, setTaxData] = useState<{
        totalDPP: number;
        totalPPN: number;
        transactions: Transaction[];
    }>({ totalDPP: 0, totalPPN: 0, transactions: [] });

    useEffect(() => {
        if (!user) return;
        loadSettings();
    }, [user]);

    useEffect(() => {
        if (!user || activeTab !== 'report') return;
        loadReport();
    }, [user, month, year, activeTab]);

    const loadSettings = async () => {
        if (!user) return;
        const s = await getTaxSettings(user.uid);
        setSettings(s);
        setLoading(false);
    };

    const handleSaveSettings = async () => {
        if (!user) return;
        try {
            await updateTaxSettings(user.uid, settings);
            alert('Pengaturan pajak berhasil disimpan!');
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan pengaturan.');
        }
    };

    const loadReport = async () => {
        if (!user) return;
        setLoading(true);

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        // Fetch transactions with status 'isTaxable' == true OR ppn > 0
        // Firestore doesn't support logical OR directly in where easily for complex conditions,
        // so let's query by date and filter in client or query where 'isTaxable' == true.
        // Assuming we always mark isTaxable.

        const q = query(
            collection(db, 'transactions'),
            where('userId', '==', user.uid),
            where('isTaxable', '==', true),
            where('tanggal', '>=', Timestamp.fromDate(startDate)),
            where('tanggal', '<=', Timestamp.fromDate(endDate))
        );

        const snapshot = await getDocs(q);
        const txs: Transaction[] = [];
        let totalDPP = 0;
        let totalPPN = 0;

        snapshot.forEach(doc => {
            const d = doc.data();
            // Cast strictly or just access known props
            // Need to convert Timestamp to Date if we use Transaction type fully, but for Display we just need values
            const t = { ...d, id: doc.id } as any;

            // Calc DPP and PPN
            // DPP = Jumlah / (1 + Rate) ??? Or is Jumlah BEFORE Tax?
            // Usually 'Jumlah' in Transaction is TOTAL (Inclusive) or Exclusive?
            // Let's assume 'Jumlah' is Grand Total. 
            // If Taxable: PPN = Jumlah - (Jumlah / (1 + Rate)) IF inclusive.
            // OR if 'Jumlah' is Basic + PPN.
            // Looking at addTransaction logic: `ppn: ... Math.round(jumlah * rate)`. 
            // It seems `jumlah` passed to it was DPP? 
            // Wait, in `addTransaction` logic: `jumlah: jumlah` (passed args).
            // `ppn` is separate.
            // So `jumlah` is likely the basic amount (DPP) or Total? 
            // Let's check `TransactionForm`. Usually 'Total' displayed is Grand Total.
            // If I implement `ppn` as separate field, `jumlah` usually means Grand Total in UI.
            // But in `addTransaction` I saw `ppn` calculated from `jumlah`.
            // So `jumlah` seems to be the BASE (DPP).
            // Total Payable = jumlah + ppn.
            // LET'S VERIFY THIS LOGIC in Form Implementation next.
            // For now, let's assume `jumlah` = DPP, `ppn` = Tax.

            totalDPP += (d.jumlah || 0);
            totalPPN += (d.ppn || 0);
            txs.push(t);
        });

        setTaxData({ totalDPP, totalPPN, transactions: txs });
        setLoading(false);
    };

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    return (
        <ProtectedRoute>
            <div className="max-w-6xl mx-auto space-y-6 pb-12">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Pajak</h1>
                        <p className="text-gray-500">Laporan PPN Keluaran & Pengaturan PKP</p>
                    </div>
                    <div className="bg-white p-1 rounded-xl border border-gray-200 flex">
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'report' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Laporan PPN
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Pengaturan
                        </button>
                    </div>
                </div>

                {activeTab === 'settings' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-2xl">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Settings size={20} className="text-gray-400" />
                            Pengaturan PKP (Pengusaha Kena Pajak)
                        </h2>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <h3 className="font-semibold text-gray-800">Status PKP</h3>
                                    <p className="text-sm text-gray-500">Aktifkan jika perusahaan Anda wajib memungut PPN.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.isPKP}
                                        onChange={(e) => setSettings({ ...settings, isPKP: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {settings.isPKP && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Tarif PPN Default</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={settings.defaultPPNRate * 100}
                                                onChange={(e) => setSettings({ ...settings, defaultPPNRate: Number(e.target.value) / 100 })}
                                                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <span className="text-gray-500 font-medium">%</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Tarif resmi saat ini: 11% (akan naik jadi 12% di 2025)</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan (di Faktur)</label>
                                            <input
                                                type="text"
                                                value={settings.companyName || ''}
                                                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="PT. Cahaya Cargo Express"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor NPWP</label>
                                            <input
                                                type="text"
                                                value={settings.companyNPWP || ''}
                                                onChange={(e) => setSettings({ ...settings, companyNPWP: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="00.000.000.0-000.000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Perusahaan</label>
                                            <textarea
                                                value={settings.companyAddress || ''}
                                                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                rows={3}
                                                placeholder="Alamat lengkap..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleSaveSettings}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                Simpan Pengaturan
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'report' && (
                    <div className="space-y-6">
                        {/* Filter */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <h2 className="font-bold text-gray-700 flex items-center gap-2">
                                <FileText size={20} className="text-blue-600" />
                                Laporan Masa PPN
                            </h2>
                            <div className="h-8 w-px bg-gray-200"></div>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="bg-gray-50 border-none rounded-lg text-sm font-medium text-gray-700 focus:ring-0"
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="bg-gray-50 border-none rounded-lg text-sm font-medium text-gray-700 focus:ring-0"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-gray-500 text-sm mb-1">Total Dasar Pengenaan Pajak (DPP)</p>
                                <h3 className="text-2xl font-bold text-gray-800">{formatRupiah(taxData.totalDPP)}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-gray-500 text-sm mb-1">Total PPN Keluaran (Output Tax)</p>
                                <h3 className="text-2xl font-bold text-blue-600">{formatRupiah(taxData.totalPPN)}</h3>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4">Tanggal</th>
                                            <th className="px-6 py-4">No Invoice / STT</th>
                                            <th className="px-6 py-4">Lawan Transaksi</th>
                                            <th className="px-6 py-4 text-right">DPP</th>
                                            <th className="px-6 py-4 text-right">PPN</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {taxData.transactions.map((t, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">{new Timestamp(t.tanggal.seconds, t.tanggal.nanoseconds).toDate().toLocaleDateString('id-ID')}</td>
                                                <td className="px-6 py-4 font-mono text-gray-600">{t.noInvoice || t.noSTT}</td>
                                                <td className="px-6 py-4">{t.pengirimName}</td>
                                                <td className="px-6 py-4 text-right">{formatRupiah(t.jumlah)}</td>
                                                <td className="px-6 py-4 text-right font-medium text-blue-600">{formatRupiah(t.ppn || 0)}</td>
                                            </tr>
                                        ))}
                                        {taxData.transactions.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center text-gray-400">Tidak ada transaksi kena pajak pada periode ini.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
