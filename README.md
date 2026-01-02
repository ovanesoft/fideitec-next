# 🏢 FIDEITEC NEXT

Plataforma integral para la gestión moderna de fideicomisos inmobiliarios con tecnología blockchain.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18+-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue)

## ✨ Características

### Autenticación
- ✅ Login/Registro con email y contraseña
- ✅ OAuth con **Google**
- ✅ Verificación de email
- ✅ Recuperación de contraseña
- ✅ JWT con refresh tokens
- ✅ Sesiones seguras

### Seguridad
- ✅ Rate limiting (general, login, registro, password reset)
- ✅ Protección XSS
- ✅ Protección SQL Injection
- ✅ Protección CSRF
- ✅ Headers de seguridad (Helmet)
- ✅ Sanitización de inputs
- ✅ Bloqueo de cuenta por intentos fallidos

### Stack Tecnológico
- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** React, Vite, Tailwind CSS
- **Landing:** HTML/CSS/JS estático
- **Email:** Resend
- **Deploy:** Render (con Blueprint)

---

## 📁 Estructura del Proyecto

```
FIDEITEC NEXT/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── config/         # Database, Passport
│   │   ├── controllers/    # Business logic
│   │   ├── database/       # SQL schema
│   │   ├── middleware/     # Auth, Security
│   │   ├── routes/         # API endpoints
│   │   └── utils/          # Email, helpers
│   └── package.json
├── frontend/               # App React/Vite
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── api/            # Axios config
│   │   ├── context/        # Auth context
│   │   └── pages/          # React components
│   └── package.json
├── landing.html            # Landing page estática
├── render.yaml             # Render Blueprint
└── bitacora.template.md    # Template para bitácora
```

---

## 🚀 Quick Start

### 1. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configurar base de datos

```bash
# Crear base de datos PostgreSQL
createdb fideitec

# Ejecutar schema
psql -d fideitec -f backend/src/database/schema.sql
```

### 3. Configurar variables de entorno

```bash
# Backend - copiar y editar
cp backend/env.example.txt backend/.env
# Editar .env con tus valores
```

### 4. Iniciar desarrollo

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Landing (opcional)
npx serve -s . -l 8080
```

---

## 📋 Variables de Entorno

### Backend (.env)

```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://usuario:password@localhost:5432/fideitec

# JWT (generar con: openssl rand -hex 32)
JWT_SECRET=
JWT_REFRESH_SECRET=
SESSION_SECRET=
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=FIDEITEC <noreply@fideitec.com>

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000
```

---

## 🔧 Configuración de OAuth

### Google OAuth

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear proyecto nuevo
3. APIs & Services → Credentials → Create OAuth Client ID
4. Application type: Web application
5. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
6. Copiar Client ID y Client Secret

---

## 📄 Páginas Incluidas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page (landing.html) |
| `/app/login` | Inicio de sesión |
| `/app/register` | Registro de usuario |
| `/app/forgot-password` | Recuperar contraseña |
| `/app/reset-password` | Restablecer contraseña |
| `/app/verify-email` | Verificación de email |
| `/app/dashboard` | Panel principal (protegido) |
| `/app/privacy` | Política de privacidad |
| `/app/terms` | Términos de servicio |

---

## 📝 API Endpoints

### Auth
```
POST /api/auth/register     - Registro
POST /api/auth/login        - Login
POST /api/auth/logout       - Logout
POST /api/auth/refresh      - Refresh token
GET  /api/auth/me           - Usuario actual
GET  /api/auth/verify-email - Verificar email
POST /api/auth/forgot-password - Solicitar reset
POST /api/auth/reset-password  - Resetear password
GET  /api/auth/google          - OAuth Google
GET  /api/auth/google/callback
```

### Users
```
GET    /api/users           - Listar usuarios
GET    /api/users/:id       - Obtener usuario
PATCH  /api/users/:id       - Actualizar usuario
DELETE /api/users/:id       - Eliminar usuario
```

### Tenants
```
GET    /api/tenants         - Listar tenants
POST   /api/tenants         - Crear tenant
GET    /api/tenants/:id     - Obtener tenant
PATCH  /api/tenants/:id     - Actualizar tenant
```

---

## 🔒 Credenciales Iniciales

Usuario root creado automáticamente al ejecutar el schema:

- **Email:** `root@fideitec.com`
- **Password:** `Root@12345`

⚠️ **IMPORTANTE:** Cambiar la contraseña inmediatamente en producción.

---

## 📄 Licencia

MIT License - Proyecto FIDEITEC

---

Hecho con ❤️ para la gestión moderna de fideicomisos inmobiliarios.

