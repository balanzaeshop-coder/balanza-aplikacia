import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBKuva5G7CB3fj85PZAEcJYMIvQjHWalqY',
  authDomain: 'balanza-aplikacia.firebaseapp.com',
  projectId: 'balanza-aplikacia',
  storageBucket: 'balanza-aplikacia.firebasestorage.app',
  messagingSenderId: '456011197309',
  appId: '1:456011197309:web:9a90d3467dadb274d5fa14',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
