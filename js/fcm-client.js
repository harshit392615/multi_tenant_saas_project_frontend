// fcm-client.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYxIJwowWh1fjYRtPapy-6LcmzBMDvFIA",
  authDomain: "mtsp-90f54.firebaseapp.com",
  projectId: "mtsp-90f54",
  storageBucket: "mtsp-90f54.firebasestorage.app",
  messagingSenderId: "117372393169",
  appId: "1:117372393169:web:62d31a758de186d20197f0",
  measurementId: "G-8JX78LCYSJ"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const VAPID_KEY = "BInQ7_EP7fLrah0Tb4NtoHDjBEhZr_5F6i6GLkzbETqAwoRfUsigjQOGmgDwr7S82cK-R1DD3f_Z6mDztHTzb3s";

export async function initFCM(apiBaseUrl, activeOrgSlug) {
    try {
        console.log("📍 FCM Step 1: Checking permissions...");
        let permission = Notification.permission;
        
        if (permission === 'default') {
            console.log("📍 FCM Step 1b: Prompting user for permission...");
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            console.warn('📍 FCM Stopped: Notification permission denied by user.');
            return;
        }

        console.log("📍 FCM Step 2: Registering Service Worker...");
        // Ensure this path matches exactly where your file is! 
        // If it's in the same folder, use './firebase-messaging-sw.js'
        const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        
        console.log("📍 FCM Step 3: Waiting for Service Worker to be 'Ready'...");
        await navigator.serviceWorker.ready;

        console.log("📍 FCM Step 4: Requesting Token from Firebase...");
        const currentToken = await getToken(messaging, { 
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration 
        });
        
        console.log("📍 FCM Step 5: Token Retrieved! Sending to Django...");
        if (currentToken) {
            await sendTokenToServer(currentToken, apiBaseUrl, activeOrgSlug);
        } else {
            console.warn('No registration token available.');
        }

        onMessage(messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
            if (window.handleIncomingNotification) {
                window.handleIncomingNotification({
                    type: payload.data?.type || 'system',
                    message: payload.notification?.body || 'New update',
                    id: payload.data?.id
                });
            }
        });

    } catch (error) {
        console.error('📍 FCM Error: An error occurred while setting up FCM: ', error);
    }
}

async function sendTokenToServer(fcmToken, apiBaseUrl, activeOrgSlug) {
    const accessToken = localStorage.getItem("access");
    if (!accessToken) return;

    try {
        // Updated to use a safer check for response success
        const response = await fetch(`${apiBaseUrl}/auth/register-fcm-token/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'X-ORG-SLUG': activeOrgSlug
            },
            body: JSON.stringify({ fcm_token: fcmToken })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        console.log("FCM Token successfully synced with backend.");
    } catch (e) {
        console.error("Failed to send FCM token to backend", e);
    }
}