# Registro DNDA (Argentina) — FIDEITEC.COM v1.00

Documentación completa para el registro de software ante la **Dirección Nacional del Derecho de Autor (DNDA)**, al amparo de la **Ley 11.723** y el **Decreto 165/1994** que regula la protección del software en Argentina.

---

## Datos del Repositorio (Referencia Verificable)

| Campo | Valor |
|-------|-------|
| **Repositorio (origin)** | https://github.com/ovanesoft/fideitec-next.git |
| **Visibilidad** | Privado |
| **Primer commit (hash)** | `6113b5984384ef8f022aaa9b881ce0d59ad38796` |
| **Fecha/hora (Argentina, UTC-03:00)** | 2026-01-02 20:31:16 |
| **Autor del commit** | Pablo Martin Faranna |
| **Mensaje** | 🚀 Initial commit - FIDEITEC NEXT |

---

## 1. Carátula / Ficha Técnica

| Campo | Valor |
|-------|-------|
| **Título / Nombre comercial** | FIDEITEC.COM |
| **Tipo de obra** | Programa de computación / Plataforma web |
| **Versión** | 1.00 |
| **Titular** | PABLO MARTIN FARANNA |
| **CUIT** | 20-27283949-3 |
| **Domicilio** | Parral 61 Piso 3ro Of. 8, Ciudad Autónoma de Buenos Aires, Argentina |
| **Autor** | PABLO MARTIN FARANNA (CUIT 20-27283949-3) |

### Estado de Publicación

| Campo | Valor |
|-------|-------|
| **Estado** | Puesto en conocimiento público |
| **Fecha de inicio del desarrollo** | 2026-01-02 (primer commit verificable) |
| **Sitio web online** | https://fideitec.com |
| **Repositorio** | https://github.com/ovanesoft/fideitec-next.git (privado) |

### Stack Tecnológico

| Componente | Tecnologías |
|------------|-------------|
| **Backend** | Node.js (v18+), Express.js, PostgreSQL (v16+) |
| **Frontend** | React (v18+), Vite, Tailwind CSS |
| **Autenticación** | JWT, OAuth 2.0 (Google), Passport.js |
| **Blockchain** | Ethereum L2 (Base), ethers.js |
| **Email** | Resend |
| **Almacenamiento** | Cloudinary |
| **Despliegue** | Render |

### Modalidad de Depósito

**Extractos representativos** del código fuente + documentación técnica, suficientes para identificar la obra, preservando información sensible y confidencial conforme al Decreto 165/1994.

---

## 2. Memoria Descriptiva

### 2.1. Descripción General

**FIDEITEC.COM** es una plataforma web integral para la **gestión moderna de fideicomisos inmobiliarios**, con capacidades avanzadas de **tokenización de activos** y **trazabilidad mediante tecnología blockchain**.

El software permite a administradoras fiduciarias, desarrolladores inmobiliarios y empresas gestoras digitalizar completamente el ciclo de vida de un fideicomiso: desde su constitución, pasando por la gestión de activos y unidades, hasta la emisión de certificados digitales de cuotas partes ("tokens") con anclaje criptográfico en blockchain para garantizar inmutabilidad y verificabilidad.

### 2.2. Problema que Resuelve

La administración tradicional de fideicomisos inmobiliarios presenta múltiples desafíos:

1. **Fragmentación de información**: Datos dispersos en planillas, documentos físicos y sistemas desconectados.
2. **Falta de trazabilidad**: Dificultad para auditar el historial de operaciones y transferencias.
3. **Acceso limitado a inversión inmobiliaria**: Altas barreras de entrada para pequeños inversores.
4. **Procesos manuales**: Emisión de certificados, verificaciones KYC/AML y aprobaciones mediante flujos lentos y propensos a errores.
5. **Desconfianza**: Ausencia de mecanismos que garanticen la integridad de los registros.

FIDEITEC.COM resuelve estos problemas mediante una plataforma unificada, multi-tenant, con certificación blockchain y flujos automatizados.

