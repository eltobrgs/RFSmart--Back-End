import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// Endpoint de Cadastro ANTIGO SEM ROLE
// router.post("/cadastro", async (req, res) => {
//   try {
//     const user = req.body;
//     console.log("Dados do usuário recebidos:", user);

//     // Gerar hash da senha
//     const salt = await bcrypt.genSalt(10);
//     const hash = await bcrypt.hash(user.password, salt);

//     // Salvar usuário no banco de dados
//     const savedUser = await prisma.user.create({
//       data: {
//         name: user.name,
//         email: user.email,
//         password: hash,
//       },
//     });
//     console.log("Usuário salvo no banco de dados:", savedUser);

//     // Gerar o token JWT
//     const token = jwt.sign({ userId: savedUser.id }, JWT_SECRET, { expiresIn: '1h' });

//     // Retornar o token e dados do usuário (sem a senha)
//     res.status(201).json({
//       message: "Cadastro realizado com sucesso",
//       token: token,
//       user: {
//         id: savedUser.id,
//         name: savedUser.name,
//         email: savedUser.email,
//       },
//     });
//   } catch (err) {
//     console.error("Erro ao realizar cadastro:", err);
//     res.status(500).json({ error: "Erro ao realizar cadastro" });
//   }
// });

router.post("/cadastro", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Verifica se o role é válido
    if (role !== "USER" && role !== "VENDEDOR") {
      return res.status(400).json({ error: "Tipo de usuário inválido" });
    }

    // Gerar hash da senha
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Salvar usuário no banco de dados
    const savedUser = await prisma.user.create({
      data: { name, email, password: hash, role },
    });

    // Gerar token JWT
    const token = jwt.sign({ userId: savedUser.id, role: savedUser.role }, JWT_SECRET, { expiresIn: '1h' });

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
      select: { id: true, name: true, email: true, role:true }, // Campos retornados
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

//ANTIGO ENDPOINT DE CADASTRO DE PRODUTOS SEM ROLE
// router.post("/produtos", async (req, res) => {
//   try {
//     const { name, category, description } = req.body;
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({ error: "Token não fornecido" });
//     }

//     const token = authHeader.split(" ")[1];
//     const decoded = jwt.verify(token, JWT_SECRET);

//     // Salvar produto no banco de dados
//     const savedProduct = await prisma.product.create({
//       data: {
//         name,
//         category,
//         description,
//         userId: decoded.userId, // Associar o produto ao usuário
//       },
//     });

//     res.status(201).json({
//       message: "Produto cadastrado com sucesso",
//       product: savedProduct,
//     });
//   } catch (err) {
//     console.error("Erro ao cadastrar produto:", err);
//     res.status(500).json({ error: "Erro ao cadastrar produto" });
//   }
// });

// Endpoint de Cadastro de Produtos
router.post("/produtos", async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar usuário pelo ID para verificar o papel
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.role !== "VENDEDOR") {
      return res.status(403).json({ error: "Apenas vendedores podem cadastrar produtos" });
    }

    // Salvar produto no banco de dados
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

// Endpoint para listar cursos, agrupados por categoria
router.get("/cursos", async (req, res) => {
  try {
    // Busca todos os cursos cadastrados
    const courses = await prisma.product.findMany({});
    // Agrupa os cursos por categoria
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

// Endpoint para buscar detalhes de um curso específico
router.get("/cursos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const course = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!course) {
      return res.status(404).json({ error: "Curso não encontrado" });
    }
    
    res.status(200).json(course);
  } catch (err) {
    console.error("Erro ao buscar detalhes do curso:", err);
    res.status(500).json({ error: "Erro ao buscar detalhes do curso" });
  }
});

export default router;
