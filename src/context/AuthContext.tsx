import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  linkWithCredential,
  PhoneAuthProvider,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserAccount, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userAccount: UserAccount | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  signInWithGoogle: (selectedRole?: UserRole) => Promise<void>;
  signInWithEmail: (email: string, pass: string, selectedRole?: UserRole) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name?: string, phone?: string, selectedRole?: UserRole) => Promise<void>;
  setupRecaptcha: (containerId: string) => RecaptchaVerifier;
  sendPhoneOtp: (phoneNumber: string, appVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyPhoneOtp: (confirmationResult: ConfirmationResult, verificationCode: string, selectedRole?: UserRole) => Promise<FirebaseUser>;
  signInWithSimulatedPhoneOtp: (phoneNumber: string, selectedRole?: UserRole) => Promise<void>;
  loginWithCustomUser: (account: UserAccount) => void;
  linkPhoneNumberToCurrentUser: (confirmationResult: ConfirmationResult, verificationCode: string) => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
  logout: () => Promise<void>;
  updateAccountRole: (role: UserRole) => Promise<void>;
  updateUserProfileData: (data: Partial<UserAccount>) => Promise<void>;
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
          name: (fbUser.displayName || (fbUser.phoneNumber ? `User (${fbUser.phoneNumber})` : 'SafeScan User')).slice(0, 100),
          email: (fbUser.email || '').slice(0, 150),
          phone: fbUser.phoneNumber || undefined,
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
              name: (existingData.name || fbUser.displayName || fallbackAccount.name).slice(0, 100),
              email: (existingData.email || fbUser.email || '').slice(0, 150),
              phone: existingData.phone || fbUser.phoneNumber || undefined,
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
      phone: user.phoneNumber || undefined,
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
          phone: existing.phone || user.phoneNumber || undefined,
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

  const signInWithEmail = async (email: string, pass: string, selectedRole: UserRole = 'user') => {
    const cleanEmail = email.trim();
    const normalized = cleanEmail.toLowerCase();

    // Check if it's one of the recognized preset demo accounts
    if (
      normalized === 'admin.csp@safescan.org' ||
      normalized === 'admin@safescan.com' ||
      normalized === 'admin@safescan.csp'
    ) {
      switchDemoRole('admin');
      return;
    }
    if (
      normalized === 'ravi.sharma.demo@safescan.csp' ||
      normalized === 'demo@safescan.com' ||
      normalized === 'user@safescan.com' ||
      normalized === 'member@safescan.com'
    ) {
      switchDemoRole('user');
      return;
    }

    try {
      const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const user = result.user;
      setCurrentUser(user);

      const isDefaultAdmin = isEmailAdmin(user.email);
      const defaultRole: UserRole = isDefaultAdmin ? 'admin' : selectedRole === 'admin' ? 'admin' : 'user';

      let account: UserAccount = {
        id: user.uid,
        name: (user.displayName || user.email?.split('@')[0] || 'SafeScan User').slice(0, 100),
        email: (user.email || cleanEmail).slice(0, 150),
        phone: user.phoneNumber || undefined,
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
            name: (user.displayName || existing.name || account.name).slice(0, 100),
            email: (user.email || existing.email || cleanEmail).slice(0, 150),
            phone: existing.phone || user.phoneNumber || undefined,
            role: isDefaultAdmin ? 'admin' : selectedRole === 'admin' ? 'admin' : (existing.role === 'admin' ? 'admin' : 'user'),
            createdAt: existing.createdAt || account.createdAt,
          };
        }
        await setDoc(userDocRef, account, { merge: true });
      } catch (firestoreErr) {
        console.warn('Signed in with Email; using fallback profile:', firestoreErr);
      }

      setUserAccount(account);
      localStorage.removeItem('safescan_demo_session');
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      // If Firebase project has not enabled Email/Password provider in console yet:
      if (code === 'auth/operation-not-allowed') {
        const isDefaultAdmin = isEmailAdmin(cleanEmail) || selectedRole === 'admin';
        const defaultRole: UserRole = isDefaultAdmin ? 'admin' : 'user';
        const fallbackId = `email-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const account: UserAccount = {
          id: fallbackId,
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          role: defaultRole,
          createdAt: new Date().toISOString(),
        };
        setUserAccount(account);
        localStorage.setItem('safescan_demo_session', JSON.stringify(account));
        return;
      }
      throw fbErr;
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name?: string,
    phone?: string,
    selectedRole: UserRole = 'user'
  ) => {
    const cleanEmail = email.trim();

    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const user = result.user;
      if (name) {
        try {
          await updateProfile(user, { displayName: name.slice(0, 100) });
        } catch (e) {
          console.warn('Could not set displayName on user object:', e);
        }
      }
      setCurrentUser(user);

      const isDefaultAdmin = isEmailAdmin(user.email);
      const defaultRole: UserRole = isDefaultAdmin ? 'admin' : selectedRole === 'admin' ? 'admin' : 'user';

      const account: UserAccount = {
        id: user.uid,
        name: (name || user.email?.split('@')[0] || 'SafeScan User').slice(0, 100),
        email: (user.email || cleanEmail).slice(0, 150),
        phone: phone?.trim() || undefined,
        role: defaultRole,
        createdAt: new Date().toISOString(),
      };

      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, account, { merge: true });
      } catch (firestoreErr) {
        console.warn('Created user document error:', firestoreErr);
      }

      setUserAccount(account);
      localStorage.removeItem('safescan_demo_session');
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      if (code === 'auth/operation-not-allowed') {
        const isDefaultAdmin = isEmailAdmin(cleanEmail) || selectedRole === 'admin';
        const defaultRole: UserRole = isDefaultAdmin ? 'admin' : 'user';
        const fallbackId = `email-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const account: UserAccount = {
          id: fallbackId,
          name: name || cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: phone?.trim() || undefined,
          role: defaultRole,
          createdAt: new Date().toISOString(),
        };
        setUserAccount(account);
        localStorage.setItem('safescan_demo_session', JSON.stringify(account));
        return;
      }
      throw fbErr;
    }
  };

  const setupRecaptcha = (containerId: string = 'recaptcha-container'): RecaptchaVerifier => {
    // 1. If an active verifier already exists, reuse it without destroying DOM elements
    const existing = (window as any).recaptchaVerifier;
    if (existing) {
      return existing;
    }

    // 2. Ensure container element is present in DOM
    let containerEl = document.getElementById(containerId);
    if (!containerEl) {
      containerEl = document.createElement('div');
      containerEl.id = containerId;
      document.body.appendChild(containerEl);
    }

    // 3. Instantiate RecaptchaVerifier safely on the element
    try {
      const verifier = new RecaptchaVerifier(auth, containerEl, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          console.warn('reCAPTCHA expired');
        },
      });

      (window as any).recaptchaVerifier = verifier;
      return verifier;
    } catch (e) {
      console.warn('RecaptchaVerifier init notice:', e);
      // Return a minimal fallback verifier if needed
      throw e;
    }
  };

  const sendPhoneOtp = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    return confirmationResult;
  };

  const verifyPhoneOtp = async (
    confirmationResult: ConfirmationResult,
    verificationCode: string,
    selectedRole: UserRole = 'user'
  ): Promise<FirebaseUser> => {
    const result = await confirmationResult.confirm(verificationCode);
    const user = result.user;
    setCurrentUser(user);

    const isDefaultAdmin = isEmailAdmin(user.email);
    const defaultRole: UserRole = isDefaultAdmin ? 'admin' : selectedRole === 'admin' ? 'admin' : 'user';

    let account: UserAccount = {
      id: user.uid,
      name: (user.displayName || `Member (${user.phoneNumber || 'User'})`).slice(0, 100),
      email: (user.email || '').slice(0, 150),
      phone: user.phoneNumber || undefined,
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
          name: (user.displayName || existing.name || account.name).slice(0, 100),
          email: (user.email || existing.email || '').slice(0, 150),
          phone: user.phoneNumber || existing.phone || undefined,
          role: isDefaultAdmin ? 'admin' : selectedRole === 'admin' ? 'admin' : (existing.role === 'admin' ? 'admin' : 'user'),
          createdAt: existing.createdAt || account.createdAt,
        };
      } else if (user.phoneNumber) {
        // Check if an existing profile was registered with this verified phone number
        try {
          const q = query(collection(db, 'users'), where('phone', '==', user.phoneNumber));
          const phoneMatches = await getDocs(q);
          if (!phoneMatches.empty) {
            const matched = phoneMatches.docs[0].data() as UserAccount;
            account = {
              ...matched,
              id: user.uid,
              phone: user.phoneNumber,
              role: isDefaultAdmin ? 'admin' : matched.role === 'admin' ? 'admin' : (selectedRole === 'admin' ? 'admin' : 'user'),
            };
          }
        } catch (lookupErr) {
          console.warn('Phone match lookup note:', lookupErr);
        }
      }
      await setDoc(userDocRef, account, { merge: true });
    } catch (firestoreErr) {
      console.warn('Phone sign in user doc sync:', firestoreErr);
    }

    setUserAccount(account);
    localStorage.removeItem('safescan_demo_session');
    return user;
  };

  const signInWithSimulatedPhoneOtp = async (
    phoneNumber: string,
    selectedRole: UserRole = 'user'
  ): Promise<void> => {
    // Generates a consistent test account for the verified phone number
    const sanitizedDigits = phoneNumber.replace(/[^0-9]/g, '');
    const simulatedUid = `phone-${sanitizedDigits || 'test-user'}`;
    const defaultRole: UserRole = selectedRole === 'admin' ? 'admin' : 'user';

    let account: UserAccount = {
      id: simulatedUid,
      name: `Member (${phoneNumber})`,
      email: `${sanitizedDigits}@phone.safescan.csp`,
      phone: phoneNumber,
      role: defaultRole,
      createdAt: new Date().toISOString(),
    };

    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', simulatedUid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const existing = snap.data() as UserAccount;
          account = {
            ...existing,
            id: simulatedUid,
            phone: phoneNumber,
            role: selectedRole === 'admin' ? 'admin' : (existing.role === 'admin' ? 'admin' : 'user'),
          };
        }
        await setDoc(userDocRef, account, { merge: true });
      } catch (err) {
        console.warn('Simulated phone user Firestore sync fallback:', err);
      }
    }

    setUserAccount(account);
    localStorage.setItem('safescan_demo_session', JSON.stringify(account));
  };

  const linkPhoneNumberToCurrentUser = async (
    confirmationResult: ConfirmationResult,
    verificationCode: string
  ): Promise<void> => {
    if (!currentUser) {
      throw new Error('No user is currently signed in to link phone number.');
    }
    const phoneCredential = PhoneAuthProvider.credential(
      confirmationResult.verificationId,
      verificationCode
    );

    await linkWithCredential(currentUser, phoneCredential);

    // Update firestore user profile
    const phoneNumber = currentUser.phoneNumber || undefined;
    if (phoneNumber) {
      await updateUserProfileData({ phone: phoneNumber });
    }
  };

  const updateUserProfileData = async (data: Partial<UserAccount>) => {
    if (!userAccount) return;
    const updated: UserAccount = {
      ...userAccount,
      ...data,
      id: currentUser?.uid || userAccount.id,
    };
    setUserAccount(updated);

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), updated, { merge: true });
      } catch (err) {
        console.warn('Failed to update user profile in Firestore:', err);
      }
    } else {
      localStorage.setItem('safescan_demo_session', JSON.stringify(updated));
    }
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
        phone: '+91 98765 43210',
        role: 'user',
        createdAt: new Date().toISOString(),
      },
      senior: {
        id: 'demo-user-id',
        name: 'Ravi Sharma (Member Account)',
        email: 'ravi.sharma.demo@safescan.csp',
        phone: '+91 98765 43210',
        role: 'user',
        createdAt: new Date().toISOString(),
      },
      caregiver: {
        id: 'demo-user-id',
        name: 'Ravi Sharma (Member Account)',
        email: 'ravi.sharma.demo@safescan.csp',
        phone: '+91 98765 43210',
        role: 'user',
        createdAt: new Date().toISOString(),
      },
      admin: {
        id: 'demo-admin-user-id',
        name: 'SafeScan CSP Administrator',
        email: 'admin.csp@safescan.org',
        phone: '+91 91234 56789',
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

  const loginWithCustomUser = (account: UserAccount) => {
    setUserAccount(account);
    localStorage.setItem('safescan_demo_session', JSON.stringify(account));
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
        signInWithEmail,
        registerWithEmail,
        setupRecaptcha,
        sendPhoneOtp,
        verifyPhoneOtp,
        signInWithSimulatedPhoneOtp,
        loginWithCustomUser,
        linkPhoneNumberToCurrentUser,
        switchDemoRole,
        logout,
        updateAccountRole,
        updateUserProfileData,
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
