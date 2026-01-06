'use client';

import type { StatusTransaksi } from '@/types/transaction';

interface StatusBadgeProps {
    status: StatusTransaksi;
    className?: string;
}

const statusConfig: Record<StatusTransaksi, { label: string; color: string; bgColor: string; icon: string }> = {
    pending: {
        label: 'Pending',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        icon: '⏳',
    },
    diproses: {
        label: 'Diproses',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        icon: '🔄',
    },
    dikirim: {
        label: 'Dikirim',
        color: 'text-purple-700',
        bgColor: 'bg-purple-100',
        icon: '🚚',
    },
    selesai: {
        label: 'Selesai',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: '✅',
    },
    dibatalkan: {
        label: 'Dibatalkan',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        icon: '❌',
    },
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <span
            className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold
        ${config.bgColor} ${config.color} ${className}
      `}
        >
            <span>{config.icon}</span>
            <span>{config.label}</span>
        </span>
    );
}