### 2.3. Usuarios Objetivo

| Tipo de Usuario | Descripción |
|-----------------|-------------|
| **Administradoras fiduciarias** | Empresas que gestionan múltiples fideicomisos |
| **Desarrolladores inmobiliarios** | Constructoras que constituyen fideicomisos para proyectos |
| **Inversores / Beneficiarios** | Personas que adquieren cuotas partes de fideicomisos |
| **Proveedores** | Empresas contratadas por los fideicomisos |
| **Auditores** | Terceros que verifican operaciones y certificados |

### 2.4. Módulos y Funcionalidades Principales

#### A) Gestión Multi-Tenant
- Múltiples organizaciones (tenants) en una única instancia
- Aislamiento de datos por tenant
- Configuración independiente por organización
- Portales personalizados para clientes y proveedores

#### B) Autenticación y Seguridad
- Registro con email/contraseña y verificación de email
- OAuth 2.0 con Google
- JWT con refresh tokens
- Rate limiting (general, login, registro, password reset)
- Protección XSS, SQL Injection, CSRF
- Headers de seguridad (Helmet)
- Bloqueo automático por intentos fallidos
- Roles jerárquicos: root, admin, manager, user

#### C) Gestión de Fideicomisos
- Alta y configuración de fideicomisos
- Asignación de partes (fiduciante, fiduciario, beneficiarios)
- Estados y ciclo de vida del fideicomiso
- Documentación asociada

#### D) Gestión de Activos Inmobiliarios
- Registro de activos (terrenos, edificios, proyectos)
- Categorización y tipificación
- Valuación y seguimiento
- Vinculación a fideicomisos

#### E) Gestión de Unidades
- Subdivisión de activos en unidades (departamentos, locales, cocheras)
- Estados de construcción y avance
- Pricing y disponibilidad
- Asignación a clientes/inversores

#### F) Tokenización y Certificados Blockchain
- División de activos en cuotas partes ("tokens")
- Emisión de certificados digitales firmados
- Generación de hash SHA-256 del certificado
- Anclaje del hash en blockchain (Base/Ethereum L2)
- Verificación pública de autenticidad
- Historial inmutable de transacciones

#### G) KYC/AML (Know Your Customer / Anti Money Laundering)
- Verificación de identidad de clientes
- Niveles de verificación (básico, intermedio, completo)
- Detección de PEP (Personas Expuestas Políticamente)
- Evaluación de riesgo AML
- Documentación respaldatoria

#### H) Sistema de Aprobaciones
- Flujos de aprobación multinivel
- Configuración de límites por operación
- Auditoría de aprobaciones

#### I) Portales de Autogestión
- Portal para clientes/inversores
- Portal para proveedores
- Registro y onboarding autoservicio
- Consulta de posiciones y certificados

#### J) Auditoría y Trazabilidad
- Logs de todas las operaciones
- Registro de cambios (valores anteriores y nuevos)
- IP y user agent de cada acción

