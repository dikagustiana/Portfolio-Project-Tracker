# Brief B5 evidence

## The distribution engine's report

`sim-report-world1-before.txt` and `sim-report-world2-before.txt` are the output of
`TZ=Asia/Jakarta node scripts/sim-report.ts` (world 1) and `… --world b2b-b2c` (world 2) on `main`
at `afb7e0e`, before any Brief B5 change. They are byte-identical to Brief B4's baseline in
`docs/sim/b4-evidence/`.

After each step the same two commands are run again and compared with `cmp`:

| Step | World 1 | World 2 |
|---|---|---|
| W0 (shell refactor, world switcher, routes) | identical | identical |
| W1 (style frames: Pabrik singkong and Rumah potong ayam staged, the swimlane snapshot) | identical | identical |
