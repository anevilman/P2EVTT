# P2EVTT — Implementation Plan

A local-only Pathfinder 2e virtual tabletop for a friends table: one Node process on the GM machine, browser clients, **two different UIs** (GM vs player), 2D map, tokens, sheets, dice, walls, fog of war, and lighting.

This is never going on the internet. Do not spend implementation time on anti-cheat, DevTools threat models, “never on the wire” allowlists, or copyright/CUP/ORC scaffolding.

**Earlier design doc** (`grok-design-doc-6f2b6c47.md`) is useful for stack, schema, vision algorithm, and dice landing — **superseded** wherever it assumes a cheating player or public-release legal constraints. This plan wins.

Solo estimate **~8–12 weeks** to v1 (shorter than the anti-cheat-heavy draft).

---

## User revisions (locked)

1. **GM and players have different interfaces.** First-class product requirement, not a permission footnote.
2. **No anti-cheat architecture.** Friends will not inspect WebSocket frames to steal the dungeon. The server exists so everyone sees the **same table**, not so we can hide bytes from the client.
3. **No fair-use / CUP / ORC work.** Private LAN app. Import or type whatever PF2e data the table wants. No attribution footer, no “ship zero Paizo content” PR checklist.

---

## What we are building (v1)

- GM runs `pnpm dev` (Node 22 LTS). Players open a browser to `http://<host>:7788` (localhost by default; `--lan` for other machines on the network).
- One campaign, **many scenes in a GM scene library**, one **active** scene at a time. Each scene has a name, background image, and (later) its own grid, walls, tokens, and FoW. Switching scenes is a GM action; every client follows.
- Reusable token library. Placed tokens with PF2e sizes. GM assigns who may move which token.
- **PC tokens:** character sheet in the player UI (owner) and GM UI.
- **NPC tokens:** optional monster stat block in the **GM UI only** (players do not get that panel).
- Dice with PF2e degree of success + visible 3D polyhedra (d4–d20, d100 as two d10s).
- Walls/doors, polygonal LOS, lighting, explored fog, GM paint/erase. FoW is a **screen** feature: player map looks fogged; GM map does not (unless they toggle Player view).
- Chat, pointer, ruler, initiative, conditions, backup zip.

Voice/video, macros, hex grid, and a full rules engine are out of v1. Use Discord for voice.

---

## Two interfaces (this is the product)

One client app, two chrome shells driven by `role: 'gm' | 'player'`. Same Pixi map renderer; **different tools, panels, and layer visibility**. A player who resizes the window must not discover GM tools. There is no “click to become GM” in the player chrome (GM is whoever started the server / claimed GM on the host).

### GM interface

```
┌─────────────── scene name ──── encounter tracker (full: all combatants, HP, hidden) ── [Player view] ─┐
│ Library / Scenes │                     MAP (Pixi)                          │ Inspector            │
│ token prototypes │  background, grid, ALL tokens (incl. hidden),           │ token / actor / wall │
│ scene list       │  walls, doors, lights, FoW paint, measure               │ NPC stat block       │
│ actors           │  pan/zoom, place tokens, draw walls                     │ assign control       │
│                  │                                                         │ scene / grid / lights│
├──────────────────┴─────────────────────────────────────────────────────────┴──────────────────────┤
│ Chat (table + GM + whispers + secret rolls) │ Dice │ Event log                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

GM-only: wall/door tools, light placement, FoW reveal/hide/reset, token library (unplaced prototypes), **scene library** (create / rename / delete / switch active / upload that scene’s map), hide/reveal token, NPC stat block editor, control assignment, grid nudge, kick/rename, backup, Player-view preview (see the map as a chosen player).

### Player interface

```
┌─────────────── scene name ──── encounter tracker (visible combatants; PC HP if shared) ─────────────┐
│ Party / my sheet │                     MAP (Pixi)                          │ My token / sheet     │
│ PCs              │  background, grid, tokens that are not hidden,          │ conditions           │
│                  │  FoW overlay, lights as atmosphere, measure             │                      │
│                  │  pan/zoom, drag tokens I control, ping                  │                      │
│                  │  NO wall tools, NO library, NO FoW paint                │                      │
├──────────────────┴─────────────────────────────────────────────────────────┴──────────────────────┤
│ Chat (table + my whispers) │ Dice │ My character sheet (modal or dock)                             │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Players: move assigned tokens, open their character sheet, roll (freeform or from sheet buttons), ping, ruler, talk in table chat. They do **not** see hidden tokens, unexplored fog, wall-edit handles, the unplaced monster library, or NPC stat-block editors. That is UI, not a wire-level secret.

Join flow: GM sees an invite panel (URL + join code). Players enter display name + code and land in the **player** shell.

---

