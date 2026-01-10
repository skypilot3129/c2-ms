'use client';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Debug script to check what's in the Firestore counter
 * Run this in browser console: debugSTTCounter()
 */
async function debugSTTCounter() {
    console.log('=== STT Counter Debug ===');

    const counterRef = doc(db, 'metadata', 'stt_counters');
    const docSnap = await getDoc(counterRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Counter document exists!');
        console.log('Full data:', data);
        console.log('Global counter:', data['global']);

        if (data['global']) {
            const currentNum = data['global'].currentNumber;
            console.log('Current number:', currentNum);
            console.log('Next STT should be:', `STT${String(currentNum + 1).padStart(6, '0')}`);
        } else {
            console.log('⚠️ No "global" key found in counter document!');
            console.log('Available keys:', Object.keys(data));
        }
    } else {
        console.log('❌ Counter document does not exist!');
        console.log('Next STT will default to: STT017642');
    }

    return docSnap.exists() ? docSnap.data() : null;
}

// Make it available globally for browser console
if (typeof window !== 'undefined') {
    (window as any).debugSTTCounter = debugSTTCounter;
}

export { debugSTTCounter };
