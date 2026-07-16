import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Button } from '../components/ui';
import { TrustChecklist } from '../components/TrustChecklist';
import { MailOpen } from 'lucide-react';

export default function InviteView() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    fetchApi(`/invites/${token}`)
      .then(data => setInvite(data.invite))
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetchApi(`/invites/${token}/accept`, { method: 'POST' });
      navigate(`/events/${res.eventId}`);
    } catch (err: any) {
      setError(err.message);
      setIsAccepting(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-slate-500">Loading invitation...</div>;

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 border border-red-200 rounded-xl shadow-sm text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Invalid Invitation</h2>
        <p className="text-slate-600">{error}</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate('/')}>Return Home</Button>
      </div>
    );
  }

  if (!invite) return null;

  const roleDisplay = invite.kind === 'event_judge' ? 'Judge' : 'Participant';
  
  // Create a mock trust checklist based on the event state fetched in the invite
  const trustData = {
    prizeFunded: invite.state !== 'Draft',
    organizerVerified: !!invite.organizerVerified,
    judgesAssigned: invite.state === 'Registration Open' || invite.state === 'Published',
    rulesPublished: !!invite.rulesPublished,
    timelineConfirmed: !!invite.timelineConfirmed
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 border border-slate-200 rounded-xl shadow-sm text-center">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <MailOpen className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">You're invited!</h2>
        <p className="text-slate-600 mb-6">
          <strong>{invite.inviterName}</strong> has invited you to join <strong>{invite.title}</strong> as a {roleDisplay}.
        </p>
        <div className="space-y-3">
          <Button className="w-full" onClick={() => navigate('/login', { state: { from: location } })}>
            Log in to Accept
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/signup', { state: { from: location } })}>
            Create an Account
          </Button>
        </div>
      </div>
    );
  }

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 border border-amber-200 rounded-xl shadow-sm text-center">
        <h2 className="text-xl font-semibold text-amber-700 mb-2">Email Mismatch</h2>
        <p className="text-slate-600 mb-6">
          This invitation was sent to <strong>{invite.email}</strong>, but you are logged in as <strong>{user.email}</strong>.
        </p>
        <Button variant="outline" onClick={() => navigate('/login', { state: { from: location } })}>
          Log in with different account
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <MailOpen className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Join {invite.title}</h2>
          <p className="text-lg text-slate-600">
            You have been invited to participate as a <strong>{roleDisplay}</strong>.
          </p>
        </div>
        
        <div className="p-8 bg-slate-50">
          <h3 className="font-semibold text-slate-900 mb-4">Event Overview</h3>
          <p className="text-slate-600 mb-6">{invite.description}</p>
          
          <TrustChecklist data={trustData} prizeTotal={invite.prizeTotal} className="mb-8 bg-white" />
          
          <Button className="w-full text-lg py-6" onClick={handleAccept} disabled={isAccepting}>
            {isAccepting ? 'Accepting...' : 'Accept & Join Event'}
          </Button>
        </div>
      </div>
    </div>
  );
}
