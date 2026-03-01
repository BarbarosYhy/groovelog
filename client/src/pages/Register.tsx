import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { spotifyApi } from '../api/spotify';

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authApi.register(form);
      await login(data.token);
      setRegistered(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  if (registered) {
    return (
      <div className="min-h-screen bg-vinyl-bg flex items-center justify-center p-8">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/30 mx-auto flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#1DB954]">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-black text-vinyl-text">Connect Spotify</h2>
            <p className="text-vinyl-muted mt-2 text-sm">
              Link your Spotify account to auto-fill listen dates when you write reviews.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => spotifyApi.connect()}
              className="w-full rounded-2xl bg-[#1DB954] py-3 font-semibold text-black hover:bg-[#1ed760] transition-colors"
            >
              Connect Spotify
            </button>
            <button
              onClick={() => navigate('/discover')}
              className="w-full text-sm text-vinyl-muted hover:text-vinyl-text transition-colors py-2"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
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
            <h1 className="text-2xl font-bold text-vinyl-text">Create account</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">{error}</div>}
              {[
                { label: 'Email', key: 'email' as const, type: 'email', placeholder: 'you@example.com' },
                { label: 'Username', key: 'username' as const, type: 'text', placeholder: 'cooluser123' },
                { label: 'Password', key: 'password' as const, type: 'password', placeholder: '8+ characters' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-vinyl-muted mb-1">{label}</label>
                  <input
                    type={type} required {...field(key)} placeholder={placeholder}
                    className="w-full rounded-lg border border-vinyl-border bg-vinyl-card px-3 py-2 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none"
                  />
                </div>
              ))}
              <button
                type="submit" disabled={loading}
                className="w-full rounded-lg bg-vinyl-amber py-2.5 font-semibold text-black hover:bg-vinyl-amber-light disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          </div>
          {/* Link outside the card */}
          <p className="text-center text-sm text-vinyl-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-vinyl-amber hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
