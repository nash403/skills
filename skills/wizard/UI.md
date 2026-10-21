# UI wizard

A single HTML page built from [template.html](template.html): Vue and Tailwind from a CDN, no build step. The library below the `LIBRARY` marker already solves the UX: one section per page with Next and Back, a sticky navbar to jump between sections, a progress bar, fields with a label, hint, description and inline error, format validation, conditional fields, a recap, answers saved in `localStorage` as they're typed, and a clear button. Your job is the `CONFIG` block at the top.

## Author it

1. **Secrets first.** If any value is secret, generate a key pair for this wizard, outside the repo:
   `node <skill-dir>/secrets.mjs keygen <tmp-dir>/<wizard-id>.key`
   It prints the public key: paste it into `publicKey`, and set `keyPath` to the private key's path. The private key never goes in the page.
2. **Copy `template.html`** to where the page will be sent from, and replace the example config:
   - one section per stage from step 1, 3–6 questions each: split a long stage rather than scroll;
   - each stage's journey from step 2 goes in `steps`, its URLs in `links`;
   - each value becomes a field, with `type: "secret"` for anything secret, and a `target` saying where it goes (`env`, `secret`, `var`);
   - a `hint` says what to enter, a `description` gives the format or where it's found;
   - validate what you can: the `email` and `url` types, `pattern` with a `patternMessage` for known formats (an API key prefix), `min`/`max`, `minLength`/`maxLength`;
   - `showIf` for questions that only apply after an earlier answer.
3. **Set `decrypt`** to the command that runs `secrets.mjs decrypt` from where the prompt will be pasted.

The config comment in the template lists every option. Don't touch anything below the `LIBRARY` marker.

## What comes back

The recap's main action is **Copy as prompt**; its menu holds **Copy as JSON**, **Copy as text** and **Download JSON**. Secrets stay encrypted in every format, and in `localStorage`. The prompt is built from the targets: it lists where each value goes and how to decrypt the secrets, so pasting it into an agent session is enough to apply everything.

When I paste the answers back: decrypt each secret with `node <skill-dir>/secrets.mjs decrypt <key> '<value>'` (or pass the downloaded JSON file), write every value where its target says, then delete the private key.

## Verify and hand off

- Open the page in a browser and walk it once: every section renders, Next blocks on missing required fields, the recap shows every answer.
- Fill a test secret, copy the prompt, and decrypt it with the private key to prove the round trip.
- Clear the test answers, then tell me where the page is and that it needs a network connection (CDN and fonts). Remind me the private key must stay with me.
