# P2EVTT

Local Pathfinder 2e–inspired virtual tabletop for a friends table. The GM runs a server on their machine; everyone else connects in a browser over the LAN. No cloud deploy.

**Why it exists:** I wanted a real-time table for our group — maps, tokens, character sheets, and monster stat blocks linked to tokens — without renting a hosted VTT. Rules stay mostly GM-driven; this is a low-security, friends-and-LAN app by design.

## Stack

- **Server:** Node.js 22, Fastify, WebSockets
- **Client:** React 19, Vite, PixiJS (maps / tokens)
- **Monorepo:** pnpm workspaces (`packages/server`, `packages/client`, `packages/shared`)

## What it does

- Multiplayer sessions over WebSockets (GM + players)
- Maps and a token library
- Character sheets
- Monster / creature stat blocks linked to tokens
- GM can switch maps during play
- First “I’m the GM” claim wins; other tabs can join as players

## Requirements

- Node.js 22 LTS (x64)
- [pnpm](https://pnpm.io) 9+ (repo pins `pnpm@11`)

## Run

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:7788](http://127.0.0.1:7788). Enter a name, then **Join as player** or **I'm the GM**.

- Players can sit before anyone claims GM.
- Display name is kept in `localStorage` (shared). Session is per tab (`sessionStorage`), so a GM can open a second tab as a player / DMPC.
- Players do not install anything — browser only.

Friends on the same network: double-click `start-lan.bat`, or:

```bash
pnpm dev -- --lan
```

Then share `http://<your-lan-ip>:7788`.

## Notes

This is intentionally not hardened for the public internet (no auth model for strangers, LAN trust assumed). Fine for a private table; not a SaaS template.

## License

See [LICENSE](./LICENSE).
