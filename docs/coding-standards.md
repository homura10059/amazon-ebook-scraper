# Coding Standards and Documentation Guidelines

This document outlines the coding standards for the Amazon Ebook Scraper project, based on the principle that **code, test code, commit logs, and code comments are read more often than they are written**. Each element serves a distinct purpose in communicating different aspects of software development decisions.

## Core Philosophy

The fundamental principle underlying these guidelines is that we spend more time reading code than writing it. Therefore:

- **Don't cut corners to save writing time** - The reader might be your future self
- **Write with the future in mind** - Focus on maintainability and understandability
- **Each element has a specific role** - Don't mix purposes between different documentation types
- **Preserve decision context** - Future maintainers need to understand not just what was done, but why

## The Four Elements Framework

### Code → Writing "How"

**Purpose**: Code naturally expresses **HOW** something is implemented.

**Key Principles**:
- Code can only contain implementation details - it inherently shows the method, not the reasoning
- Focus on clarity and readability in expressing the implementation approach
- Follow functional programming principles (see @docs/functional-programming.md)
- Make illegal states unrepresentable through type safety

**Guidelines**:
```typescript
// Good: Clear implementation expressing "how"
const parseBookPrice = (priceText: string): Result<Price, string> =>
  pipe(
    priceText.replace(/[^0-9.]/g, ''),
    text => parseFloat(text),
    price => isNaN(price) 
      ? { success: false, error: 'Invalid price format' }
      : { success: true, data: price as Price }
  );

// Avoid: Implementation that obscures the "how"
const parsePrice = (t: string) => {
  let p = t;
  for (let i = 0; i < t.length; i++) {
    if (!/[0-9.]/.test(t[i])) p = p.replace(t[i], '');
  }
  return parseFloat(p) || null;
};
```

**Integration with Project Standards**:
- Use TypeScript's type system to make "how" explicit
- Prefer functional composition over imperative loops
- Create domain-specific types that express business concepts clearly

### Test Code → Writing "What"

**Purpose**: Test code should express **WHAT** the specification is - it becomes the specification of the target code.

**Key Principles**:
- Focus on "What should this code do?" when writing tests
- Tests define requirements and expected behavior
- Follow TDD practices (see @docs/tdd.md)
- Write tests from the user's perspective

**Guidelines**:
```typescript
// Good: Expresses "what" the specification is
describe('parseBookPrice', () => {
  it('should extract numeric price from formatted text', () => {
    const result = parseBookPrice('$29.99');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(29.99);
    }
  });

  it('should return error for non-numeric text', () => {
    const result = parseBookPrice('Free');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid price format');
  });
});

// Bad: Meaningless test that doesn't express specification
describe('parseBookPrice', () => {
  it('TestError001', () => {
    expect(parseBookPrice('invalid')).toBeTruthy();
  });
});
```

**Good Examples**:
- Decide the specification first, then write tests before implementation (TDD)
- Test names should explain the behavior being verified
- Each test should verify one specific piece of functionality

**Bad Examples**:
- Creating meaningless tests like "TestError001" just for coverage
- Testing implementation details instead of behavior
- Writing tests after implementation without considering specifications

### Commit Messages → Writing "Why"

**Purpose**: Commit logs should explain **WHY** the change was made. Code and test code cannot convey the reasoning behind changes.

**Key Principles**:
- Share the problem recognition - without understanding "Why", you can't judge if "What" or "How" is correct
- Explain the context that led to the change
- Help future maintainers understand the decision-making process

**Good Examples**:
```
feat: implement price validation with domain types

Amazon prices can include currency symbols and formatting that
break standard parsing. Added Result type pattern to handle
these cases gracefully and provide clear error messages.

Co-authored-by: homura <homura10059@users.noreply.github.com>
```

```
fix: replace deprecated request library with native fetch

The 'request' library has been deprecated and has security
vulnerabilities. Native fetch is available in Node.js 18+
and provides better Promise support for our functional approach.

Resolves: #123
```

