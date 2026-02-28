import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 border-b border-vinyl-border bg-vinyl-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="text-2xl">🎵</span>
          <span className="text-vinyl-amber">Groovelog</span>
        </Link>

        <div className="flex items-center gap-6 text-sm text-vinyl-muted">
          <Link to="/discover" className="hover:text-vinyl-text transition-colors">Discover</Link>
          {user ? (
            <>
              <Link to="/" className="hover:text-vinyl-text transition-colors">Feed</Link>
              <Link to={`/profile/${user.username}`} className="hover:text-vinyl-text transition-colors">
                {user.username}
              </Link>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="hover:text-vinyl-text transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-vinyl-text transition-colors">Sign in</Link>
              <Link
                to="/register"
                className="rounded-full bg-vinyl-amber px-4 py-1.5 text-black font-medium hover:bg-vinyl-amber-light transition-colors"
              >
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
