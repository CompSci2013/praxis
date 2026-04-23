import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ReferenceAppService } from '../../core/services/reference-app.service';
import { ReferenceDoc } from '../../core/models/praxis.interfaces';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-reference',
  templateUrl: './reference.component.html',
  styleUrls: ['./reference.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferenceComponent implements OnInit, OnDestroy {
  documents: ReferenceDoc[] = [];
  loading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private referenceService: ReferenceAppService,
    private cdr: ChangeDetectorRef,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Praxis - Reference');
    this.referenceService.listDocuments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (docs) => {
          this.documents = docs.sort((a, b) => a.order - b.order);
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

  getPreview(doc: ReferenceDoc): string {
    if (!doc.body) { return ''; }
    const firstParagraph = doc.body.split('\n\n').find(p => p.trim() && !p.startsWith('#'));
    if (!firstParagraph) { return ''; }
    const cleaned = firstParagraph.replace(/[#*_`\[\]()]/g, '').trim();
    return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned;
  }
}
