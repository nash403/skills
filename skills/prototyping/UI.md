# UI prototype

Several variants of one surface, mounted in the running app and switchable from a floating bar. I flip between them, pick one or steal bits from each, and the rest goes away.

## The surface

Any size: a page, a region of a layout already accepted, a panel or card, a button or custom field, or a behaviour (a drag, an inline edit, a transition). Name the surface and the question in one line before drafting.

Mount the variants where the surface will live: the page that holds the region, the form that will hold the field. A surface in isolation hides its problems; the real header, data and density expose them. Only when that context doesn't exist yet, create a throwaway route following the project's routing conventions, with `prototype` in its path, and give it a realistic surrounding.

## Variants

Default to 3, at most 5. Each uses the project's component library and styling, and has a clear name (`VariantA`… or a short descriptive one).

They differ along the axis of the question: structure and hierarchy for a layout, visualization for data, interaction for a behaviour. Never just colour or copy; if two come out too similar, redo one. A shared header is fine, a shared layout defeats the point.

For a behaviour, keep it simplistic: hardcoded data, stubbed mutations, faked delays. The point is to see what it feels like, not to build it.

## The switcher

Variants are selected by a `?variant=` search param, set through the framework's router so the choice survives a reload and can be shared. Only the surface swaps; the data fetching around it stays.

A small fixed bar at the bottom centre: previous and next arrows that wrap around, the current variant's key and name between them. The `←` and `→` keys do the same, except when an input, textarea or contenteditable has focus. It looks clearly apart from the design being judged, and never renders in production builds. One shared component, wherever shared UI lives.

## Rounds

When a direction wins, it becomes the fixed context and the next round prototypes a surface inside it: the layout first, then the panel that matters, then the field in it. Each round has its own question and verdict.

## Hand it over

Give me the URL and the variant keys. The useful feedback is often "the header from B with the list from C": that's the actual design. Once settled, fold the winner in, and drop the losing variants and the switcher.
