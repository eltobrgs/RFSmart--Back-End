import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// Configuração do multer para armazenar os arquivos temporariamente
const storage = multer.memoryStorage();
const upload = multer({ storage });

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

//services/supabaseclient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);


// Endpoint de Cadastro de Produto com Upload de Arquivos
router.post("/produtos", upload.fields([{ name: 'image' }, { name: 'video' }, { name: 'pdf' }]), async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const { video, pdf, image } = req.files;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Realizando o upload dos arquivos para o Supabase
    const videoUpload = await supabase
      .storage
      .from('videos') // Nome do bucket de vídeos
      .upload(`produtos/${Date.now()}_${video[0].originalname}`, video[0].buffer);

    const pdfUpload = await supabase
      .storage
      .from('pdfs') // Nome do bucket de PDFs
      .upload(`produtos/${Date.now()}_${pdf[0].originalname}`, pdf[0].buffer);

    const imageUpload = await supabase
      .storage
      .from('imagens') // Nome do bucket de imagens
      .upload(`produtos/${Date.now()}_${image[0].originalname}`, image[0].buffer);

    if (videoUpload.error || pdfUpload.error || imageUpload.error) {
      return res.status(500).json({ error: "Erro ao fazer upload dos arquivos" });
    }

    // Obtendo as URLs públicas dos arquivos
    const videoUrl = supabase
      .storage
      .from('videos')
      .getPublicUrl(videoUpload.data.path).publicURL;

    const pdfUrl = supabase
      .storage
      .from('pdfs')
      .getPublicUrl(pdfUpload.data.path).publicURL;

    const imageUrl = supabase
      .storage
      .from('imagens')
      .getPublicUrl(imageUpload.data.path).publicURL;

    // Salvar o produto no banco de dados com as URLs dos arquivos
    const savedProduct = await prisma.product.create({
      data: {
        name,
        category,
        description,
        userId: decoded.userId, // Associar o produto ao usuário
        videoUrl,
        pdfUrl,
        imageUrl,
      },
    });

    res.status(201).json({
      message: "Produto cadastrado com sucesso",
      product: savedProduct,
    });
  } catch (err) {
    console.error("Erro ao cadastrar produto:", err);
    res.status(500).json({ error: "Erro ao cadastrar produto" });
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