**Bad Examples**:
- "Review feedback" / "Review response" (shows no ownership or understanding)
- "Bug fix" (without explaining what the bug was)
- "Lint fixes" (shows no understanding of why the lint rule exists)
- "New addition" (every addition has a reason)
- "Work interruption, temporary commit" (commit logs are for code history, not work logs)

**Commit Message Format**:
Follow conventional commits with clear explanations:
```
<type>(<scope>): <description>

<body explaining why this change was necessary>

<footer with references to issues, co-authors, etc.>
```

### Code Comments → Writing "Why Not"

**Purpose**: Code comments should explain **WHY NOT** - what was considered but not implemented, preserving implementation struggles and decisions.

**Key Principles**:
- Document the "excuses" or reasoning for not taking seemingly obvious approaches
- Preserve context about alternative approaches that were considered
- Explain constraints that forced suboptimal solutions

**Good Examples**:
```typescript
// Should use Promise.all here for parallel processing, but Amazon's
// rate limiting causes 429 errors with concurrent requests.
// Processing sequentially to respect rate limits.
// Issue for optimization: #456
for (const isbn of isbns) {
  const bookData = await fetchBookData(isbn);
  results.push(bookData);
}

// Using cheerio instead of Playwright for parsing because
// Amazon's anti-bot detection blocks headless browsers.
// Trade-off: loses dynamic content but avoids detection.
const $ = cheerio.load(html);
```

**Bad Examples**:
```typescript
// This function parses book data (already clear from code)
const parseBookData = (html: string) => { ... }

// Extracts price from HTML (describes what, not why not)
const price = $(priceSelector).text();

// Validates ISBN format (should be in commit message if explaining why)
if (!/^\d{13}$/.test(isbn)) { ... }
```

**When to Write Comments**:
- When you had to make trade-offs due to external constraints
- When the obvious solution doesn't work for non-obvious reasons
- When you're forced to use a workaround due to library limitations
- When performance requirements forced a less readable approach

**When NOT to Write Comments**:
- Explaining what the code does (should be clear from the code itself)
- Explaining why you're doing something (belongs in commit messages)
- Restating information already expressed in types or function names

## Integration with Project Standards

### Relationship to Functional Programming

These documentation standards complement our functional programming approach:

- **Code**: Express domain concepts through types and pure functions
- **Tests**: Specify behavior using property-based testing where appropriate
- **Commits**: Explain why functional approaches were chosen over imperative ones
- **Comments**: Document when functional purity had to be compromised

### Relationship to TDD

The documentation standards support our TDD practices:

- **Tests as Specification**: Tests become the "What" - the living specification
- **Implementation Clarity**: Code focuses purely on "How" to fulfill the specification
- **Change Rationale**: Commits explain "Why" the specification needed to change
- **Design Decisions**: Comments preserve "Why Not" certain design approaches were taken

## Summary Table

| Element | Purpose | Focus | Integration |
|---------|---------|-------|-------------|
| **Code** | How | Implementation method | Functional, type-safe expression |
| **Test Code** | What | Specification definition | TDD-driven behavior specification |
| **Commit Messages** | Why | Change reasoning | Problem context and decision rationale |
| **Code Comments** | Why Not | Alternative considerations | Trade-offs and constraints |

## Practical Application

### Code Review Checklist

When reviewing code, check that each element fulfills its purpose:

- [ ] **Code**: Is the "how" clear and follows functional programming principles?
- [ ] **Tests**: Do they specify "what" the code should do from user perspective?
- [ ] **Commit**: Does the message explain "why" this change was necessary?
- [ ] **Comments**: Do they document "why not" obvious alternatives when appropriate?

### Writing Workflow

1. **Start with "What"**: Write failing tests that specify the desired behavior
2. **Implement "How"**: Write minimal functional code to pass the tests
3. **Document "Why"**: Commit with clear explanation of the change rationale
4. **Preserve "Why Not"**: Add comments for non-obvious design decisions and trade-offs

This approach ensures that all four elements work together to create maintainable, understandable code that serves both current implementation needs and future maintenance requirements.