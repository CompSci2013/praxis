import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BrowseComponent } from './features/browse/browse.component';
import { ArticleComponent } from './features/article/article.component';
import { SearchComponent } from './features/search/search.component';
import { ReferenceComponent } from './features/reference/reference.component';
import { ReferenceArticleComponent } from './features/reference/reference-article/reference-article.component';

const routes: Routes = [
  { path: '', redirectTo: 'browse', pathMatch: 'full' },
  { path: 'browse', component: BrowseComponent },
  { path: 'article/:id', component: ArticleComponent },
  {
    path: 'graph',
    loadChildren: () => import('./features/graph/graph.module').then(m => m.GraphModule),
  },
  { path: 'search', component: SearchComponent },
  { path: 'reference', component: ReferenceComponent },
  { path: 'reference/:slug', component: ReferenceArticleComponent },
  { path: '**', redirectTo: 'browse' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
