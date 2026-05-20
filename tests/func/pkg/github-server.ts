import http from 'http';
import type { AddressInfo } from 'net';

type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

export class GitHubTestServer {
  private server: http.Server;
  public baseUrl = '';
  private handlers = new Map<string, RouteHandler>();

  constructor() {
    this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      const key = `${req.method} ${req.url?.split('?')[0]}`;
      const handler = this.handlers.get(key);
      if (handler) {
        handler(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not Found' }));
      }
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server.close((err?: Error) => (err ? reject(err) : resolve())),
    );
  }

  on(method: string, path: string, handler: RouteHandler): void {
    this.handlers.set(`${method} ${path}`, handler);
  }

  reset(): void {
    this.handlers.clear();
  }

  repoExists(owner: string, repo: string): void {
    this.on('GET', `/repos/${owner}/${repo}`, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 1, name: repo, full_name: `${owner}/${repo}` }));
    });
  }

  repoNotFound(owner: string, repo: string): void {
    this.on('GET', `/repos/${owner}/${repo}`, (_req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not Found' }));
    });
  }

  latestRelease(
    owner: string,
    repo: string,
    release: { tag_name: string; name?: string | null; published_at?: string | null },
  ): void {
    this.on('GET', `/repos/${owner}/${repo}/releases/latest`, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(release));
    });
  }
}
