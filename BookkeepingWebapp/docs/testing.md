# Testing

### Automated unit tests (Vitest)

Unit tests live in `test/` and cover all three layers: PEG engine, grammar/parser, and renderer.

```bash
# Install dependencies first (only needed once)
npm install

# Check for vulnerabilities after install
npm audit

# If vulnerabilities are found, fix them
npm audit fix --force

# Run all tests once and exit
npm test

# Run in watch mode — re-runs on every file save
npm run test:watch
```

### Reading the test results

Vitest prints results directly in the terminal. Each test suite and individual test case is listed with a pass/fail indicator:

```
✓ test/parser/PEGParser.test.ts (14 tests)
✓ test/parser/grammar.test.ts (32 tests)
✓ test/render/render.test.ts (28 tests)

Test Files  3 passed (3)
Tests       74 passed (74)
Duration    Xms
```

A failing test looks like:
```
✗ test/parser/grammar.test.ts > Multiplicative > regression: (3+5) not parsed as 3*(+5)
  AssertionError: expected { type: 'UnaryExpression' } to match { type: 'BinaryExpression' }
    at test/parser/grammar.test.ts:87:5
```

The output shows:
- Which file and test suite the failure is in
- Which specific test case failed
- What the actual value was vs what was expected
- The exact line number in the test file

### Manual browser tests

For visual verification of the renderer:

```bash
npm run dev
```

Open `http://localhost:5173`. The first test case loads automatically.
Call `__nextTest()` in the browser console (`F12`) to cycle through all
test cases. The browser console also prints the full JSON AST for each
rendered expression.