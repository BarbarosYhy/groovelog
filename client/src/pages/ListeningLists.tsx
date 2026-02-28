import { useParams } from 'react-router-dom';

export default function ListeningLists() {
  const { username } = useParams<{ username: string }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-vinyl-text">{username}'s Lists</h1>
      <div className="grid gap-6 md:grid-cols-2">
        {['want', 'listened'].map((status) => (
          <div key={status} className="rounded-xl border border-vinyl-border bg-vinyl-surface p-5">
            <h2 className="font-semibold text-vinyl-text mb-4 capitalize">
              {status === 'want' ? '🎯 Want to Listen' : '✅ Listened'}
            </h2>
            <p className="text-vinyl-muted text-sm">Albums will appear here.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
