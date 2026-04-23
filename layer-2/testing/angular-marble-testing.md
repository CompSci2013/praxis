---
id: angular-marble-testing
layer1_parent: null
angular_version: "14"
module: "rxjs/testing"
---

# Marble Testing

## How Angular Implements This

Marble testing is an RxJS feature, not Angular-specific, but Angular projects use it heavily because Angular is built on RxJS. Marble syntax lets you describe observable behavior as ASCII timelines, making it possible to test complex async sequences synchronously.

The core concept: each character in a marble string represents one "virtual time frame" (usually 1ms in the test scheduler). Special characters control what happens:

- `-` -- time passes, no emission
- `a`, `b`, `c` -- values emitted (mapped to actual values via a values object)
- `|` -- observable completes
- `#` -- observable errors
- `(abc)` -- multiple values emitted synchronously in the same frame
- `^` -- subscription point (for hot observables)

The `TestScheduler` from `rxjs/testing` provides `hot()`, `cold()`, and `expectObservable()` helpers. It runs everything synchronously -- no `setTimeout`, no `fakeAsync`, no waiting.

## The Correct Way

### Basic marble test setup

```typescript
// search.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError
} from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private http: HttpClient) {}

  /**
   * Takes a stream of search terms, debounces, deduplicates,
   * and maps to API results.
   */
  search(terms$: Observable<string>): Observable<string[]> {
    return terms$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term =>
        this.http.get<string[]>(`/api/search?q=${term}`)
      )
    );
  }
}
```

```typescript
// search.service.spec.ts
import { TestScheduler } from 'rxjs/testing';
import { debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';

describe('Marble Testing Basics', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      // Use Jasmine's deep equality for assertion
      expect(actual).toEqual(expected);
    });
  });

  it('should understand cold observables', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // cold() creates an observable that starts when subscribed
      const source$ = cold('--a--b--c|', {
        a: 1, b: 2, c: 3
      });
      // Timeline:  --1--2--3|
      // Frame:     0123456789
      //   frame 2: emit 1
      //   frame 5: emit 2
      //   frame 8: emit 3
      //   frame 9: complete

      const expected = '--a--b--c|';
      expectObservable(source$).toBe(expected, { a: 1, b: 2, c: 3 });
    });
  });

  it('should test the map operator', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const source$ = cold('-a-b-c|', { a: 1, b: 2, c: 3 });
      const result$ = source$.pipe(map(x => x * 10));

      expectObservable(result$).toBe('-a-b-c|', { a: 10, b: 20, c: 30 });
    });
  });

  it('should test debounceTime', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // User types 'a', then 'b' quickly, then waits
      // Each dash is 1ms in run() mode
      const source$ = cold('-a-b-------c--|');
      //                     ^ ^ debounce resets
      //                         ^ 300ms of silence needed (not shown in short form)

      // With debounceTime(3), 'a' is dropped because 'b' comes 2ms later.
      // 'b' emits after 3ms of silence.
      const result$ = source$.pipe(debounceTime(3));

      // 'b' emits at frame 7 (frame 3 + 3ms debounce + 1ms for the dash)
      // Actually in run() mode, debounceTime uses virtual time
      const expected = '------b---------(c|)';
      // Note: the exact timing in run() mode can be non-obvious.
      // The key insight: values that arrive within the debounce window are dropped.

      expectObservable(result$).toBe(expected);
    });
  });
});
```

### Hot observables and subscription points

```typescript
describe('Hot Observables', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('should understand hot observables', () => {
    scheduler.run(({ hot, expectObservable }) => {
      // hot() creates an observable that is already emitting
      // ^ marks where the subscription happens
      const source$ = hot('--a--b--^--c--d--|', {
        a: 'before1', b: 'before2', c: 'after1', d: 'after2'
      });
      // 'a' and 'b' happen before subscription -- subscriber never sees them

      const expected = '---c--d--|';
      expectObservable(source$).toBe(expected, {
        c: 'after1', d: 'after2'
      });
    });
  });
});
```

### Testing a realistic service method

```typescript
// notification.service.ts
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications$ = new Subject<string>();

  push(message: string): void {
    this.notifications$.next(message);
  }

  /**
   * Batches notifications into groups, emitting every 500ms.
   * Filters out empty batches.
   */
  getBatched(): Observable<string[]> {
    return this.notifications$.pipe(
      bufferTime(500),
      filter(batch => batch.length > 0)
    );
  }
}
```

