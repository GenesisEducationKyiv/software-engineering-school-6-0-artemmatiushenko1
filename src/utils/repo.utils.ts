export function parseRepoPath(repoPath: string): {
  owner: string;
  repo: string;
} {
  const [owner, repo] = repoPath.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository path: ${repoPath}`);
  }
  return { owner, repo };
}
