# When to Mock

Mock what the test cannot control, not what the code calls. The boundary is the external system, not the file it lives in: code you own can still be the only door to the network, and a third-party pure function is no boundary at all.

Mock at **system boundaries** only:

- Backend: database (prefer a test DB), outbound HTTP, clock and randomness, filesystem, message queue
- Frontend: network, routing/URL, auth session, browser storage, clock and animation, websocket

Don't mock:

- Internal collaborators that reach no external system
- Private methods, or anything you must reach inside to replace
- Pure logic, whoever wrote it

## Hooks, composables and other transports

A hook or composable is a transport, not a boundary. Judge it by what sits at the far end:

- **Derives from its arguments** → let it run. Mocking it mocks the implementation.
- **Carries an external effect** (`useQuery`, `useRouter`, `useSession`, `useLocalStorage`) → that is the system boundary as it surfaces in the component. Cut it, but as low as you can.

Descend this ladder, stop at the first rung that works:

1. **Real** — pure logic, no setup.
2. **Test provider** — the real hook runs against something you control (`QueryClientProvider`, `MemoryRouter`, a test store; backend: test DB, injected dependency).
3. **Fake at the transport** — real hook and real cache, faked wire (MSW; backend: fake HTTP client, injected clock).
4. **Mock the hook** — last resort, when the rungs above cost setup out of proportion to the test. Comment which external system you cut.

Decide with: *swap the mock for the real thing — does the test fail because of my code, or because of the network, the URL, a clock?* Second case, legitimate boundary. First case, you are mocking your own implementation.

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic function with conditional logic:

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

Each mock then returns one specific shape, with no conditional logic in the test setup.
