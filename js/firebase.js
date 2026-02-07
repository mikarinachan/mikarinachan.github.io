import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfyTtuLXAmibDu2ebKSTUI-_ZKFrv8Syo",
  authDomain: "math-memo-870c0.firebaseapp.com",
  projectId: "math-memo-870c0",
  storageBucket: "math-memo-870c0.firebasestorage.app",
  messagingSenderId: "396039327636",
  appId: "1:396039327636:web:028aa61574d06623240981"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function loadRatings() {
  const ratingMap = {};
  const snap = await getDocs(collection(db, "ratings"));
  snap.forEach((doc) => {
    const { postId, score } = doc.data() || {};
    if (!postId || typeof score !== "number") return;
    (ratingMap[postId] ??= []).push(score);
  });
  return ratingMap;
}

export async function submitRating(postId, score) {
  return addDoc(collection(db, "ratings"), {
    postId,
    score,
    createdAt: new Date()
  });
}

