// // server.js
// import express from 'express';
// import publicRoutes from './routes/public.js';
// import privateRoutes from './routes/private.js';
// import auth from './middlewares/auth.js';
// import cors from 'cors';

// const app = express();

// app.use(express.json()); // Middleware que permite o uso de JSON
// app.use(cors({ origin: '*' })); // Permite requisições de qualquer origem

// app.use('/', publicRoutes);
// app.use('/', auth, privateRoutes); // Rota privada com autenticação

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });


import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import publicRoutes from './routes/public.js';
import privateRoutes from './routes/private.js';
import auth from './middlewares/auth.js';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
// Carregar variáveis de ambiente
dotenv.config();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do Multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // Middleware que permite o uso de JSON
app.use(cors({ origin: '*' })); // Permite requisições de qualquer origem

// Rota pública
app.use('/', publicRoutes);

// Rota privada com autenticação
app.use('/', auth, privateRoutes);

// Rota de upload de arquivos
app.post('/upload', upload.fields([{ name: 'pdf' }, { name: 'image' }, { name: 'video' }]), async (req, res) => {
  try {
    const filePromises = [];

    // Envia os arquivos para o Supabase
    if (req.files['pdf']) {
      filePromises.push(uploadFileToSupabase(req.files['pdf'][0]));
    }
    if (req.files['image']) {
      filePromises.push(uploadFileToSupabase(req.files['image'][0]));
    }
    if (req.files['video']) {
      filePromises.push(uploadFileToSupabase(req.files['video'][0]));
    }

    const files = await Promise.all(filePromises);

    res.status(200).json({ message: 'Arquivos carregados com sucesso!', files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Função para enviar arquivo para o Supabase Storage
const uploadFileToSupabase = async (file) => {
  const { data, error } = await supabase.storage
    .from('uploads') // Nome do bucket
    .upload(`uploads/${Date.now()}-${file.originalname}`, file.buffer, {
      contentType: file.mimetype,
      upsert: false, // Se você quiser substituir arquivos existentes, altere para true
    });

  if (error) throw error;
  return data.path; // Retorna o caminho do arquivo no Supabase
};

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
