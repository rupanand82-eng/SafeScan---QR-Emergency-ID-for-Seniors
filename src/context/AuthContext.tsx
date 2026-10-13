import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserAccount, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userAccount: UserAccount | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  signInWithGoogle: (selectedRole?: UserRole) => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
  logout: () => Promise<void>;
  updateAccountRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ['rupanand82@gmail.com', 'rupanandpalakurthi@gmail.com'];

function isEmailAdmin(email?: string | null): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync with Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setCurrentUser(fbUser);
        const isDefaultAdmin = isEmailAdmin(fbUser.email);
        const fallbackAccount: UserAccount = {
          id: fbUser.uid,
          name: (fbUser.displayName || 'SafeScan User').slice(0, 100),
          email: (fbUser.email || '').slice(0, 150),
          role: isDefaultAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
        };

        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const existingData = snap.data() as UserAccount;
            const resolvedRole: UserRole = isDefaultAdmin
              ? 'admin'
              : existingData.role === 'admin'
              ? 'admin'
              : 'user';
            const resolvedAccount: UserAccount = {
              ...existingData,
              id: fbUser.uid,
              name: (existingData.name || fbUser.displayName || 'SafeScan User').slice(0, 100),
              email: (existingData.email || fbUser.email || '').slice(0, 150),
              role: resolvedRole,
            };
            setUserAccount(resolvedAccount);
          } else {
            await setDoc(userDocRef, fallbackAccount, { merge: true });
            setUserAccount(fallbackAccount);
          }
        } catch (error) {
          console.warn('Firestore user profile sync fallback active:', error);
          setUserAccount((prev) => prev || fallbackAccount);
        }
      } else {
        // If no firebase user, check if we have a demo session in localStorage
        const storedDemo = localStorage.getItem('safescan_demo_session');
        if (storedDemo) {
          try {
            const parsed = JSON.parse(storedDemo) as UserAccount;
            setUserAccount(parsed);
          } catch {
            setUserAccount(null);
          }
        } else {
          setUserAccount(null);
        }
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (selectedRole: UserRole = 'user') => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    setCurrentUser(user);

    const isDefaultAdmin = isEmailAdmin(user.email);
    const defaultRole: UserRole = isDefaultAdmin ? 'admin' : selectedRole === 'admin' ? 'admin' : 'user';

    let account: UserAccount = {
      id: user.uid,
      name: (user.displayName || 'SafeScan User').slice(0, 100),
      email: (user.email || '').slice(0, 150),
      role: defaultRole,
      createdAt: new Date().toISOString(),
    };

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const existing = snap.data() as UserAccount;
        account = {
          id: user.uid,
          name: (user.displayName || existing.name || 'SafeScan User').slice(0, 100),
          email: (user.email || existing.email || '').slice(0, 150),
          role: isDefaultAdmin ? 'admin' : selectedRole === 'admin' ? 'admin' : (existing.role === 'admin' ? 'admin' : 'user'),
          createdAt: existing.createdAt || account.createdAt,
        };
      }
      await setDoc(userDocRef, account, { merge: true });
    } catch (firestoreErr) {
      console.warn('Signed in with Google; using session profile while database sync completes:', firestoreErr);
    }

    setUserAccount(account);
    localStorage.removeItem('safescan_demo_session');
  };

  const switchDemoRole = (role: UserRole) => {
    if (currentUser && userAccount) {
      updateAccountRole(role === 'admin' ? 'admin' : 'user');
      return;
    }

    const demoAccounts: Record<string, UserAccount> = {
      user: {
        id: 'demo-user-id',
        name: 'Ravi Sharma (Member Account)',
        email: 'ravi.sharma.demo@safescan.csp',
        role: 'user',
        createdAt: new Date().toISOString(),
      },
      senior: {
        id: 'demo-user-id',
        name: 'Ravi Sharma (Member Account)',
        email: 'ravi.sharma.demo@safescan.csp',
        role: 'user',
        createdAt: new Date().toISOString(),
      },
      caregiver: {
        id: 'demo-user-id',
        name: 'Ravi Sharma (Member Account)',
        email: 'ravi.sharma.demo@safescan.csp',
        role: 'user',
        createdAt: new Date().toISOString(),
      },
      admin: {
        id: 'demo-admin-user-id',
        name: 'SafeScan CSP Administrator',
        email: 'admin.csp@safescan.org',
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
    };

    const target = demoAccounts[role] || demoAccounts.user;
    setUserAccount(target);
    localStorage.setItem('safescan_demo_session', JSON.stringify(target));
  };

  const logout = async () => {
    localStorage.removeItem('safescan_demo_session');
    setUserAccount(null);
    setCurrentUser(null);
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('SignOut warning:', e);
    }
  };

  const updateAccountRole = async (newRole: UserRole) => {
    if (!userAccount) return;
    const resolvedRole = newRole === 'admin' ? 'admin' : 'user';
    const updated: UserAccount = {
      ...userAccount,
      id: currentUser?.uid || userAccount.id,
      name: (userAccount.name || currentUser?.displayName || 'SafeScan User').slice(0, 100),
      email: (userAccount.email || currentUser?.email || '').slice(0, 150),
      role: resolvedRole,
      createdAt: userAccount.createdAt || new Date().toISOString(),
    };
    setUserAccount(updated);
    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), updated, { merge: true });
      } catch (e) {
        console.warn('Error updating role in Firestore:', e);
      }
    } else {
      localStorage.setItem('safescan_demo_session', JSON.stringify(updated));
    }
  };

  const role = userAccount?.role || 'user';
  const isAdmin = role === 'admin' || isEmailAdmin(currentUser?.email);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userAccount,
        loading,
        role,
        isAdmin,
        signInWithGoogle,
        switchDemoRole,
        logout,
        updateAccountRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
