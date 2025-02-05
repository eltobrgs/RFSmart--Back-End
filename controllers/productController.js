//controllers/productController.js
import { PrismaClient } from '@prisma/client';

import uploadProductFiles from '../helpers/uploadProductFiles';

const prisma = new PrismaClient();

async function createProduct(req, res) {
  try {
    const { name, category, description } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Criar o produto no banco de dados
    const product = await prisma.product.create({
      data: {
        name,
        category,
        description,
        userId: decoded.userId,
      },
    });

    // Acessa os arquivos enviados (por exemplo, com Multer ou outro middleware)
    const files = req.files; // Supondo que você esteja usando o Multer ou outro middleware para o upload de arquivos

    // Faz o upload dos arquivos
    await uploadProductFiles(product.id, files);

    res.status(201).json({
      message: 'Produto criado com sucesso!',
      product,
    });
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
}

export { createProduct };
