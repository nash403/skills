---
name: syncing-ticket-status
description: "Keep a ticket's status and labels in step with the work: in progress when it starts, in review when a PR or MR opens, ready to deploy or done once it's merged or pushed to the default branch. Use after a push, a PR or MR, or a merge tied to a ticket, or when I ask to update a ticket's status."
---

Align the ticket's status with where the work really is, on the tracker the project uses.

## 1. Find the ticket

From the conversation, the branch name or the commit messages (`ABC-123`, `#12`). Find the tracker, its statuses and its labels in the committed files, then the project context. No ticket: say so in one line and stop. Never guess one.

## 2. Read it first

Trackers linked to the git platform often move tickets on their own (branch, PR, merge, closing keywords). If the status is already right, do nothing.

## 3. Decide

| The work | The status |
| --- | --- |
| Started: first commit on the ticket's branch | In progress |
| Up for review: PR or MR opened | In review |
| Shipped: merged, or pushed to the default branch without a PR | Done, or the status just before it |

Use the tracker's own status names, the closest match to each step. Shipping the code isn't always the end of the ticket: deploying, testing or releasing may follow, outside the work's scope. When the workflow has a status between review and done (Ready to deploy, Ready for release, Merged…), shipped means that one; Done only when there's nothing in between.

Add only labels the tracker already has, when one fits the step. Shipped means the work delivers everything the ticket asks; work that only advances it leaves it where it is.

## 4. Act

- **Forward along the table, nothing in doubt**: apply it, then say it in one line: the ticket, old → new status, its link.
- **Ask first** when the work may not cover the whole ticket, when several tickets could match, to move a ticket backward, or when the ticket belongs to someone else.
- **On shipped**, leave a one-line comment on what was delivered, with the commit or PR.
