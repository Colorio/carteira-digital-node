# Carteira Digital

Aplicação de carteira digital desenvolvida como projeto de desafio técnico, com funcionalidades de consulta de saldo, depósitos, transferências entre usuários e estornos de transações.

O projeto utiliza NestJS no backend e Next.js no frontend.

## Funcionalidades

- **Autenticação de usuários:** acesso à aplicação por meio de autenticação.
- **Carteira digital:** consulta de saldo disponível.
- **Depósitos:** adição de valores à carteira.
- **Transferências:** envio de valores entre usuários.
- **Histórico de transações:** visualização das movimentações realizadas.
- **Estornos:** possibilidade de reverter operações respeitando as regras de negócio.
- **Auditoria:** registro das operações financeiras realizadas.

## Regras de negócio

- Não é permitido realizar transferências com saldo insuficiente.
- As operações financeiras utilizam transações no banco de dados para evitar inconsistências em caso de falhas.
- Depósitos só podem ser estornados quando houver saldo suficiente para devolver o valor.
- Transferências só podem ser estornadas em até 5 minutos após sua realização.
- Uma transação não pode ser estornada mais de uma vez.
- As operações são registradas em logs de auditoria, incluindo informações sobre o usuário responsável e os dados da movimentação.
- Caso ocorra uma falha no registro de auditoria, a operação financeira também é desfeita.

## Tecnologias utilizadas

### Backend
- Node.js
- NestJS 12
- TypeScript
- Prisma 7
- PostgreSQL 17
- JWT

### Frontend
- Next.js 16
- React 19
- TypeScript
- SweetAlert2

### Ambiente e ferramentas
- Docker
- Docker Compose
- NPM

## Como executar o projeto

### Pré-requisitos

Antes de começar, é necessário ter instalado:

- Node.js
- NPM
- Docker e Docker Compose

### 1. Clonar o repositório

```bash
git clone https://github.com/Colorio/carteira-digital-node.git

cd carteira-digital-node
```

### 2. Configurar o banco de dados

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Inicie o PostgreSQL:

```bash
docker compose up -d
```

### 3. Instalar e configurar o backend

Entre na pasta do backend:

```bash
cd backend
npm install
```

Configure o arquivo `.env` com a conexão do PostgreSQL:

```env
DATABASE_URL="postgresql://carteira:defina_sua_senha@localhost:5432/carteira_digital?schema=public"
```

Execute as migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

Para popular o banco com dados de demonstração:

```bash
npx prisma db seed
```

### 4. Executar o backend

```bash
npm run start:dev
```

O backend ficará disponível em:

http://localhost:3000

### 5. Instalar e executar o frontend

Em outro terminal, na raiz do projeto:

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

A aplicação ficará disponível em:

http://localhost:3001

## Executando os testes

Na pasta `backend`, para executar toda a suíte de testes:

```bash
npm test
```

Para executar os testes de integração:

```bash
npm run test:e2e
```

## Encerrando a aplicação

Para parar o backend e o frontend, utilize `Ctrl + C` nos respectivos terminais.

Para parar os containers:

```bash
docker compose down
```

Para parar os containers e remover também os volumes do banco de dados:

```bash
docker compose down -v
```

**Atenção:** o segundo comando remove os dados persistidos no banco de dados.

---

Desenvolvido como projeto de desafio técnico.