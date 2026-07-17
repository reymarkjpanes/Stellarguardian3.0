import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Rocket } from 'lucide-react';

/**
 * NotFound page — styled 404 with navigation CTAs.
 * Route: catch-all /* at App level.
 */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center px-4"
      aria-label="Page not found"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="text-center max-w-md"
      >
        {/* Giant 404 */}
        <p
          className="text-[9rem] leading-none font-display font-black select-none"
          style={{ color: 'rgba(99,102,241,0.12)' }}
          aria-hidden="true"
        >
          404
        </p>

        {/* Floating star */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-5xl mb-6 -mt-8"
          aria-hidden="true"
        >
          ⭐
        </motion.div>

        <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">
          Page not found
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go back
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Home
          </button>
          <button
            onClick={() => navigate('/public')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aurora-500 text-white text-sm font-medium hover:bg-aurora-600 transition-colors"
          >
            <Rocket className="w-4 h-4" aria-hidden="true" />
            Browse Events
          </button>
        </div>
      </motion.div>
    </main>
  );
}