## Stack (closed)

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS x64, TypeScript 5.x, pnpm workspaces (`shared` / `server` / `client`) |
| Server | Fastify 5 + `@fastify/websocket` |
| DB | Drizzle + better-sqlite3, WAL, `campaign.sqlite` + `app.sqlite` |
| Chrome | React 19 + Vite — **`GmApp` vs `PlayerApp`** (shared map widget) |
| Map | PixiJS 8 |
| Dice | Three.js + cannon-es overlay |
| Validation | Zod for protocol and sheets |
| Native addons | Pin Windows prebuilds (`better-sqlite3`, sharp) |

**Server role:** shared table of record. Clients send actions (move, roll, chat). Server writes SQLite and broadcasts so every screen stays in sync. Role checks exist so a player UI cannot accidentally drive GM tools (wrong button, not “cheater”). Broadcast the scene; let each shell decide what to **draw**.

Do **not** build: observer-filtered payload types, never-on-the-wire allowlists, media ACL-by-snapshot, per-connection seq to hide events, DevTools-proof formula composition, hashed threat-model tables.

Simple monotonic `seq` on the campaign is enough for “missed a message → resync snapshot.” Everyone can get the same snapshot; the player shell ignores hidden tokens and GM-only panels.

---

## Fog of war and lighting (game feature, not security)

Still worth computing in `packages/shared` so GM **Player view** matches what players actually see.

- **Stage 1:** polygonal LOS from each player-controlled token, blocked by walls/doors.
- **Stage 2:** illumination + vision type (normal / low-light / darkvision / greater darkvision). Per source, then union. A human+dwarf pair must not see darkness through the human.
- **Explored fog:** shared party in v1. GM can paint reveal/hide.
- **Player map:** unexplored = opaque; explored-but-not-visible = dim grey; current vision = lit. Hidden tokens not drawn.
- **GM map:** full scene; optional Player-view overlay.

Friends-with-DevTools could read token positions from the socket. Out of scope.

---

## Dice

Server picks the number so every client plays the **same** 3D landing (sync, not fairness-against-cheats). Sheet buttons send the formula currently on the sheet (typed modifiers). 3D overlay: simulate physics, then snap quaternion to the rolled face (d4 vertex, d10 `10` → face 0, d100 = two d10s). Chat total is what the table reads.

---

## Features

**Requested, in v1:** local server, browser clients, two UIs, 2D rooms + background, **scene library** (named maps the GM can switch between), grid overlay, multiplayer + one DM, savable tokens, assignable control, PC sheets, NPC tokens ± stat blocks (GM UI), dice + 3D polyhedra, FoW (DM paint + token vision), lighting.

**Also in v1 because a session needs them:** walls/doors, hidden tokens (GM UI), chat + roll log, pointer, ruler, 5-ft diagonals, collision so Large tokens do not walk through walls, initiative tracker, condition badges, backup zip, sheet roll buttons.

**P1:** drawings, AoE templates, journal, turn-lock movement, split-party fog, colored lights.

**Out of v1:** voice/video, macros, hex, flanking automation, Foundry modules.

---

## Key decisions (revised)

| # | Decision |
|---|---|
| K1 | Node 22 + TS monorepo; pin native prebuilds. |
| K2 | React chrome split into **GM shell vs player shell**; PixiJS map; Three.js dice overlay. |
| K3 | Fastify + WebSockets. Gameplay on WS; HTTP for media and backup. |
| K4 | SQLite via Drizzle. Backup via `backup()` / `VACUUM INTO`. |
| K5 | Server is the shared table. Broadcast scene state. **Do not** filter the wire for anti-cheat. Player vs GM is **which UI and which tools**. |
| K6 | **Scene library, one active scene.** Campaign holds many scenes. GM creates/renames/deletes and switches which one the table is on. Players do not get a scene picker — they just see the active map. Token *prototypes* are campaign-wide; *placed* tokens, walls, lights, and FoW belong to a scene. |
| K7 | Hybrid actors: indexed HP/name/type + `sheet_json`. Conditions on tokens. |
| K8 | Vision in `shared`, run on the server so Player view matches. Used to **draw** FoW, not to strip packets. |
| K9 | Two-stage per-source vision; shared-party explored fog. |
| K10 | Server rolls first so 3D dice agree; animation is loaded. |
| K11 | Remaster-shaped sheets. Type-the-number modifiers in v1. |
| K12 | No full rules engine in v1. |
| K13 | Join code + display name. First loopback client is GM. `--lan` for friends on the network. Keep it simple (no unlock-hash theater). |
| K14 | Bind `127.0.0.1:7788` by default; `--lan` → `0.0.0.0`. |
| K15 | Images on disk, metadata in SQLite. Re-encode uploads so the map does not eat random files. Not an ACL puzzle. |
| K16 | No voice/video. |
| K17 | **No legal workstream.** Private table; paste/import any PF2e data you want. |
| K18 | Elevation stored, unused in the renderer. |
| K19 | `token.move` on pointerup (+ optional 10 Hz preview). Camera is local. |
| K20 | Freeform rolls and sheet buttons both send a formula. Server rolls and builds 3D `visuals`. |
| K21 | LOS unlimited-in-scene unless a feet cap is set; convert cap to pixels. |
| K22 | NPC stat blocks are a **GM panel**. Players never get that UI. No need to omit the JSON from the socket. |
| K23 | **Two chrome shells** from day one (PR-04b already branches layout). |
| K24 | **Scene library is v1, GM-only.** Minimum: list, new scene, rename, delete (not the last scene), set active, per-scene background upload. Duplicate scene is P1. |

