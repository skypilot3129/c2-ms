import { db } from './firebase';
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    limit
} from 'firebase/firestore';
import type {
    SocialMediaStats,
    SocialMediaFormData,
    SocialMediaDoc,
    SocialMediaPlatform
} from '@/types/social-media';

const COLLECTION_NAME = 'social_media_reports';

// Get all social media stats
export const getAllSocialMediaStats = async (): Promise<SocialMediaStats[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('reportDate', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data() as SocialMediaDoc;
            return {
                id: doc.id,
                platform: data.platform,
                followers: data.followers,
                engagement: data.engagement,
                views: data.views,
                posts: data.posts,
                likes: data.likes,
                comments: data.comments,
                shares: data.shares,
                reportDate: data.reportDate?.toDate() || new Date(),
                notes: data.notes,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error('Error getting social media stats:', error);
        throw error;
    }
};

// Get latest stats for each platform
export const getLatestSocialMediaStats = async (): Promise<SocialMediaStats[]> => {
    try {
        const platforms: SocialMediaPlatform[] = ['tiktok', 'instagram', 'website', 'youtube'];
        const latestStats: SocialMediaStats[] = [];

        for (const platform of platforms) {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('platform', '==', platform),
                orderBy('reportDate', 'desc'),
                limit(1)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data() as SocialMediaDoc;
                latestStats.push({
                    id: doc.id,
                    platform: data.platform,
                    followers: data.followers,
                    engagement: data.engagement,
                    views: data.views,
                    posts: data.posts,
                    likes: data.likes,
                    comments: data.comments,
                    shares: data.shares,
                    reportDate: data.reportDate?.toDate() || new Date(),
                    notes: data.notes,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date()
                });
            }
        }

        return latestStats;
    } catch (error) {
        console.error('Error getting latest social media stats:', error);
        throw error;
    }
};

// Get stats for specific platform
export const getSocialMediaStatsByPlatform = async (platform: SocialMediaPlatform): Promise<SocialMediaStats[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('platform', '==', platform),
            orderBy('reportDate', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data() as SocialMediaDoc;
            return {
                id: doc.id,
                platform: data.platform,
                followers: data.followers,
                engagement: data.engagement,
                views: data.views,
                posts: data.posts,
                likes: data.likes,
                comments: data.comments,
                shares: data.shares,
                reportDate: data.reportDate?.toDate() || new Date(),
                notes: data.notes,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error('Error getting social media stats by platform:', error);
        throw error;
    }
};

// Add new social media report
export const addSocialMediaReport = async (data: SocialMediaFormData): Promise<string> => {
    try {
        const now = Timestamp.now();
        const docData: Omit<SocialMediaDoc, 'createdAt' | 'updatedAt'> & {
            createdAt: Timestamp;
            updatedAt: Timestamp;
        } = {
            platform: data.platform,
            followers: data.followers,
            engagement: data.engagement,
            views: data.views,
            posts: data.posts,
            likes: data.likes,
            comments: data.comments,
            shares: data.shares,
            reportDate: Timestamp.fromDate(data.reportDate),
            notes: data.notes,
            createdAt: now,
            updatedAt: now
        };

        const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
        return docRef.id;
    } catch (error) {
        console.error('Error adding social media report:', error);
        throw error;
    }
};

// Update social media report
export const updateSocialMediaReport = async (id: string, data: Partial<SocialMediaFormData>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const updateData: any = {
            ...data,
            updatedAt: Timestamp.now()
        };

        if (data.reportDate) {
            updateData.reportDate = Timestamp.fromDate(data.reportDate);
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error('Error updating social media report:', error);
        throw error;
    }
};

// Delete social media report
export const deleteSocialMediaReport = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting social media report:', error);
        throw error;
    }
};
