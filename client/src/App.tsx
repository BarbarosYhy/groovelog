import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Discover from './pages/Discover';
import AlbumDetail from './pages/AlbumDetail';
import PlaylistDetail from './pages/PlaylistDetail';
import WriteReview from './pages/WriteReview';
import Profile from './pages/Profile';
import ListeningLists from './pages/ListeningLists';
import Login from './pages/Login';
import Register from './pages/Register';
import SpotifySuccess from './pages/SpotifySuccess';
import SpotifyError from './pages/SpotifyError';
import ReviewDetail from './pages/ReviewDetail';
import Settings from './pages/Settings';
import Search from './pages/Search';
import Friends from './pages/Friends';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, throwOnError: false },
    mutations: { throwOnError: false },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-vinyl-muted">
        Loading...
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/spotify-success" element={<SpotifySuccess />} />
            <Route path="/spotify-error" element={<SpotifyError />} />
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route path="/discover" element={<Discover />} />
              <Route
                path="/friends"
                element={
                  <ProtectedRoute>
                    <Friends />
                  </ProtectedRoute>
                }
              />
              <Route path="/search" element={<Search />} />
              <Route path="/album/:id" element={<AlbumDetail />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />
              <Route
                path="/review/new"
                element={
                  <ProtectedRoute>
                    <WriteReview />
                  </ProtectedRoute>
                }
              />
              <Route path="/review/:id" element={<ReviewDetail />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/lists/:username" element={<ListeningLists />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
