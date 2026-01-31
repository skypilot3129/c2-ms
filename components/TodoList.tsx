'use client';

import { useState } from 'react';
import { Todo, TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS, TODO_STATUS_LABELS } from '@/types/todo';
import { updateTodoStatus, deleteTodo } from '@/lib/firestore-todos';
import { Check, X, Trash2, Edit, Clock } from 'lucide-react';

interface TodoListProps {
    todos: Todo[];
    onRefresh: () => void;
    onEdit?: (todo: Todo) => void;
}

export default function TodoList({ todos, onRefresh, onEdit }: TodoListProps) {
    const [updating, setUpdating] = useState<string | null>(null);

    const handleToggleComplete = async (todo: Todo) => {
        setUpdating(todo.id);
        try {
            const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
            await updateTodoStatus(todo.id, newStatus);
            onRefresh();
        } catch (error) {
            console.error('Error toggling todo:', error);
            alert('Gagal mengupdate todo');
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (todoId: string) => {
        if (!confirm('Hapus todo ini?')) return;

        setUpdating(todoId);
        try {
            await deleteTodo(todoId);
            onRefresh();
        } catch (error) {
            console.error('Error deleting todo:', error);
            alert('Gagal menghapus todo');
        } finally {
            setUpdating(null);
        }
    };

    const isOverdue = (todo: Todo) => {
        return todo.status !== 'completed' &&
            todo.status !== 'cancelled' &&
            new Date(todo.dueDate) < new Date();
    };

    const sortedTodos = [...todos].sort((a, b) => {
        // Completed items to bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;

        // Sort by due date
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return (
        <div className="space-y-2">
            {sortedTodos.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Clock size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Belum ada todo</p>
                </div>
            ) : (
                sortedTodos.map((todo) => {
                    const priorityColor = TODO_PRIORITY_COLORS[todo.priority];
                    const isUpdating = updating === todo.id;
                    const overdue = isOverdue(todo);

                    return (
                        <div
                            key={todo.id}
                            className={`bg-white rounded-lg p-4 border-l-4 ${priorityColor.border} shadow-sm hover:shadow-md transition-shadow ${todo.status === 'completed' ? 'opacity-60' : ''
                                } ${overdue ? 'bg-red-50' : ''}`}
                        >
                            <div className="flex items-start gap-3">
                                <button
                                    onClick={() => handleToggleComplete(todo)}
                                    disabled={isUpdating}
                                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${todo.status === 'completed'
                                            ? 'bg-green-500 border-green-500'
                                            : 'border-gray-300 hover:border-green-500'
                                        } disabled:opacity-50`}
                                >
                                    {todo.status === 'completed' && (
                                        <Check size={14} className="text-white" />
                                    )}
                                </button>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className={`font-semibold ${todo.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-800'
                                            }`}>
                                            {todo.title}
                                        </h4>
                                        <div className="flex gap-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityColor.bg} ${priorityColor.text}`}>
                                                {TODO_PRIORITY_LABELS[todo.priority]}
                                            </span>
                                        </div>
                                    </div>

                                    {todo.description && (
                                        <p className={`text-sm mb-2 ${todo.status === 'completed' ? 'text-gray-400' : 'text-gray-600'
                                            }`}>
                                            {todo.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs">
                                            <Clock size={12} className={overdue ? 'text-red-500' : 'text-gray-400'} />
                                            <span className={overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                                                {new Date(todo.dueDate).toLocaleDateString('id-ID', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                                {overdue && ' (Terlambat)'}
                                            </span>
                                        </div>

                                        <div className="flex gap-1">
                                            {onEdit && (
                                                <button
                                                    onClick={() => onEdit(todo)}
                                                    className="p-1.5 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(todo.id)}
                                                disabled={isUpdating}
                                                className="p-1.5 hover:bg-red-50 rounded text-red-600 transition-colors disabled:opacity-50"
                                                title="Hapus"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