### 2.5. Arquitectura Técnica

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIOS                                │
│   (Administradores / Inversores / Proveedores / Auditores)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                      │
│         fideitec.com / app.fideitec.com                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Login   │ │Dashboard │ │Fideico-  │ │Tokeniza- │           │
│  │ Register │ │  Panel   │ │  misos   │ │  ción    │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Express.js)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │  Trusts  │ │  Assets  │ │  Tokens  │           │
│  │ Passport │ │ Parties  │ │  Units   │ │  Certs   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Clients  │ │Suppliers │ │Approvals │ │  Audit   │           │
│  │   KYC    │ │  Portal  │ │  System  │ │   Logs   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│      PostgreSQL           │   │      Blockchain (Base L2)       │
│  ┌─────────────────────┐  │   │                                 │
│  │ tenants, users      │  │   │  • Anclaje de hashes            │
│  │ clients, suppliers  │  │   │  • Verificación pública         │
│  │ trusts, assets      │  │   │  • Inmutabilidad                │
│  │ units, tokens       │  │   │                                 │
│  │ certificates        │  │   │  Red: Base (Ethereum L2)        │
│  │ audit_logs          │  │   │  Respaldo: Coinbase             │
│  └─────────────────────┘  │   │                                 │
└───────────────────────────┘   └─────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────┐
│    Servicios Externos     │
│  • Resend (Email)         │
│  • Cloudinary (Storage)   │
│  • Google OAuth           │
└───────────────────────────┘
```

### 2.6. Características Distintivas

1. **Tokenización sin fricción**: Los usuarios finales no necesitan conocimientos de blockchain ni wallets; la plataforma abstrae toda la complejidad.

2. **Certificados con doble garantía**: Cada certificado tiene firma digital de FIDEITEC + hash anclado en blockchain público, combinando validez legal con verificabilidad técnica.

3. **Multi-tenancy real**: Arquitectura diseñada desde el inicio para soportar múltiples organizaciones con aislamiento completo de datos.

4. **Compliance integrado**: KYC/AML como parte nativa del flujo, no como añadido posterior.

5. **Trazabilidad completa**: Auditoría de cada operación con valores anteriores/nuevos, timestamps, IP y usuario.

### 2.7. Marco Legal de Referencia

El software está diseñado para operar bajo el marco legal argentino de fideicomisos:

- **Ley 24.441**: Régimen de financiamiento de la vivienda y la construcción (fideicomisos)
- **Código Civil y Comercial**: Artículos 1666 a 1707 (contratos de fideicomiso)
- **Ley 25.326**: Protección de datos personales
- **Ley 11.723**: Propiedad intelectual (protección del software)
- **Decreto 165/1994**: Régimen de protección de software

---

## 3. Declaración de Autoría y Titularidad

### DECLARACIÓN JURADA

Yo, **PABLO MARTIN FARANNA**, CUIT **20-27283949-3**, con domicilio en **Parral 61 Piso 3ro Of. 8, Ciudad Autónoma de Buenos Aires, Argentina**, declaro bajo juramento que:

1. Soy el **autor** y **titular** de los derechos patrimoniales del software denominado **"FIDEITEC.COM"**, versión **1.00**, el cual constituye una obra original en los términos de la Ley 11.723.

2. El desarrollo del software inició con fecha **2026-01-02 20:31:16 (UTC-03:00)**, tomando como referencia verificable el primer commit del repositorio privado https://github.com/ovanesoft/fideitec-next.git, cuyo hash es `6113b5984384ef8f022aaa9b881ce0d59ad38796`.

3. El software ha sido **puesto en conocimiento público** a través del sitio web **https://fideitec.com**, encontrándose operativo y accesible.

4. El material que acompaño se presenta bajo la modalidad de **DEPÓSITO PARCIAL** mediante **EXTRACTOS REPRESENTATIVOS** del código fuente y documentación técnica, suficientes para identificar la obra, preservando información sensible y confidencial, conforme a lo dispuesto por el **Decreto 165/1994**.

5. La obra es **original** y no infringe derechos de terceros. Las dependencias de software de código abierto utilizadas (listadas en los archivos `package.json`) se emplean conforme a sus respectivas licencias permisivas (MIT, Apache, ISC, etc.).

6. Este registro se realiza al amparo de la **Ley 11.723** de Propiedad Intelectual y el **Decreto 165/1994** que regula específicamente la protección del software en Argentina.

---

**Firmo en CABA, a los 16 días del mes de enero de 2026.**

**Firma:** __________________________

**Aclaración:** PABLO MARTIN FARANNA

**CUIT:** 20-27283949-3

---

## 4. Anexo — Índice de Extractos del Código Fuente

### A) Documentación y Metadatos
| Archivo | Descripción |
|---------|-------------|
| `README.md` | Documentación principal, estructura, endpoints, configuración |
| `backend/package.json` | Dependencias y scripts del backend |
| `frontend/package.json` | Dependencias y scripts del frontend |
| `render.yaml` | Configuración de despliegue |

### B) Backend — Núcleo Funcional
| Archivo/Directorio | Descripción |
|-------------------|-------------|
| `backend/src/app.js` | Punto de entrada, configuración de Express y middlewares |
| `backend/src/config/` | Configuración de base de datos, Passport (OAuth), blockchain |
| `backend/src/middleware/` | Autenticación, seguridad, validación, rate limiting |
| `backend/src/routes/` | Definición de endpoints de la API |
| `backend/src/controllers/` | Lógica de negocio (selección representativa) |
| `backend/src/services/` | Servicios: blockchain, certificados, órdenes, storage |
| `backend/src/database/schema.sql` | Esquema principal de base de datos |
| `backend/src/database/migration_*.sql` | Migraciones (tokenización, aprobaciones, etc.) |

### C) Frontend — Interfaz de Usuario
| Archivo/Directorio | Descripción |
|-------------------|-------------|
| `frontend/src/main.jsx` | Punto de entrada de React |
| `frontend/src/App.jsx` | Componente raíz y enrutamiento |
| `frontend/src/api/axios.js` | Configuración de cliente HTTP |
| `frontend/src/context/` | Contextos de autenticación (usuarios, clientes, proveedores) |
| `frontend/src/pages/` | Páginas principales (selección representativa) |
| `frontend/src/components/` | Componentes reutilizables |

### D) Documentación Adicional
| Archivo | Descripción |
|---------|-------------|
| `docs/GUIA_INVERSOR_TOKENIZACION.md` | Guía completa para inversores |

### Exclusiones (por seguridad y confidencialidad)
- `.env` / archivos de configuración con secretos
- Credenciales, API keys, tokens de acceso
- `node_modules/` (dependencias descargables)
- Archivos generados, builds, logs
- Datos de prueba o producción

---

## 5. Huella de Integridad del Depósito

| Campo | Valor |
|-------|-------|
| **Nombre del archivo** | `fideitec-com_extractos_v1.00.zip` |
| **SHA-256** | `cfd1c4c0e56773acbea7ea1f50913b70afc4ccc5add674c2c4b17a2b2ec91f75` |
| **Cantidad de archivos** | 74 |
| **Fecha de generación** | 2026-01-16 |
| **Generado por** | Pablo Martin Faranna |

### Instrucciones para generar el hash

```bash
# En macOS/Linux:
shasum -a 256 fideitec-com_extractos_v1.00.zip

