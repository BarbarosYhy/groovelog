import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SpotifySuccess() {
  const navigate = useNavigate();
  const { login, token } = useAuth();

  useEffect(() => {
    const refresh = async () => {
      if (token) {
        try { await login(token); } catch { /* token still valid, user stays logged in */ }
      }
      const t = setTimeout(() => navigate('/'), 1500);
      return () => clearTimeout(t);
    };
    refresh();
  }, []);

  return (
    <div className="min-h-screen bg-vinyl-bg flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#1DB954]/20 mx-auto flex items-center justify-center">
          <svg className="w-8 h-8 text-[#1DB954]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-vinyl-text">Spotify Connected!</h2>
        <p className="text-vinyl-muted text-sm">Redirecting you home...</p>
      </div>
    </div>
  );
}
