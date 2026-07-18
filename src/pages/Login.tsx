import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Button, Input } from '../components/ui';

export default function Login() {
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
      const data = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      // Modular authRouter returns { data: { accessToken, refreshToken, user } }
      const { accessToken, refreshToken, user: authUser } = data.data;
      login(accessToken, refreshToken, authUser);
      
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900">Welcome back</h1>
        <p className="text-slate-500 mt-2">Log in to your Stellar Guardian account</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}
        
        <Input 
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
        <Input 
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
        
        <Button type="submit" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Log in'}
        </Button>
      </form>
      
      <div className="mt-4 text-center">
        <Link to="/forgot-password" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">
          Forgot your password?
        </Link>
      </div>
      
      <p className="mt-4 text-center text-sm text-slate-600">
        Don't have an account? <Link to="/signup" className="font-medium text-indigo-600 hover:underline">Sign up</Link>
      </p>
    </div>
  );
}
