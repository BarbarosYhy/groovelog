import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import albumRoutes from './routes/albums';
import reviewRoutes from './routes/reviews';
import commentRoutes from './routes/comments';
import userRoutes from './routes/users';
import playlistRoutes from './routes/playlists';
import listeningRoutes from './routes/listening';
import spotifyRouter from './routes/spotify';
import friendsRouter from './routes/friends';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/listening', listeningRoutes);
app.use('/api/spotify', spotifyRouter);
app.use('/api/friends', friendsRouter);

export default app;
