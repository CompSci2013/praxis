import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Node, Edge, ClusterNode, Layout } from '@swimlane/ngx-graph';
import { GraphService } from '../../../core/services/graph.service';
import { GraphData, GraphEdge } from '../../../core/models/praxis.interfaces';
import { Title } from '@angular/platform-browser';

interface DomainOption { label: string; value: string; }
interface EdgeTypeOption { label: string; value: string; checked: boolean; }

@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  nodes: Node[] = [];
  links: Edge[] = [];
  clusters: ClusterNode[] = [];

  layoutSettings = { orientation: 'TB' };
  layout: string | Layout = 'dagreCluster';
  zoomToFit$: Subject<any> = new Subject();

  layerOptions = [
    { label: 'All', value: 'all' },
    { label: 'Layer 1', value: '1' },
    { label: 'Layer 2', value: '2' },
  ];
  selectedLayer = 'all';

  domainOptions: DomainOption[] = [];
  selectedDomains: string[] = [];

  severityOptions: DomainOption[] = [
    { label: 'Critical', value: 'critical' },
    { label: 'Important', value: 'important' },
    { label: 'Recommended', value: 'recommended' },
    { label: 'Informational', value: 'informational' },
  ];
  selectedSeverities: string[] = [];

  edgeTypes: EdgeTypeOption[] = [
    { label: 'Depends On', value: 'depends_on', checked: true },
    { label: 'Related', value: 'related', checked: true },
    { label: 'Layer Mapping', value: 'layer1_parent', checked: true },
  ];

  viewMode: 'full' | 'neighborhood' = 'full';
  centerNodeId = '';
  neighborhoodDepth = 2;
  nodeSuggestions: { id: string; label: string }[] = [];

  loading = true;
  private fullGraphData: GraphData | null = null;

  domainColors: Record<string, string> = {
    architecture: '#e91e63',
    frontend: '#2196f3',
    backend: '#4caf50',
    'cross-cutting': '#ff9800',
    discipline: '#9c27b0',
  };

  edgeColors: Record<string, string> = {
    depends_on: '#ef5350',
    related: '#42a5f5',
    layer1_parent: '#66bb6a',
  };

  constructor(
    private graphService: GraphService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Praxis — Graph');
    this.loadFullGraph();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadFullGraph(): void {
    this.loading = true;
    this.graphService.getFullGraph()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.fullGraphData = data;
          this.extractDomains(data);
          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
          setTimeout(() => this.zoomToFit$.next(true), 500);
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private extractDomains(data: GraphData): void {
    const domains = new Set<string>();
    data.nodes.forEach(n => { if (n.domain) domains.add(n.domain); });
    this.domainOptions = Array.from(domains).sort().map(d => ({ label: this.capitalize(d), value: d }));
  }

  applyFilters(): void {
    if (!this.fullGraphData) return;

    let filteredNodes = [...this.fullGraphData.nodes];

    if (this.selectedLayer !== 'all') {
      const layer = parseInt(this.selectedLayer, 10);
      filteredNodes = filteredNodes.filter(n => n.layer === layer);
    }

    if (this.selectedDomains.length > 0) {
      filteredNodes = filteredNodes.filter(n => n.domain && this.selectedDomains.includes(n.domain));
    }

    if (this.selectedSeverities.length > 0) {
      filteredNodes = filteredNodes.filter(n => !n.severity || this.selectedSeverities.includes(n.severity));
    }

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const activeEdgeTypes = this.edgeTypes.filter(e => e.checked).map(e => e.value);

    let filteredEdges = this.fullGraphData.edges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target) && activeEdgeTypes.includes(e.type)
    );

    this.nodes = filteredNodes.map(n => ({
      id: n.id,
      label: n.label,
      data: {
        domain: n.domain,
        layer: n.layer,
        severity: n.severity,
        color: this.getNodeColor(n),
        borderColor: this.getSeverityColor(n.severity),
      },
    }));

    this.links = filteredEdges.map(e => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      data: {
        type: e.type,
        color: this.edgeColors[e.type] || '#888',
      },
    }));

    this.clusters = this.buildClusters(filteredNodes);
    this.cdr.markForCheck();
  }

  private buildClusters(nodes: { id: string; domain?: string; layer: number }[]): ClusterNode[] {
    const domainGroups = new Map<string, string[]>();
    nodes.forEach(n => {
      const key = n.domain || (n.layer === 2 ? 'angular' : 'other');
      if (!domainGroups.has(key)) domainGroups.set(key, []);
      domainGroups.get(key)!.push(n.id);
    });

    return Array.from(domainGroups.entries()).map(([domain, childIds]) => ({
      id: `cluster-${domain}`,
      label: this.capitalize(domain),
      childNodeIds: childIds,
    }));
  }

  onNodeClick(node: Node): void {
    this.router.navigate(['/article', node.id]);
  }

  searchNodes(event: { query: string }): void {
    if (!this.fullGraphData) return;
    const q = event.query.toLowerCase();
    this.nodeSuggestions = this.fullGraphData.nodes
      .filter(n => n.label.toLowerCase().includes(q) || n.id.includes(q))
      .slice(0, 10)
      .map(n => ({ id: n.id, label: n.label }));
  }

  onCenterNodeSelected(selected: { id: string }): void {
    if (!selected?.id) return;
    this.centerNodeId = selected.id;
    this.loadNeighborhood();
  }

  loadNeighborhood(): void {
    if (!this.centerNodeId) return;
    this.loading = true;
    this.graphService.getNeighborhood(this.centerNodeId, this.neighborhoodDepth)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          const graphData: GraphData = data;
          this.nodes = graphData.nodes.map(n => ({
            id: n.id,
            label: n.label,
            data: {
              domain: n.domain,
              layer: n.layer,
              severity: n.severity,
              color: this.getNodeColor(n),
              borderColor: this.getSeverityColor(n.severity),
              isCenter: n.id === this.centerNodeId,
            },
          }));
          this.links = graphData.edges.map(e => ({
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            data: { type: e.type, color: this.edgeColors[e.type] || '#888' },
          }));
          this.clusters = [];
          this.loading = false;
          this.cdr.markForCheck();
          setTimeout(() => this.zoomToFit$.next(true), 500);
        },
        error: () => { this.loading = false; this.cdr.markForCheck(); },
      });
  }

  toggleViewMode(): void {
    if (this.viewMode === 'full') {
      this.viewMode = 'neighborhood';
    } else {
      this.viewMode = 'full';
      this.applyFilters();
      setTimeout(() => this.zoomToFit$.next(true), 500);
    }
  }

  fitGraph(): void {
    this.zoomToFit$.next(true);
  }

  getNodeColor(node: { domain?: string; layer: number }): string {
    if (node.layer === 2) return '#1a237e';
    return this.domainColors[node.domain || ''] || '#333';
  }

  getSeverityColor(severity?: string): string {
    switch (severity) {
      case 'critical': return '#ef5350';
      case 'important': return '#ffa726';
      case 'recommended': return '#42a5f5';
      case 'informational': return '#78909c';
      default: return '#555';
    }
  }

  getEdgeStroke(type: string): string {
    return type === 'related' ? '4,4' : 'none';
  }

  private capitalize(s: string): string {
    return s.replace(/(^|\s|-)\w/g, c => c.toUpperCase());
  }
}
