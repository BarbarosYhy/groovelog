import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

const queryClient = new QueryClient();

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/lists/:username" element={<ListeningLists />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
