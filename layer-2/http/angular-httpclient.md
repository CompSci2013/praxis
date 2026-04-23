---
id: angular-httpclient
layer1_parent: request-response-transformation
angular_version: "14"
module: "@angular/common/http"
---

# Angular HttpClient

## How Angular Implements This

`HttpClient` is Angular's built-in HTTP client. It wraps `XMLHttpRequest` in an RxJS Observable-based API: every HTTP method returns a cold Observable that executes the request when subscribed to and completes after the response arrives (or errors).

Key characteristics:
- **Typed responses**: `http.get<User[]>('/api/users')` returns `Observable<User[]>`. The generic parameter tells TypeScript what shape to expect.
- **Cold observables**: The request is not sent until `.subscribe()` is called (or the `async` pipe evaluates). If you call `http.get()` without subscribing, nothing happens.
- **Automatic JSON**: Responses are parsed as JSON by default. Request bodies are serialized as JSON by default.
- **Single emission**: HttpClient observables emit exactly once (the response) and then complete. No subscription cleanup needed for the HTTP call itself.

`HttpClient` lives in `HttpClientModule`, which must be imported in `AppModule`. It provides `HttpClient` as a singleton service, plus the `HttpInterceptor` infrastructure.

## The Correct Way

```typescript
// user.service.ts — typed HTTP calls
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = '/api/users';

  constructor(private http: HttpClient) {}

  // GET with typed response
  getUsers(page: number, pageSize: number): Observable<PaginatedResponse<User>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PaginatedResponse<User>>(this.apiUrl, { params });
  }

  // GET single item
  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  // POST — create
  createUser(user: Omit<User, 'id'>): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
    // Body is automatically serialized as JSON
    // Content-Type: application/json is set automatically
  }

  // PUT — full update
  updateUser(user: User): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${user.id}`, user);
  }

  // PATCH — partial update
  patchUser(id: number, changes: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, changes);
  }

  // DELETE
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // GET with custom headers
  getUserWithAuth(id: number, token: string): Observable<User> {
    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${token}`)
      .set('X-Custom-Header', 'value');

    return this.http.get<User>(`${this.apiUrl}/${id}`, { headers });
  }

  // GET with full response (access headers, status code)
  getUserWithResponse(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`, {
      observe: 'response'  // Returns HttpResponse<User> instead of User
    }).pipe(
      map(response => {
        console.log('Status:', response.status);
        console.log('ETag:', response.headers.get('ETag'));
        return response.body!;
      })
    );
  }

  // GET with text response (not JSON)
  getReadme(): Observable<string> {
    return this.http.get('/api/readme', { responseType: 'text' });
  }

  // GET with blob response (file download)
  downloadReport(): Observable<Blob> {
    return this.http.get('/api/report', { responseType: 'blob' });
  }

  // POST with progress events (file upload)
  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post('/api/upload', formData, {
      reportProgress: true,
      observe: 'events'  // Returns HttpEvent stream: Sent, UploadProgress, Response
    });
  }

  // Search with debounced input (component would use switchMap)
  search(term: string): Observable<User[]> {
    if (!term.trim()) {
      return of([]);
    }
    const params = new HttpParams().set('q', term);
    return this.http.get<User[]>(`${this.apiUrl}/search`, { params });
  }
}
```

```typescript
// Using the service in a component
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { UserService, User, PaginatedResponse } from '../services/user.service';

