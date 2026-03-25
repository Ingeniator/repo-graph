import fs from 'node:fs';
import path from 'node:path';
import { DockerDependency, DockerfileRecord, RepoConfig, ResolutionConfidence, ScanWarning } from './types.js';

interface ParseContext {
  globalArgs: Map<string, string>;
  stageArgs: Map<string, string>;
  stages: Set<string>;
  seenFrom: boolean;
}

export function parseDockerfile(repo: RepoConfig, absolutePath: string): DockerfileRecord {
  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const context: ParseContext = {
    globalArgs: new Map(),
    stageArgs: new Map(),
    stages: new Set(),
    seenFrom: false,
  };

  const dependencies: DockerDependency[] = [];
  const declaredImages: string[] = [];
  const warnings: ScanWarning[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const trimmed = stripComment(lines[index]).trim();
    if (!trimmed) continue;

    const argMatch = trimmed.match(/^ARG\s+([A-Za-z_][A-Za-z0-9_]*)(?:=(.*))?$/i);
    if (argMatch) {
      const name = argMatch[1];
      const value = argMatch[2]?.trim();
      if (!context.seenFrom) {
        if (value !== undefined) {
          context.globalArgs.set(name, value);
        }
      } else if (value !== undefined) {
        context.stageArgs.set(name, value);
      } else if (!context.stageArgs.has(name) && !context.globalArgs.has(name)) {
        warnings.push({
          code: 'docker.arg.unset',
          message: `ARG ${name} is declared without a default and may remain unresolved`,
          line: lineNumber,
          instruction: trimmed,
        });
      }
      continue;
    }

    const fromMatch = trimmed.match(/^FROM\s+(.+)$/i);
    if (!fromMatch) continue;

    context.seenFrom = true;
    context.stageArgs = new Map(context.globalArgs);

    const parsed = parseFromInstruction(fromMatch[1].trim());
    if (!parsed) {
      warnings.push({
        code: 'docker.from.unparsed',
        message: 'Unable to parse FROM instruction',
        line: lineNumber,
        instruction: trimmed,
      });
      continue;
    }

    const imageRef = resolveArgSubstitution(parsed.rawImageRef, context.stageArgs);
    if (parsed.alias) {
      context.stages.add(parsed.alias);
    }

    if (context.stages.has(imageRef)) {
      continue;
    }

    const dependencyWarnings: ScanWarning[] = [];
    const unresolvedVars = findUnresolvedVariables(imageRef);
    if (unresolvedVars.length) {
      dependencyWarnings.push({
        code: 'docker.from.unresolved_arg',
        message: `Unresolved build arg(s) in base image reference: ${unresolvedVars.join(', ')}`,
        line: lineNumber,
        instruction: trimmed,
      });
    }

    const confidence: ResolutionConfidence = unresolvedVars.length ? 'unresolved' : 'inferred';
    dependencies.push({
      raw: parsed.rawImageRef,
      resolved: imageRef,
      type: 'image',
      sourceInstruction: trimmed,
      sourceLine: lineNumber,
      confidence,
      warnings: dependencyWarnings,
    });
    warnings.push(...dependencyWarnings);
  }

  const repoPath = repo.path;
  if (!repoPath) {
    throw new Error(`Repo '${repo.name}' has no resolved path`);
  }

  const relativePath = path.relative(repoPath, absolutePath);
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
    warnings,
  };
}

function parseFromInstruction(fromBody: string): { rawImageRef: string; alias?: string } | undefined {
  const parts = fromBody.match(/(?:"[^"]*"|'[^']*'|\S+)/g) ?? [];
  if (!parts.length) {
    return undefined;
  }

  let cursor = 0;
  while (cursor < parts.length && parts[cursor].startsWith('--')) {
    cursor += 1;
  }

  const rawImageRef = parts[cursor];
  if (!rawImageRef) {
    return undefined;
  }

  let alias: string | undefined;
  for (let index = cursor + 1; index < parts.length; index += 1) {
    if (parts[index].toUpperCase() === 'AS') {
      alias = parts[index + 1];
      break;
    }
  }

  return { rawImageRef, alias };
}

function resolveArgSubstitution(value: string, args: Map<string, string>): string {
  return value
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}/g, (match, name: string) => args.get(name) ?? match)
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) => args.get(name) ?? match);
}

function findUnresolvedVariables(value: string): string[] {
  const matches = value.match(/\$\{[A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?\}|\$[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return [...new Set(matches)];
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
