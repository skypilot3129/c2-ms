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
            // Convert Firestore Timestamp to Date for display
            const tanggalDate = d.tanggal instanceof Timestamp ? d.tanggal.toDate() : new Date(d.tanggal);

            const t = {
                ...d,
                id: doc.id,
                tanggal: tanggalDate // Ensure tanggal is always a Date object
            } as Transaction;

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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Pajak</h1>
                        <p className="text-gray-500 text-sm">Laporan PPN Keluaran & Pengaturan PKP</p>
                    </div>
                    <div className="bg-white p-1 rounded-xl border border-gray-200 flex w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'report' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Laporan PPN
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Pengaturan
                        </button>
                    </div>
                </div>

                {activeTab === 'settings' && (
                    <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-8 max-w-2xl">
                        <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Settings size={20} className="text-gray-400" />
                            Pengaturan PKP (Pengusaha Kena Pajak)
                        </h2>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Status PKP</h3>
                                    <p className="text-xs sm:text-sm text-gray-500">Aktifkan jika perusahaan Anda wajib memungut PPN.</p>
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
                                                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                placeholder="PT. Cahaya Cargo Express"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor NPWP</label>
                                            <input
                                                type="text"
                                                value={settings.companyNPWP || ''}
                                                onChange={(e) => setSettings({ ...settings, companyNPWP: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                placeholder="00.000.000.0-000.000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Perusahaan</label>
                                            <textarea
                                                value={settings.companyAddress || ''}
                                                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                rows={3}
                                                placeholder="Alamat lengkap..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleSaveSettings}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-sm sm:text-base"
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
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                            <h2 className="font-bold text-gray-700 flex items-center gap-2">
                                <FileText size={20} className="text-blue-600" />
                                <span className="text-sm sm:text-base">Laporan Masa PPN</span>
                            </h2>
                            <div className="hidden sm:block h-8 w-px bg-gray-200"></div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                    className="flex-1 sm:flex-none bg-gray-50 border-none rounded-lg text-sm font-medium text-gray-700 focus:ring-0"
                                >
                                    {months.map((m, i) => (
                                        <option key={i} value={i}>{m}</option>
                                    ))}
                                </select>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="flex-1 sm:flex-none bg-gray-50 border-none rounded-lg text-sm font-medium text-gray-700 focus:ring-0"
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-white p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-gray-500 text-xs sm:text-sm mb-1">Total Dasar Pengenaan Pajak (DPP)</p>
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{formatRupiah(taxData.totalDPP)}</h3>
                            </div>
                            <div className="bg-white p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-gray-500 text-xs sm:text-sm mb-1">Total PPN Keluaran (Output Tax)</p>
                                <h3 className="text-xl sm:text-2xl font-bold text-blue-600">{formatRupiah(taxData.totalPPN)}</h3>
                            </div>
                        </div>

                        {/* Table Desktop / Card Mobile Hybrid */}
                        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
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
                                                <td className="px-6 py-4">{t.tanggal.toLocaleDateString('id-ID')}</td>
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

                            {/* Mobile Card List View */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {taxData.transactions.map((t, idx) => (
                                    <div key={idx} className="p-4 flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-mono font-bold text-gray-700 text-sm">{t.noInvoice || t.noSTT}</span>
                                                <p className="font-medium text-gray-800 text-sm mt-0.5">{t.pengirimName}</p>
                                                <p className="text-xs text-gray-500 mt-1">{t.tanggal.toLocaleDateString('id-ID')}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg mt-2">
                                            <div>
                                                <p className="text-[10px] text-gray-400">DPP</p>
                                                <p className="font-medium text-gray-700 text-sm">{formatRupiah(t.jumlah)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-400">PPN</p>
                                                <p className="font-bold text-blue-600 text-sm">{formatRupiah(t.ppn || 0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {taxData.transactions.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 text-sm px-4">
                                        Tidak ada transaksi kena pajak pada periode ini.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