@Component({
  selector: 'app-user-list',
  template: `
    <ng-container *ngIf="response$ | async as response">
      <table>
        <tr *ngFor="let user of response.data">
          <td>{{ user.name }}</td>
          <td>{{ user.email }}</td>
          <td><button (click)="delete(user.id)">Delete</button></td>
        </tr>
      </table>
      <app-paginator
        [total]="response.total"
        [page]="response.page"
        [pageSize]="response.pageSize"
        (pageChange)="onPageChange($event)">
      </app-paginator>
    </ng-container>
  `
})
export class UserListComponent implements OnInit {
  response$!: Observable<PaginatedResponse<User>>;
  private currentPage = 1;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadPage(1);
  }

  onPageChange(page: number): void {
    this.loadPage(page);
  }

  private loadPage(page: number): void {
    this.currentPage = page;
    this.response$ = this.userService.getUsers(page, 20);
    // Reassigning the observable causes the async pipe to unsubscribe from
    // the old one and subscribe to the new one. Clean and simple.
  }

  delete(id: number): void {
    this.userService.deleteUser(id).subscribe({
      next: () => this.loadPage(this.currentPage),  // Refresh after delete
      error: (err) => console.error('Delete failed', err)
    });
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Not subscribing — request never fires
save(): void {
  this.http.post('/api/users', this.userData);  // Observable created but not subscribed
  // Nothing happens. No request is sent. No error. Just silence.
  this.showSuccess();  // Shows success before anything was saved!
}
// Fix: .subscribe() or use async pipe

// WRONG: Using any for response types
this.http.get('/api/users').subscribe((data: any) => {
  this.users = data;  // No type checking. data.naem won't be caught by TypeScript.
});
// Fix: this.http.get<User[]>('/api/users')

// WRONG: Subscribing in a loop
this.userIds.forEach(id => {
  this.http.get<User>(`/api/users/${id}`).subscribe(user => {
    this.users.push(user);  // Race condition: users arrive in random order
  });
});
// Fix: forkJoin(this.userIds.map(id => this.http.get<User>(`/api/users/${id}`)))
// forkJoin waits for ALL requests and returns results in order.

// WRONG: Mutating HttpParams
const params = new HttpParams();
params.set('page', '1');  // Returns a NEW HttpParams — does NOT mutate
params.set('size', '20');  // Also returns a new one — first set is lost
this.http.get('/api/data', { params });  // No params sent!
// Fix: chain the calls: new HttpParams().set('page', '1').set('size', '20')
// HttpParams is immutable — every method returns a new instance.
```

## Common Mistakes

1. **`HttpParams` and `HttpHeaders` are immutable**: Every `.set()`, `.append()`, and `.delete()` call returns a new instance. Calling `params.set('key', 'value')` without capturing the return value does nothing. This is the most common HttpClient mistake in Angular.

2. **Forgetting to import `HttpClientModule`**: Without `HttpClientModule` in `AppModule.imports`, injecting `HttpClient` throws `NullInjectorError: No provider for HttpClient!`. Import it once in `AppModule`, never in feature modules.

3. **Type parameter doesn't validate at runtime**: `http.get<User[]>(url)` tells TypeScript the response is `User[]`, but Angular does not validate the actual response shape. If the API returns `{ data: User[] }` instead of `User[]`, you get a runtime error when the template tries to iterate. The type parameter is a compile-time assertion only.

4. **Double subscription with async pipe + manual subscribe**: If a component assigns an observable to a property AND subscribes to it, the HTTP request fires twice. Either use `async` pipe or `subscribe`, not both (unless the observable uses `shareReplay`).

5. **Not handling errors**: `HttpClient` throws `HttpErrorResponse` on non-2xx status codes. Without `catchError` in the pipe, the error propagates to the subscriber's error callback. If there is no error callback, it becomes an unhandled promise rejection. Always handle errors — either in the service (return fallback) or in the component (show error UI).

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService, User } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService]
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();  // Fail if unexpected requests were made
  });

  it('should GET users with pagination params', () => {
    const mockResponse = {
      data: [{ id: 1, name: 'Alice', email: 'a@b.com' }],
      total: 1, page: 1, pageSize: 20
    };

    service.getUsers(1, 20).subscribe(response => {
      expect(response.data.length).toBe(1);
      expect(response.data[0].name).toBe('Alice');
    });

    const req = httpMock.expectOne(r =>
      r.url === '/api/users' &&
      r.params.get('page') === '1' &&
      r.params.get('pageSize') === '20'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should POST to create a user', () => {
    const newUser = { name: 'Bob', email: 'b@c.com' };
    const createdUser = { id: 42, ...newUser };

    service.createUser(newUser).subscribe(user => {
      expect(user.id).toBe(42);
    });

    const req = httpMock.expectOne('/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newUser);
    req.flush(createdUser);
  });

  it('should DELETE a user', () => {
    service.deleteUser(42).subscribe();

    const req = httpMock.expectOne('/api/users/42');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should handle 404 error', () => {
    service.getUser(999).subscribe({
      error: (error) => {
        expect(error.status).toBe(404);
      }
    });

    const req = httpMock.expectOne('/api/users/999');
    req.flush('Not found', { status: 404, statusText: 'Not Found' });
  });
});
```

`HttpClientTestingModule` replaces the real HTTP backend with a mock. Use `httpMock.expectOne()` to intercept requests, assert on method/URL/body/params, and `flush()` a response. `httpMock.verify()` in `afterEach` ensures no unexpected requests were made and no expected requests went unhandled. This is synchronous — no `fakeAsync` needed for basic request/response testing.
