// Firebase configuration matching the Android google-services.json
const firebaseConfig = {
    apiKey: "AIzaSyCxYDfBVm65TJby47yyAY6mkiLRbEuBisU",
    authDomain: "iptv-premium-lealstudio.firebaseapp.com",
    projectId: "iptv-premium-lealstudio",
    storageBucket: "iptv-premium-lealstudio.firebasestorage.app",
    // NOTE: For full Firebase Web functionality, you should add your Web App ID and Sender ID here
    // messagingSenderId: "975854936161",
    // appId: "YOUR_WEB_APP_ID_HERE"
};

// Initialize Firebase
let app, db;
try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialized successfully.");
} catch (e) {
    console.error("Firebase initialization error:", e);
}
