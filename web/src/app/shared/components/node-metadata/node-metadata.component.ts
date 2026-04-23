import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { PraxisNode } from '../../../core/models/praxis.interfaces';

@Component({
  selector: 'app-node-metadata',
  templateUrl: './node-metadata.component.html',
  styleUrls: ['./node-metadata.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeMetadataComponent {
  @Input() node!: PraxisNode;

  get layerLabel(): string {
    return this.node.layer === 1 ? 'L1 - Universal' : 'L2 - Angular';
  }

  get layerClass(): string {
    return this.node.layer === 1 ? 'layer-1' : 'layer-2';
  }
}
