'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, TrendingUp, X } from 'lucide-react';
import SocialMediaStatsCard from '@/components/SocialMediaStatsCard';
import {
    getAllSocialMediaStats,
    addSocialMediaReport,
    getSocialMediaStatsByPlatform
} from '@/lib/firestore-social-media';
import type { SocialMediaStats, SocialMediaFormData, SocialMediaPlatform } from '@/types/social-media';

export default function SocialMediaPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [stats, setStats] = useState<SocialMediaStats[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<SocialMediaFormData>({
        platform: 'instagram',
        followers: 0,
        engagement: 0,
        views: 0,
        posts: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        reportDate: new Date(),
        notes: ''
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

    const loadData = async () => {
        setDataLoading(true);
        try {
            const data = await getAllSocialMediaStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading social media stats:', error);
        } finally {
            setDataLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            await addSocialMediaReport(formData);
            setShowForm(false);
            setFormData({
                platform: 'instagram',
                followers: 0,
                engagement: 0,
                views: 0,
                posts: 0,
                likes: 0,
                comments: 0,
                shares: 0,
                reportDate: new Date(),
                notes: ''
            });
            loadData();
            alert('Data berhasil ditambahkan!');
        } catch (error) {
            console.error('Error adding report:', error);
            alert('Gagal menambahkan data');
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

    // Group stats by platform
    const statsByPlatform: Record<SocialMediaPlatform, SocialMediaStats[]> = {
        tiktok: [],
        instagram: [],
        website: [],
        youtube: []
    };

    stats.forEach(stat => {
        statsByPlatform[stat.platform].push(stat);
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <TrendingUp size={28} className="text-blue-600" />
                            Social Media Analytics
                        </h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                            >
                                <Plus size={20} />
                                Tambah Data
                            </button>
                            <Link href="/dashboard/bagas">
                                <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-semibold transition-colors">
                                    ← Kembali
                                </button>
                            </Link>
                        </div>
                    </div>
                    <p className="text-gray-600">
                        Kelola dan pantau performa social media CCE
                    </p>
                </div>

                {/* Latest Stats Overview */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Data Terbaru</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(['tiktok', 'instagram', 'website', 'youtube'] as SocialMediaPlatform[]).map(platform => {
                            const platformStats = statsByPlatform[platform];
                            const latestStat = platformStats[0]; // Already sorted by date desc

                            return latestStat ? (
                                <SocialMediaStatsCard
                                    key={platform}
                                    stats={latestStat}
                                />
                            ) : (
                                <div key={platform} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                    <p className="text-gray-500 text-center">
                                        Belum ada data untuk {platform}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Historical Data */}
                {Object.entries(statsByPlatform).map(([platform, platformStats]) => {
                    if (platformStats.length === 0) return null;

                    return (
                        <div key={platform} className="mb-8">
                            <h2 className="text-xl font-bold text-gray-900 mb-4 capitalize">
                                Riwayat Data {platform}
                            </h2>
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tanggal</th>
                                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Followers</th>
                                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Engagement</th>
                                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Views</th>
                                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Posts</th>
                                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Likes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {platformStats.map(stat => (
                                            <tr key={stat.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm text-gray-800">
                                                    {new Date(stat.reportDate).toLocaleDateString('id-ID')}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right text-gray-800 font-semibold">
                                                    {stat.followers.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                                    {stat.engagement.toFixed(1)}%
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                                    {stat.views.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                                    {stat.posts}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                                    {stat.likes.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}

                {/* Add Report Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900">Tambah Data Social Media</h3>
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
                                        Platform *
                                    </label>
                                    <select
                                        value={formData.platform}
                                        onChange={(e) => setFormData({ ...formData, platform: e.target.value as SocialMediaPlatform })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="tiktok">TikTok</option>
                                        <option value="instagram">Instagram</option>
                                        <option value="website">Website</option>
                                        <option value="youtube">YouTube</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Tanggal Laporan *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.reportDate.toISOString().split('T')[0]}
                                            onChange={(e) => setFormData({ ...formData, reportDate: new Date(e.target.value) })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Followers *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.followers}
                                            onChange={(e) => setFormData({ ...formData, followers: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Engagement Rate (%) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.engagement}
                                            onChange={(e) => setFormData({ ...formData, engagement: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                            min="0"
                                            max="100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Total Views *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.views}
                                            onChange={(e) => setFormData({ ...formData, views: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Total Posts *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.posts}
                                            onChange={(e) => setFormData({ ...formData, posts: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                            min="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Total Likes *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.likes}
                                            onChange={(e) => setFormData({ ...formData, likes: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Total Comments *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.comments}
                                            onChange={(e) => setFormData({ ...formData, comments: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                            min="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Total Shares *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.shares}
                                            onChange={(e) => setFormData({ ...formData, shares: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Catatan
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={3}
                                        placeholder="Catatan tambahan..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Menyimpan...' : 'Simpan Data'}
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
