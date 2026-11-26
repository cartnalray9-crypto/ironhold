# Ironhold — Frontier Command

A mobile-first merge-and-grind frontier strategy game. Build an island, merge identical
structures into higher tiers, research three linked ceilings, train and combine troops,
hunt monsters for gear, and bring friends into your banner.

**There is no shop in this game.** No VIP tiers, no packages, no currency bundles, no paid
boosts, no ads. Progression is time plus the skill of your merge and space decisions.

Live preview: https://ironhold-9vk5xw-preview.freebuff.site

---

## The rules, as implemented

### 2-to-1 merging
Two identical structures of the **same kind and same level** merge into one structure one
level higher (`mergeBuilding` in `src/game/engine.ts`). Mismatched levels never combine.
Merging is instant and frees the plot; upgrading is a timed job.

### Three-tier stair-step research
`src/game/data.ts` defines the caps:

| Track | What it does |
| --- | --- |
| Structure Level | New structures are *built* at this level, and may only be upgraded up to it |
| Merge Level | Hard cap on merged structure level — never more than 3 above Structure Level |
| Unit Force Combination | Hard cap on troop tiers — never more than 3 above the Merge ceiling |

Every track is gated by Command Center level; the Command Center (max 80) is gated by
campaign waves cleared.

### Space is the real limit
Three islands × 24 plots. Each cleared wave unlocks one more plot; islands 2 and 3 also
need Command Center 10 / 20 and 10 / 20 waves. Buildings can be relocated, or dismantled
for a quarter of their cost.

### Timers, with offline catch-up
Construction, research, training, scouting and gathering all run in real time and complete
while the game is closed (production is credited for up to 12 hours). Build crews are
`2 + floor(HQ / 10)`; one research project at a time; one training batch per branch.

### Troops
Army, Navy and Air branches train from Barracks / Shipyard / Air Base. Two units of the
same tier combine into one of the next tier, capped by `min(Unit Force research, building
level + 3)`. Power is compared against wave and monster power with a little luck; losing
costs troops, and the Repair Factory reduces those losses.

### Heroes
Heroes gain experience from time spent gathering and from kills and waves. The second and
third hero only join once you have accumulated enough gathering time and kills — there is
no other way to obtain them. Bonuses: battle power, gathering yield, build speed.

### Gear only from exploration
The frontier is a 9×7 fog-of-war map. Scouting is a timed job that spreads outward from
charted land; hunting monsters pays resources and, at depth 1 or more, rolls gear. Deeper
zones drop higher tiers. Nothing else in the game produces gear.

### Gathering at any time
Gold, Wood, Stone, Food and Ore can be sent for 1m / 5m / 15m from the first minute. No
resource is locked behind a level or a purchase.

### Friends / banner
The Banner tab creates an invite link containing your banner code and world seed. Anyone
who opens it joins the same banner and plays the same frontier layout. Pasting a friend's
link adds their card to your roster; each ally can send one supply drop every 30 minutes.
This is asynchronous co-op — there is no account system and no server cost.

---

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # type-check + production build into dist/
```

## Deploy

### GitHub Pages
`.github/workflows/pages.yml` builds the app and publishes `dist` on every push to `main`.
Once, in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
`vite.config.ts` uses `base: './'`, so the game also works from a project subpath.

### Freebuff Sites
The repository root contains `deploy.json` and `worker.js` for a static-asset Worker deploy.

## Project layout

```
index.html            shell, PWA meta, manifest link
public/               manifest.webmanifest, app icon
src/main.tsx          React bootstrap
src/App.tsx           shell, resources, job strip, tabs, mobile nav, log
src/types.ts          game state model
src/game/data.ts      all rules and formulas: costs, times, caps, waves, zones, gear, heroes
src/game/engine.ts    state transitions: build, merge, research, train, hunt, alliances
src/game/save.ts      localStorage save/load, invite code in the URL
src/components/       Base (islands), Research, Troops, Heroes, World, Banner
src/styles.css        theme and mobile layout
```

Progress is saved in the browser's `localStorage` under `ironhold.save.v1`.

## Fair-play commitments

- No shop, no VIP, no packages, no ads, no loot boxes, no energy gates.
- Power comes only from troops, and troops come from time and merge decisions.
- Every resource is gatherable from the first minute.
- Gear drops only from ground you explore.
