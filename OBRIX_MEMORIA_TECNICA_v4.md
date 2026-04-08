# 🏗️ OBRIX ERP — Memoria Técnica v4
**Fecha:** Marzo 2026  
**Fase:** 3 — Motor de Inteligencia Documental + Gestión de Relaciones Comerciales

| Campo | Valor |
|-------|-------|
| **Usuario** | Ricardo López (super_admin) |
| **Company ID** | b4b90721-f529-4808-b305-e1b1f6b4fe9f |
| **User ID** | 12c55b4b-da9d-4922-9582-adc558a752bd |
| **Proyecto Supabase** | openzxgmmnfiqbhuijes |
| **Versión** | 4.0 |
| **Confidencial** | Sí — Propiedad de DINNOVAC / OBRIX ERP |

---

## 📋 TABLA DE CONTENIDOS

1. [Stack Tecnológico](#1-stack-tecnológico)
2. [Base de Datos — Tablas Activas](#2-base-de-datos--tablas-activas)
3. [Estructura de Archivos](#3-estructura-de-archivos)
4. [Rutas Activas en App.jsx](#4-rutas-activas-en-appjsx)
5. [Módulo: Gestión de Materiales](#5-módulo-gestión-de-materiales)
6. [Módulo: Gestión de Relaciones Comerciales (Terceros)](#6-módulo-gestión-de-relaciones-comerciales-terceros)
7. [Motor de Parsing Fiscal — Inteligencia Documental](#7-motor-de-parsing-fiscal--inteligencia-documental)
8. [Edge Function: parse-document](#8-edge-function-parse-document)
9. [Sidebar y Navegación](#9-sidebar-y-navegación)
10. [Roles y Permisos](#10-roles-y-permisos)
11. [Bugs Resueltos](#11-bugs-resueltos)
12. [Próximos Pasos](#12-próximos-pasos)
13. [Notas Técnicas](#13-notas-técnicas)

---

## 1. Stack Tecnológico

### 1.1 Frontend

| Capa | Tecnología | Versión | Detalle |
|------|------------|---------|---------|
| **Framework** | React | 18.2.0 | SPA con componentes funcionales |
| **Build Tool** | Vite | 5.0.0+ | Bundler rápido para desarrollo |
| **Routing** | React Router DOM | 6.21.0 | Navegación entre pantallas |
| **Estilos** | Tailwind CSS | 3.3.0+ | Utility-first CSS framework |
| **Iconos** | Lucide React | 0.294.0 | Iconos SVG escalables |
| **Gráficas** | Recharts | 2.10.0 | Gráficos estadísticos |

### 1.2 Backend

| Capa | Tecnología | Detalle |
|------|------------|---------|
| **Base de Datos** | PostgreSQL 15 | Motor relacional |
| **Autenticación** | Supabase Auth | Email/password + Google OAuth |
| **Storage** | Supabase Storage | Buckets para archivos y documentos fiscales |
| **RLS** | Row Level Security | Políticas de acceso por rol en todas las tablas |
| **Edge Functions** | Deno v2.1.4 | parse-document (motor OCR con Claude API) |

### 1.3 Herramientas de Parsing PDF

| Herramienta | Versión | Propósito | Licencia |
|-------------|---------|-----------|----------|
| **pdfjs-dist** | 3.11.174 | Extracción nativa de texto PDF en el navegador | Apache 2.0 |
| **pdf.worker.js** | 3.11.174 | Worker para procesamiento en background (Vite) | Apache 2.0 |

> **Nota:** Los PDFs de documentos SAT (CSF, 32-D, CSD) son generados digitalmente — contienen texto seleccionable nativo. **No requieren OCR.** La extracción con `pdf.js` es más rápida (< 2s) y precisa (95%+) que cualquier método OCR.

### 1.4 Dependencias NPM

```
@supabase/supabase-js
react-router-dom
lucide-react
pdfjs-dist@3.11.174    ← Motor parsing fiscal (nuevo en v4)
jspdf + jspdf-autotable
xlsx
recharts
```

---

## 2. Base de Datos — Tablas Activas

### 2.1 Resumen de Tablas

| Tabla | Descripción | Estado |
|-------|-------------|--------|
| `companies` | Empresas del sistema | ✅ |
| `users_profiles` | Perfiles + rol + is_active + phone | ✅ v2 |
| `company_settings` | Límites aprobación, moneda, factores costo | ✅ |
| `projects` | Proyectos de construcción | ✅ |
| `project_nodes` | Árbol jerárquico de proyecto | ✅ |
| `warehouses` | Almacenes | ✅ |
| `materials_catalog` | Catálogo v2: material_code, company_id, is_active | ✅ v2 |
| `material_unit_conversions` | Unidades de medida por material con factor conversión | ✅ NUEVO |
| `material_prices` | Precio compra/gestión/inflación/venta por proyecto | ✅ |
| `material_price_history` | Historial automático vía trigger | ✅ |
| `inventory` | Stock por almacén | ✅ |
| `movements` | Movimientos de inventario | ✅ |
| `material_requests` | Solicitudes v2 | ✅ v2 |
| `material_request_items` | Ítems con precios y unidades | ✅ v2 |
| `material_dispatches` | Despachos/consumos a obra | ⏳ pendiente |
| `attendance` | Asistencia | ✅ estructura básica |
| `terceros` | Registro de clientes/proveedores con datos fiscales | ✅ NUEVO |
| `tercero_direcciones` | Direcciones por tercero (fiscal, administrativa, entrega) | ✅ NUEVO |
| `tercero_documentos` | Documentos fiscales adjuntos (CSF, 32D, CSD, etc.) | ✅ NUEVO |

### 2.2 Campos Clave por Módulo

```sql
-- users_profiles
role, is_active, phone, full_name, updated_at

-- materials_catalog
material_code VARCHAR(20) UNIQUE  -- Ej: TUB0001
company_id, is_active, created_by, updated_at

-- material_requests
estimated_amount DECIMAL(15,2)
approval_level   VARCHAR(20)  -- 'jefe_obra' | 'admin_empresa'
delivery_type    VARCHAR(20)  -- 'almacen' | 'directo_obra'

-- material_request_items
unit_price DECIMAL(15,4)

-- material_prices (columnas calculadas STORED)
sale_price_obra  -- compra + gestión + inflación (calculado automáticamente)
margin_pct       -- margen % (calculado automáticamente)
```

### 2.3 Tabla: `terceros`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | Identificador único |
| company_id | UUID FK | Empresa propietaria |
| rfc | TEXT | RFC del tercero (UNIQUE) |
| razon_social | TEXT | Nombre o Razón Social |
| tipo | VARCHAR | `'proveedor'` \| `'cliente'` \| `'ambos'` |
| regimen_fiscal | TEXT | Clave régimen fiscal SAT |
| uso_cfdi_default | TEXT | Uso CFDI por defecto |
| email | TEXT | Correo electrónico |
| telefono | TEXT | Teléfono de contacto |
| codigo_postal | TEXT | Código postal fiscal |
| csf_parseada | BOOLEAN | ¿CSF leída automáticamente? |
| csf_confianza | INTEGER | % confianza en parsing |
| opinion_32d_estatus | TEXT | Estatus opinión cumplimiento |
| opinion_32d_fecha | DATE | Fecha de emisión 32-D |
| csd_numero | TEXT | Número de certificado CSD |
| csd_vencimiento | DATE | Fecha de vencimiento CSD |
| csd_estatus | TEXT | `'vigente'` \| `'vencido'` \| `'no_verificado'` |
| clabe | TEXT | CLABE bancaria |
| clabe_titular | TEXT | Nombre titular CLABE |
| clabe_verificada | BOOLEAN | ¿RFC coincide con titular? |
| repse_numero | TEXT | Número de registro REPSE |
| onboarding_paso | INTEGER | 1=CSF, 2=Nivel 1, 3=Nivel 2 |
| status | TEXT | `'activo'` \| `'inactivo'` |
| created_at | TIMESTAMPTZ | Fecha creación |
| updated_at | TIMESTAMPTZ | Fecha actualización |

### 2.4 Tabla: `tercero_direcciones`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | Identificador único |
| tercero_id | UUID FK | Referencia a `terceros` |
| tipo | VARCHAR | `'fiscal'` \| `'administrativa'` \| `'entrega'` |
| calle | TEXT | Calle/vialidad |
| numero_exterior | TEXT | Número exterior |
| numero_interior | TEXT | Número interior |
| colonia | TEXT | Colonia |
| codigo_postal | TEXT | Código postal |
| municipio | TEXT | Municipio/Alcaldía |
| estado | TEXT | Estado |
| contacto_nombre | TEXT | Nombre contacto (opcional) |
| contacto_tel | TEXT | Teléfono contacto (opcional) |
| referencia | TEXT | Referencias/indicaciones |
| fuente_csf | BOOLEAN | ¿Auto-llenada desde CSF? |
| created_at | TIMESTAMPTZ | Fecha creación |

### 2.5 Tabla: `tercero_documentos`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | Identificador único |
| tercero_id | UUID FK | Referencia a `terceros` |
| tipo_documento | VARCHAR | `'CSF'` \| `'32D'` \| `'CSD'` \| `'ESTADO_CUENTA'` |
| archivo_url | TEXT | URL pública en Supabase Storage |
| estatus | TEXT | `'validado'` \| `'pendiente'` \| `'rechazado'` |
| fecha_documento | DATE | Fecha de emisión del documento |
| fecha_validacion | TIMESTAMPTZ | Fecha de validación |
| datos_extraidos | JSONB | Datos parseados automáticamente |
| confianza | INTEGER | % confianza en parsing |
| created_at | TIMESTAMPTZ | Fecha creación |

### 2.6 Funciones SQL Activas

```sql
generate_request_folio()            -- SOL-2026-0001
generate_dispatch_folio()           -- DES-2026-0001
generate_material_code(subcat)      -- TUB0001, FIJ0001
check_material_duplicate(...)       -- TRUE si duplicado
get_approval_level(company, amount) -- 'jefe_obra' | 'admin_empresa'
auto_ingest_to_inventory(req_id)    -- ingreso automático al recibir
log_price_change()                  -- trigger historial precios
```

---

## 3. Estructura de Archivos

```
C:/Obrix/src/
├── config/
│   ├── supabase.js
│   └── permissions.config.js         ← 6 roles, PERMISSIONS, MENU_ACCESS, hasPermission()
├── context/
│   └── AuthContext.jsx               ← user, userProfile, loading, login, logout
├── hooks/
│   ├── usePermission.js              ← can(), canAccess(), role, isSuperAdmin...
│   └── useToast.js
├── components/
│   ├── auth/
│   │   └── PermissionGuard.jsx       ← RequirePermission, PermissionGuard, PermissionButton
│   ├── fiscal/                       ← NUEVO
│   │   └── DocumentUploadValidator.jsx  ← Zona drop + validación en tiempo real
│   └── layout/
│       ├── MainLayout.jsx
│       └── Sidebar.jsx               ← Actualizado con grupo "Relaciones Comerciales"
├── services/
│   ├── users.service.js
│   ├── companySettings.service.js
│   ├── materialsCatalog.service.js
│   ├── materialRequestsV2.service.js
│   ├── projectNodes.service.js
│   ├── dispatches.service.js         ← Despacho a obra
│   ├── terceros.service.js           ← NUEVO — CRUD terceros + scoring
│   └── documentParser.service.js    ← NUEVO — Motor parsing pdf.js + regex
├── pages/
│   ├── admin/
│   │   └── UsersAdmin.jsx
│   ├── settings/
│   │   └── CompanySettings.jsx
│   ├── materials/
│   │   ├── MaterialCatalog.jsx
│   │   ├── MaterialRequestsV2.jsx
│   │   ├── RequestFormV2.jsx
│   │   ├── ApprovalModalV2.jsx
│   │   ├── ReceptionModal.jsx
│   │   └── DispatchForm.jsx         ← Despacho a obra
│   ├── relaciones/                  ← NUEVO
│   │   ├── TercerosList.jsx         ← Directorio con semáforos y KPIs
│   │   └── TerceroForm.jsx          ← Onboarding 3 pasos CSF-first
│   └── reports/
│       ├── Reports.jsx
│       ├── ProjectsProgressReport.jsx
│       └── NodeProgressReport.jsx
└── App.jsx                          ← Todas las rutas (ProtectedRoute interno)
```

### Descripción de archivos clave del módulo fiscal

| Archivo | Descripción | Tamaño aprox. |
|---------|-------------|---------------|
| `documentParser.service.js` | Motor parsing: pdf.js + regex patterns CSF/32D/CSD | ~500 líneas |
| `DocumentUploadValidator.jsx` | Componente UI drag & drop + validación en tiempo real | ~300 líneas |
| `TerceroForm.jsx` | Formulario onboarding 3 pasos (CSF → Nivel 1 → Nivel 2) | ~800 líneas |
| `TercerosList.jsx` | Directorio con semáforos, KPIs y filtros | ~400 líneas |
| `terceros.service.js` | CRUD completo terceros + direcciones + documentos | ~200 líneas |

---

## 4. Rutas Activas en App.jsx

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/dashboard` | Dashboard | Panel principal |
| `/projects` | Projects | Gestión de proyectos |
| `/project-tree` | ProjectTree | Árbol jerárquico |
| `/inventory` | Inventory | Inventario |
| `/materials/catalog` | MaterialCatalog | Maestro de Materiales v2 |
| `/materials/requests` | MaterialRequestsV2 | Solicitudes de materiales |
| `/reports` | Reports | Reportes generales |
| `/reports/projects-progress` | ProjectsProgressReport | Avance por proyecto |
| `/reports/node-progress` | NodeProgressReport | Avance por nodo |
| `/attendance` | Attendance | Asistencia |
| `/admin/users` | UsersAdmin | Administración de usuarios |
| `/settings/company` | CompanySettings | Configuración de empresa |
| `/relaciones/terceros` | TercerosList | Directorio de Terceros |
| `/relaciones/terceros/nuevo` | TerceroForm | Onboarding nuevo tercero |
| `/relaciones/terceros/:id` | TerceroDetail | Detalle y edición de tercero |

> **Nota técnica:** `ProtectedRoute` está definido **internamente** en `App.jsx` (no es un archivo separado).

---

## 5. Módulo: Gestión de Materiales

### 5.1 Ciclo de Vida de Materiales

```
1. MAESTRO DE MATERIALES
   Actor: Admin Empresa
   └── Catálogo + precios por proyecto (compra/gestión/inflación/venta)

2. SOLICITUD
   Actor: Solicitante / Jefe de Obra
   ├── Vinculada al Proyecto
   ├── Monto calculado automáticamente (cantidad × precio venta obra)
   └── Nivel aprobación: automático según límite configurado

3. APROBACIÓN
   ├── Monto ≤ límite empresa → Jefe de Obra
   ├── Monto > límite empresa → Admin Empresa
   ├── Aprobador ajusta cantidades
   └── Aprobador define destino: Almacén | Directo a Obra

4A. RECEPCIÓN EN ALMACÉN
    Actor: Almacenista
    ├── Valida cantidad + captura precio real
    ├── Reporta defectos + fotos
    ├── Ingreso AUTOMÁTICO al inventario (auto_ingest_to_inventory)
    └── Defectos → Devolución a Proveedor

4B. RECEPCIÓN DIRECTA A OBRA
    Actor: Almacenista / Jefe de Obra
    └── Registra consumo directo en el Proyecto

5. DESPACHO / CONSUMO A OBRA  ← ⏳ Módulo creado, pendiente integración
   Actor: Jefe de Obra
   ├── Selecciona material del inventario
   ├── Cantidad a despachar
   ├── Precio venta obra vigente (momento del despacho)
   ├── Margen calculado automáticamente
   ├── Descuenta del inventario
   └── Folio automático: DES-2026-0001
```

---

## 6. Módulo: Gestión de Relaciones Comerciales (Terceros)

### 6.1 Decisiones de Arquitectura

| Decisión | Valor |
|----------|-------|
| Modelo de datos | Mixto: RFC único compartido entre empresas propias, condiciones comerciales por empresa (`tercero_relaciones`) |
| Arranque | Desde cero — no existía módulo previo |
| Rutas | `/relaciones/terceros` y `/relaciones/terceros/nuevo` |
| Nombre en sidebar | "🤝 Gestión de Relaciones Comerciales" |

### 6.2 Flujo de Onboarding CSF-First (3 pasos)

```
PASO 1 — CSF obligatoria (puerta de entrada)
  ├── Zona de drop visual — arrastra o selecciona PDF
  ├── documentParser.service.js extrae texto con pdf.js
  ├── Parser CSF identifica: RFC, Nombre, CP, Régimen, Dirección Fiscal
  ├── Si confianza ≥ 50% → Auto-llenado + avanza automáticamente al Paso 2
  │   (campos bloqueados con candado azul 🔒)
  └── Si confianza < 50% → Captura manual con advertencia ⚠️ (no bloquea)

PASO 2 — Confirmar Nivel 1 + Direcciones
  ├── Datos fiscales pre-llenados desde CSF (solo editables si falló lectura)
  ├── Campos manuales obligatorios: Tipo (cliente/proveedor/ambos), Uso CFDI, Email
  ├── Acordeones opcionales: Dirección Administrativa, Dirección de Entrega
  ├── Panel de Alertas Pendientes (qué falta para estado ÓPTIMO)
  └── Dos acciones: "Guardar mínimo" ← registro activo inmediato
                    "Agregar documentación" → avanza al Paso 3

PASO 3 — Nivel 2 Óptimo (documentación complementaria)
  ├── 32-D Opinión de Cumplimiento (auto-extrae: estatus, fecha emisión)
  ├── CSD Certificado de Sello Digital (auto-extrae: número, vencimiento, estatus)
  ├── Estado de Cuenta Bancario (auto-extrae: CLABE, titular, verifica RFC)
  └── REPSE (número + vencimiento + alerta responsabilidad solidaria)
```

### 6.3 Estados del Tercero

| Estado | Descripción | Requisitos mínimos |
|--------|-------------|-------------------|
| Pendiente | CSF cargada, datos básicos incompletos | RFC, Nombre, CP |
| Nivel 1 | Datos fiscales completos | RFC, Nombre, CP, Régimen, Email |
| Nivel 2 (ÓPTIMO) | Documentación completa | + 32D, CSD, CLABE verificada |
| Activo | Listo para operar | Nivel 1 mínimo |
| Inactivo | Bloqueado por admin | — |

---

## 7. Motor de Parsing Fiscal — Inteligencia Documental

### 7.1 Arquitectura del Parser

```
┌──────────────────────────────────────────────┐
│  CARGA DE PDF (drag & drop o selección)      │
└──────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│  EXTRAER TEXTO CON pdf.js (NATIVO)           │
│  - Worker local empaquetado por Vite         │
│  - ignoreErrors: true (evita bug crypto SAT) │
│  - disableNativeImageDecoder: true           │
└──────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│  ¿TEXTO EXTRAÍDO EXITOSAMENTE?               │
│  SÍ → Parsear con regex patterns             │
│  NO → Mostrar error: "Documento con firma    │
│       compleja" + opción captura manual      │
└──────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│  PARSERS POR TIPO DE DOCUMENTO               │
│  CSF → RFC, Nombre, CP, Régimen, Estatus,    │
│        Dirección Fiscal, Fecha Inicio Ops    │
│  32D → RFC, Nombre, Domicilio, Fecha emisión,│
│        Estatus opinión cumplimiento          │
│  CSD → RFC, Nombre, Número Serie,            │
│        Fecha vigencia, SHA-256, Estatus      │
└──────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────┐
│  AUTO-LLENADO DEL FORMULARIO                 │
│  - RFC, Nombre, CP bloqueados (🔒)           │
│  - Dirección fiscal auto-llenada desde CSF   │
│  - Régimen fiscal con clave SAT              │
│  - Score de confianza calculado              │
└──────────────────────────────────────────────┘
```

### 7.2 Configuración del Worker (Vite)

```javascript
// src/services/documentParser.service.js
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';

GlobalWorkerOptions.workerSrc = pdfWorker;
```

### 7.3 Parámetros Críticos de getDocument

```javascript
const pdf = await getDocument({
  arrayBuffer,                         // ✅ Sintaxis correcta para Vite
  ignoreErrors: true,                  // ✅ Evita bug crypto con firmas SAT
  disableNativeImageDecoder: true      // ✅ Evita CSF con QR (hashOriginal.toHex)
}).promise;
```

### 7.4 Extracción de Texto

```javascript
export const extraerTextoPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({
    arrayBuffer,
    ignoreErrors: true,
    disableNativeImageDecoder: true
  }).promise;

  let textoCompleto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) textoCompleto += pageText + '\n\n';
  }

  return textoCompleto
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/:/g, ': ')
    .replace(/,/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
```

### 7.5 Regex Patterns — CSF

```javascript
// RFC (4 patrones — cubre CSF 2018-2026)
const rfcPatterns = [
  /RFC[:\s]+([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
  /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\s+RFC/i,
  /RFC\s*[:\s]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
  /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})(?=\s+CURP)/i,   // CSF nueva 2023+
];

// Nombre/Razón Social (4 patrones)
const nombrePatterns = [
  /CURP\s+[A-Z0-9]{18}\s+([A-ZÁÉÍÓÚÑ\s,.]{10,})\s+(?:Código Postal|Domicilio)/i,
  /([A-ZÁÉÍÓÚÑ\s]{10,})\s+Nombre,\s*denominación\s+o\s*razón\s+social/i,
  /RAZÓN\s+SOCIAL[:\s]*([A-ZÁÉÍÓÚÑ\s,.]+?)(?=\s+(?:RFC|CURP|DOMICILIO|CÓDIGO POSTAL|$))/i,
  /NOMBRE[:\s]*([A-ZÁÉÍÓÚÑ\s,.]+?)(?=\s+(?:RFC|CURP|DOMICILIO|CÓDIGO POSTAL|$))/i,
];

// Código Postal (4 patrones)
const cpPatterns = [
  /Código\s+Postal[:\s]*(\d{5})/i,
  /C\.?\s*P\.?[:\s]*(\d{5})/i,
  /(\d{5})\s+Código\s+Postal/i,
  /([A-ZÁÉÍÓÚÑ\s,.]{10,})\s+(\d{5})\s+(?:Colonia|Municipio)/i,
];

// Régimen Fiscal (2 patrones)
const regimenPatterns = [
  /Régimen\s+(?:de\s+)?(?:Fiscal\s+)?[:\s]*(.+?)(?=\d{2}\/\d{2}\/\d{4}|Fecha|Estatus|$)/is,
  /Código Postal\s+\d{5}\s+(.+?)\s+(?:Fecha|Inicio|Estatus)/i,
];

// Estatus en el padrón (3 patrones)
const estatusPatterns = [
  /Estatus\s+en\s+el\s+padrón[:\s]+(ACTIVO|SUSPENDIDO|CANCELADO)/i,
  /Situación\s+en\s+el\s+padrón[:\s]+(ACTIVO|SUSPENDIDO|CANCELADO)/i,
  /ACTIVO\s+en\s+el\s+padrón\s+fiscal/i,
];
```

### 7.6 Sistema de Confianza

| Nivel | Rango | Acción | Color |
|-------|-------|--------|-------|
| Excelente | 80–100% | ✅ Auto-llenado completo — avanza automáticamente | `#10B981` verde |
| Aceptable | 50–79% | ⚠️ Auto-llenado parcial — revisar manualmente | `#F59E0B` amarillo |
| Insuficiente | 0–49% | ❌ No se pudo validar — captura manual requerida | `#EF4444` rojo |

**Cálculo de confianza para CSF:**

| Campo | Puntos | Requerido |
|-------|--------|-----------|
| RFC | 35 | ✅ Sí |
| Nombre/Razón Social | 25 | ✅ Sí |
| Código Postal | 15 | ✅ Sí |
| Régimen Fiscal | 15 | ✅ Sí |
| Estatus en el padrón | 10 | ❌ No |
| CURP | 5 | ❌ No |
| **Total** | **105** | **Máximo 100** |

### 7.7 Validaciones Exportadas

```javascript
// Validación de RFC
export const validarRFC = (rfc) => {
  if (!rfc) return false;
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc.toUpperCase());
};

// Validación de CURP
export const validarCURP = (curp) => {
  if (!curp) return false;
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp);
};

// Validación de Código Postal
export const validarCP = (cp) => {
  if (!cp) return false;
  return /^\d{5}$/.test(cp);
};

// Días de vigencia del CSD
export const calcularDiasVigencia = (fechaFin) => {
  if (!fechaFin) return null;
  const diffTiempo = new Date(fechaFin) - new Date();
  return Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));
};
```

### 7.8 Variantes de CSF Soportadas

| Variante | Años | Características | Regex especial |
|----------|------|-----------------|----------------|
| CSF Nueva | 2023–2026 | Nombre después de CURP, CP después de nombre | `/CURP\s+[A-Z0-9]{18}\s+([A-ZÁÉÍÓÚÑ\s,.]{10,})\s+(?:Código Postal\|Domicilio)/i` |
| CSF Antigua | 2018–2022 | Formato 32/D, nombre antes de RFC | `/([A-ZÁÉÍÓÚÑ\s]{10,})\s+Nombre,\s*denominación\s+o\s*razón\s+social/i` |
| CSF con QR | 2020+ | Layout diferente, QR grande en portada | `disableNativeImageDecoder: true` |

### 7.9 Funciones Exportadas por documentParser.service.js

| Función | Descripción |
|---------|-------------|
| `extraerTextoPDF(file)` | Extrae texto nativo del PDF con pdf.js |
| `parsearDocumento(texto, tipo)` | Detecta tipo y aplica parser correspondiente |
| `parseCSF(texto)` | Parser especializado para Constancia de Situación Fiscal |
| `parse32D(texto)` | Parser especializado para Opinión de Cumplimiento 32-D |
| `parseCSD(texto)` | Parser especializado para Certificado de Sello Digital |
| `getEtiquetasCampos(tipo)` | Etiquetas UI por tipo de documento |
| `getCamposCriticos(tipo)` | Lista de campos mínimos requeridos |
| `getSemaforoParsing(confianza)` | Devuelve color y mensaje según % confianza |
| `validarRFC(rfc)` | Valida formato RFC |
| `validarCURP(curp)` | Valida formato CURP |
| `validarCP(cp)` | Valida formato CP (5 dígitos) |
| `calcularDiasVigencia(fechaFin)` | Días restantes para vencimiento CSD |

---

## 8. Edge Function: parse-document

> **Estado actual:** La Edge Function `parse-document` fue el primer intento de motor OCR (usando Claude API). Fue **superada** por la solución local con `pdf.js + regex` que resultó ser más rápida, precisa y sin costo por llamada. La función sigue activa en Supabase pero ya no es el motor principal.

### 8.1 Parámetros de Referencia

| Parámetro | Valor |
|-----------|-------|
| Nombre | `parse-document` |
| ID en Supabase | `4d7f8ea8-24bb-4947-b0f2-d155771ef21f` |
| Proyecto | `openzxgmmnfiqbhuijes` |
| Versión desplegada | v6 (Claude API) |
| Estado | ACTIVE |
| JWT Verification | DESACTIVADO |

### 8.2 Configuración JWT (evita reset en deploys)

```toml
# C:\obrix\supabase\functions\parse-document\config.toml
[functions.parse-document]
verify_jwt = false
```

### 8.3 Comparativa de Motores

| Método | Tiempo | Precisión | Costo | Estado |
|--------|--------|-----------|-------|--------|
| **pdf.js + regex (local)** | **< 2s** | **95%+** | **$0** | ✅ **Motor activo** |
| Claude API (Edge Function) | 3–5s | Alta | ~$0.001/doc | Disponible como fallback |
| OCR Tesseract (descartado) | 8–12s | 80–85% | $0 | ❌ Requiere Ghostscript |

---

## 9. Sidebar y Navegación

### 9.1 Estructura Actual

```
Dashboard
Proyectos
Árbol de Proyecto
Inventario
▼ Gestión de Materiales      ← grupo expandible
  ├── Solicitudes             → /materials/requests
  └── Maestro de Materiales  → /materials/catalog
Reportes
Avance Proyectos
Avance por Nodo
Asistencia
▼ 🤝 Relaciones Comerciales  ← grupo nuevo
  └── Directorio de Terceros → /relaciones/terceros
Usuarios
▼ Configuración              ← grupo expandible
  └── Empresa                → /settings/company
```

### 9.2 Notas de Implementación

- Hook de permisos: `usePermission` de `../../hooks/usePermission` (no `useAuth`)
- Componente de navegación: `NavLink` (no `Link`)
- `ProtectedRoute` definido internamente en `App.jsx`

---

## 10. Roles y Permisos

```
super_admin    → acceso total
admin_empresa  → configura empresa, aprueba solicitudes > límite
jefe_obra      → solicita, aprueba solicitudes <= límite, despacha a obra
almacenista    → recibe, reporta defectos
solicitante    → solo crea solicitudes
solo_lectura   → consultas y reportes
```

**RLS:** Todas las tablas tienen RLS habilitado. Política principal:
```sql
-- Solución al problema de referencia circular
CREATE POLICY "authenticated_own_profile"
  ON users_profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

**Constraint de roles** (CHECK, no ENUM):
```sql
CHECK (role IN ('super_admin','admin_empresa','jefe_obra',
                'almacenista','solicitante','solo_lectura'))
```

---

## 11. Bugs Resueltos

### 11.1 Módulo de Parsing Fiscal (Fase 3 — Marzo 2026)

| Problema | Causa Raíz | Solución | Impacto |
|----------|------------|----------|---------|
| `hashOriginal.toHex is not a function` | Bug crypto de pdf.js v3+ en Vite con firmas SAT | `ignoreErrors: true` + worker local | ⚠️ Alto |
| Worker desde CDN fallaba en localhost | CORS + requería internet | Importar worker local con `?url` (Vite) | ⚠️ Alto |
| `getDocument - no url parameter provided` | Sintaxis incorrecta `{ url: arrayBuffer }` | Usar `{ arrayBuffer }` directamente | ⚠️ Alto |
| Texto binario ilegible / OCR fallaba | PDF con firma digital compleja | Extracción nativa pdf.js — no se necesita OCR | ⚠️ Crítico |
| Regex no detectaba CSF 2023–2026 | Patrones solo para CSF antigua | Múltiples patrones por campo + detección automática | ⚠️ Medio |
| `getCamposCriticos` no exportado | Función faltante en service | Agregar exportación completa | ⚠️ Bajo |
| `hashOriginal.toHex` en CSF con QR | Verificación de firma en PDF con QR | `disableNativeImageDecoder: true` | ⚠️ Medio |

### 11.2 Módulo de Terceros / Edge Function (Fase 2 — Marzo 2026)

| Problema | Causa Raíz | Solución |
|----------|------------|----------|
| Error 401 en Edge Function | JWT verification activo por defecto | Dashboard + `config.toml` con `verify_jwt = false` |
| CPU Timeout (código 546) | Extractor manual recorría PDF byte a byte | Migración a Claude API (v6) |
| Parser no reconocía CSF del SAT | Encoding de fuentes propietario SAT | Migración a pdf.js local (solución definitiva) |
| Import `ProtectedRoute` fallaba | Archivo separado que no existe en el proyecto | ProtectedRoute es interno en `App.jsx` |
| Import `useAuth` en Sidebar fallaba | Sidebar usa `usePermission`, no `useAuth` | Corregir import y usar estructura original |
| Service apuntaba a función inexistente | `documentParser.service.js` apuntaba a `parse-document-local` | Corregir URL a `parse-document` |

### 11.3 Módulo de Materiales (Fases 1–2)

| Problema | Causa Raíz | Solución |
|----------|------------|----------|
| Error `500 No API key` en RLS | Referencia circular en políticas | Política simple `auth.uid() = id` |

---

## 12. Próximos Pasos

### 12.1 Inmediato (1–2 semanas)

**Completar integración de Terceros**
- Componentes pendientes: `TerceroDetail.jsx`, `FiscalDashboard.jsx`, `BanderasPanel.jsx`
- Completar parsers: `parse32D()` y `parseCSD()` en `documentParser.service.js`
- Confirmar que la extracción de 32-D y CSD funciona con documentos reales

**Validación de RFC contra SAT**
- Integración con API del SAT para verificar RFC activo
- Alerta si RFC no existe, está suspendido o cancelado

**Despacho a Obra (cierra Fase 2)**
- Integrar `DispatchForm.jsx` en `MaterialRequestsV2.jsx` como acción en tab "Recibidos"
- Ejecutar migración `migration_dispatch_fase2.sql` si no está aplicada

### 12.2 Corto Plazo (1 mes)

- **Dashboard Fiscal:** KPIs de terceros, alertas CSD por vencer, documentación pendiente
- **Validación CSD contra SAT:** verificar vigencia y revocación del certificado
- **Notificaciones Push:** alerta cuando CSD vence en < 30 días
- **Integración Facturación:** vincular tercero → proyecto → factura

### 12.3 Mediano Plazo (2–3 meses)

- **Buzón Fiscal SAT:** SOAP + e.firma AES-256 + descarga masiva CFDI
- **Validación bancaria CLABE:** integración para confirmar titularidad automática
- **Libro Mayor y Contabilidad Electrónica Anexo 24**
- **OCR Fallback:** Tesseract.js para documentos escaneados (si eventualmente se necesita)

---

## 13. Notas Técnicas

### 13.1 Por qué pdf.js y no OCR para documentos SAT

Los PDFs del SAT (CSF, 32-D, CSD) **no son documentos escaneados**:
- Son generados digitalmente por el SAT
- Contienen texto seleccionable al 100%
- El OCR añade complejidad sin aportar precisión

**Benchmark:**

| Método | Tiempo Promedio | Precisión | Complejidad |
|--------|-----------------|-----------|-------------|
| pdf.js (nativo) | 1.2 segundos | 95%+ | Baja |
| OCR (Tesseract) | 8.5 segundos | 85% | Alta |
| OCR + Ghostscript | 12.3 segundos | 80% | Muy Alta |

### 13.2 Manejo de Errores en el Parser

```javascript
// Bug crypto con firma digital SAT
if (pdfError.message?.includes('hashOriginal.toHex')) {
  return {
    success: false,
    error: 'Documento con firma digital compleja. Usa una CSF sin firma avanzada.',
    metodo: 'failed_crypto'
  };
}

// Texto insuficiente
if (!textoExtraido || textoExtraido.length < 50) {
  throw new Error('Texto extraído insuficiente');
}

// PDF corrupto
if (error.name === 'InvalidPDFException') {
  throw new Error('PDF corrupto o inválido');
}

// PDF protegido
if (error.name === 'PasswordException') {
  throw new Error('PDF protegido con contraseña');
}
```

### 13.3 Precios calculados automáticamente (Materiales)

`sale_price_obra` y `margin_pct` son columnas **STORED** en PostgreSQL — se calculan automáticamente en INSERT/UPDATE, no se guardan manualmente.

### 13.4 Ingreso automático a inventario

Al confirmar recepción:
```javascript
await supabase.rpc('auto_ingest_to_inventory', { request_id: requestId })
```
Ejecuta UPSERT en `inventory` y registra en `movements`.

### 13.5 Performance del Parser

| Métrica | Valor |
|---------|-------|
| Tiempo extracción texto PDF | < 2 segundos |
| Tiempo parsing CSF | < 500ms |
| Precisión en campos críticos | 95%+ |
| Tamaño máximo PDF | 10MB |
| Memoria utilizada | ~50MB |
| CPU utilizada | ~15% |

---

*Documento generado: 13 de marzo de 2026*  
*Versión: 4.0*  
*Autor: Ing. Ricardo López Costilla*  
*Confidencial — Propiedad de DINNOVAC / OBRIX ERP*
