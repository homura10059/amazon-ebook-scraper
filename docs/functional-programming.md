# Functional Programming Guidelines

This document outlines the functional programming principles and patterns used in the Amazon Ebook Scraper project, based on Scott Wlaschin's "Domain Modeling Made Functional" philosophy.

## Core Philosophy

**IMPORTANT**: This project follows functional programming principles wherever possible, emphasizing domain modeling through types and making illegal states unrepresentable. All new code should be written in functional style with a focus on domain-driven design.

## Domain Modeling Made Functional Principles

### 1. Type-Driven Domain Modeling
- **Make Illegal States Unrepresentable**: Use TypeScript's type system to encode business rules
- **Domain Types**: Create specific types for domain concepts (ISBN, BookTitle, Price, etc.)
- **Constrained Types**: Use branded types and validation for domain constraints

```typescript
// Good: Domain-specific types
type ISBN = string & { readonly brand: unique symbol };
type BookTitle = string & { readonly brand: unique symbol };
type Price = number & { readonly brand: unique symbol };

interface BookData {
  readonly isbn: ISBN;
  readonly title: BookTitle;
  readonly price: Price;
}
```

### 2. Railway-Oriented Programming
- **Result Types**: Use `Result<T, E>` for operations that can fail
- **Pipeline Composition**: Chain operations using `map`, `flatMap`, and `pipe`
- **Error Handling**: Make errors explicit in the type system

```typescript
type Result<T, E> = { success: true; data: T } | { success: false; error: E };

const parseISBN = (input: string): Result<ISBN, string> => 
  /^\d{13}$/.test(input) 
    ? { success: true, data: input as ISBN }
    : { success: false, error: "Invalid ISBN format" };
```

### 3. Pure Functions and Immutability
- **Pure Functions**: Functions should be predictable with no side effects
- **Immutable Data**: Avoid `let` variables and mutations; prefer `const` and creating new objects
- **Function Composition**: Break complex logic into small, composable functions

### 4. Pipeline-Oriented Programming
- **Data Transformation Pipelines**: Use function composition to create clear data flow
- **Avoid Imperative Loops**: Use `map()`, `filter()`, `find()`, `reduce()` instead of `for` loops
- **Higher-Order Functions**: Use functions that accept or return other functions

## Domain-Driven Functional Patterns

### Type-Safe Domain Operations

```typescript
// Good: Domain-specific operations with type safety
const createBookData = (
  isbn: string,
  title: string,
  price: number
): Result<BookData, string> => {
  const isbnResult = parseISBN(isbn);
  if (!isbnResult.success) return isbnResult;
  
  const titleResult = parseBookTitle(title);
  if (!titleResult.success) return titleResult;
  
  const priceResult = parsePrice(price);
  if (!priceResult.success) return priceResult;
  
  return {
    success: true,
    data: {
      isbn: isbnResult.data,
      title: titleResult.data,
      price: priceResult.data
    }
  };
};
```

### Pipeline-Oriented Data Processing

```typescript
// Good: Pipeline-oriented selector matching
const findBookValue = (selectors: readonly string[]) =>
  pipe(
    selectors,
    map(selector => $(selector).text().trim()),
    find(text => text.length > 0),
    option => option ?? null
  );

// Avoid: Imperative loops with mutations
let value = "";
for (const selector of selectors) {
  value = $(selector).text().trim();
  if (value) break;
}
```

### Error Railway Pattern

```typescript
// Chain operations that can fail
const scrapeBookDetails = (url: string): Result<BookData, ScrapingError> =>
  pipe(
    fetchPage(url),
    flatMap(extractISBN),
    flatMap(isbn => 
      pipe(
        extractTitle(page),
        map(title => ({ isbn, title }))
      )
    ),
    flatMap(({ isbn, title }) =>
      pipe(
        extractPrice(page),
        map(price => createBookData(isbn, title, price))
      )
    )
  );
```

## Domain Types and Constraints

### Branded Types for Domain Safety

```typescript
// Create domain-specific types that prevent mixing
type URL = string & { readonly _brand: 'URL' };
type Selector = string & { readonly _brand: 'Selector' };
type ScrapedText = string & { readonly _brand: 'ScrapedText' };

// Factory functions with validation
const createURL = (input: string): Result<URL, string> =>
  isValidURL(input)
    ? { success: true, data: input as URL }
    : { success: false, error: "Invalid URL format" };
```

### State Machines with Types

```typescript
// Make scraping states explicit
type ScrapingState = 
  | { type: 'idle' }
  | { type: 'fetching'; url: URL }
  | { type: 'parsing'; html: string }
  | { type: 'completed'; data: BookData }
  | { type: 'failed'; error: ScrapingError };

// State transitions are explicit and type-safe
const transition = (
  state: ScrapingState,
  event: ScrapingEvent
): ScrapingState => {
  // Pattern matching ensures all cases are handled
  switch (state.type) {
    case 'idle':
      return event.type === 'START_FETCH' 
        ? { type: 'fetching', url: event.url }
        : state;
    // ... other transitions
  }
};
```

## Implementation Guidelines

### Refactoring to Domain-Driven Functional Style

1. **Identify Domain Concepts**: Convert primitive types to domain types
2. **Make Invalid States Impossible**: Use union types and constraints
3. **Create Validation Pipelines**: Use Result types for operations that can fail
4. **Compose Functions**: Build complex operations from simple, pure functions
5. **Handle Errors Explicitly**: Make error cases part of the type system

### Testing Domain Functions

```typescript
// Test domain functions with property-based testing
describe('ISBN validation', () => {
  it('should accept valid 13-digit ISBNs', () => {
    const result = parseISBN('9784274217884');
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid ISBN formats', () => {
    const result = parseISBN('invalid');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid ISBN format');
  });
});
```

## Benefits of Domain Modeling Made Functional

- **Type Safety**: Domain types prevent runtime errors and invalid states
- **Self-Documenting Code**: Types express business rules and domain concepts
- **Composability**: Small, focused functions can be easily combined into pipelines
- **Error Handling**: Explicit error types make failure cases visible and handleable
- **Maintainability**: Changes to domain rules are reflected in the type system
- **Testability**: Pure functions and explicit types make testing straightforward
- **Refactoring Safety**: Type system catches breaking changes during refactoring