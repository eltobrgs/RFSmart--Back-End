# U-gym - Gerenciador de Treino Backend

[![Node.js](https://img.shields.io/badge/Node.js-16.x-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2.x-blue)](https://www.prisma.io/)

**U-gym Backend** é a API que suporta o aplicativo U-gym, projetado para ajudar os usuários a gerenciar seus treinos de maneira eficiente. O backend foi desenvolvido utilizando **Node.js**, **Express** e **Prisma ORM** para interagir com o banco de dados.

---

## 🚀 Funcionalidades (aida em desenvolvimento)

- 🔒 **Autenticação de usuários**: registre, faça login e gerencie a sessão do usuário.
- 📅 **Gerenciamento de treinos**: crie, edite, exclua e visualize treinos.
- 📊 **Estatísticas de treino**: calcule e forneça dados sobre o desempenho.
- 🧑‍💻 **Perfil de usuário**: armazene e edite informações pessoais como nome, foto e objetivos.
- 🛠️ **Integração com banco de dados**: utilize **Prisma ORM** para interagir com o banco de dados SQL de forma eficiente.

---

## 🛠️ Tecnologias Utilizadas

- **[Node.js](https://nodejs.org/)**: Plataforma para execução do JavaScript no servidor.
- **[Express](https://expressjs.com/)**: Framework para criação de APIs RESTful.
- **[Prisma](https://www.prisma.io/)**: ORM para interagir com o banco de dados de forma segura e eficiente.
- **[JWT](https://jwt.io/)**: Autenticação baseada em JSON Web Tokens.
- **[bcrypt](https://www.npmjs.com/package/bcrypt)**: Biblioteca para hashing de senhas de maneira segura.
- **[MongoDB/ banco de dados não relacional, também conhecido como NoSQL ](https://www.prisma.io/docs/concepts/database-connectors/postgresql)**: Banco de dados utilizado para armazenar dados do usuário e treinos.

---

## 🚀 Como Rodar o Projeto

1. Clone este repositório:
    ```bash
    git clone https://github.com/eltobrgs/Ugym-Backend.git
    cd Ugym-Backend
    ```

2. Instale as dependências:
    ```bash
    npm install
    ```

3. Configure o arquivo `.env` com as variáveis de ambiente:
    ```
    DATABASE_URL=URL de conexão com o banco de dados
    JWT_SECRET=Chave secreta para geração de tokens JWT
    ```

4. Gere e aplique as migrações do Prisma:
    ```bash
    npx prisma migrate dev
    ```

5. Inicie o servidor:
    ```bash
    npm run dev
    ```


