import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, Wallet, Menu, X } from 'lucide-react';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }} />
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 group" onClick={() => setMobileMenuOpen(false)}>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
                  <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-[spin_2s_linear_infinite]"></div>
                </div>
                <span className="font-display text-xl font-bold tracking-tight text-slate-900">
                  Stellar <span className="text-indigo-600">Guardian</span>
                </span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/public" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Browse Events
              </Link>
              
              {user ? (
                <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
                  <Link to="/dashboard" className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                    My Events
                  </Link>
                  <Link to="/events/create" className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                    Create Event
                  </Link>
                  
                  <div className="relative ml-4">
                    <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold uppercase ring-2 ring-transparent focus:ring-slate-200 hover:ring-slate-200 transition-all focus:outline-none" aria-label="User menu" aria-expanded={profileMenuOpen} aria-haspopup="true">
                      {user.name.charAt(0)}
                    </button>
                    {profileMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl transition-all origin-top-right transform z-50">
                          <div className="p-4 border-b border-slate-100">
                            <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                          </div>
                          <div className="p-1">
                            <Link to="/settings" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors focus:bg-slate-50 focus:outline-none">
                              <Wallet className="w-4 h-4 text-slate-400" />
                              Wallet Settings
                            </Link>
                            <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left rounded-md transition-colors mt-1 focus:bg-red-50 focus:outline-none">
                              <LogOut className="w-4 h-4 text-red-400" />
                              Sign Out
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    Log in
                  </Link>
                  <Link to="/signup" className="text-sm font-semibold bg-slate-900 text-white px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                    Sign up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button 
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                aria-expanded={mobileMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-b border-slate-200 overflow-hidden bg-white"
            >
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <Link 
                  to="/public" 
                  className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Browse Events
                </Link>
                
                {user ? (
                  <>
                    <Link 
                      to="/dashboard" 
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      My Events
                    </Link>
                    <Link 
                      to="/events/create" 
                      className="block px-3 py-2 rounded-md text-base font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Create Event
                    </Link>
                    
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center px-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold uppercase">
                          {user.name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="text-base font-medium text-slate-800">{user.name}</div>
                          <div className="text-sm font-medium text-slate-500">{user.email}</div>
                        </div>
                      </div>
                      
                      <Link 
                        to="/settings" 
                        className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Wallet Settings
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                    <Link 
                      to="/login" 
                      className="block w-full text-center px-4 py-2 border border-slate-300 shadow-sm text-base font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log in
                    </Link>
                    <Link 
                      to="/signup" 
                      className="block w-full text-center px-4 py-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Stellar Guardian. Powered by Stellar.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Terms</a>
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
