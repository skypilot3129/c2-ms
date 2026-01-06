// Script to inspect Firebase Firestore schema
import { db } from './lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function inspectDatabase() {
    console.log('🔍 Inspecting Firebase Database...\n');

    try {
        // Check clients collection
        console.log('📊 Checking "clients" collection...');
        const clientsRef = collection(db, 'clients');
        const clientsQuery = query(clientsRef, limit(5));
        const clientsSnapshot = await getDocs(clientsQuery);

        if (clientsSnapshot.empty) {
            console.log('❌ Collection "clients" is empty or does not exist\n');
        } else {
            console.log(`✅ Found ${clientsSnapshot.size} documents\n`);

            let index = 0;
            clientsSnapshot.forEach((doc) => {
                console.log(`--- Document ${index + 1} (ID: ${doc.id}) ---`);
                const data = doc.data();
                console.log('Fields:', Object.keys(data));
                console.log('Sample data:', JSON.stringify(data, null, 2));
                console.log('');
                index++;
            });
        }

        // List all collections at root level
        console.log('\n📁 Attempting to list all root collections...');
        console.log('(Note: This requires Firebase Admin SDK in production)');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

inspectDatabase();
