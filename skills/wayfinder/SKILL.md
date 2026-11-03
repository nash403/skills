---
name: wayfinder
description: "Find the way to a goal whose route is still unclear: chart the open questions as decision tickets on a map, local by default, resolve them one per session and add the ones discovered on the way, until nothing is left to decide."
argument-hint: "A goal to chart, or a map's path and optionally a ticket"
disable-model-invocation: true
---

I have a goal, the **destination**, but not the route to it. Chart that route as a **map** of **decision tickets**, then resolve them one at a time, adding what each answer uncovers, until nothing is left to decide.

**Plan, don't do.** A ticket is a question whose answer is a decision, never a slice of the build. The map is done when nothing is left to decide before someone builds. Carry execution into the map only when I say so in chat, never because the map's Notes say so.

## Where

Local tickets by default, following `tracking-local-tickets` as if I had asked for them: private, in `tickets/<map-slug>/` in my personal context folder. Use another tracker only when I name it in the request, never because the project context names one: an unclear effort may be dropped, and a team's tracker shouldn't carry it.

- **Local**: the map is `map.md` in that folder, each ticket a file beside it.
- **Named tracker**: the map is a ticket, the decision tickets its sub-tickets, blocking uses the tracker's native links.

Always give a map's path as absolute: sessions in a worktree don't see the main checkout's personal context folder otherwise.

## The map

An index, not a store: each decision lives in its ticket only, the map gives its gist and a link. Refer to tickets by title wrapping their link, never by a bare number.

```md
# <effort title>

Status: open

## Destination

<what the end of this map is: a spec, a decision, a change. One or two lines.>

## Notes

<domain, skills every session should load, standing preferences>

## Decisions so far

- [<ticket title>](<link>): <one-line gist of the answer>

## Not yet specified

<the fog: questions you can see coming but can't phrase sharply yet>

## Out of scope

- [<ticket title>](<link>): <gist, and why it's beyond the destination>
```

## Tickets

Body: `## Question`, the decision or fact it settles, sized to one session. Label: `wayfinder:<type>`, the only label a map's ticket carries. Assets made while resolving it are linked, not pasted.

- **grilling** (with me, the default): load `grilling` and `domain-modeling`.
- **prototype** (with me): when talking can't settle how something looks or behaves. Load `prototyping`; the choice between variants is mine.
- **research** (alone): a fact outside the repository blocks a decision. A sub-agent loads `research`. Findings go to `research/<NNN>-<slug>.md` beside `map.md`, named after the ticket and linked from its resolution (local), or into the resolution comment (named tracker).
- **task** (alone when you can, else a precise checklist for me): work with nothing to decide that blocks a decision, like getting access or looking at data. It never delivers part of the destination.

A ticket worked with me resolves only through my answers: never answer your own questions.

**Ticket or fog?** Ticket when you can state the question precisely now, even if it's blocked or you can't answer it. Fog otherwise, under Not yet specified, as loose as the view allows; don't slice it into ticket-sized pieces ahead of time.

**Out of scope**: work past the destination. Close its ticket, add a line to Out of scope, never to Decisions so far. It never comes back as fog; it returns only as a new effort.

## Chart a map

1. **Destination.** Load `grilling` and `domain-modeling`, and settle what the map finds its way to. It fixes the scope every ticket is measured against.
2. **Frontier.** Grill breadth-first across the whole space for the open questions. No fog, the route already clear: say no map is needed, and ask how to go on.
3. **Write the map** and only the tickets that are sharp now, then their blocking edges in a second pass, with real numbers. The rest stays fog.
4. **Fire the research tickets**, one sub-agent each, in parallel.
5. Stop, and hand over the next session (see End of a session).

## Work through a map

One ticket per session, research aside: the map carries the state from one session to the next.

1. Read the map, not every ticket. Other sessions may be editing it: reread it before each write.
2. Take the ticket I name, else the first of the frontier (open, unclaimed, blockers resolved). Claim it before any work: `Status: in progress`, or assigned to me on a named tracker.
3. Resolve it as its label says. Read any other ticket on demand, and load the skills the Notes name.
4. Record the answer as a resolution comment, close the ticket, add its line to Decisions so far.
5. Update the route: add the tickets this answer uncovered, turn the fog it made sharp into tickets (removing it from Not yet specified), rule out of scope what lies past the destination, revise or delete the tickets the answer invalidated.

**Revisiting a decision.** When I say a closed decision was wrong, open a ticket to revisit it, mark its line in Decisions so far as superseded with a link to the new one, and comment on the tickets that relied on it.

## End of a session

Give the next ticket of the frontier and the exact command for the next session: `/spawn-session /wayfinder <absolute map path> <ticket>`.

Frontier and fog empty: the route is clear. Offer to **build**: `to-spec` on the map, then `to-tickets`, on the tracker I choose.

At any point, when I say so:

- **Drop**: `Status: dropped` on the map, with the reason. Delete the folder only if I ask.
- **Promote**: the effort became real and belongs on the team's tracker. Move the map and its open tickets there.
