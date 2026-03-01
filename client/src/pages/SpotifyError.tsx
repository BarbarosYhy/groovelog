import { Link } from 'react-router-dom';

export default function SpotifyError() {
  return (
    <div className="min-h-screen bg-vinyl-bg flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-900/20 mx-auto flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-vinyl-text">Spotify connection failed</h2>
        <p className="text-vinyl-muted text-sm">You can try again from your profile settings.</p>
        <Link to="/" className="inline-block text-vinyl-amber hover:underline text-sm">Go home</Link>
      </div>
    </div>
  );
}
