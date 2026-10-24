---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions red-green or red-green-refactor, or wants tests written for new code.
---

# Test-Driven Development

TDD is the red → green loop. This skill is what makes that loop produce tests worth keeping: what deserves a test, where tests go, the anti-patterns, and the rules of the loop.

When exploring the codebase, read the project's documentation (such as `GLOSSARY.md`, `CODING_STYLE.md`, `CONTRIBUTING.md`) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## What a good test is

A test verifies behavior through a public interface, never implementation details: code can change entirely, tests shouldn't. It reads like a specification ("user can checkout with valid cart"), makes one logical assertion, and survives refactors. A unit test covers one module through its public interface, its internal collaborators running for real.

Test the decisions the code makes, frontend and backend alike:

- conditionals and computations;
- returned shapes and state changes, observed through the interface;
- throws and failure paths;
- outbound calls at a system boundary, when the call is the behavior: the card charged for this amount, the e-mail sent, the request made.

Not worth a test:

- anything purely presentational: a CSS class, a style property, layout, or whatever only a human or a full external environment can check. A state carried by a class is checked through its ARIA attribute or what's rendered;
- unconditional output (static markup, a getter returning its field) and thin wrappers over library primitives: they test the framework;
- logs and analytics events: they pin no product behavior and go stale.

See [tests.md](tests.md) for addressing and examples, and [mocking.md](mocking.md) for what to mock.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

In a UI, the default seam is the component: props in, rendered output and emitted callbacks out, never a hook's or composable's return value.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?"

When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "designing-deep-modules" for the vocabulary: module, interface, depth, seam, adapter, leverage, locality. It's a reference to consult, not a session to run.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators that reach no external system, asserts calls between your own modules, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction. Expected values come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Fragile addressing**: targets the subject through an incidental detail: CSS classes, `nth-child`, DOM structure, log parsing, column indexes. Behavior is unchanged; the test breaks anyway. See [tests.md](tests.md) for the addressing order.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: they pin the code's structure rather than what callers observe, and commit to it before you understand the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (see the `code-review` skill), not the red → green implementation cycle.
