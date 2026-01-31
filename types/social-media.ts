export type SocialMediaPlatform = 'tiktok' | 'instagram' | 'website' | 'youtube';

export interface SocialMediaStats {
    id: string;
    platform: SocialMediaPlatform;
    followers: number;
    engagement: number; // Percentage
    views: number;
    posts: number;
    likes: number;
    comments: number;
    shares: number;
    reportDate: Date;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface SocialMediaFormData {
    platform: SocialMediaPlatform;
    followers: number;
    engagement: number;
    views: number;
    posts: number;
    likes: number;
    comments: number;
    shares: number;
    reportDate: Date;
    notes: string;
}

export interface SocialMediaDoc {
    platform: SocialMediaPlatform;
    followers: number;
    engagement: number;
    views: number;
    posts: number;
    likes: number;
    comments: number;
    shares: number;
    reportDate: any; // Firestore Timestamp
    notes: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export const PLATFORM_LABELS: Record<SocialMediaPlatform, string> = {
    'tiktok': 'TikTok',
    'instagram': 'Instagram',
    'website': 'Website',
    'youtube': 'YouTube'
};

export const PLATFORM_COLORS: Record<SocialMediaPlatform, { bg: string; text: string; border: string }> = {
    'tiktok': { bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-700' },
    'instagram': { bg: 'bg-gradient-to-br from-purple-600 to-pink-500', text: 'text-white', border: 'border-purple-400' },
    'website': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-400' },
    'youtube': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-400' }
};
