---
name: clean-code
description: "My clean-code rules for any stack: naming, control flow, state and types, errors, plus the code smell catalog reviews check against. Use when writing or refactoring code, or when a review needs the smell baseline."
---

# Clean code

Apply these rules to the code the change touches, never to the code around it. A repo's documented standard overrides them. Skip what a linter or formatter enforces.

## Naming

- **A name carries the concept it holds.** A qualifier alone (`entered`, `opened`, `atOpening`) names a state, not a thing: add the noun (`enteredTransportCost`, `transportCostAtOpening`). A function names the thing it acts on or returns.
- **The farther the uses, the more the name says alone.** When a use sits out of sight of its declaration (about a screen away), first shorten the distance: compute the value next to its use, or extract the block that uses it. Otherwise make the name readable without its definition.
- **Judge a name at the call site.** Context visible there counts (`transportCost.atOpening()`); the file name doesn't. Don't repeat context the call site already shows.
- **Fix a bad export at its source.** Alias an import only to resolve a collision. A function that needs two names in two contexts is two functions, or a generic one whose results get contextual names.
- **No abbreviations** beyond established ones (`id`, `url`, `i` in a short loop).

## Control flow

- **Guard clauses first.** Handle edge cases at the top with an early `return` or `throw`; the main path stays at the first indentation level.
- **A ternary reads at a glance.** One or two lines, never nested.

## State and types

- **One source of truth.** A value derivable from others is computed where it's needed, never stored and kept in sync (in React: no `useState` + `useEffect` mirroring props or other state).
- **Make illegal states unrepresentable.** A discriminated union, not booleans or optional fields that only make sense in some combinations.
- **No positional boolean argument.** Split into two functions, or pass a named option.

## Errors

- **Handle an error or propagate it.** Handling means a deliberate outcome: retry, show it, a fallback the spec wants. An empty `catch`, or one that logs and returns a default, hides the failure.

## Smells

[smells.md](smells.md) holds the smell baseline reviews check against, each as _what it is → how to fix_. A smell is always a judgement call: report it as "possible Feature Envy", never as a violation.
