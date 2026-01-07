import 'server-only';
import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Replace \n with actual newlines if stored as a single string
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
        console.log('Firebase Admin Initialized successfully');
    } catch (error: any) {
        console.error('Firebase Admin Initialization Error:', error.stack);
    }
} else {
    console.log('Firebase Admin already initialized');
}

// Debug Env Vars (Hide key content for security)
console.log('Admin SDK Env Check:', {
    projectId: process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Missing',
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? 'Set (Length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ')' : 'Missing'
});

export const adminDb = admin.firestore();
