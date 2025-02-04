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

// Configuração do Multer
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

// Conexão com GridFS
let bucket;
mongoose.connection.on('open', () => {
    bucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    });
});

// Função para upload de arquivo
const uploadFileToGridFS = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        
        const uploadStream = bucket.openUploadStream(file.originalname, {
            metadata: {
                mimetype: file.mimetype,
                uploadDate: new Date()
            }
        });

        uploadStream.on('error', reject);
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.end(file.buffer);
    });
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






// Rota de cadastro de produto
router.post('/produtos', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
      const { name, category, description } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      // Upload dos arquivos
      const files = req.files;
      const fileIds = {};

      if (files) {
          for (const fileType of ['pdf', 'image', 'video']) {
              if (files[fileType] && files[fileType][0]) {
                  fileIds[fileType] = await uploadFileToGridFS(files[fileType][0]);
              }
          }
      }

      // Criação do produto no banco
      const product = await prisma.product.create({
          data: {
              name,
              category,
              description,
              userId: decoded.userId,
              pdfId: fileIds.pdf || null,
              imageId: fileIds.image || null,
              videoId: fileIds.video || null
          }
      });

      res.status(201).json({
          message: 'Produto cadastrado com sucesso',
          product: {
              ...product,
              pdfUrl: fileIds.pdf ? `/arquivos/${fileIds.pdf}` : null,
              imageUrl: fileIds.image ? `/arquivos/${fileIds.image}` : null,
              videoUrl: fileIds.video ? `/arquivos/${fileIds.video}` : null
          }
      });
  } catch (error) {
      console.error('Erro no cadastro:', error);
      res.status(500).json({ 
          error: 'Erro ao cadastrar produto',
          details: error.message
      });
  }
});

// Rota para buscar arquivos
router.get('/arquivos/:id', async (req, res) => {
  try {
      const fileId = new mongoose.Types.ObjectId(req.params.id);
      const file = await bucket.find({ _id: fileId }).toArray();
      
      if (!file || file.length === 0) {
          return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      res.set('Content-Type', file[0].metadata.mimetype);
      const downloadStream = bucket.openDownloadStream(fileId);
      downloadStream.pipe(res);
  } catch (error) {
      console.error('Erro ao recuperar arquivo:', error);
      res.status(500).json({ error: 'Erro ao recuperar arquivo' });
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



export default router;