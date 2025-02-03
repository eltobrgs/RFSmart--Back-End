import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'seuSegredoJWT';

// Criar diretório de uploads caso não exista
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do multer
const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDir);
  },
  filename: (_, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Middleware para autenticação
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });
    
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Cadastro de Usuário
router.post("/cadastro", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const savedUser = await prisma.user.create({ data: { name, email, password: hash } });
    const token = jwt.sign({ userId: savedUser.id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: "Cadastro realizado com sucesso", token, user: { id: savedUser.id, name, email } });
  } catch (err) {
    res.status(500).json({ error: "Erro ao realizar cadastro" });
  }
});

// Login de Usuário
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Login bem-sucedido", token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Erro ao realizar login" });
  }
});

// Obter dados do usuário autenticado
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, name: true, email: true } });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar dados do usuário" });
  }
});

// Cadastro de Produtos
router.post("/produtos", authenticate, upload.fields([{ name: 'pdf' }, { name: 'video' }]), async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const pdfUrl = req.files['pdf'] ? `/uploads/${req.files['pdf'][0].filename}` : null;
    const videoUrl = req.files['video'] ? `/uploads/${req.files['video'][0].filename}` : null;
    
    const savedProduct = await prisma.product.create({
      data: { name, category, description, userId: req.user.userId, pdfUrl, videoUrl }
    });
    res.status(201).json({ message: "Produto cadastrado com sucesso", product: savedProduct });
  } catch (err) {
    res.status(500).json({ error: "Erro ao cadastrar produto" });
  }
});

// Listagem de Produtos
router.get("/produtos", authenticate, async (req, res) => {
  try {
    const products = await prisma.product.findMany({ where: { userId: req.user.userId } });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
});

// Detalhes de um Produto
router.get("/produtos/:id", authenticate, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar produto" });
  }
});

// Servindo arquivos estáticos
router.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

export default router;
