# Logic prototype

One self-contained HTML file that lets anyone drive a state model by clicking, so the bugs in the idea show up before the code exists. It may go to a designer, a PM or a domain expert: it speaks their language, not the code's.

## Isolate the logic

Write the logic as a small pure module in its own `<script>` block, shaped by the question:

- a reducer, `(state, action) => state`, when actions are discrete events;
- a state machine, when "which actions are legal right now" is part of the question;
- pure functions over a plain data type, when there is no current state;
- a class with a clear method surface, when the logic owns ongoing state.

No DOM, no `document`, no handlers inside it: the page calls into it, never the other way. That module is what lifts into the real code once validated; the page around it is throwaway.

## Build the page

Plain HTML, CSS and JS, everything inline: it opens by double-click and survives being emailed. Labels use domain words, in the language of whoever will click through it. Top to bottom:

1. **Title and the question** in a sentence or two.
2. **Current state** as a readable panel of labelled fields, not raw JSON, re-rendered after every action, with what just changed called out.
3. **Free play**: one button per action, always available.
4. **Walkthroughs**: one tab per scenario, with a short description of what to watch for and its steps as real buttons. Starting one resets to a known state. Cover the happy path, the awkward edge case, and something that should be illegal.

Clean and restrained: good typography, one accent colour, no animation.

## Hand it over

Send the file or open it. The interesting moments are "wait, that shouldn't be possible" and "I assumed X": those are the bugs in the idea. Add actions or scenarios as they ask.
