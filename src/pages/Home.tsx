import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Trophy, Users, ArrowRight, Zap, Lock } from 'lucide-react';
import { Button } from '../components/ui';
import { motion } from 'motion/react';

export default function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col items-center min-h-[80vh] pt-12 pb-24">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center text-center max-w-4xl mx-auto px-4"
      >
        <motion.div variants={item} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50/80 text-indigo-700 text-sm font-semibold mb-8 border border-indigo-100 shadow-sm backdrop-blur-sm">
          <Shield className="w-4 h-4 text-indigo-500" /> Trusted on Stellar
        </motion.div>
        
        <motion.h1 variants={item} className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-slate-900 tracking-tight leading-[1.1] mb-6">
          A trust layer for <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            competition prize money.
          </span>
        </motion.h1>
        
        <motion.p variants={item} className="text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
          See a competition's prize money locked and verified on the blockchain before you apply — no more advertised prizes that turn out to be empty promises.
        </motion.p>
        
        <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link to="/public" className="w-full sm:w-auto">
            <Button className="w-full px-8 py-4 text-lg h-auto shadow-lg shadow-indigo-600/20 group">
              Browse Competitions
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link to="/events/create" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full px-8 py-4 text-lg h-auto border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50">
              Host an Event
            </Button>
          </Link>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 text-left border-t border-slate-100 pt-16 max-w-5xl mx-auto px-4 w-full"
      >
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="w-14 h-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-semibold text-xl text-slate-900 mb-3 font-display">Verified Escrow</h3>
          <p className="text-slate-600 leading-relaxed">Prizes are locked upfront using Stellar smart contracts. You can verify the funds before writing a single line of code.</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-100 transition-all">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="font-semibold text-xl text-slate-900 mb-3 font-display">Clear Roles</h3>
          <p className="text-slate-600 leading-relaxed">Organizers fund, Participants build, Judges review. A single unified account handles all roles seamlessly across different events.</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="w-14 h-14 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-amber-100 transition-all">
            <Zap className="w-7 h-7" />
          </div>
          <h3 className="font-semibold text-xl text-slate-900 mb-3 font-display">Guaranteed Payouts</h3>
          <p className="text-slate-600 leading-relaxed">Winners receive their prize money directly to their Freighter wallet the moment the Organizer confirms the results.</p>
        </div>
      </motion.div>
    </div>
  );
}
