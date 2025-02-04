import express from 'express';
import publicRoutes from './routes/public.js';
import privateRoutes from './routes/private.js';
import auth from './middlewares/auth.js';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(express.json());
app.use(cors({ origin: '*' }));

// Middleware para injetar Supabase
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

app.use('/', publicRoutes);
app.use('/', auth, privateRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});