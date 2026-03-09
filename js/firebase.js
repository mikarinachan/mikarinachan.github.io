import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("FIREBASE FILE LOADED 20260309-C");

const firebaseConfig = {
  apiKey: "AIzaSyCfyTtuLXAmjDbu2ebKSTUI-_ZKFrv8Syo",
  authDomain: "math-memo-870c0.firebaseapp.com",
  projectId: "math-memo-870c0",
  storageBucket: "math-memo-870c0.firebasestorage.app",
  messagingSenderId: "396039327636",
  appId: "1:396039327636:web:028aa61574d06623240981",
  measurementId: "G-ZH0V0D91G6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export async function loginWithGoogle() {
  console.log("LOGIN START", location.href);
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logout() {
  await signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

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
  const user = auth.currentUser;
  if (!user) throw new Error("LOGIN_REQUIRED");

  return addDoc(collection(db, "ratings"), {
    postId,
    score,
    uid: user.uid,
    userName: user.displayName || "",
    userPhotoURL: user.photoURL || "",
    createdAt: new Date()
  });
}
