import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { PraxisNode } from '../../../core/models/praxis.interfaces';

interface LinkGroup {
  label: string;
  icon: string;
  nodes: PraxisNode[];
}

@Component({
  selector: 'app-related-links',
  templateUrl: './related-links.component.html',
  styleUrls: ['./related-links.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatedLinksComponent {
  @Input() node!: PraxisNode;
  @Input() neighbors: PraxisNode[] = [];

  get linkGroups(): LinkGroup[] {
    if (!this.node || !this.neighbors.length) {
      return [];
    }

    const groups: LinkGroup[] = [];
    const neighborMap = new Map<string, PraxisNode>();
    this.neighbors.forEach(n => neighborMap.set(n.id, n));

    // Prerequisites (depends_on)
    if (this.node.depends_on?.length) {
      const nodes = this.node.depends_on
        .map(id => neighborMap.get(id))
        .filter((n): n is PraxisNode => !!n);
      if (nodes.length) {
        groups.push({ label: 'Prerequisites', icon: 'pi pi-arrow-circle-up', nodes });
      }
    }

    // Related Concepts
    if (this.node.related?.length) {
      const nodes = this.node.related
        .map(id => neighborMap.get(id))
        .filter((n): n is PraxisNode => !!n);
      if (nodes.length) {
        groups.push({ label: 'Related Concepts', icon: 'pi pi-link', nodes });
      }
    }

    // Implementations (children for L1)
    if (this.node.layer === 1 && this.node.children?.length) {
      const nodes = this.node.children
        .map(id => neighborMap.get(id))
        .filter((n): n is PraxisNode => !!n);
      if (nodes.length) {
        groups.push({ label: 'Implementations', icon: 'pi pi-code', nodes });
      }
    }

    // Principle (layer1_parent for L2)
    if (this.node.layer === 2 && this.node.layer1_parent) {
      const parent = neighborMap.get(this.node.layer1_parent);
      if (parent) {
        groups.push({ label: 'Principle', icon: 'pi pi-star', nodes: [parent] });
      }
    }

    // Dependents
    if (this.node.dependents?.length) {
      const nodes = this.node.dependents
        .map(id => neighborMap.get(id))
        .filter((n): n is PraxisNode => !!n);
      if (nodes.length) {
        groups.push({ label: 'Used By', icon: 'pi pi-arrow-circle-down', nodes });
      }
    }

    return groups;
  }
}
