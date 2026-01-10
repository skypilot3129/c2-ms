import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

/**
 * Script to reset STT counter to a specific number
 * Run this once in the browser console or as a Node script
 * Note: Counter is global (shared across all users)
 */
async function resetSTTCounter(resetToNumber: number) {
    const counterRef = doc(db, 'metadata', 'stt_counters');

    try {
        console.log(`🔄 Resetting global STT counter to ${resetToNumber}...`);

        await setDoc(counterRef, {
            ['global']: {
                currentNumber: resetToNumber,
                prefix: 'STT',
                lastUpdated: new Date(),
            }
        }, { merge: true });

        console.log(`✅ Successfully reset counter to ${resetToNumber}`);
        console.log(`📝 Next STT will be: STT${String(resetToNumber + 1).padStart(6, '0')}`);

        // Verify
        const docSnap = await getDoc(counterRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log('📊 Current counter data:', data['global']);
        }
    } catch (error) {
        console.error('❌ Error resetting counter:', error);
    }
}

// Example usage:
// Run in browser console after importing this file
// resetSTTCounter(17673); // This will make next STT = STT017674

export { resetSTTCounter };
