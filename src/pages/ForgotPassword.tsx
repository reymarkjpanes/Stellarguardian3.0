import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

/**
 * ForgotPassword page — request a password reset email.
 * Route: /forgot-password
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Always show success to prevent user enumeration
      setSent(true);
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
          {sent ? (
            /* Success state */
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
              <h1 className="text-xl font-display font-bold text-slate-900 mb-2">Check your email</h1>
              <p className="text-slate-500 text-sm mb-6">
                If an account with <strong>{email}</strong> exists, we've sent a reset link. Check your spam folder too.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-700"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Back to login
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                  <Mail className="w-6 h-6 text-indigo-600" />
                </div>
                <h1 className="text-xl font-display font-bold text-slate-900 mb-1">Forgot password?</h1>
                <p className="text-slate-500 text-sm">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    aria-required="true"
                    aria-describedby={error ? 'email-error' : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  {error && (
                    <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600">
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  aria-busy={isLoading}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Sending…' : 'Send reset link'}
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
