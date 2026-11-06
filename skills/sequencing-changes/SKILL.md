---
name: sequencing-changes
description: "Order a change across commits, MRs and deploys so nothing breaks in between: expand and contract for contracts crossing a deploy boundary, a replacement built beside the old feature, feature flags, prefactoring. Use when splitting work into commits or MRs, writing a migration, removing or renaming a column, API field, event payload or stored key, or replacing a feature or page."
---

# Sequencing changes

These rules cover what only the order of delivery shows, never the final code. Within one deploy unit, order doesn't matter: a prop and its callers change together.

## Expand, then contract

A contract crosses a deploy boundary when its producer and its consumers ship separately: a database column and the running code, an API field and the deployed front, an event payload and its subscribers, a key in client storage. Change it in two deliveries:

1. **Expand.** Add the new form beside the old, nullable or with a default, and mark the old one deprecated. The code stops reading and writing the old form. For a rename, write both forms, then backfill existing rows in batches before switching reads to the new one; a long backfill ships on its own.
2. **Contract.** Remove the old form in a later delivery, once no running client uses it. Before proposing it, name the clients that could still: SPA tabs open on an old bundle, mobile apps not yet updated, scheduled jobs, services on their own release cycle. When every consumer ships together with the change, deployed everywhere is enough.

## Replacing a feature or page

Build the new one beside the old, switch over, then delete the old one in a later delivery.

## Feature flags

Put a replacement behind a flag when the rollout must be gradual or the rollback instant. Removing the flag and the old path is the contract step: plan it (a ticket, or an item of the split) when the flag is created.

## Prefactoring

Make the change easy, then make the easy change: a refactor ships in its own commit or MR, before the behavior change.

## Destructive steps

Nothing destructive (dropping a column, a table or data) without my explicit go.
