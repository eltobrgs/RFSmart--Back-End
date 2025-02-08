import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Inicialização do router e conexão com banco de dados
const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// =============== AUTENTICAÇÃO ===============

/**
 * Rota de Cadastro de Usuários
 * POST /cadastro
 * Permite cadastro de usuários com roles específicos (USER ou VENDEDOR)
 */
router.post("/cadastro", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validação do tipo de usuário
    if (role !== "USER" && role !== "VENDEDOR") {
      return res.status(400).json({ error: "Tipo de usuário inválido" });
    }

    // Criptografia da senha
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Criação do usuário no banco
    const savedUser = await prisma.user.create({
      data: { name, email, password: hash, role },
    });

    // Geração do token JWT com role incluída
    const token = jwt.sign(
      { userId: savedUser.id, role: savedUser.role }, 
      JWT_SECRET, 
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: "Cadastro realizado com sucesso",
      token,
      user: { id: savedUser.id, name: savedUser.name, email: savedUser.email, role: savedUser.role },
    });
  } catch (err) {
    console.error("Erro ao realizar cadastro:", err);
    res.status(500).json({ error: "Erro ao realizar cadastro" });
  }
});

/**
 * Rota de Login
 * POST /login
 * Autentica usuário e retorna token JWT
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Busca usuário no banco
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Verifica senha
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    // Gera token JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '10m' });

    res.status(200).json({
      message: "Login bem-sucedido",
      token,
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

/**
 * Rota para Dados do Usuário
 * GET /me
 * Retorna dados do usuário autenticado
 */
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
      select: { id: true, name: true, email: true, role: true },
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

// =============== PRODUTOS ===============

/**
 * Rota de Cadastro de Produtos
 * POST /produtos
 * Permite que vendedores cadastrem novos produtos
 */
router.post("/produtos", async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verifica se o usuário é vendedor
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.role !== "VENDEDOR") {
      return res.status(403).json({ error: "Apenas vendedores podem cadastrar produtos" });
    }

    // Cadastra o produto
    const savedProduct = await prisma.product.create({
      data: {
        name,
        category,
        description,
        userId: user.id,
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

/**
 * Rota de Listagem de Produtos do Usuário
 * GET /produtos
 * Lista todos os produtos cadastrados pelo usuário
 */
router.get("/produtos", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const products = await prisma.product.findMany({
      where: { userId: decoded.userId },
    });

    res.status(200).json(products);
  } catch (err) {
    console.error("Erro ao listar produtos:", err);
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
});

/**
 * Rota de Detalhes do Produto
 * GET /product/:id
 * Retorna detalhes de um produto específico
 */
router.get("/product/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    res.status(200).json(product);
  } catch (err) {
    console.error("Erro ao buscar detalhes do produto:", err);
    res.status(500).json({ error: "Erro ao buscar detalhes do produto" });
  }
});

/**
 * Rota de Listagem de Cursos
 * GET /cursos
 * Lista todos os cursos agrupados por categoria
 */
router.get("/cursos", async (req, res) => {
  try {
    const courses = await prisma.product.findMany({});
    
    // Agrupa cursos por categoria
    const coursesByCategory = courses.reduce((acc, course) => {
      if (!acc[course.category]) acc[course.category] = [];
      acc[course.category].push(course);
      return acc;
    }, {});
    
    res.status(200).json(coursesByCategory);
  } catch (err) {
    console.error("Erro ao listar cursos:", err);
    res.status(500).json({ error: "Erro ao listar cursos" });
  }
});



export default router;