# En Windows (PowerShell):
Get-FileHash -Algorithm SHA256 fideitec-com_extractos_v1.00.zip
```

---

## 6. Licencia y Condiciones de Uso

| Campo | Valor |
|-------|-------|
| **Tipo de licencia** | Propietaria / Comercial |
| **Titular de derechos** | Pablo Martin Faranna |
| **Uso permitido** | Exclusivamente por el titular o bajo acuerdo comercial |
| **Distribución** | Prohibida sin autorización expresa |
| **Modificación** | Prohibida sin autorización expresa |
| **Código abierto** | No |

---

## 7. Datos de Contacto para DNDA

| Campo | Valor |
|-------|-------|
| **Titular** | Pablo Martin Faranna |
| **CUIT** | 20-27283949-3 |
| **Domicilio legal** | Parral 61 Piso 3ro Of. 8, CABA, Argentina |
| **Email** | drfaranna@delegales.com |
| **Teléfono** | 11-6043-3010 |

---

## 8. Índice de Documentos del Depósito

1. ☑ Este documento (`REGISTRO_DNDA_FIDEITEC_COM_v1.00.md` / versión impresa)
2. ☐ Comprobante de pago DNDA-CESSI
3. ☐ Comprobante de pago Fondo Nacional de las Artes
4. ☐ ZIP con extractos del código fuente (`fideitec-com_extractos_v1.00.zip`)
5. ☐ Hoja con huella de integridad (SHA-256) firmada

---

*Documento generado para registro ante DNDA — Argentina*
*Fecha de generación: 16 de enero de 2026*
*Versión del software: 1.00*
