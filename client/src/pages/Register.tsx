import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authApi.register(form);
      await login(data.token);
      navigate('/discover');
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-vinyl-bg">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl">🎵</span>
          <h1 className="mt-2 text-2xl font-bold text-vinyl-amber">Groovelog</h1>
          <p className="mt-1 text-vinyl-muted">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-vinyl-border bg-vinyl-surface p-6 space-y-4">
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
        <p className="mt-4 text-center text-sm text-vinyl-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-vinyl-amber hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
