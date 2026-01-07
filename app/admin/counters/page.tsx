'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save, Settings, Hash, Trash2 } from 'lucide-react';
import { cleanupOrphanExpenses } from '@/lib/firestore-expenses';

export default function AdminCountersPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Current counters
    const [currentSTT, setCurrentSTT] = useState(0);
    const [currentInvoice, setCurrentInvoice] = useState(0);
    const [currentInvoicePKP, setCurrentInvoicePKP] = useState(0);

    // New values to set
    const [newSTT, setNewSTT] = useState('');
    const [newInvoice, setNewInvoice] = useState('');
    const [newInvoicePKP, setNewInvoicePKP] = useState('');

    // Cleanup state
    const [cleaningUp, setCleaningUp] = useState(false);

    useEffect(() => {
        if (!user) return;
        loadCounters();
    }, [user]);

    const loadCounters = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Load STT counter
            const sttRef = doc(db, 'metadata', 'stt_counters');
            const sttDoc = await getDoc(sttRef);
            if (sttDoc.exists()) {
                const data = sttDoc.data();
                setCurrentSTT(data[user.uid]?.currentNumber || 0);
            }

            // Load Invoice counters
            const invRef = doc(db, 'metadata', 'invoice_counters');
            const invDoc = await getDoc(invRef);
            if (invDoc.exists()) {
                const data = invDoc.data();
                setCurrentInvoice(data[user.uid]?.currentNumber || 0);
                setCurrentInvoicePKP(data[`${user.uid}_pkp`]?.currentNumber || 0);
            }
        } catch (error) {
            console.error('Error loading counters:', error);
            alert('Gagal memuat data counter');
        } finally {
            setLoading(false);
        }
    };

    const handleResetSTT = async () => {
        if (!user || !newSTT) return;
        const num = parseInt(newSTT);
        if (isNaN(num) || num < 0) {
            return alert('Masukkan angka yang valid');
        }

        if (!confirm(`Reset STT counter ke ${num}?\nNomor STT berikutnya akan: STT${String(num + 1).padStart(6, '0')}`)) {
            return;
        }

        setSaving(true);
        try {
            const counterRef = doc(db, 'metadata', 'stt_counters');
            await setDoc(counterRef, {
                [user.uid]: {
                    currentNumber: num,
                    prefix: 'STT',
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            setCurrentSTT(num);
            setNewSTT('');
            alert(`✅ Berhasil! STT counter saat ini: ${num}\nSTT berikutnya: STT${String(num + 1).padStart(6, '0')}`);
            loadCounters();
        } catch (error) {
            console.error('Error resetting STT:', error);
            alert('Gagal mereset STT counter');
        } finally {
            setSaving(false);
        }
    };

    const handleResetInvoice = async () => {
        if (!user || !newInvoice) return;
        const num = parseInt(newInvoice);
        if (isNaN(num) || num < 0) {
            return alert('Masukkan angka yang valid');
        }

        if (!confirm(`Reset Invoice counter ke ${num}?\nNomor Invoice berikutnya akan: INV${String(num + 1).padStart(6, '0')}`)) {
            return;
        }

        setSaving(true);
        try {
            const counterRef = doc(db, 'metadata', 'invoice_counters');
            await setDoc(counterRef, {
                [user.uid]: {
                    currentNumber: num,
                    prefix: 'INV',
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            setCurrentInvoice(num);
            setNewInvoice('');
            alert(`✅ Berhasil! Invoice counter saat ini: ${num}\nInvoice berikutnya: INV${String(num + 1).padStart(6, '0')}`);
            loadCounters();
        } catch (error) {
            console.error('Error resetting Invoice:', error);
            alert('Gagal mereset Invoice counter');
        } finally {
            setSaving(false);
        }
    };

    const handleResetInvoicePKP = async () => {
        if (!user || !newInvoicePKP) return;
        const num = parseInt(newInvoicePKP);
        if (isNaN(num) || num < 0) {
            return alert('Masukkan angka yang valid');
        }

        if (!confirm(`Reset Invoice PKP counter ke ${num}?\nNomor Invoice PKP berikutnya akan: INV-PKP${String(num + 1).padStart(5, '0')}`)) {
            return;
        }

        setSaving(true);
        try {
            const counterRef = doc(db, 'metadata', 'invoice_counters');
            await setDoc(counterRef, {
                [`${user.uid}_pkp`]: {
                    currentNumber: num,
                    prefix: 'INV-PKP',
                    lastUpdated: Timestamp.now(),
                }
            }, { merge: true });

            setCurrentInvoicePKP(num);
            setNewInvoicePKP('');
            alert(`✅ Berhasil! Invoice PKP counter saat ini: ${num}\nInvoice PKP berikutnya: INV-PKP${String(num + 1).padStart(5, '0')}`);
            loadCounters();
        } catch (error) {
            console.error('Error resetting Invoice PKP:', error);
            alert('Gagal mereset Invoice PKP counter');
        } finally {
            setSaving(false);
        }
    };

    const handleCleanupOrphanExpenses = async () => {
        if (!user) return;

        if (!confirm('⚠️ Hapus semua pengeluaran yang voyageId-nya tidak valid?\n\nIni akan menghapus pengeluaran yang pemberangkatannya sudah dihapus sebelumnya.\n\nLanjutkan?')) {
            return;
        }

        setCleaningUp(true);
        try {
            const result = await cleanupOrphanExpenses(user.uid);

            if (result.deletedCount === 0) {
                alert('✅ Tidak ada pengeluaran orphan yang ditemukan.\nSemua data sudah bersih!');
            } else {
                alert(`✅ Berhasil menghapus ${result.deletedCount} pengeluaran orphan!\n\nData pengeluaran yang tidak memiliki pemberangkatan valid telah dibersihkan.`);
            }
        } catch (error) {
            console.error('Error cleaning up orphan expenses:', error);
            alert('❌ Gagal membersihkan data orphan. Silakan coba lagi.');
        } finally {
            setCleaningUp(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto max-w-4xl px-4 py-4">
                        <Link href="/" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                            <ArrowLeft size={16} />
                            Kembali ke Home
                        </Link>
                        <div className="flex items-center gap-3">
                            <Settings className="text-blue-600" size={28} />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">Admin - Kelola Counter</h1>
                                <p className="text-sm text-gray-500">Reset & manage STT dan Invoice counters</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto max-w-4xl px-4 py-8">
                    {loading ? (
                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Memuat data counter...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Info Card */}
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <Hash size={20} />
                                    Informasi Penting
                                </h3>
                                <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
                                    <li>Counter menunjukkan nomor terakhir yang digunakan</li>
                                    <li>Nomor berikutnya = Counter + 1</li>
                                    <li>Reset hanya jika ada kesalahan atau perlu sinkronisasi</li>
                                    <li>Pastikan tidak ada duplikasi nomor saat mereset</li>
                                </ul>
                            </div>

                            {/* STT Counter */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                    <Hash className="text-blue-600" size={20} />
                                    Counter STT (Surat Tanda Terima)
                                </h2>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Counter Saat Ini</label>
                                        <div className="px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50">
                                            <div className="text-2xl font-bold text-gray-800 font-mono">
                                                {currentSTT}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Format: STT{String(currentSTT).padStart(6, '0')}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Berikutnya</label>
                                        <div className="px-4 py-3 rounded-xl border-2 border-green-200 bg-green-50">
                                            <div className="text-2xl font-bold text-green-800 font-mono">
                                                STT{String(currentSTT + 1).padStart(6, '0')}
                                            </div>
                                            <div className="text-xs text-green-600 mt-1">
                                                Preview nomor berikutnya
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Reset Counter Ke:</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="number"
                                            value={newSTT}
                                            onChange={(e) => setNewSTT(e.target.value)}
                                            placeholder="Contoh: 17667"
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-mono"
                                        />
                                        <button
                                            onClick={handleResetSTT}
                                            disabled={saving || !newSTT}
                                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            <Save size={18} />
                                            Reset
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-1">
                                        Jika diset ke 17667, maka STT berikutnya akan: STT017668
                                    </p>
                                </div>
                            </div>

                            {/* Invoice Regular Counter */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                    <Hash className="text-purple-600" size={20} />
                                    Counter Invoice (Regular)
                                </h2>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Counter Saat Ini</label>
                                        <div className="px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50">
                                            <div className="text-2xl font-bold text-gray-800 font-mono">
                                                {currentInvoice}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Format: INV{String(currentInvoice).padStart(6, '0')}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Berikutnya</label>
                                        <div className="px-4 py-3 rounded-xl border-2 border-purple-200 bg-purple-50">
                                            <div className="text-2xl font-bold text-purple-800 font-mono">
                                                INV{String(currentInvoice + 1).padStart(6, '0')}
                                            </div>
                                            <div className="text-xs text-purple-600 mt-1">
                                                Preview nomor berikutnya
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Reset Counter Ke:</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="number"
                                            value={newInvoice}
                                            onChange={(e) => setNewInvoice(e.target.value)}
                                            placeholder="Contoh: 12365"
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none font-mono"
                                        />
                                        <button
                                            onClick={handleResetInvoice}
                                            disabled={saving || !newInvoice}
                                            className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            <Save size={18} />
                                            Reset
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-1">
                                        Jika diset ke 12365, maka Invoice berikutnya akan: INV012366
                                    </p>
                                </div>
                            </div>

                            {/* Invoice PKP Counter */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                    <Hash className="text-orange-600" size={20} />
                                    Counter Invoice PKP (Kena Pajak)
                                </h2>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Counter Saat Ini</label>
                                        <div className="px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50">
                                            <div className="text-2xl font-bold text-gray-800 font-mono">
                                                {currentInvoicePKP}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Format: INV-PKP{String(currentInvoicePKP).padStart(5, '0')}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Berikutnya</label>
                                        <div className="px-4 py-3 rounded-xl border-2 border-orange-200 bg-orange-50">
                                            <div className="text-2xl font-bold text-orange-800 font-mono">
                                                INV-PKP{String(currentInvoicePKP + 1).padStart(5, '0')}
                                            </div>
                                            <div className="text-xs text-orange-600 mt-1">
                                                Preview nomor berikutnya
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Reset Counter Ke:</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="number"
                                            value={newInvoicePKP}
                                            onChange={(e) => setNewInvoicePKP(e.target.value)}
                                            placeholder="Contoh: 5176"
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none font-mono"
                                        />
                                        <button
                                            onClick={handleResetInvoicePKP}
                                            disabled={saving || !newInvoicePKP}
                                            className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            <Save size={18} />
                                            Reset
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-1">
                                        Jika diset ke 5176, maka Invoice PKP berikutnya akan: INV-PKP05177
                                    </p>
                                </div>
                            </div>

                            {/* Cleanup Orphan Expenses */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                    <Trash2 className="text-red-600" size={20} />
                                    Bersihkan Data Orphan
                                </h2>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                                    <h3 className="font-semibold text-yellow-900 mb-2 text-sm">Apa itu Data Orphan?</h3>
                                    <p className="text-sm text-yellow-800 mb-2">
                                        Data orphan adalah <strong>pengeluaran yang pemberangkatannya sudah dihapus</strong>.
                                        Ini terjadi jika Anda menghapus pemberangkatan sebelum fitur cascade delete diimplementasikan.
                                    </p>
                                    <p className="text-xs text-yellow-700">
                                        <strong>Catatan:</strong> Pemberangkatan yang dihapus sekarang akan otomatis menghapus pengeluaran terkait.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                        <h4 className="font-semibold text-gray-700 text-sm mb-2">Yang Akan Dilakukan:</h4>
                                        <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                                            <li>Scan semua pengeluaran tipe "voyage"</li>
                                            <li>Cek apakah voyageId masih valid</li>
                                            <li>Hapus pengeluaran dengan voyageId yang tidak ada</li>
                                        </ul>
                                    </div>

                                    <button
                                        onClick={handleCleanupOrphanExpenses}
                                        disabled={cleaningUp}
                                        className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {cleaningUp ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Membersihkan Data...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 size={18} />
                                                Bersihkan Data Orphan
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Refresh Button */}
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={loadCounters}
                                    disabled={loading}
                                    className="border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
                                >
                                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                    Refresh Data
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
