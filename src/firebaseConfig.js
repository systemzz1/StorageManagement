import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDvqMwKKt5Zd-wNb6UxJW5HRFmw6OJTyzw",
  authDomain: "esphanoian.firebaseapp.com",
  databaseURL: "https://esphanoian-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esphanoian",
  storageBucket: "esphanoian.firebasestorage.app",
  messagingSenderId: "27228573774",
  appId: "1:27228573774:web:5739a0b52fc7c86670f31f",
  measurementId: "G-3GFHB64PWQ"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { app, database, auth };
