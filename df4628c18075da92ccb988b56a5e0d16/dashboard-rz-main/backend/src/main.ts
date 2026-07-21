import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

// origens web explicitamente permitidas (frontend hospedado em navegador comum)
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      // API pura (JSON + download de arquivo), sem HTML servido daqui — CSP
      // de verdade já vive no index.html do frontend. cross-origin liberado
      // pq frontend e backend podem ficar em domínios diferentes (ex.:
      // Vercel + backend hospedado à parte).
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: (origin, callback) => {
      // sem Origin (curl/server-to-server) não dá pra checar domínio —
      // libera. Sem credentials:true aqui (o app usa Authorization: Bearer,
      // não cookie), então isso não abre brecha de CSRF via cookie.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Dashboard API rodando em http://localhost:${port}/api`);
}

bootstrap();
