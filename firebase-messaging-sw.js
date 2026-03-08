// firebase-messaging-sw.js
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force the new version to take over immediately
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); // Become the active controller for the page
});
// ... rest of your existing firebase-messaging-sw.js code
// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 1. Initialize Firebase inside the service worker
const firebaseConfig = {
  apiKey: "AIzaSyBYxIJwowWh1fjYRtPapy-6LcmzBMDvFIA",
  authDomain: "mtsp-90f54.firebaseapp.com",
  projectId: "mtsp-90f54",
  storageBucket: "mtsp-90f54.firebasestorage.app",
  messagingSenderId: "117372393169",
  appId: "1:117372393169:web:62d31a758de186d20197f0",
  measurementId: "G-8JX78LCYSJ"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 2. Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '../image.png' // Add an icon path here
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});