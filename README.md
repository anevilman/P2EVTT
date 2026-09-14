# P2EVTT

A local Pathfinder 2e virtual tabletop for a friends table. The GM runs a server on their machine; everyone else connects in a browser.

This is a private LAN app. There is no cloud deploy.

## Requirements

- Node.js 22 LTS x64
- [pnpm](https://pnpm.io) 9+

## Run

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:7788](http://127.0.0.1:7788).

Friends on the same network:

```bash
pnpm dev -- --lan
```

Then share `http://<your-lan-ip>:7788`.

## Git phases

Work lands as sequential commits on `main` so a bad step is easy to undo:

```bash
git log --oneline
git revert HEAD          # undo the last phase, keep history
git reset --hard <sha>   # jump back to a known-good commit (destructive)
```
