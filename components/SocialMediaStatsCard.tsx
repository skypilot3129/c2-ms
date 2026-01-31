'use client';

import { SocialMediaStats, PLATFORM_LABELS, PLATFORM_COLORS, SocialMediaPlatform } from '@/types/social-media';
import { TrendingUp, TrendingDown, Users, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';

interface SocialMediaStatsCardProps {
    stats: SocialMediaStats;
    onClick?: () => void;
}

export default function SocialMediaStatsCard({ stats, onClick }: SocialMediaStatsCardProps) {
    const platformLabel = PLATFORM_LABELS[stats.platform];
    const colors = PLATFORM_COLORS[stats.platform];

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    return (
        <div
            onClick={onClick}
            className={`rounded-2xl p-6 shadow-lg border-2 ${colors.border} bg-gradient-to-br ${colors.bg} ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-bold ${colors.text}`}>{platformLabel}</h3>
                <div className={`px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm`}>
                    <span className={`text-sm font-semibold ${colors.text}`}>
                        {stats.engagement.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className={colors.text} />
                        <span className={`text-xs ${colors.text} opacity-80`}>Followers</span>
                    </div>
                    <p className={`text-2xl font-bold ${colors.text}`}>
                        {formatNumber(stats.followers)}
                    </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Eye size={16} className={colors.text} />
                        <span className={`text-xs ${colors.text} opacity-80`}>Views</span>
                    </div>
                    <p className={`text-2xl font-bold ${colors.text}`}>
                        {formatNumber(stats.views)}
                    </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Heart size={16} className={colors.text} />
                        <span className={`text-xs ${colors.text} opacity-80`}>Likes</span>
                    </div>
                    <p className={`text-lg font-bold ${colors.text}`}>
                        {formatNumber(stats.likes)}
                    </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <MessageCircle size={16} className={colors.text} />
                        <span className={`text-xs ${colors.text} opacity-80`}>Comments</span>
                    </div>
                    <p className={`text-lg font-bold ${colors.text}`}>
                        {formatNumber(stats.comments)}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/20">
                <span className={`text-xs ${colors.text} opacity-80`}>
                    {stats.posts} posts
                </span>
                <span className={`text-xs ${colors.text} opacity-80`}>
                    {new Date(stats.reportDate).toLocaleDateString('id-ID')}
                </span>
            </div>
        </div>
    );
}
