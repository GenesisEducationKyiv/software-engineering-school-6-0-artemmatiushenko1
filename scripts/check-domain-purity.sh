grep -rE "from ['\"](pg|nodemailer|drizzle|fastify|octokit|ioredis|prom-client|zod)" src/modules/*/domain/ src/modules/*/application && exit 1 || echo OK
