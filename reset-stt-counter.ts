import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

/**
 * Script to reset STT counter to a specific number
 * Run this once in the browser console or as a Node script
 */
async function resetSTTCounter(userId: string, resetToNumber: number) {
    const counterRef = doc(db, 'metadata', 'stt_counters');

    try {
        console.log(`Resetting STT counter for user ${userId} to ${resetToNumber}...`);

        await setDoc(counterRef, {
            [userId]: {
                currentNumber: resetToNumber,
                prefix: 'STT',
                lastUpdated: new Date(),
            }
        }, { merge: true });

        console.log(`✅ Successfully reset counter to ${resetToNumber}`);
        console.log(`Next STT will be: STT${String(resetToNumber + 1).padStart(6, '0')}`);

        // Verify
        const doc = await getDoc(counterRef);
        if (doc.exists()) {
            const data = doc.data();
            console.log('Current counter data:', data[userId]);
        }
    } catch (error) {
        console.error('Error resetting counter:', error);
    }
}

// Example usage:
// Replace with your actual user ID and desired number
// resetSTTCounter('YOUR_USER_ID', 17667); // This will make next STT = 017668

export { resetSTTCounter };
