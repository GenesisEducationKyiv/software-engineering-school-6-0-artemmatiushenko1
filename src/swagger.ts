import { type AppConfig } from './config.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import YAML from 'yaml';
import type { OpenAPIV2 } from 'openapi-types';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { fileURLToPath, URL } from 'node:url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setupSwagger = async (
  config: AppConfig,
  fastify: FastifyInstance,
) => {
  const swaggerPath = path.join(__dirname, '../swagger.yaml');
  const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
  const swaggerConfig = YAML.parse(swaggerFile) as OpenAPIV2.Document;

  const appUrl = new URL(config.appUrl);
  swaggerConfig.host = appUrl.host;
  swaggerConfig.schemes = [appUrl.protocol.replace(':', '')];

  await fastify.register(fastifySwagger, {
    mode: 'static',
    specification: {
      document: swaggerConfig,
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
  });
};
