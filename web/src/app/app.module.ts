import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';

import { AppRoutingModule } from './app-routing.module';
import { PrimengModule } from './primeng.module';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';

import { AppComponent } from './app.component';
import { BrowseComponent } from './features/browse/browse.component';
import { ArticleComponent } from './features/article/article.component';
import { SearchComponent } from './features/search/search.component';
import { ReferenceComponent } from './features/reference/reference.component';
import { ReferenceArticleComponent } from './features/reference/reference-article/reference-article.component';

@NgModule({
  declarations: [
    AppComponent,
    BrowseComponent,
    ArticleComponent,
    SearchComponent,
    ReferenceComponent,
    ReferenceArticleComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    AppRoutingModule,
    PrimengModule,
    MarkdownModule.forRoot(),
    CoreModule,
    SharedModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
