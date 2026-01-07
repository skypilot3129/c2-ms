/**
 * Debug script to check STT counter in database
 * Add this to a page and run it to see current counter value
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function debugSTTCounter(userId: string) {
    try {
        const counterRef = doc(db, 'metadata', 'stt_counters');
        const counterDoc = await getDoc(counterRef);

        if (counterDoc.exists()) {
            const data = counterDoc.data();
            console.log('=== STT Counter Debug ===');
            console.log('Full document data:', data);
            console.log('User ID:', userId);
            console.log('Counter for this user:', data[userId]);
            console.log('Current number:', data[userId]?.currentNumber);

            if (data[userId]?.currentNumber) {
                const next = data[userId].currentNumber + 1;
                console.log('Next STT should be:', `STT${String(next).padStart(6, '0')}`);
            }
        } else {
            console.log('Counter document does not exist!');
        }
    } catch (error) {
        console.error('Error reading counter:', error);
    }
}

// To use: Call this in your component with user.uid
// debugSTTCounter(user.uid);
