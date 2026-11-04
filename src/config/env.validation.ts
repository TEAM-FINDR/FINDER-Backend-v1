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
    CORS_ORIGINS: allowedOrigins,
  };
}
