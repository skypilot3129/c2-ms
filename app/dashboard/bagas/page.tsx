'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    TrendingUp,
    MessageSquare,
    CheckSquare,
    Calendar,
    ArrowRight,
    BarChart3,
    Users,
    Clock
} from 'lucide-react';
import SocialMediaStatsCard from '@/components/SocialMediaStatsCard';
import CustomerMessageList from '@/components/CustomerMessageList';
import TodoList from '@/components/TodoList';
import { getLatestSocialMediaStats } from '@/lib/firestore-social-media';
import { getAllCustomerMessages, getMessageStats } from '@/lib/firestore-customer-messages';
import { getTodosByUser, getTodoStats } from '@/lib/firestore-todos';
import type { SocialMediaStats } from '@/types/social-media';
import type { CustomerMessage } from '@/types/customer-message';
import type { Todo } from '@/types/todo';

export default function BagasDashboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [socialMediaStats, setSocialMediaStats] = useState<SocialMediaStats[]>([]);
    const [recentMessages, setRecentMessages] = useState<CustomerMessage[]>([]);
    const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
    const [messageStats, setMessageStats] = useState<any>(null);
    const [todoStats, setTodoStats] = useState<any>(null);
    const [dataLoading, setDataLoading] = useState(true);

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
        if (!user) return;

        setDataLoading(true);
        try {
            // Load social media stats
            const smStats = await getLatestSocialMediaStats();
            setSocialMediaStats(smStats);

            // Load recent messages (last 5)
            const messages = await getAllCustomerMessages();
            setRecentMessages(messages.slice(0, 5));

            // Load message stats
            const mStats = await getMessageStats();
            setMessageStats(mStats);

            // Load today's todos
            const allTodos = await getTodosByUser(user.uid);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const todaysTodos = allTodos.filter(todo => {
                const dueDate = new Date(todo.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate.getTime() === today.getTime();
            });
            setTodayTodos(todaysTodos);

            // Load todo stats
            const tStats = await getTodoStats(user.uid);
            setTodoStats(tStats);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setDataLoading(false);
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
                        <h1 className="text-3xl font-bold text-gray-900">
                            Dashboard Marketing CCE
                        </h1>
                        <Link href="/">
                            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-semibold transition-colors">
                                ← Kembali ke Home
                            </button>
                        </Link>
                    </div>
                    <p className="text-gray-600">
                        Selamat datang, <span className="font-semibold">{user.displayName || user.email}</span>
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <BarChart3 size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Platform Social Media</p>
                                <p className="text-2xl font-bold text-gray-900">{socialMediaStats.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <MessageSquare size={20} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Pesan Belum Dibaca</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {messageStats?.unread || 0}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <CheckSquare size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Todo Hari Ini</p>
                                <p className="text-2xl font-bold text-gray-900">{todayTodos.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Social Media Stats Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <TrendingUp size={24} className="text-blue-600" />
                            Social Media Analytics
                        </h2>
                        <Link href="/dashboard/bagas/social-media">
                            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                                Lihat Detail <ArrowRight size={16} />
                            </button>
                        </Link>
                    </div>

                    {dataLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {socialMediaStats.length === 0 ? (
                                <div className="col-span-full text-center py-12 bg-white rounded-xl">
                                    <p className="text-gray-500">Belum ada data social media</p>
                                    <Link href="/dashboard/bagas/social-media">
                                        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                                            Tambah Data
                                        </button>
                                    </Link>
                                </div>
                            ) : (
                                socialMediaStats.map((stats) => (
                                    <SocialMediaStatsCard
                                        key={stats.id}
                                        stats={stats}
                                        onClick={() => router.push('/dashboard/bagas/social-media')}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Customer Messages Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <MessageSquare size={24} className="text-green-600" />
                            Pesan Customer Terbaru
                        </h2>
                        <Link href="/dashboard/bagas/customers">
                            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">
                                Lihat Semua <ArrowRight size={16} />
                            </button>
                        </Link>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <CustomerMessageList
                            messages={recentMessages}
                            onRefresh={loadData}
                        />
                        {recentMessages.length > 0 && (
                            <div className="mt-4 text-center">
                                <Link href="/dashboard/bagas/customers">
                                    <button className="text-blue-600 hover:underline text-sm font-semibold">
                                        Lihat semua pesan →
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Today's Todos Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <CheckSquare size={24} className="text-purple-600" />
                            Todo Hari Ini
                        </h2>
                        <Link href="/dashboard/bagas/calendar">
                            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors">
                                Buka Calendar <ArrowRight size={16} />
                            </button>
                        </Link>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <TodoList
                            todos={todayTodos}
                            onRefresh={loadData}
                        />
                        {todayTodos.length === 0 && (
                            <div className="text-center">
                                <Link href="/dashboard/bagas/calendar">
                                    <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">
                                        Tambah Todo
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
