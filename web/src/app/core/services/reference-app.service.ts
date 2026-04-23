import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ReferenceDoc } from '../models/praxis.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ReferenceAppService {
  private documentsCache: ReferenceDoc[] | null = null;

  constructor(private api: ApiService) {}

  listDocuments(): Observable<ReferenceDoc[]> {
    if (this.documentsCache) {
      return of(this.documentsCache);
    }
    return this.api.get<ReferenceDoc[]>('/reference').pipe(
      tap(docs => this.documentsCache = docs),
      shareReplay(1)
    );
  }

  getDocument(slug: string): Observable<ReferenceDoc> {
    return this.api.get<ReferenceDoc>(`/reference/${slug}`);
  }
}
