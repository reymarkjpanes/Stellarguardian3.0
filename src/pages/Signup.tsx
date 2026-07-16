import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Button, Input } from '../components/ui';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const data = await fetchApi('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      login(data.token, data.user);
      
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900">Create an account</h1>
        <p className="text-slate-500 mt-2">Join Stellar Guardian to host and join verified events</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}
        
        <Input 
          label="Full Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
        />
        <Input 
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
        <div className="relative">
          <Input 
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          {password && (
            <div className="mt-2 flex gap-1">
              <div className={`h-1 flex-1 rounded-full ${password.length > 0 ? (password.length > 5 ? 'bg-green-500' : 'bg-amber-500') : 'bg-slate-200'}`}></div>
              <div className={`h-1 flex-1 rounded-full ${password.length > 5 ? (password.length > 8 ? 'bg-green-500' : 'bg-amber-500') : 'bg-slate-200'}`}></div>
              <div className={`h-1 flex-1 rounded-full ${password.length > 8 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
            </div>
          )}
        </div>
        
        <Button type="submit" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Sign up'}
        </Button>
      </form>
      
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link>
      </p>
    </div>
  );
}
