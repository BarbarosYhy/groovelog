import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authApi.login({ email, password });
      await login(data.token);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-vinyl-bg">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl">🎵</span>
          <h1 className="mt-2 text-2xl font-bold text-vinyl-amber">Groovelog</h1>
          <p className="mt-1 text-vinyl-muted">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-vinyl-border bg-vinyl-surface p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-vinyl-muted mb-1">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-vinyl-border bg-vinyl-card px-3 py-2 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-vinyl-muted mb-1">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-vinyl-border bg-vinyl-card px-3 py-2 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-vinyl-amber py-2.5 font-semibold text-black hover:bg-vinyl-amber-light disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-vinyl-muted">
          No account?{' '}
          <Link to="/register" className="text-vinyl-amber hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
