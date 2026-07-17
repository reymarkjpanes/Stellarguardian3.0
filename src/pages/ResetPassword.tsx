import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * ResetPassword page — set a new password via reset token.
 * Route: /reset-password?token=<64-char-hex>
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Missing or invalid reset token. Please request a new link.');
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to reset password.');
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {success ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                aria-hidden="true"
              >
                <CheckCircle className="w-8 h-8 text-green-600" />
              </motion.div>
              <h1 className="text-xl font-display font-bold text-slate-900 mb-2">Password updated!</h1>
              <p className="text-slate-500 text-sm">
                Redirecting you to login in a moment…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                  <Lock className="w-6 h-6 text-indigo-600" />
                </div>
                <h1 className="text-xl font-display font-bold text-slate-900 mb-1">Set new password</h1>
                <p className="text-slate-500 text-sm">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="space-y-4 mb-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                      New password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      aria-required="true"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirm password
                    </label>
                    <input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      aria-required="true"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !password || !confirm || !token}
                  aria-busy={isLoading}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Updating…' : 'Update password'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-4">
                <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </main>
  );
}
