# 🚀 Rastreador de Demanda Pro (ATENDI)

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

**Controle de Atendimento Pro** é um sistema moderno e de alta performance desenvolvido para registrar e analisar a demanda de serviços com estatísticas detalhadas em tempo real. Ideal para recepções, centros de triagem e gestão de fluxo de clientes.

---

## ✨ Funcionalidades Principais

- 📊 **Dashboard em Tempo Real**: Visualize a demanda diária, semanal, mensal e anual através de gráficos de pizza e barras interativos.
- 📶 **Suporte Offline**: Graças à persistência do Firestore, o sistema continua funcionando mesmo sem conexão com a internet, sincronizando os dados automaticamente ao retornar.
- 🌓 **Modo Escuro & Claro**: Interface adaptável às preferências do usuário com persistência no navegador.
- 🔐 **Gestão de Acesso**: Autenticação via Firebase (Login administrativo e acesso anônimo para registro).
- ⚙️ **Customização Total**: Painel administrativo para adicionar, editar ou remover botões de serviço sem tocar no código.
- 📥 **Exportação de Dados**: Gere relatórios instantâneos em formato CSV para análise no Excel ou Google Sheets.
- 🖥️ **Multiplataforma**: Pronto para rodar no navegador ou como aplicativo desktop nativo via Electron.

---

## 🛠️ Tecnologias Utilizadas

- **Core:** [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Backend:** [Firebase](https://firebase.google.com/) (Firestore & Auth)
- **Gráficos:** [Recharts](https://recharts.org/)
- **Animações:** [Framer Motion](https://www.framer.com/motion/)
- **Data & Hora:** [date-fns](https://date-fns.org/)
- **Desktop:** [Electron](https://www.electronjs.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)

---

## 🚀 Como Começar

### Pré-requisitos

- Node.js (v18+)
- npm ou yarn

### Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/notyalcc/ATENDI.git
   cd ATENDI
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure o Firebase:**
   Crie um arquivo `.env` na raiz do projeto com suas credenciais do Firebase:
   ```env
   VITE_FIREBASE_API_KEY=seu_api_key
   VITE_FIREBASE_AUTH_DOMAIN=seu_auth_domain
   VITE_FIREBASE_PROJECT_ID=seu_project_id
   VITE_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
   VITE_FIREBASE_APP_ID=seu_app_id
   ```

### Executando o Projeto

**Modo Web (Desenvolvimento):**
```bash
npm run dev
```

**Modo Desktop (Electron):**
```bash
npm run electron:dev
```

---

## 📦 Build & Deploy

**Gerar versão para Web:**
```bash
npm run build
```

**Gerar executável Desktop (.exe portable):**
```bash
npm run electron:build
```

---

## 📄 Licença

Este projeto está sob a licença de uso privado. Consulte o autor para mais detalhes.

---

<p align="center">
  Desenvolvido com ❤️ por <a href="https://github.com/notyalcc">Clayton S. Silva</a>
</p>