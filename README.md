# Novo

[Aplicación web](https://productivitynovo.vercel.app) · [Novo Companion 0.2.7](https://github.com/jeremyencarnacion2000-stack/Novo/releases/tag/companion-v0.2.7)

La rama `main` contiene la versión que se publica en Vercel. El proyecto web vive en la raíz; el compañero de Windows está en [`companion/windows`](companion/windows/README.md). Vercel solo compila la web.

## Web

Requisitos: Node.js 24 y PostgreSQL. Copia `.env.local.example` a `.env.local` y configura tus credenciales.

```powershell
npm ci --legacy-peer-deps
npm run dev
npm test -- --runInBand
npm run build
```

La configuración de Vercel usa `npm ci --legacy-peer-deps` y `npm run vercel-build`, con comprobación de TypeScript activa. Aplica las migraciones aditivas de Prisma de forma explícita, antes de publicar código que las requiera.

## Compañero

Descarga el instalador de GitHub Releases o consulta [sus instrucciones](companion/windows/README.md). La configuración local, credenciales y datos personales no se publican.
