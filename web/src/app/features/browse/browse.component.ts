import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TreeNode } from 'primeng/api';
import { ContentService } from '../../core/services/content.service';
import { TaxonomyResponse, TaxonomyDomain, TaxonomyStats } from '../../core/models/praxis.interfaces';

@Component({
  selector: 'app-browse',
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseComponent implements OnInit, OnDestroy {
  treeNodes: TreeNode[] = [];
  loading = true;
  stats: TaxonomyStats | null = null;

  layerOptions = [
    { label: 'Both', value: 'both' },
    { label: 'L1 - Universal', value: 'l1' },
    { label: 'L2 - Angular', value: 'l2' },
  ];
  selectedLayer = 'both';

  severityOptions = [
    { label: 'Critical', value: 'critical' },
    { label: 'Important', value: 'important' },
    { label: 'Recommended', value: 'recommended' },
    { label: 'Informational', value: 'informational' },
  ];
  selectedSeverities: string[] = [];

  private taxonomy: TaxonomyResponse | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private contentService: ContentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.contentService.getTaxonomy()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (taxonomy) => {
          this.taxonomy = taxonomy;
          this.buildTree();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });

    this.contentService.getStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onLayerChange(): void {
    this.buildTree();
  }

  onSeverityChange(): void {
    this.buildTree();
  }

  onNodeSelect(event: { node: TreeNode }): void {
    const node = event.node;
    if (node.type === 'leaf' && node.data?.id) {
      this.router.navigate(['/article', node.data.id]);
    }
  }

  private buildTree(): void {
    if (!this.taxonomy) { return; }

    const domains: TaxonomyDomain[] = [];

    if (this.selectedLayer === 'both' || this.selectedLayer === 'l1') {
      domains.push(...this.taxonomy.layer1.map(d => ({ ...d, name: `L1: ${d.name}` })));
    }
    if (this.selectedLayer === 'both' || this.selectedLayer === 'l2') {
      domains.push(...this.taxonomy.layer2.map(d => ({ ...d, name: `L2: ${d.name}` })));
    }

    this.treeNodes = domains.map(domain => this.domainToTreeNode(domain));
    this.cdr.markForCheck();
  }

  private domainToTreeNode(domain: TaxonomyDomain): TreeNode {
    return {
      label: `${domain.name} (${domain.nodeCount})`,
      icon: 'pi pi-folder',
      expandedIcon: 'pi pi-folder-open',
      type: 'domain',
      expanded: false,
      children: domain.categories.map(cat => ({
        label: `${cat.name} (${cat.nodes.length})`,
        icon: 'pi pi-list',
        type: 'category',
        expanded: false,
        children: cat.nodes
          .filter(n => {
            if (!this.selectedSeverities.length) { return true; }
            return n.severity ? this.selectedSeverities.includes(n.severity) : false;
          })
          .map(n => ({
            label: n.title,
            icon: this.getSeverityIcon(n.severity),
            type: 'leaf',
            data: { id: n.id, severity: n.severity },
          })),
      })).filter(cat => cat.children!.length > 0),
    };
  }

  private getSeverityIcon(severity?: string): string {
    switch (severity) {
      case 'critical': return 'pi pi-exclamation-triangle';
      case 'important': return 'pi pi-exclamation-circle';
      case 'recommended': return 'pi pi-info-circle';
      case 'informational': return 'pi pi-question-circle';
      default: return 'pi pi-file';
    }
  }
}
