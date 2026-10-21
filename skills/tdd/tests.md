# Good and Bad Tests

## Addressing the Subject

Address the thing under test by a stable, intentional handle, never by an incidental detail that can change while behavior doesn't.

Frontend has a settled order — follow it:

1. **The project's test ID attribute** — the default, and mandatory wherever text is translated or dynamic. Plan test IDs during component design; if an element lacks one, add it rather than falling back.
2. **Semantic role without a name** — singletons only (`dialog`, `navigation`, `alert`). A translated `name` puts the fragility straight back.
3. **Text, label or placeholder** — last resort, with a comment stating why the two above were impossible.

Backend: address through the public interface and response payload, not column indexes, log lines or stdout scraping.

Where the project ships a UI testing skill or doc, it owns the concrete attribute and query table. Defer to it.

One scenario per test (`opens modal`, `submits and shows error`), not one test walking a whole flow.

## Examples

```typescript
// GOOD: observable behavior through the public interface
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});

// GOOD: the call at the system boundary is the behavior
test("checkout charges the card for the cart total", async () => {
  const payments = { charge: jest.fn().mockResolvedValue({ status: "ok" }) };
  await checkout(cartOf({ price: 15 }), payments);
  expect(payments.charge).toHaveBeenCalledWith(15);
});

// BAD: asserts a call between your own modules
test("checkout calls calculateTax", async () => {
  const spy = jest.spyOn(pricing, "calculateTax");
  await checkout(cart, payments);
  expect(spy).toHaveBeenCalledWith(cart.total);
});
```

```typescript
// BAD: bypasses the interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: verifies through the interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

```typescript
// BAD: tautological, the expected value is recomputed the way the code computes it
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: the expected value is an independent, known literal
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```