```typescript
// notification.service.spec.ts
import { TestScheduler } from 'rxjs/testing';
import { bufferTime, filter } from 'rxjs/operators';

describe('NotificationService batching', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('should batch emissions within a time window', () => {
    scheduler.run(({ hot, expectObservable }) => {
      // Simulate three notifications arriving in the first 500ms window
      const source$ = hot('-a-b-c-----------------', {
        a: 'msg1', b: 'msg2', c: 'msg3'
      });

      const result$ = source$.pipe(
        bufferTime(500),
        filter(batch => batch.length > 0)
      );

      // At 500ms, the buffer emits all three messages as a batch.
      // The exact frame depends on virtual time -- 500ms = 500 dashes.
      // In run() mode, use time progression syntax:
      expectObservable(result$).toBe(
        '500ms a',
        { a: ['msg1', 'msg2', 'msg3'] }
      );
    });
  });
});
```

### Testing error handling

```typescript
it('should handle observable errors', () => {
  scheduler.run(({ cold, expectObservable }) => {
    const source$ = cold('-a-b-#', { a: 1, b: 2 }, new Error('fail'));
    // # means error, third argument is the error object

    expectObservable(source$).toBe('-a-b-#', { a: 1, b: 2 }, new Error('fail'));
  });
});

it('should test catchError recovery', () => {
  scheduler.run(({ cold, expectObservable }) => {
    const source$ = cold('-a-#', { a: 1 }, new Error('fail'));
    const recovery$ = cold('--b|', { b: 99 });

    const result$ = source$.pipe(
      catchError(() => recovery$)
    );

    // After error at frame 3, switches to recovery$ which emits at +2
    expectObservable(result$).toBe('-a---b|', { a: 1, b: 99 });
  });
});
```

## The Anti-Pattern in Angular

**Using `setTimeout`/`fakeAsync` for testing observable timing.**

```typescript
// WRONG -- unreliable, slow, hard to reason about
it('should debounce', fakeAsync(() => {
  let result: string | undefined;
  source$.pipe(debounceTime(300)).subscribe(v => result = v);

  source$.next('a');
  tick(100);
  source$.next('b');
  tick(300);

  expect(result).toBe('b');
  // This works but becomes unmanageable for complex pipelines.
  // Marble tests express the same thing in one readable line.
}));
```

**Writing marble strings without a values map.**

```typescript
// CONFUSING -- the letters ARE the values (strings 'a', 'b', 'c')
const source$ = cold('-a-b-c|');
// This only works when your actual values are single-character strings.
// For real-world tests, always use a values map:
const source$ = cold('-a-b-c|', {
  a: { id: 1, name: 'Alice' },
  b: { id: 2, name: 'Bob' },
  c: { id: 3, name: 'Charlie' }
});
```

## Common Mistakes

1. **Using `scheduler.run()` vs manual mode**: Always use the `run()` callback form. In run mode, time-based operators (debounceTime, delay, bufferTime) use virtual time automatically. Without `run()`, you must manually advance the scheduler, which is error-prone and verbose.

2. **Forgetting that `cold` starts at subscription, `hot` is already running**: If you use `cold` when you mean `hot`, your timing will be wrong because cold observables start their timeline at the moment of subscription.

3. **Wrong frame count after `(abc)` sync groups**: Synchronous emissions `(abc)` take only one frame of virtual time, but the parentheses consume two characters. This shifts all subsequent timing. `-(abc)--d|` has `d` at frame 7, not frame 9.

4. **Marble tests that are harder to read than the code**: If your marble string is 80+ characters long with complex sync groups and nested subscriptions, the test is less readable than the code it tests. Use marble tests for pipelines with 1-3 operators. For complex orchestration, consider testing behavior at a higher level.

5. **Comparing object references instead of values**: `expectObservable` uses the equality function you pass to `TestScheduler`. If you use `toBe` (strict equality) instead of `toEqual` (deep equality), object comparisons will fail even when the values match.

## Testing This

Verify your marble test setup works with a trivial case first:

```typescript
it('sanity check: cold observable emits and completes', () => {
  scheduler.run(({ cold, expectObservable }) => {
    const source$ = cold('---a---|', { a: 42 });
    expectObservable(source$).toBe('---a---|', { a: 42 });
  });
});
```

Then build up complexity:

```typescript
// Test subscription timing
it('should test subscription and unsubscription', () => {
  scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
    const source$ = cold('--a--b--c--d--|');
    const subscription = '   ^------!';  // subscribe at 3, unsubscribe at 10
    const expected =     '   ---a--b--';  // only sees a and b

    expectObservable(source$, subscription).toBe(expected);
    expectSubscriptions(source$.subscriptions).toBe([subscription]);
  });
});
```
