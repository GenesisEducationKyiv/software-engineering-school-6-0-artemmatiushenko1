import Fastify from 'fastify';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { db } from './platform/db/client.js';
import { createFastifyServerOptions } from './platform/fastify/create-fastify-server-options.js';
import {
  MIGRATIONS_FOLDER,
  runDatabaseMigrations,
} from './platform/db/migrate.js';

const appConfig = createConfig();

const fastify = Fastify(createFastifyServerOptions(appConfig));
const container = new AppContainer(appConfig, fastify.log, db);
container.registerEventSubscribers();
const deps = container.build();

deps.logger.info('Running database migrations...');
await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
deps.logger.info('Migrations completed successfully.');

const app = await App.create(appConfig, container.build(), fastify);

await app.start();

app.startScannerCron();
