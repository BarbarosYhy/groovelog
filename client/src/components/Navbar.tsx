import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-vinyl-text font-semibold'
      : 'text-vinyl-muted hover:text-vinyl-text';

  return (
    <nav className="sticky top-0 z-50 border-b border-vinyl-border/60 bg-vinyl-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-8 h-8 rounded-full bg-vinyl-amber flex items-center justify-center text-black font-black text-sm shrink-0">
            G
          </div>
          <span className="text-lg font-black tracking-tight text-vinyl-text group-hover:text-vinyl-amber transition-colors">
            GROOVELOG
          </span>
        </Link>

        {/* Center nav tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-vinyl-border/50 bg-vinyl-surface/50 p-1">
          {user && (
            <Link
              to="/"
              className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${
                location.pathname === '/'
                  ? 'bg-vinyl-card text-vinyl-text font-semibold shadow-sm'
                  : 'text-vinyl-muted hover:text-vinyl-text'
              }`}
            >
              Feed
            </Link>
          )}
          <Link
            to="/discover"
            className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${
              location.pathname === '/discover'
                ? 'bg-vinyl-card text-vinyl-text font-semibold shadow-sm'
                : 'text-vinyl-muted hover:text-vinyl-text'
            }`}
          >
            Discover
          </Link>
          <Link
            to="/search"
            className={`rounded-lg px-4 py-1.5 text-sm transition-colors flex items-center gap-1.5 ${
              location.pathname === '/search'
                ? 'bg-vinyl-card text-vinyl-text font-semibold shadow-sm'
                : 'text-vinyl-muted hover:text-vinyl-text'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
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
              <Link
                to="/settings"
                title="Settings"
                className="p-1.5 text-vinyl-muted hover:text-vinyl-text transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
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
