# Tuscolo Cleaning Tracker

MVP funcional para validar el flujo interno de limpieza de Tuscolo con frontend React y backend Node simple.

## Stack

- React + TypeScript
- Vite
- CSS responsive
- Backend Node sin dependencias externas
- Persistencia local en `server/data/db.json`
- Tareas HACCP importadas desde `HACCP-Checkliste Digital.xlsx`

## Ejecutar

```bash
npm install
npm run api
```

En otra terminal:

```bash
npm run dev
```

Luego abrir la URL local que indique Vite. El frontend usa `/api` y Vite lo proxyea al backend local en `http://127.0.0.1:8787`.

Para servir la app compilada desde el backend:

```bash
npm run build
npm start
```

## Usuario Inicial

- Admin: `admin@tuscolo.de` / `admin123`

Después de entrar como admin podés promover usuarios registrados a admin desde el panel.

Para producción, configurá un email y contraseña inicial propios con `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD`.

## Backend MVP

- API Node sin dependencias externas.
- Persistencia local en `server/data/db.json`.
- Login con contraseña hasheada con `scrypt`.
- Sesiones con token firmado y rutas protegidas.
- Permisos: empleados solo pueden crear sus propios chequeos; admins pueden gestionar tareas, registros y roles.
- Límite de intentos para login/registro y límite de tamaño para fotos enviadas en registros.
- Registro con código de confirmación por email si configurás `RESEND_API_KEY`; sin esa variable usa código demo en consola.
- Gestión de roles desde el panel admin.
- Endpoints para tareas, registros y usuarios.

## Variables De Producción

En Render, agregá al menos estas variables:

```bash
HOST=0.0.0.0
SESSION_SECRET=una_clave_larga_random_de_32_caracteres_o_mas
INITIAL_ADMIN_EMAIL=tu-email-admin@dominio.com
INITIAL_ADMIN_PASSWORD=una-password-segura
INITIAL_ADMIN_NAME=Tuscolo Admin
INITIAL_ADMIN_LANGUAGE=es
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=Tuscolo <onboarding@resend.dev>
```

Opcionales:

```bash
MAX_BODY_BYTES=10485760
MAX_RECORD_PHOTO_BYTES=7340032
```

También tenés una plantilla en `.env.example`.

## Email Real En Producción

Para enviar emails reales, necesitás estas variables de entorno:

```bash
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=Tuscolo <onboarding@resend.dev>
```

Para enviar a cualquier email real, Resend requiere un dominio verificado. Mientras uses `onboarding@resend.dev`, Resend normalmente permite pruebas limitadas, pero para uso real conviene verificar un dominio propio y poner:

```bash
EMAIL_FROM=Tuscolo <noreply@tudominio.com>
```

## Estado Actual Del MVP

- Branding Tuscolo con slogan `Sotto il cielo d’Italia`
- Selector de idioma: Español, Alemán, Inglés e Italiano
- Login/register con confirmación por email
- Roles admin/empleado
- Selector de empleado y área para iniciar chequeos
- Wizard de preguntas por área con respuestas Hecho/No hecho
- Administración de tareas por sector: agregar, editar y eliminar
- Frecuencia de tarea diaria/semanal
- Registro incompleto con tareas fallidas y motivo por tarea
- Fotos por paso diario, con confirmación si se continúa sin foto
- Registro completado con mensaje opcional
- Fecha y hora guardadas automáticamente
- Vista de registros del mes
- Exportación inicial mediante impresión del resumen mensual

## Pendiente Para Producción Real

- Reemplazar `server/data/db.json` por una base de datos persistente como Supabase, Neon o PostgreSQL gestionado.
- Guardar fotos en storage real como Supabase Storage, S3/R2 o similar, en vez de guardar imágenes base64 dentro del JSON.
- Verificar un dominio propio en Resend para usar un `EMAIL_FROM` real.
- Configurar backups, monitoreo y una política de retención de registros/fotos.
