import pg from 'pg';

export async function truncateTables(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(
    'TRUNCATE TABLE subscription_tokens, subscriptions RESTART IDENTITY CASCADE',
  );
  await client.end();
}

export async function getSubscriptionToken(
  email: string,
  repo: string,
  scope: 'subscribe' | 'unsubscribe',
): Promise<string> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query<{ token: string }>(
    `SELECT st.token
     FROM subscription_tokens st
     JOIN subscriptions s ON s.id = st.subscription_id
     WHERE s.email = $1 AND s.repo = $2 AND st.scope = $3
     LIMIT 1`,
    [email, repo, scope],
  );
  await client.end();
  return result.rows[0].token;
}
