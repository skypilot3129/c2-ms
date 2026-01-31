'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar as CalendarIcon, Plus, X, ChevronLeft, ChevronRight, List } from 'lucide-react';
import TodoList from '@/components/TodoList';
import {
    getTodosByUser,
    getTodosForDateRange,
    getTodosForCalendar,
    addTodo,
    updateTodo,
    getTodoStats
} from '@/lib/firestore-todos';
import type { Todo, TodoFormData, TodoPriority } from '@/types/todo';
import { TODO_PRIORITY_COLORS } from '@/types/todo';

export default function CalendarPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [todos, setTodos] = useState<Todo[]>([]);
    const [todosByDate, setTodosByDate] = useState<Record<string, Todo[]>>({});
    const [stats, setStats] = useState<any>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
    const [formData, setFormData] = useState<TodoFormData>({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: new Date()
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
    }, [user, currentDate]);

    const loadData = async () => {
        if (!user) return;

        try {
            // Load all todos for the current month
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            const todosGrouped = await getTodosForCalendar(user.uid, month, year);
            setTodosByDate(todosGrouped);

            // Load all todos
            const allTodos = await getTodosByUser(user.uid);
            setTodos(allTodos);

            // Load stats
            const todoStats = await getTodoStats(user.uid);
            setStats(todoStats);
        } catch (error) {
            console.error('Error loading todos:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        try {
            if (editingTodo) {
                await updateTodo(editingTodo.id, formData);
                alert('Todo berhasil diupdate!');
            } else {
                await addTodo(user.uid, formData);
                alert('Todo berhasil ditambahkan!');
            }

            setShowForm(false);
            setEditingTodo(null);
            setFormData({
                title: '',
                description: '',
                priority: 'medium',
                dueDate: new Date()
            });
            loadData();
        } catch (error) {
            console.error('Error saving todo:', error);
            alert('Gagal menyimpan todo');
        } finally {
            setSaving(false);
        }
    };

    const handleEditTodo = (todo: Todo) => {
        setEditingTodo(todo);
        setFormData({
            title: todo.title,
            description: todo.description,
            priority: todo.priority,
            dueDate: new Date(todo.dueDate)
        });
        setShowForm(true);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: (Date | null)[] = [];

        // Add empty cells for days before the first day
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add all days in the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }

        return days;
    };

    const previousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    const getDateKey = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const getTodosForDate = (date: Date) => {
        const dateKey = getDateKey(date);
        return todosByDate[dateKey] || [];
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const isSelected = (date: Date) => {
        if (!selectedDate) return false;
        return date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear();
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

    const days = getDaysInMonth(currentDate);
    const selectedDateTodos = selectedDate ? getTodosForDate(selectedDate) : [];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <CalendarIcon size={28} className="text-purple-600" />
                            Calendar & Todo
                        </h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                            >
                                <Plus size={20} />
                                Tambah Todo
                            </button>
                            <Link href="/dashboard/bagas">
                                <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-semibold transition-colors">
                                    ← Kembali
                                </button>
                            </Link>
                        </div>
                    </div>
                    <p className="text-gray-600">
                        Kelola tugas dan jadwal kerja Anda
                    </p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 mb-1">Total Todo</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Pending</p>
                            <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
                            <p className="text-sm text-gray-500 mb-1">In Progress</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
                            <p className="text-sm text-gray-500 mb-1">Completed</p>
                            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-red-200">
                            <p className="text-sm text-gray-500 mb-1">Overdue</p>
                            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                        </div>
                    </div>
                )}

                {/* View Toggle */}
                <div className="flex justify-center mb-6">
                    <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200 inline-flex">
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-colors ${viewMode === 'calendar'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <CalendarIcon size={18} />
                            Calendar
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-colors ${viewMode === 'list'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <List size={18} />
                            List
                        </button>
                    </div>
                </div>

                {viewMode === 'calendar' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Calendar */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                {/* Calendar Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <button
                                        onClick={previousMonth}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                    </h2>
                                    <button
                                        onClick={nextMonth}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                                        <div key={day} className="text-center py-2 text-sm font-semibold text-gray-600">
                                            {day}
                                        </div>
                                    ))}

                                    {days.map((date, index) => {
                                        if (!date) {
                                            return <div key={`empty-${index}`} className="aspect-square" />;
                                        }

                                        const dateTodos = getTodosForDate(date);
                                        const today = isToday(date);
                                        const selected = isSelected(date);

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => setSelectedDate(date)}
                                                className={`aspect-square p-1 border rounded-lg text-sm transition-all relative ${today
                                                        ? 'border-purple-500 bg-purple-50 font-bold'
                                                        : selected
                                                            ? 'border-purple-400 bg-purple-100'
                                                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                                                    }`}
                                            >
                                                <div className="flex flex-col h-full">
                                                    <span className={today ? 'text-purple-700' : 'text-gray-700'}>
                                                        {date.getDate()}
                                                    </span>
                                                    {dateTodos.length > 0 && (
                                                        <div className="flex-1 flex flex-wrap gap-0.5 mt-1 justify-center">
                                                            {dateTodos.slice(0, 3).map(todo => {
                                                                const priorityColor = TODO_PRIORITY_COLORS[todo.priority];
                                                                return (
                                                                    <div
                                                                        key={todo.id}
                                                                        className={`w-1.5 h-1.5 rounded-full ${priorityColor.bg}`}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Selected Date Todos */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">
                                    {selectedDate
                                        ? `Todo - ${selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`
                                        : 'Pilih Tanggal'}
                                </h3>
                                <TodoList
                                    todos={selectedDateTodos}
                                    onRefresh={loadData}
                                    onEdit={handleEditTodo}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Semua Todo</h2>
                        <TodoList
                            todos={todos}
                            onRefresh={loadData}
                            onEdit={handleEditTodo}
                        />
                    </div>
                )}

                {/* Add/Edit Todo Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-2xl w-full">
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                                <h3 className="text-xl font-bold text-gray-900">
                                    {editingTodo ? 'Edit Todo' : 'Tambah Todo Baru'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingTodo(null);
                                        setFormData({
                                            title: '',
                                            description: '',
                                            priority: 'medium',
                                            dueDate: new Date()
                                        });
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Judul Todo *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        required
                                        placeholder="Contoh: Meeting dengan klien"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Deskripsi
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        rows={3}
                                        placeholder="Detail tambahan tentang todo ini..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Prioritas *
                                        </label>
                                        <select
                                            value={formData.priority}
                                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as TodoPriority })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            required
                                        >
                                            <option value="low">Rendah</option>
                                            <option value="medium">Sedang</option>
                                            <option value="high">Tinggi</option>
                                            <option value="urgent">Mendesak</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Tanggal Deadline *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.dueDate.toISOString().split('T')[0]}
                                            onChange={(e) => setFormData({ ...formData, dueDate: new Date(e.target.value) })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Menyimpan...' : (editingTodo ? 'Update Todo' : 'Simpan Todo')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForm(false);
                                            setEditingTodo(null);
                                        }}
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
