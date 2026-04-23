import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { GraphData } from '../models/praxis.interfaces';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  constructor(private api: ApiService) {}

  getFullGraph(filters?: {
    layer?: number;
    domain?: string;
    severity?: string;
    edgeType?: string;
  }): Observable<GraphData> {
    const params: Record<string, string | number> = {};
    if (filters) {
      if (filters.layer !== undefined) { params['layer'] = filters.layer; }
      if (filters.domain) { params['domain'] = filters.domain; }
      if (filters.severity) { params['severity'] = filters.severity; }
      if (filters.edgeType) { params['edgeType'] = filters.edgeType; }
    }
    return this.api.get<GraphData>('/graph', params);
  }

  getNeighborhood(nodeId: string, depth: number = 1): Observable<GraphData> {
    return this.api.get<GraphData>(`/graph/${nodeId}/neighborhood`, { depth });
  }
}
