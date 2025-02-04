import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { GridFSBucket } from 'mongodb';
import mongoose from 'mongoose';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// Configuração do Multer para armazenar arquivos na memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Conectar ao GridFS
const conn = mongoose.connection;
let bucket;
conn.once("open", () => {
  bucket = new GridFSBucket(conn.db, { bucketName: "uploads" });
});

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







// Endpoint para cadastrar produto com upload de arquivos
router.post("/produtos", upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("Requisição recebida:", req.body);
    console.log("Arquivos recebidos:", req.files);

    const { name, category, description } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    let fileIds = {};
    for (const fileKey of ["pdf", "image", "video"]) {
      if (req.files[fileKey]) {
        const file = req.files[fileKey][0];
        const uploadStream = bucket.openUploadStream(file.originalname);
        uploadStream.end(file.buffer);

        console.log(`Arquivo ${fileKey} salvo com ID:`, uploadStream.id);
        fileIds[fileKey] = uploadStream.id.toString();
      }
    }

    console.log("Salvando produto no banco:", { name, category, description, fileIds });

    const savedProduct = await prisma.product.create({
      data: {
        name,
        category,
        description,
        userId: decoded.userId,
        pdfId: fileIds.pdf || null,
        imageId: fileIds.image || null,
        videoId: fileIds.video || null,
      },
    });

    console.log("Produto cadastrado com sucesso:", savedProduct);
    res.status(201).json({
      message: "Produto cadastrado com sucesso",
      product: savedProduct,
    });
  } catch (err) {
    console.error("Erro ao cadastrar produto:", err);
    res.status(500).json({ error: "Erro ao cadastrar produto", details: err.message });
  }
});


// Endpoint para recuperar produto com arquivos
router.get("/produtos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    res.status(200).json({
      ...product,
      pdfUrl: product.pdfId ? `/arquivos/${product.pdfId}` : null,
      imageUrl: product.imageId ? `/arquivos/${product.imageId}` : null,
      videoUrl: product.videoId ? `/arquivos/${product.videoId}` : null,
    });
  } catch (err) {
    console.error("Erro ao buscar produto:", err);
    res.status(500).json({ error: "Erro ao buscar produto" });
  }
});

// Endpoint para recuperar arquivos
router.get("/arquivos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id));
    downloadStream.pipe(res);
  } catch (err) {
    console.error("Erro ao recuperar arquivo:", err);
    res.status(500).json({ error: "Erro ao recuperar arquivo" });
  }
});

export default router;