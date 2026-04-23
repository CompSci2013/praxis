import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { PrimengModule } from '../primeng.module';

import { MarkdownRendererComponent } from './components/markdown-renderer/markdown-renderer.component';
import { SeverityBadgeComponent } from './components/severity-badge/severity-badge.component';
import { NodeMetadataComponent } from './components/node-metadata/node-metadata.component';
import { RelatedLinksComponent } from './components/related-links/related-links.component';

const COMPONENTS = [
  MarkdownRendererComponent,
  SeverityBadgeComponent,
  NodeMetadataComponent,
  RelatedLinksComponent,
];

@NgModule({
  declarations: COMPONENTS,
  imports: [
    CommonModule,
    RouterModule,
    PrimengModule,
    MarkdownModule.forChild(),
  ],
  exports: COMPONENTS,
})
export class SharedModule {}
