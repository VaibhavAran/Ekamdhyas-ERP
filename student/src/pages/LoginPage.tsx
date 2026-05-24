import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, User as UserIcon } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import type { User } from '../types';
import { getUserById, getUserByEmail, loginWithEmail } from '../lib/firebaseService';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const getAuthErrorMessage = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Account not found. Please register first.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/invalid-password':
        return 'Password must be at least 6 characters.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return error.message || 'Unable to authenticate. Please check your email and password.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to authenticate. Please check your email and password.';
};

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const firebaseUser = await loginWithEmail(email, password);

      // Prefer lookup by UID
      let student = null;
      if (firebaseUser.uid) {
        student = await getUserById(firebaseUser.uid);
      }

      // Fallback: lookup by email
      if (!student) {
        student = await getUserByEmail(firebaseUser.email || email);
      }

      if (!student) {
        setErrorMessage('Student account not found');
        return;
      }

      if (student.role !== 'student') {
        setErrorMessage('Unauthorized account');
        return;
      }

      if (student.status && student.status !== 'active') {
        setErrorMessage('Student account is not active');
        return;
      }

      // session persistence handled by onAuthStateChanged; no localStorage
      onLogin(student);
    } catch (error: unknown) {
      console.error('Authentication error:', error);
      // Normalize common auth errors
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          setErrorMessage('Invalid email or password');
        } else {
          setErrorMessage(getAuthErrorMessage(error));
        }
      } else {
        setErrorMessage(getAuthErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl shadow-blue-100/50 p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/5 rounded-full -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-6">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Student Panel</h1>
          <p className="text-gray-500 text-center text-sm mb-8">
            P.E.S. College of Engineering, Chh. Sambhajinagar
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {errorMessage && (
              <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                {errorMessage}
              </div>
            )}
            {/* Only login is allowed for students; registration removed */}

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@pescoe.ac.in"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all duration-200 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all duration-200 text-sm font-medium"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <>
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs font-bold text-gray-500 group-hover:text-gray-700">Remember me</span>
                </label>
                <a href="#" className="text-xs font-bold text-blue-600 hover:underline">Forgot?</a>
              </div>
            </>

            <button
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group mt-2"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Login
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-xs font-medium text-gray-400 flex items-center gap-2 text-center px-4">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Secure authentication for P.E.S. College Students
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
