'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquare, X, Filter } from 'lucide-react';
import CustomerMessageList from '@/components/CustomerMessageList';
import {
    getAllCustomerMessages,
    getCustomerMessagesByStatus,
    addCustomerMessage,
    getMessageStats
} from '@/lib/firestore-customer-messages';
import type { CustomerMessage, CustomerMessageFormData, MessageStatus, MessageSource } from '@/types/customer-message';

export default function CustomerMessagesPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [messages, setMessages] = useState<CustomerMessage[]>([]);
    const [filteredMessages, setFilteredMessages] = useState<CustomerMessage[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState<MessageStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState<CustomerMessageFormData>({
        customerName: '',
        customerPhone: '',
        message: '',
        source: 'whatsapp',
        receivedAt: new Date()
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    useEffect(() => {
        filterMessages();
    }, [messages, filterStatus, searchQuery]);

    const loadData = async () => {
        setDataLoading(true);
        try {
            const data = await getAllCustomerMessages();
            setMessages(data);

            const messageStats = await getMessageStats();
            setStats(messageStats);
        } catch (error) {
            console.error('Error loading customer messages:', error);
        } finally {
            setDataLoading(false);
        }
    };

    const filterMessages = () => {
        let filtered = messages;

        if (filterStatus !== 'all') {
            filtered = filtered.filter(m => m.status === filterStatus);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.customerName.toLowerCase().includes(query) ||
                m.customerPhone.includes(query) ||
                m.message.toLowerCase().includes(query)
            );
        }

        setFilteredMessages(filtered);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            await addCustomerMessage(formData);
            setShowForm(false);
            setFormData({
                customerName: '',
                customerPhone: '',
                message: '',
                source: 'whatsapp',
                receivedAt: new Date()
            });
            loadData();
            alert('Pesan berhasil ditambahkan!');
        } catch (error) {
            console.error('Error adding message:', error);
            alert('Gagal menambahkan pesan');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <MessageSquare size={28} className="text-green-600" />
                            Pesan Customer
                        </h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                            >
                                <Plus size={20} />
                                Tambah Pesan
                            </button>
                            <Link href="/dashboard/bagas">
                                <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-semibold transition-colors">
                                    ← Kembali
                                </button>
                            </Link>
                        </div>
                    </div>
                    <p className="text-gray-600">
                        Kelola dan lacak pesan dari customer
                    </p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 mb-1">Total Pesan</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-red-200">
                            <p className="text-sm text-gray-500 mb-1">Belum Dibaca</p>
                            <p className="text-2xl font-bold text-red-600">{stats.unread}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
                            <p className="text-sm text-gray-500 mb-1">Sudah Dibaca</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.read}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
                            <p className="text-sm text-gray-500 mb-1">Direspon</p>
                            <p className="text-2xl font-bold text-green-600">{stats.responded}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Arsip</p>
                            <p className="text-2xl font-bold text-gray-600">{stats.archived}</p>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari nama, nomor, atau pesan..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filterStatus === 'all'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Semua
                            </button>
                            <button
                                onClick={() => setFilterStatus('unread')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filterStatus === 'unread'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Belum Dibaca
                            </button>
                            <button
                                onClick={() => setFilterStatus('responded')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filterStatus === 'responded'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Direspon
                            </button>
                        </div>
                    </div>
                </div>

                {/* Messages List */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    {dataLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                        </div>
                    ) : (
                        <CustomerMessageList
                            messages={filteredMessages}
                            onRefresh={loadData}
                        />
                    )}
                </div>

                {/* Add Message Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900">Tambah Pesan Customer</h3>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Nama Customer *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                        placeholder="Nama lengkap customer"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Nomor Telepon *
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.customerPhone}
                                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                        placeholder="Contoh: 081234567890"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Sumber Pesan *
                                    </label>
                                    <select
                                        value={formData.source}
                                        onChange={(e) => setFormData({ ...formData, source: e.target.value as MessageSource })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="direct">Direct</option>
                                        <option value="call">Telepon</option>
                                        <option value="email">Email</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Tanggal & Waktu Diterima *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.receivedAt.toISOString().slice(0, 16)}
                                        onChange={(e) => setFormData({ ...formData, receivedAt: new Date(e.target.value) })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Isi Pesan *
                                    </label>
                                    <textarea
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        rows={5}
                                        required
                                        placeholder="Tulis isi pesan dari customer..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Menyimpan...' : 'Simpan Pesan'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
