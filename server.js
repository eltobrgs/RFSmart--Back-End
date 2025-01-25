// server.js
import express from 'express';
import publicRoutes from './routes/public.js';
import privateRoutes from './routes/private.js';
import auth from './middlewares/auth.js';
import cors from 'cors';

const app = express();

app.use(express.json()); // Middleware que permite o uso de JSON
app.use(cors({ origin: '*' })); // Permite requisições de qualquer origem

app.use('/', publicRoutes);
app.use('/', auth, privateRoutes); // Rota privada com autenticação

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
