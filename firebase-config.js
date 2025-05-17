

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD0meJvmKpzRnWVsH8kQ47gAofr71fEyKM",
  authDomain: "ansibin-bar-checkliste.firebaseapp.com",
  databaseURL:"https://ansibin-bar-checkliste-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ansibin-bar-checkliste",
  storageBucket: "ansibin-bar-checkliste.firebasestorage.app",
  messagingSenderId: "204246341170",
  appId: "1:204246341170:web:40e654fe2b27c0a8298e2b",
  measurementId: "G-DLVKC89E8M"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
console.log("Firebase wurde initialisiert mit korrekter DB URL!");