import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export interface TeacherProfile {
  name: string;
  email: string;
  role: string;
  department_name?: string;
  [key: string]: any;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  teacherProfile: TeacherProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  teacherProfile: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'faculty', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data() as TeacherProfile;
            
            if (data.role === 'teacher') {
              setCurrentUser(user);
              setTeacherProfile(data);
            } else {
              await auth.signOut();
              setCurrentUser(null);
              setTeacherProfile(null);
            }
          } else {
            await auth.signOut();
            setCurrentUser(null);
            setTeacherProfile(null);
          }
        } catch (error) {
          console.error("Error fetching teacher profile:", error);
          await auth.signOut();
          setCurrentUser(null);
          setTeacherProfile(null);
        }
      } else {
        setCurrentUser(null);
        setTeacherProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, teacherProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
