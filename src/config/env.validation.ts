const environments = ['development', 'test', 'production'] as const;

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = config.NODE_ENV ?? 'development';
  if (
    typeof nodeEnv !== 'string' ||
    !environments.includes(nodeEnv as (typeof environments)[number])
  ) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const rawPort = config.PORT ?? 3000;
  const port = typeof rawPort === 'number' ? rawPort : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required.');
  }
  try {
    const parsedDatabaseUrl = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  const accessSecret = config.JWT_ACCESS_SECRET;
  if (typeof accessSecret !== 'string' || accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters.');
  }

  const refreshTtlDays = Number(config.SESSION_REFRESH_TTL_DAYS ?? 30);
  if (!Number.isInteger(refreshTtlDays) || refreshTtlDays < 1 || refreshTtlDays > 365) {
    throw new Error('SESSION_REFRESH_TTL_DAYS must be an integer between 1 and 365.');
  }

  const accessTtlSeconds = Number(config.JWT_ACCESS_TTL_SECONDS ?? 900);
  if (!Number.isInteger(accessTtlSeconds) || accessTtlSeconds < 60 || accessTtlSeconds > 86400) {
    throw new Error('JWT_ACCESS_TTL_SECONDS must be an integer between 60 and 86400.');
  }

  const smtpPort = Number(config.SMTP_PORT ?? 1025);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }

  const corsOrigins = config.CORS_ORIGINS ?? '';
  if (typeof corsOrigins !== 'string') {
    throw new Error('CORS_ORIGINS must be a comma-separated string.');
  }

  const allowedOrigins = corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of allowedOrigins) {
    try {
      const parsedOrigin = new URL(origin);
      if (
        parsedOrigin.origin !== origin ||
        !['http:', 'https:'].includes(parsedOrigin.protocol)
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        `CORS_ORIGINS contains an invalid origin: ${origin}`,
      );
    }
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_ACCESS_TTL_SECONDS: accessTtlSeconds,
    SESSION_REFRESH_TTL_DAYS: refreshTtlDays,
    SMTP_HOST: config.SMTP_HOST ?? 'localhost',
    SMTP_PORT: smtpPort,
    SMTP_USER: config.SMTP_USER ?? '',
    SMTP_PASSWORD: config.SMTP_PASSWORD ?? '',
    EMAIL_FROM: config.EMAIL_FROM ?? 'FINDR <no-reply@localhost>',
    WEB_APP_URL: config.WEB_APP_URL ?? 'http://localhost:5173',
    CORS_ORIGINS: allowedOrigins,
  };
}
