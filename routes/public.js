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
    const { name, category, description, whatsapp } = req.body;
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
        whatsapp, // Armazena o link diretamente
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
 * Rota para gerenciar acesso de usuários ao curso
 * POST /produtos/:productId/access
 */
router.post("/produtos/:productId/access", async (req, res) => {
  try {
    const { productId } = req.params;
    const { userId, action } = req.body;
    
    if (action === 'grant') {
      // Adiciona o ID do curso aos cursos acessíveis do usuário
      await prisma.user.update({
        where: { id: userId },
        data: {
          accessibleCourseIds: {
            push: productId
          }
        }
      });
      
      // Adiciona o ID do usuário à lista de usuários com acesso ao curso
      await prisma.product.update({
        where: { id: productId },
        data: {
          userAccessIds: {
            push: userId
          }
        }
      });
    } else if (action === 'revoke') {
      // Remove o ID do curso dos cursos acessíveis do usuário
      await prisma.user.update({
        where: { id: userId },
        data: {
          accessibleCourseIds: {
            set: {
              accessibleCourseIds: {
                filter: id => id !== productId
              }
            }
          }
        }
      });
      
      // Remove o ID do usuário da lista de usuários com acesso ao curso
      await prisma.product.update({
        where: { id: productId },
        data: {
          userAccessIds: {
            set: {
              userAccessIds: {
                filter: id => id !== userId
              }
            }
          }
        }
      });
    }

    res.status(200).json({ message: "Acesso atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao gerenciar acesso:", err);
    res.status(500).json({ error: "Erro ao gerenciar acesso" });
  }
});

/**
 * Rota para listar usuários com acesso ao curso
 * GET /produtos/:productId/users
 */
router.get("/produtos/:productId/users", async (req, res) => {
  try {
    const { productId } = req.params;
    const users = await prisma.user.findMany({
      where: {
        role: "USER",
        accessibleCourseIds: {
          has: productId
        }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    res.status(200).json(users);
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
    res.status(500).json({ error: "Erro ao listar usuários" });
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
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const courses = await prisma.product.findMany({
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    // Separar cursos por acesso
    const availableCourses = {};
    const unavailableCourses = {};

    courses.forEach(course => {
      const hasAccess = course.userAccessIds.includes(decoded.userId);
      const category = course.category || 'Sem Categoria';
      
      const courseData = {
        ...course,
        hasAccess,
        whatsapp: course.whatsapp
      };
      
      if (hasAccess) {
        if (!availableCourses[category]) availableCourses[category] = [];
        availableCourses[category].push(courseData);
      } else {
        if (!unavailableCourses[category]) unavailableCourses[category] = [];
        unavailableCourses[category].push(courseData);
      }
    });

    res.status(200).json({
      available: availableCourses,
      unavailable: unavailableCourses
    });
  } catch (err) {
    console.error("Erro ao listar cursos:", err);
    res.status(500).json({ error: "Erro ao listar cursos" });
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

/**
 * Rota para listar todos os usuários
 * GET /usuarios
 */
router.get("/usuarios", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: "USER" // Filtra apenas usuários comuns
      },
      select: {
        id: true,
        name: true,
        email: true,
        accessibleCourseIds: true // Para verificar se o usuário tem acesso ao curso
      }
    });

    res.status(200).json(users);
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});


/**
 * Rota para deletar um curso específico
 * DELETE /produtos/:id
 */
router.delete("/produtos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Deletar todas as lições associadas ao curso
    await prisma.lesson.deleteMany({
      where: {
        module: {
          productId: id // Deleta lições que pertencem aos módulos do curso
        }
      }
    });

    // Deletar todos os módulos associados ao curso
    await prisma.module.deleteMany({
      where: {
        productId: id // Deleta módulos que pertencem ao curso
      }
    });

    // Deletar o curso
    await prisma.product.delete({
      where: { id }
    });

    res.status(200).json({ message: "Curso, módulos e lições deletados com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar curso:", err);
    res.status(500).json({ error: "Erro ao deletar curso" });
  }
});

export default router;
