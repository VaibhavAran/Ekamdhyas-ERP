// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyChf8NNylifajrDiCBOc8kgdPm0UEk6-0M",
  authDomain: "erp-system-42207.firebaseapp.com",
  projectId: "erp-system-42207",
  storageBucket: "erp-system-42207.firebasestorage.app",
  messagingSenderId: "1068029051841",
  appId: "1:1068029051841:web:07ba3e889c141733bca540",
  measurementId: "G-K33J7LXF5D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);