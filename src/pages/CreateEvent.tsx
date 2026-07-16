import React from 'react';
import EventWizard from '../components/EventWizard';

export default function CreateEvent() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-display font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            Launch Your Stellar Event
          </h1>
          <p className="mt-3 text-lg text-slate-500 font-sans">
            Design, schedule, fund, and host decentralized events backed by Stellar escrow security.
          </p>
        </div>
        
        <EventWizard />
      </div>
    </div>
  );
}
