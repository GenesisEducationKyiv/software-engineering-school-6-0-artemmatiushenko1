grep -rE "from ['\"](pg|nodemailer|drizzle|fastify|octokit|ioredis|prom-client)" src/modules/*/domain/ && exit 1 || echo OK
