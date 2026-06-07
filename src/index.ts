import Fastify from 'fastify';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { db } from './db/index.js';
import { MIGRATIONS_FOLDER, runDatabaseMigrations } from './db/migrate.js';

const fastify = Fastify({
  logger: true,
});

const appConfig = createConfig();
const container = new AppContainer(appConfig, fastify.log, db);
const deps = container.build();

deps.logger.info('Running database migrations...');
await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
deps.logger.info('Migrations completed successfully.');

const app = await App.create(appConfig, container.build(), fastify);

await app.start();

app.startScannerCron();
