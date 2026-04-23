import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ContentService } from './content.service';
import { SearchResult, PraxisNode } from '../models/praxis.interfaces';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  constructor(
    private api: ApiService,
    private contentService: ContentService
  ) {}

  semanticSearch(query: string, topK: number = 10): Observable<SearchResult[]> {
    return this.api.post<SearchResult[]>('/search', { query, top_k: topK });
  }

  filterNodes(filters: {
    layer?: number;
    domain?: string;
    category?: string;
    severity?: string;
  }): Observable<PraxisNode[]> {
    return this.contentService.getNodes(filters);
  }
}
