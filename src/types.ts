export type ResolutionConfidence = 'configured' | 'inferred' | 'unresolved';
export type ViewType = 'repo' | 'dockerfile' | 'image';

export interface RepoConfig {
  name: string;
  path?: string;
  github?: string;
  git?: string;
  ref?: string;
  images?: ConfiguredImage[];
}

export interface ConfiguredImage {
  name: string;
  dockerfile?: string;
}

export interface RawConfig {
  repos: RepoConfig[];
  settings?: {
    dockerfilePatterns?: string[];
    cacheDir?: string;
  };
  imageOwnership?: Record<string, { repo: string; dockerfile?: string; confidence?: ResolutionConfidence }>;
}

export interface DockerfileRecord {
  id: string;
  repo: string;
  path: string;
  absolutePath: string;
  serviceName: string;
  declaredImages: string[];
  dependencies: DockerDependency[];
  warnings: ScanWarning[];
}

export interface DockerDependency {
  raw: string;
  resolved: string;
  type: 'image';
  sourceInstruction: string;
  sourceLine: number;
  confidence: ResolutionConfidence;
  ownership?: OwnershipResolution;
  warnings?: ScanWarning[];
}

export interface OwnershipResolution {
  repo?: string;
  dockerfile?: string;
  confidence: ResolutionConfidence;
  reason: string;
}

export interface RepoNode {
  name: string;
  path: string;
  dockerfiles: DockerfileRecord[];
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: 'depends_on';
  confidence: ResolutionConfidence;
  metadata: Record<string, string | undefined>;
}

export interface SourceDiagnostic {
  repo: string;
  source: string;
  cachePath?: string;
  ref?: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  details?: string;
}

export interface ScanWarning {
  code: string;
  message: string;
  line?: number;
  instruction?: string;
  details?: string;
}

export interface ScanMetadata {
  configPath?: string;
  repoCount: number;
  dockerfileCount: number;
  dependencyCount: number;
  internalEdgeCount: number;
  externalEdgeCount: number;
  unresolvedCount: number;
  warningCount: number;
  dockerfilePatterns: string[];
  sourceDiagnostics: SourceDiagnostic[];
}

export interface ScanGraph {
  generatedAt: string;
  repos: RepoNode[];
  edges: GraphEdge[];
  unresolvedImages: string[];
  metadata: ScanMetadata;
}

export interface RepoResolutionOptions {
  cacheDir?: string;
  refresh?: boolean;
  diagnostics?: SourceDiagnostic[];
}
