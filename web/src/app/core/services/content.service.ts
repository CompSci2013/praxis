import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { PraxisNode, TaxonomyResponse, TaxonomyStats } from '../models/praxis.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private taxonomyCache$ = new BehaviorSubject<TaxonomyResponse | null>(null);
  private statsCache$ = new BehaviorSubject<TaxonomyStats | null>(null);

  constructor(private api: ApiService) {}

  getNodes(filters?: {
    layer?: number;
    domain?: string;
    category?: string;
    severity?: string;
  }): Observable<PraxisNode[]> {
    const params: Record<string, string | number> = {};
    if (filters) {
      if (filters.layer !== undefined) { params['layer'] = filters.layer; }
      if (filters.domain) { params['domain'] = filters.domain; }
      if (filters.category) { params['category'] = filters.category; }
      if (filters.severity) { params['severity'] = filters.severity; }
    }
    return this.api.get<PraxisNode[]>('/nodes', params);
  }

  getNode(id: string): Observable<PraxisNode> {
    return this.api.get<PraxisNode>(`/nodes/${id}`);
  }

  getNeighbors(id: string, depth: number = 1): Observable<PraxisNode[]> {
    return this.api.get<PraxisNode[]>(`/nodes/${id}/neighbors`, { depth });
  }

  getTaxonomy(): Observable<TaxonomyResponse> {
    if (this.taxonomyCache$.value) {
      return of(this.taxonomyCache$.value);
    }
    return this.api.get<TaxonomyResponse>('/taxonomy').pipe(
      tap(data => this.taxonomyCache$.next(data)),
      shareReplay(1)
    );
  }

  getStats(): Observable<TaxonomyStats> {
    if (this.statsCache$.value) {
      return of(this.statsCache$.value);
    }
    return this.api.get<TaxonomyStats>('/stats').pipe(
      tap(data => this.statsCache$.next(data)),
      shareReplay(1)
    );
  }
}
