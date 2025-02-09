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
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '5h' });

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
 * Rota de Cadastro de Módulo
 * POST /produtos/:productId/modules
 * Adiciona um novo módulo a um curso
 */
router.post("/produtos/:productId/modules", async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, description, order } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verifica se o produto pertence ao vendedor
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        userId: decoded.userId,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Produto não encontrado ou sem permissão" });
    }

    const module = await prisma.module.create({
      data: {
        name,
        description,
        order,
        productId,
      },
    });

    res.status(201).json(module);
  } catch (err) {
    console.error("Erro ao criar módulo:", err);
    res.status(500).json({ error: "Erro ao criar módulo" });
  }
});

/**
 * Rota de Cadastro de Aula
 * POST /modules/:moduleId/lessons
 * Adiciona uma nova aula a um módulo
 */
router.post("/modules/:moduleId/lessons", async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { name, description, videoUrl, order } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verifica se o módulo pertence a um produto do vendedor
    const module = await prisma.module.findFirst({
      where: {
        id: moduleId,
        product: {
          userId: decoded.userId,
        },
      },
    });

    if (!module) {
      return res.status(404).json({ error: "Módulo não encontrado ou sem permissão" });
    }

    const lesson = await prisma.lesson.create({
      data: {
        name,
        description,
        videoUrl,
        order,
        moduleId,
      },
    });

    res.status(201).json(lesson);
  } catch (err) {
    console.error("Erro ao criar aula:", err);
    res.status(500).json({ error: "Erro ao criar aula" });
  }
});

/**
 * Rota de Detalhes do Produto (Atualizada)
 * GET /product/:id
 * Retorna detalhes de um produto específico com seus módulos e aulas
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
        },
        modules: {
          orderBy: {
            order: 'asc'
          },
          include: {
            lessons: {
              orderBy: {
                order: 'asc'
              }
            }
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
 * Rota de Listagem de Cursos com Paginação e Filtros
 * GET /cursos
 * Query params:
 * - page: número da página (default: 1)
 * - limit: itens por página (default: 10)
 * - category: filtro por categoria
 * - search: busca por nome ou descrição
 * - sort: ordenação (recent, name_asc, name_desc)
 */
router.get("/cursos", async (req, res) => {
  try {
    console.log("Iniciando busca de cursos...");
    
    // Buscar todos os cursos com try/catch específico
    let courses;
    try {
      courses = await prisma.product.findMany({
        include: {
          user: {
            select: {
              name: true
            }
          },
          _count: {
            select: {
              modules: true
            }
          }
        }
      });
      console.log("Cursos encontrados:", courses);
    } catch (queryErr) {
      console.error("Erro na query:", queryErr);
      return res.status(500).json({ error: "Erro ao buscar cursos no banco" });
    }

    // Verificar se courses é um array válido
    if (!Array.isArray(courses)) {
      console.error("Resultado não é um array:", courses);
      return res.status(500).json({ error: "Formato de dados inválido" });
    }

    // Filtrar cursos sem userId e agrupar por categoria
    let coursesByCategory;
    try {
      // Filtrar apenas cursos válidos (com userId)
      const validCourses = courses.filter(course => course.userId);
      
      coursesByCategory = validCourses.reduce((acc, course) => {
        const category = course.category || 'Sem Categoria';
        if (!acc[category]) acc[category] = [];
        acc[category].push({
          ...course,
          modulesCount: course._count?.modules || 0
        });
        return acc;
      }, {});
      console.log("Cursos agrupados:", coursesByCategory);
    } catch (groupErr) {
      console.error("Erro ao agrupar cursos:", groupErr);
      return res.status(500).json({ error: "Erro ao processar dados dos cursos" });
    }

    // Retornar no formato antigo
    return res.status(200).json(coursesByCategory);
  } catch (err) {
    console.error("Erro detalhado ao listar cursos:", err);
    return res.status(500).json({ 
      error: "Erro ao listar cursos",
      details: err.message 
    });
  }
});

/**
 * Rota para buscar categorias disponíveis
 * GET /categorias
 * Retorna lista de categorias existentes
 */
router.get("/categorias", async (req, res) => {
  try {
    const categories = await prisma.product.findMany({
      select: {
        category: true
      },
      distinct: ['category']
    });

    res.json(categories.map(c => c.category));
  } catch (err) {
    console.error("Erro ao buscar categorias:", err);
    res.status(500).json({ error: "Erro ao buscar categorias" });
  }
});

export default router;
