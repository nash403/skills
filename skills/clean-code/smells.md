# Smell baseline

Each smell reads _what it is_ → _how to fix_. From Fowler, _Refactoring_ (2nd ed., ch. 3), unless marked _Clean Code_ (Martin, ch. 17).

- **Mysterious Name**: a function, variable or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file. → extract the shared shape, call it from both.
- **Long Function**: a function or component doing several things at several levels of detail. → extract each intention into a named function or component.
- **Long Parameter List**: many params or props, often several passed straight through. → pass the concept they describe, or one parameter object.
- **Global Data**: module-level state or a global store anyone can write to. → encapsulate it behind functions that control the writes.
- **Mutable Data**: state updated in several places, including derived state stored and synced (`useEffect` copying props into state). → compute derived values on read; narrow who can write the rest.
- **Divergent Change**: one file or module edited for several unrelated reasons. → split so each module changes for one reason.
- **Shotgun Surgery**: one logical change forces scattered edits across many files. → gather what changes together into one module.
- **Feature Envy**: a function that reaches into another object's data more than its own. → move it onto the data it envies.
- **Data Clumps**: the same few fields or params travelling together (`start`, `end`, `timezone`). → bundle them into one type, pass that.
- **Primitive Obsession**: a string or number standing in for a domain concept (ids, amounts, statuses). → give the concept its own small type or literal union.
- **Repeated Switches**: the same `switch` or `if` cascade on the same value in several places. → one map both sites share, or polymorphism.
- **Speculative Generality**: abstractions, params or hooks for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Temporary Field**: a field set only in some flows and empty otherwise. → extract that case, or model it with a discriminated union.
- **Message Chains**: long `a.b.c.d` navigation the caller shouldn't depend on. → hide the walk behind one function on the first object.
- **Middle Man**: a class, function or component that mostly passes things on, prop drilling included. → call the real target directly; for props, composition or a context.
- **Insider Trading**: modules reading or writing each other's internals. → go through the public interface, or merge what can't be separated.
- **Flag Arguments** (_Clean Code_ F3): a boolean param that switches the function between two behaviors. → two functions, or a named option.
- **Dead Code** (_Clean Code_ G9): branches, exports, props or params nothing reaches. → delete it.
- **Hidden Temporal Coupling** (_Clean Code_ G31): calls that must happen in an order nothing enforces (`init()` before `load()`). → make each step take the previous step's result as input.
