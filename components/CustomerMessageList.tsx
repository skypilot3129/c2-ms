'use client';

import { useState } from 'react';
import { CustomerMessage, MESSAGE_STATUS_LABELS, MESSAGE_STATUS_COLORS, MESSAGE_SOURCE_LABELS } from '@/types/customer-message';
import { updateMessageStatus } from '@/lib/firestore-customer-messages';
import { Phone, Mail, MessageCircle, Check, Eye, Archive } from 'lucide-react';

interface CustomerMessageListProps {
    messages: CustomerMessage[];
    onRefresh: () => void;
}

export default function CustomerMessageList({ messages, onRefresh }: CustomerMessageListProps) {
    const [updating, setUpdating] = useState<string | null>(null);

    const handleStatusChange = async (messageId: string, newStatus: any) => {
        setUpdating(messageId);
        try {
            await updateMessageStatus(messageId, newStatus);
            onRefresh();
        } catch (error) {
            console.error('Error updating message status:', error);
            alert('Gagal mengupdate status pesan');
        } finally {
            setUpdating(null);
        }
    };

    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'whatsapp':
                return <MessageCircle size={16} className="text-green-600" />;
            case 'call':
                return <Phone size={16} className="text-blue-600" />;
            case 'email':
                return <Mail size={16} className="text-purple-600" />;
            default:
                return <MessageCircle size={16} className="text-gray-600" />;
        }
    };

    const openWhatsApp = (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    return (
        <div className="space-y-3">
            {messages.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <MessageCircle size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Belum ada pesan customer</p>
                </div>
            ) : (
                messages.map((message) => {
                    const statusColor = MESSAGE_STATUS_COLORS[message.status];
                    const isUpdating = updating === message.id;

                    return (
                        <div
                            key={message.id}
                            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-gray-800">{message.customerName}</h4>
                                        {getSourceIcon(message.source)}
                                    </div>
                                    <button
                                        onClick={() => openWhatsApp(message.customerPhone)}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        {message.customerPhone}
                                    </button>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text}`}>
                                        {MESSAGE_STATUS_LABELS[message.status]}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(message.receivedAt).toLocaleDateString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>

                            <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                                {message.message}
                            </p>

                            {message.responseNotes && (
                                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3 rounded">
                                    <p className="text-sm text-blue-800">
                                        <strong>Response:</strong> {message.responseNotes}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                {message.status === 'unread' && (
                                    <button
                                        onClick={() => handleStatusChange(message.id, 'read')}
                                        disabled={isUpdating}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition-colors disabled:opacity-50"
                                    >
                                        <Eye size={14} />
                                        Tandai Dibaca
                                    </button>
                                )}
                                {(message.status === 'unread' || message.status === 'read') && (
                                    <button
                                        onClick={() => handleStatusChange(message.id, 'responded')}
                                        disabled={isUpdating}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors disabled:opacity-50"
                                    >
                                        <Check size={14} />
                                        Tandai Direspon
                                    </button>
                                )}
                                {message.status === 'responded' && (
                                    <button
                                        onClick={() => handleStatusChange(message.id, 'archived')}
                                        disabled={isUpdating}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                                    >
                                        <Archive size={14} />
                                        Arsipkan
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
