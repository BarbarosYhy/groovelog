import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
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
      const data = await authApi.login({ identifier, password });
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
    <div className="min-h-screen bg-vinyl-bg flex">
      {/* Decorative left panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-vinyl-surface items-center justify-center p-12 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 30% 50%, rgba(245,158,11,0.08) 0%, transparent 70%)' }}
        />
        <div className="relative text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-vinyl-amber mx-auto flex items-center justify-center text-black font-black text-3xl">
            G
          </div>
          <h2 className="text-3xl font-black text-vinyl-text">GROOVELOG</h2>
          <p className="text-vinyl-muted max-w-xs">Track, review, and discover albums with people who love music.</p>
        </div>
      </div>

      {/* Right panel: form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <div className="w-12 h-12 rounded-full bg-vinyl-amber mx-auto flex items-center justify-center text-black font-black text-xl mb-3">G</div>
            <p className="font-black text-vinyl-amber text-xl">GROOVELOG</p>
          </div>
          {/* Form card */}
          <div className="rounded-2xl border border-vinyl-border bg-vinyl-surface p-8 space-y-5">
            <h1 className="text-2xl font-bold text-vinyl-text">Sign in</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-vinyl-muted mb-1">Email or username</label>
                <input
                  type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full rounded-lg border border-vinyl-border bg-vinyl-card px-3 py-2 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none"
                  placeholder="your@email.com or username"
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
          </div>
          {/* Link outside the card */}
          <p className="text-center text-sm text-vinyl-muted">
            No account?{' '}
            <Link to="/register" className="text-vinyl-amber hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
