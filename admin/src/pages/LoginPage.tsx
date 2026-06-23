import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { writeAuthFlag } from '../utils/authStorage'
import illustrationImage from '../assets/illustration.jpg'
import { FiLock, FiUser, FiArrowRight, FiShield } from 'react-icons/fi'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // 1. Check controllers collection first (new system)
      let q = query(
        collection(db, 'controllers'),
        where('username', '==', username.trim().toLowerCase())
      );
      let querySnapshot = await getDocs(q);
      let userData: any = null;
      let userType = 'controller';

      // 2. If not found in controllers, check admins collection (backward compatibility)
      if (querySnapshot.empty) {
        q = query(
          collection(db, 'admins'),
          where('username', '==', username.trim().toLowerCase())
        );
        querySnapshot = await getDocs(q);
        userType = 'admin';
      }

      if (querySnapshot.empty) {
        setError('Invalid username or password.');
        setIsLoading(false);
        return;
      }

      userData = querySnapshot.docs[0].data();

      if (userData.password === password) {
        writeAuthFlag(true)
        localStorage.setItem('controller-username', userData.username);
        navigate(redirectTo, { replace: true })
      } else {
        setError('Invalid username or password.');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      const errorMessage = err?.message || 'System error. Please try again later.';
      setError(errorMessage);
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-['Plus_Jakarta_Sans'] relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
      <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '4s' }}></div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden relative z-10 transition-all duration-500 hover:shadow-blue-900/20 hover:border-slate-600/50">

        {/* Left Side: Graphic / Branding */}
        <section className="hidden lg:flex flex-col items-center justify-center p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] z-0"></div>

          <div className="relative z-10 text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 mb-6 border border-blue-500/30 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
              <FiShield className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tight leading-tight mb-4">
              Image Based <br /> Attendance System
            </h1>
            <p className="text-slate-400 text-lg max-w-md mx-auto">
              Advanced school management panel. Monitor and manage real-time visual attendance records securely.
            </p>
          </div>

          <div className="relative z-10 w-80 h-80 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl p-4 bg-slate-800/50 backdrop-blur-sm group">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <img
              src={illustrationImage}
              alt="Attendance System"
              className="w-full h-full object-cover rounded-xl transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
            />
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="p-8 md:p-16 flex flex-col justify-center bg-slate-900/80 backdrop-blur-xl z-10">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-10 text-center lg:text-left">
              <span className="inline-block py-1 px-3 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold tracking-wider uppercase mb-4 border border-blue-500/20">
                Secure Access
              </span>
              <h2 className="text-3xl font-bold text-white mb-2">School Sign In</h2>
              <p className="text-slate-400">Enter your credentials to access the command center.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-slate-300 ml-1">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <FiUser className="w-5 h-5" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    placeholder="e.g. controller"
                    disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
                  <a href="#" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors hover:underline">Forgot password?</a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <FiLock className="w-5 h-5" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-[pulse_1s_ease-in-out]">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  <p className="text-sm text-red-400 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-blue-600/25 group relative overflow-hidden"
              >
                {/* Button shine effect */}
                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-[shine_1.5s]"></div>

                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <span>Enter Command Center</span>
                    <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="pt-6 text-center">
                <p className="text-xs text-slate-500">
                  Protected by standard encryption. Authorized personnel only.
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes shine {
          100% {
            left: 200%;
          }
        }
      `}</style>
    </main>
  )
}