---

## PR Plan

First playable: **PR-04b** (map + one token). FoW after walls. GM vs player chrome starts as soon as there is a role.

| PR | Title | Effort | Depends on |
|---|---|---|---|
| 01 | Monorepo + `pnpm dev` on :7788 | 0.5d | — |
| 02 | Protocol + WebSocket presence | 1d | 01 |
| 03 | SQLite, campaign, join code, **role on session** | 1.5d | 02 |
| 04a | Scene background + Pixi pan/zoom | 1.5d | 03 |
| **04c** | **Scene library** (list / new / rename / delete / switch active / per-scene map upload) | 2d | 04a |
| **04b** | **One token + move-on-drop. Split GM vs player chrome** (GM: inspector; player: no tools yet) | 1.5d | 04c |
| 05 | Grid from squares-across, snap, `occupiedSquares` | 1d | 04b |
| 06 | Token library (GM panel), sizes, facing, many tokens | 2d | 05 |
| 07 | Actors, control assignment (**GM assigns; player can only move assigned**) | 2d | 06 |
| 08a | Character sheet Core tab (player + GM) | 2d | 07 |
| 08b | Skills/strikes/spells + **NPC stat block GM panel** | 2d | 08a |
| 09 | Chat, whispers, GM log (GM shell sees GM/secret channels) | 1.5d | 07 |
| 10 | Dice math + sheet buttons + degree of success | 2d | 08b, 09 |
| 11 | 3D dice overlay | ~1w | 10 |
| 12 | Walls/doors (GM tools) + AABB collision | 3d | 05, 07 |
| 13a | Vision sweep library + fixtures | 3d | 12 |
| 13b | GM debug polygons | 1d | 13a |
| 13c | Player map: hide hidden tokens, apply FoW overlay; GM: full map + Player view | 2d | 13a, 07 |
| 13d | Explored fog + GM paint | 2d | 13c |
| 14 | Lighting + vision types | 3d | 13d |
| 15 | Pointer, ruler, measured movement | 2d | 13d, 05 |
| 16 | Initiative (GM sees all; player tracker is the player-facing list) + conditions | 2.5d | 08b, 10 |
| 16.1 | Settings, invite panel, kick | 0.5d | 03, 08a |
| 17 | Backup zip + polish | 2d | after 16 |
| 18 | *(P1)* Drawings + AoE templates | ~1w | 15, 12 |

**Merge order:** 01 → 02 → 03 → 04a → **04c** → 04b → 05 → 06 → 07 → 08a → 08b → 09 → 10 → 11, with 12 after 07. 13a after 12. 13b → 13c → 13d → 14. 15 after 13d. 16 after 08b+10. 17 last.

**v1 exit criteria:** GM and four friends on a LAN. GM screen has a **scene library** (at least two named maps, switch mid-session), walls, token library, NPC blocks, unfogged map, Player-view toggle. Player screens have FoW, no wall tools, their sheet, tokens they control. Load a map, grid, PC + NPC tokens, assign control, roll a strike with 3D dice, walk into a room and reveal fog, darkvision vs a dark corner, ping, three-round encounter, backup zip. Opening DevTools is not a test.

---

## Defaults (from earlier questions)

1. Name: **P2EVTT**. Call it a Pathfinder table in the UI if you want — no CUP workstream.
2. Share PC HP on player tracker (`sharePcHp: true`).
3. Type modifiers by hand in v1.
4. Shared-party fog in v1.
5. No voice/video.
6. Remaster-shaped sheets.

---

## Implementation notes

- Workspace `C:\Users\bradl\Documents\dev\P2EVTT` is empty.
- Copy a **trimmed** design into `docs/design.md` on PR-01: keep stack, schema, vision math, dice landing; drop security/legal chapters that this plan kills.
- Windows: Node 22 LTS x64; prebuilds, not node-gyp.
- Caps on huge dice formulas / wall batches stay as “don’t freeze the GM laptop,” not as anti-DoS.
