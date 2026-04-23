import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { SearchService } from '../../core/services/search.service';
import { ContentService } from '../../core/services/content.service';
import { SearchResult, PraxisNode, TaxonomyResponse } from '../../core/models/praxis.interfaces';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent implements OnInit, OnDestroy {
  // Semantic search
  searchQuery = '';
  searchResults: SearchResult[] = [];
  searchLoading = false;

  // Filter search
  filterResults: PraxisNode[] = [];
  filterLoading = false;

  // Filter options
  domainOptions: { label: string; value: string }[] = [];
  categoryOptions: { label: string; value: string }[] = [];
  severityOptions = [
    { label: 'Critical', value: 'critical' },
    { label: 'Important', value: 'important' },
    { label: 'Recommended', value: 'recommended' },
    { label: 'Informational', value: 'informational' },
  ];
  layerOptions = [
    { label: 'All Layers', value: null },
    { label: 'L1 - Universal', value: 1 },
    { label: 'L2 - Angular', value: 2 },
  ];

  selectedDomain: string | null = null;
  selectedCategory: string | null = null;
  selectedSeverity: string | null = null;
  selectedLayer: number | null = null;

  activeTabIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private searchService: SearchService,
    private contentService: ContentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.contentService.getTaxonomy()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (taxonomy) => {
          this.buildFilterOptions(taxonomy);
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSemanticSearch(): void {
    if (!this.searchQuery.trim()) { return; }
    this.searchLoading = true;
    this.searchResults = [];
    this.cdr.markForCheck();

    this.searchService.semanticSearch(this.searchQuery.trim())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.searchLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (results) => {
          this.searchResults = results;
          this.cdr.markForCheck();
        },
      });
  }

  onFilterSearch(): void {
    this.filterLoading = true;
    this.filterResults = [];
    this.cdr.markForCheck();

    const filters: Record<string, string | number> = {};
    if (this.selectedLayer !== null) { filters['layer'] = this.selectedLayer; }
    if (this.selectedDomain) { filters['domain'] = this.selectedDomain; }
    if (this.selectedCategory) { filters['category'] = this.selectedCategory; }
    if (this.selectedSeverity) { filters['severity'] = this.selectedSeverity; }

    this.searchService.filterNodes(filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.filterLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (results) => {
          this.filterResults = results;
          this.cdr.markForCheck();
        },
      });
  }

  navigateToArticle(id: string): void {
    this.router.navigate(['/article', id]);
  }

  getSnippet(content: string, maxLen: number = 200): string {
    if (!content) { return ''; }
    return content.length > maxLen ? content.substring(0, maxLen) + '...' : content;
  }

  getScorePercent(score: number): number {
    return Math.round(score * 100);
  }

  private buildFilterOptions(taxonomy: TaxonomyResponse): void {
    const domains = new Set<string>();
    const categories = new Set<string>();

    [...taxonomy.layer1, ...taxonomy.layer2].forEach(domain => {
      domains.add(domain.name);
      domain.categories.forEach(cat => categories.add(cat.name));
    });

    this.domainOptions = Array.from(domains).sort().map(d => ({ label: d, value: d }));
    this.categoryOptions = Array.from(categories).sort().map(c => ({ label: c, value: c }));
  }
}
