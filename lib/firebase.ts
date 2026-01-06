import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDe4Uh3_gjbutp8-M_TuukUfTCFTSeWGQo",
    authDomain: "c2express-7e148.firebaseapp.com",
    projectId: "c2express-7e148",
    storageBucket: "c2express-7e148.firebasestorage.app",
    messagingSenderId: "1058527926604",
    appId: "1:1058527926604:web:e805cbd1e51f3d7f1757e9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Export collection references
export const clientsCollection = collection(db, 'clients');
