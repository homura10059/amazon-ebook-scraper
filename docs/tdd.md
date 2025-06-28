# Test-Driven Development (TDD)

This document outlines the Test-Driven Development practices for the Amazon Ebook Scraper project, following t-wada's (和田卓人) recommended approach.

## TDD Philosophy

TDD is fundamentally about **developer testing** that creates testable designs and reduces development anxiety through incremental success. The key principle is to prioritize "usability" over "buildability" in design.

## TDD Workflow (t-wada's 5-Step Process)

Following Kent Beck's definition as advocated by t-wada:

1. **Write a comprehensive test scenario list** - Plan what needs to be tested
2. **Select one item and write a failing test** - Focus on one test at a time, ensure it fails initially
3. **Write minimal code to pass** - Implement just enough code to make the current test (and all previous tests) pass
4. **Refactor as needed** - Improve implementation design while maintaining test success
5. **Return to step 2** - Repeat until the test list is empty

### Core Principles

- **One test at a time** - Never write multiple tests simultaneously
- **Small incremental steps** - Build confidence through gradual progress
- **Same timing** - Write tests in the same timing as implementation
- **User perspective** - Tests should verify expected behavior from the user's viewpoint

## Testing Commands

- `pnpm test` - Run all tests once
- `pnpm test:watch` - Run tests in watch mode (for development)
- `pnpm test:coverage` - Run tests with coverage reporting
- `pnpm -F <workspace> test` - Run tests for specific workspace

## TDD Benefits (t-wada's Insights)

- **Immediate feedback** on code functionality
- **Reduced fear** of changing existing code
- **Systematic problem-solving** for developers
- **Confidence building** through incremental success
- **Task management** and problem decomposition skills

## Testing Guidelines

Following t-wada's recommendations:

- **Write tests before implementation** - Tests define requirements and expected behavior
- **Focus on one test at a time** - Avoid writing multiple tests simultaneously
- **Keep tests simple** - Each test should verify one specific piece of functionality
- **Test independence** - Each test should be independent of others
- **Descriptive test names** - Test names should explain the behavior being verified
- **User perspective** - Tests should verify expected behavior from the user's viewpoint
- **Mock external dependencies** - HTTP requests, file system operations, etc.
- **Group related tests** using `describe` blocks
- **Aim for high coverage** (>80%) focusing on critical business logic

## Test File Structure

- Place test files next to source files with `.test.ts` extension
- Use `vitest.config.ts` for test configuration
- Follow the pattern: `src/module.ts` → `src/module.test.ts`

## Learning TDD (t-wada's Approach)

t-wada recommends starting TDD learning through:

1. **Imitation and "copying" (写経)** - Practice through hands-on exercises
2. **Tutorial-based learning** - Follow structured examples
3. **Individual practice** - TDD can be practiced independently, even in waterfall projects
4. **Experience psychological benefits** - Feel the increased confidence and reduced anxiety

## Practical Implementation

### Step-by-Step Example

```typescript
// 1. Write test scenario list (TODO)
// - fetchBookData should return book data for valid ISBN
// - fetchBookData should throw error for invalid ISBN
// - fetchBookData should handle network errors

// 2. Select one item and write failing test
describe('ScraperService', () => {
  it('should return book data for valid ISBN', () => {
    const service = new ScraperService();
    const result = service.fetchBookData('9784274217884');
    
    expect(result).toEqual({
      title: 'テスト駆動開発',
      author: 'Kent Beck',
      isbn: '9784274217884'
    });
  });
});

// 3. Write minimal code to pass
class ScraperService {
  fetchBookData(isbn: string) {
    return {
      title: 'テスト駆動開発',
      author: 'Kent Beck', 
      isbn: '9784274217884'
    };
  }
}

// 4. Refactor as needed
// 5. Return to step 2 for next test
```

### Mocking External Dependencies

```typescript
import { vi } from 'vitest';

// Mock HTTP client
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
```

### Test Coverage

- Focus on **critical business logic** and edge cases
- Use `pnpm test:coverage` to generate coverage reports
- Maintain >80% coverage while prioritizing meaningful tests over metrics