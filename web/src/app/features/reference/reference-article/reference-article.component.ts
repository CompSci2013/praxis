import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { ReferenceAppService } from '../../../core/services/reference-app.service';
import { ReferenceDoc } from '../../../core/models/praxis.interfaces';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-reference-article',
  templateUrl: './reference-article.component.html',
  styleUrls: ['./reference-article.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferenceArticleComponent implements OnInit, OnDestroy {
  document: ReferenceDoc | null = null;
  allDocs: ReferenceDoc[] = [];
  loading = true;
  currentIndex = -1;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private referenceService: ReferenceAppService,
    private cdr: ChangeDetectorRef,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.referenceService.listDocuments()
      .pipe(takeUntil(this.destroy$))
      .subscribe(docs => {
        this.allDocs = docs.sort((a, b) => a.order - b.order);
        this.updateIndex();
        this.cdr.markForCheck();
      });

    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.loading = true;
          this.document = null;
          this.cdr.markForCheck();
          const slug = params.get('slug') || '';
          return this.referenceService.getDocument(slug);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (doc) => {
          this.document = doc;
          this.titleService.setTitle(`${doc.title} - Praxis Reference`);
          this.updateIndex();
          this.loading = false;
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

  get hasPrev(): boolean {
    return this.currentIndex > 0;
  }

  get hasNext(): boolean {
    return this.currentIndex >= 0 && this.currentIndex < this.allDocs.length - 1;
  }

  get prevDoc(): ReferenceDoc | null {
    return this.hasPrev ? this.allDocs[this.currentIndex - 1] : null;
  }

  get nextDoc(): ReferenceDoc | null {
    return this.hasNext ? this.allDocs[this.currentIndex + 1] : null;
  }

  goPrev(): void {
    if (this.prevDoc) {
      this.router.navigate(['/reference', this.prevDoc.slug]);
    }
  }

  goNext(): void {
    if (this.nextDoc) {
      this.router.navigate(['/reference', this.nextDoc.slug]);
    }
  }

  private updateIndex(): void {
    if (this.document && this.allDocs.length) {
      this.currentIndex = this.allDocs.findIndex(d => d.slug === this.document!.slug);
    }
  }
}
