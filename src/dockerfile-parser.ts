import fs from 'node:fs';
import path from 'node:path';
import { DockerDependency, DockerfileRecord, RepoConfig, ResolutionConfidence } from './types.js';

interface ParseContext {
  args: Map<string, string>;
  stages: Set<string>;
}

export function parseDockerfile(repo: RepoConfig, absolutePath: string): DockerfileRecord {
  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const context: ParseContext = {
    args: new Map(),
    stages: new Set(),
  };

  const dependencies: DockerDependency[] = [];
  const declaredImages: string[] = [];

  for (const line of lines) {
    const trimmed = stripComment(line).trim();
    if (!trimmed) continue;

    const argMatch = trimmed.match(/^ARG\s+([A-Za-z_][A-Za-z0-9_]*)=(.+)$/i);
    if (argMatch) {
      context.args.set(argMatch[1], argMatch[2].trim());
      continue;
    }

    const fromMatch = trimmed.match(/^FROM\s+(.+)$/i);
    if (!fromMatch) continue;

    const fromBody = fromMatch[1].trim();
    const parts = fromBody.split(/\s+/);
    const imageRef = resolveArgSubstitution(parts[0], context.args);
    const aliasIndex = parts.findIndex((part) => part.toUpperCase() === 'AS');
    const alias = aliasIndex >= 0 ? parts[aliasIndex + 1] : undefined;

    if (alias) {
      context.stages.add(alias);
    }

    if (context.stages.has(imageRef)) {
      continue;
    }

    const confidence: ResolutionConfidence = imageRef.includes('${') ? 'unresolved' : 'inferred';
    dependencies.push({
      raw: parts[0],
      resolved: imageRef,
      type: 'image',
      sourceInstruction: trimmed,
      confidence,
    });
  }

  const relativePath = path.relative(repo.path, absolutePath);
  const serviceName = deriveServiceName(relativePath);

  for (const configuredImage of repo.images ?? []) {
    const configuredDockerfile = configuredImage.dockerfile ? normalizePath(configuredImage.dockerfile) : undefined;
    if (!configuredDockerfile || configuredDockerfile === normalizePath(relativePath)) {
      declaredImages.push(configuredImage.name);
    }
  }

  return {
    id: `${repo.name}:${relativePath}`,
    repo: repo.name,
    path: relativePath,
    absolutePath,
    serviceName,
    declaredImages,
    dependencies,
  };
}

function resolveArgSubstitution(value: string, args: Map<string, string>): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => args.get(name) ?? `\${${name}}`);
}

function stripComment(line: string): string {
  if (line.trimStart().startsWith('#')) return '';
  return line;
}

function deriveServiceName(relativePath: string): string {
  const normalized = normalizePath(relativePath);
  const dirname = path.posix.dirname(normalized);
  if (dirname === '.') return normalized;
  return dirname;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}
