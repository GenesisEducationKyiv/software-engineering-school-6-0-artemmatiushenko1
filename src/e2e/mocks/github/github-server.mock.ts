import fastify from 'fastify';

const server = fastify();

server.get('/repos/facebook/react', () => {
  return {
    id: 10270250,
    name: 'react',
    full_name: 'facebook/react',
    owner: {
      login: 'facebook',
    },
  };
});

server.get('/repos/facebook/react/releases/latest', () => {
  return {
    tag_name: 'v18.2.0',
    name: 'v18.2.0',
    published_at: '2022-06-14T17:15:21Z',
  };
});

server.get('/health', () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 9090, host: '0.0.0.0' });
    console.log('GitHub mock server listening on port 9090');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

await start();
