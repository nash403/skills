# GLOSSARY.md Format

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
_Code_: `BuyerCompany`
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **One term, no synonyms.** Words customers or other teams use go under `_Avoid_` for code and copy.
- **Point to the code only when grepping the term wouldn't find it.** Add a `_Code_` line, after `_Avoid_`, naming the type, field or enum value that holds the concept: `` `TenderInvitation` with status `DECLINED` ``, `` `TenderResponse.total_price` ``, or a note when the code stores it at another grain. Never a file path or a function. No line when the code uses the term itself. A `_Code_` name that is also an `_Avoid_` word documents the legacy name: it doesn't license that word in new code or copy, unless the codebase's convention is to keep it.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.

## Glossary map

In a multi-context repo, `GLOSSARY-MAP.md` at the root lists the contexts, where they live, and how they relate to each other:

```md
# Glossary Map

## Contexts

- [Ordering](./src/ordering/GLOSSARY.md): receives and tracks customer orders
- [Billing](./src/billing/GLOSSARY.md): generates invoices and processes payments
- [Fulfillment](./src/fulfillment/GLOSSARY.md): manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

When multiple contexts exist, infer which one the current topic relates to. If unclear, ask.
