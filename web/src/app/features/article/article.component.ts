import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { MenuItem } from 'primeng/api';
import { ContentService } from '../../core/services/content.service';
import { PraxisNode } from '../../core/models/praxis.interfaces';

@Component({
  selector: 'app-article',
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleComponent implements OnInit, OnDestroy {
  node: PraxisNode | null = null;
  neighbors: PraxisNode[] = [];
  loading = true;
  breadcrumbs: MenuItem[] = [];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/browse' };

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private contentService: ContentService,
    private titleService: Title,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const id = params.get('id') || '';
          this.loading = true;
          this.node = null;
          this.neighbors = [];
          this.cdr.markForCheck();
          return this.contentService.getNode(id);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (node) => {
          this.node = node;
          this.titleService.setTitle(`${node.title} - Praxis`);
          this.breadcrumbs = this.buildBreadcrumbs(node);
          this.loadNeighbors(node.id);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasChildren(): boolean {
    return this.node?.layer === 1 && !!this.node.children?.length;
  }

  get childNodes(): PraxisNode[] {
    if (!this.node?.children?.length) { return []; }
    return this.neighbors.filter(n => this.node!.children!.includes(n.id));
  }

  private loadNeighbors(id: string): void {
    this.contentService.getNeighbors(id, 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (neighbors) => {
          this.neighbors = neighbors;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildBreadcrumbs(node: PraxisNode): MenuItem[] {
    const crumbs: MenuItem[] = [
      { label: 'Browse', routerLink: '/browse' },
    ];
    if (node.domain) {
      crumbs.push({ label: node.domain });
    }
    crumbs.push({ label: node.category });
    crumbs.push({ label: node.title });
    return crumbs;
  }
}
