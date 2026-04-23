export interface PraxisNode {
  id: string;
  layer: 1 | 2;
  domain?: string;
  category: string;
  severity?: 'critical' | 'important' | 'recommended' | 'informational';
  depends_on: string[];
  related: string[];
  anti_pattern_of?: string;
  layer1_parent?: string;
  angular_version?: string;
  module?: string;
  title: string;
  body?: string;
  path: string;
  dependents?: string[];
  children?: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  layer: 1 | 2;
  domain?: string;
  category: string;
  severity?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'depends_on' | 'related' | 'layer1_parent';
}

export interface TaxonomyDomain {
  name: string;
  categories: TaxonomyCategory[];
  nodeCount: number;
}

export interface TaxonomyCategory {
  name: string;
  nodes: { id: string; title: string; severity?: string }[];
}

export interface TaxonomyResponse {
  layer1: TaxonomyDomain[];
  layer2: TaxonomyDomain[];
}

export interface TaxonomyStats {
  totalNodes: number;
  layer1Count: number;
  layer2Count: number;
  edgesByType: { depends_on: number; related: number; layer1_parent: number };
  domainCounts: Record<string, number>;
  severityCounts: Record<string, number>;
}

export interface SearchResult {
  score: number;
  content: string;
  file_path: string;
  node?: PraxisNode;
}

export interface ReferenceDoc {
  slug: string;
  title: string;
  body?: string;
  order: number;
}
