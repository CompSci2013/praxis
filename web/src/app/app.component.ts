import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'Praxis';
  searchText = '';
  searchSuggestions: string[] = [];

  navItems = [
    { label: 'Browse', icon: 'pi pi-list', routerLink: '/browse' },
    { label: 'Graph', icon: 'pi pi-sitemap', routerLink: '/graph' },
    { label: 'Search', icon: 'pi pi-search', routerLink: '/search' },
    { label: 'Reference', icon: 'pi pi-book', routerLink: '/reference' },
  ];

  constructor(private router: Router) {}

  onSearchSelect(event: { value?: string }): void {
    if (event.value) {
      this.router.navigate(['/search'], { queryParams: { q: event.value } });
      this.searchText = '';
    }
  }

  onSearchComplete(_event: { query: string }): void {
    // Placeholder - wiring comes in Phase 6
    this.searchSuggestions = [];
  }
}
