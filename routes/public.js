import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do Multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Função para enviar arquivo para o Supabase Storage
const uploadFileToSupabase = async (file) => {
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(`uploads/${Date.now()}-${file.originalname}`, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) throw error;
  return data.path; // Retorna o caminho do arquivo no Supabase
};
// Endpoint de Cadastro
router.post("/cadastro", async (req, res) => {
  try {
    const user = req.body;
    console.log("Dados do usuário recebidos:", user);

    // Gerar hash da senha
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(user.password, salt);

    // Salvar usuário no banco de dados
    const savedUser = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: hash,
      },
    });
    console.log("Usuário salvo no banco de dados:", savedUser);

    // Gerar o token JWT
    const token = jwt.sign({ userId: savedUser.id }, JWT_SECRET, { expiresIn: '1h' });

    // Retornar o token e dados do usuário (sem a senha)
    res.status(201).json({
      message: "Cadastro realizado com sucesso",
      token: token,
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
      },
    });
  } catch (err) {
    console.error("Erro ao realizar cadastro:", err);
    res.status(500).json({ error: "Erro ao realizar cadastro" });
  }
});

// Endpoint de Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Tentativa de login com email:", email);

    // Buscar usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log("Usuário não encontrado:", email);
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Verificar senha
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Senha incorreta para o usuário:", email);
      return res.status(401).json({ error: "Senha incorreta" });
    }

    // Gerar o token JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '10m' });

    res.status(200).json({
      message: "Login bem-sucedido",
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Erro ao realizar login:", err);
    res.status(500).json({ error: "Erro ao realizar login" });
  }
});

// Endpoint para buscar dados do usuário
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true }, // Campos retornados
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Erro ao buscar dados do usuário:", err);
    res.status(500).json({ error: "Erro ao buscar dados do usuário" });
  }
});

// Endpoint para cadastrar produtos com arquivos
router.post('/produtos', upload.fields([{ name: 'pdf' }, { name: 'image' }, { name: 'video' }]), async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Enviar arquivos para o Supabase
    const filePromises = [];

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

    // Criar produto no banco de dados
    const savedProduct = await prisma.product.create({
      data: {
        name,
        category,
        description,
        userId: decoded.userId, // Associar o produto ao usuário
        files: files, // Armazenar os caminhos dos arquivos
      },
    });

    res.status(201).json({
      message: 'Produto cadastrado com sucesso',
      product: savedProduct,
    });
  } catch (err) {
    console.error('Erro ao cadastrar produto:', err);
    res.status(500).json({ error: 'Erro ao cadastrar produto' });
  }
});

// Endpoint de Listagem de Produtos
router.get("/produtos", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar produtos do usuário
    const products = await prisma.product.findMany({
      where: { userId: decoded.userId },
    });

    res.status(200).json(products);
  } catch (err) {
    console.error("Erro ao listar produtos:", err);
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
});

export default router;
