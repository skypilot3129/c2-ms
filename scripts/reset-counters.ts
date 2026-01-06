/**
 * DEVELOPMENT ONLY - Reset STT and Invoice Counters
 * 
 * ⚠️ WARNING: Do NOT use in production!
 * This script resets all counters to their default starting values
 * 
 * Usage: npx tsx scripts/reset-counters.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc, collection, getDocs } from 'firebase/firestore';

// Firebase config - same as your lib/firebase.ts
const firebaseConfig = {
    apiKey: "AIzaSyBlJ2RqHhwf-QXnTe7SxNLvQDfDfQZg6sE",
    authDomain: "cahaya-cargo.firebaseapp.com",
    projectId: "cahaya-cargo",
    storageBucket: "cahaya-cargo.firebasestorage.app",
    messagingSenderId: "709451569896",
    appId: "1:709451569896:web:8a12c4f98a5e75e12b0f67"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetCounters() {
    try {
        console.log('🔄 Starting counter reset...\n');

        // 1. Delete STT counter
        const sttCounterRef = doc(db, 'metadata', 'stt_counter');
        await deleteDoc(sttCounterRef);
        console.log('✅ STT counter deleted - next STT will be: STT017642');

        // 2. Delete Invoice counters
        const invoiceCounterRef = doc(db, 'metadata', 'invoice_counters');
        await deleteDoc(invoiceCounterRef);
        console.log('✅ Invoice counters deleted - next invoices will be:');
        console.log('   - Regular: INV012366');
        console.log('   - PKP: INV-PKP05177');

        console.log('\n✨ All counters have been reset to default values!');
        console.log('\n⚠️  NOTE: This does NOT delete existing transactions.');
        console.log('   Counters will restart from default on next transaction creation.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting counters:', error);
        process.exit(1);
    }
}

// Optional: Also delete all transactions (use with EXTREME caution!)
async function deleteAllTransactions() {
    const confirmed = process.argv.includes('--delete-all-transactions');

    if (!confirmed) {
        console.log('\nℹ️  To also delete ALL transactions, run:');
        console.log('   npx tsx scripts/reset-counters.ts --delete-all-transactions\n');
        return;
    }

    console.log('\n⚠️  DELETING ALL TRANSACTIONS...');

    const transactionsRef = collection(db, 'transactions');
    const snapshot = await getDocs(transactionsRef);

    let deleted = 0;
    for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, 'transactions', docSnap.id));
        deleted++;
    }

    console.log(`🗑️  Deleted ${deleted} transactions`);
}

// Run the script
(async () => {
    await resetCounters();
    await deleteAllTransactions();
})();
