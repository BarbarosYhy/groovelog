import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-vinyl-text font-medium'
      : 'text-vinyl-muted hover:text-vinyl-text';

  return (
    <nav className="sticky top-0 z-50 border-b border-vinyl-border/60 bg-vinyl-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-vinyl-amber flex items-center justify-center text-black font-black text-sm shrink-0">
            G
          </div>
          <span className="text-lg font-black tracking-tight text-vinyl-text group-hover:text-vinyl-amber transition-colors">
            GROOVELOG
          </span>
        </Link>

        <div className="flex items-center gap-8 text-sm">
          <Link to="/discover" className={`transition-colors ${isActive('/discover')}`}>Discover</Link>
          {user && (
            <Link to="/" className={`transition-colors ${isActive('/')}`}>Feed</Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to={`/profile/${user.username}`}
                className="flex items-center gap-2 rounded-full border border-vinyl-border px-3 py-1.5 text-sm hover:border-vinyl-amber/50 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-vinyl-amber/20 flex items-center justify-center text-vinyl-amber text-xs font-bold shrink-0">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-vinyl-text">{user.username}</span>
              </Link>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="text-sm text-vinyl-muted hover:text-vinyl-text transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-vinyl-muted hover:text-vinyl-text transition-colors">
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-vinyl-amber px-4 py-1.5 text-sm text-black font-semibold hover:bg-vinyl-amber-light transition-colors"
              >
                Join free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
