import React, { createContext, useState, useEffect } from 'react';
import { auth, database } from '../firebaseConfig';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const roleRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(roleRef);
          if (snapshot.exists()) {
            const userData = snapshot.val();
            // Block disabled accounts
            if (userData.disabled === true) {
              await signOut(auth);
              setCurrentUser(null);
              setRole(null);
              setLoading(false);
              return;
            }
            setRole(userData.role || 'staff');
          } else {
            // No profile found — auto-promote as admin (owner's first login)
            await set(roleRef, { role: 'admin', email: user.email, createdAt: Date.now(), disabled: false });
            setRole('admin');
          }
        } catch (error) {
          console.error('Firebase Database Error:', error);
          setRole('staff');
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const value = { currentUser, role, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
