# Tuscolo Cleaning Tracker

MVP frontend para validar el flujo interno de limpieza de Tuscolo.

## Stack

- React + TypeScript
- Vite
- CSS responsive sin backend
- Datos mockeados y registros persistidos en `localStorage`
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

## Usuarios demo

- Admin: `admin@tuscolo.de` / `admin123`
- Empleados demo: contraseña `demo123`

## Backend MVP

- API Node sin dependencias externas.
- Persistencia local en `server/data/db.json`.
- Login con contraseña hasheada.
- Registro con código de confirmación por email si configurás `RESEND_API_KEY`; sin esa variable usa código demo en consola.
- Gestión de roles desde el panel admin.
- Endpoints para tareas, registros y usuarios.

## Email Real En Producción

En Render, agregá estas variables de entorno:

```bash
HOST=0.0.0.0
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=Tuscolo <onboarding@resend.dev>
```

Para enviar a cualquier email real, Resend requiere un dominio verificado. Mientras uses `onboarding@resend.dev`, Resend normalmente permite pruebas limitadas, pero para uso real conviene verificar un dominio propio y poner:

```bash
EMAIL_FROM=Tuscolo <noreply@tudominio.com>
```

## Funcionalidades MVP

- Branding Tuscolo con slogan `Sotto il cielo d’Italia`
- Selector de idioma: Español, Alemán, Inglés e Italiano
- Selector de empleado y área
- Wizard de preguntas por área con respuestas Sí/No
- Administración de tareas por sector: agregar, editar y eliminar
- Frecuencia de tarea diaria/semanal
- Registro incompleto al responder No, con tarea fallida y comentario opcional
- Registro completado al responder Sí a todas, con foto obligatoria y mensaje opcional
- Fecha y hora guardadas automáticamente
- Vista de registros del mes
- Exportación inicial mediante impresión del resumen mensual
