# Third-party notices

The "Simulasi proses" screen (`src/sim/`) draws its world with code adapted from the projects
below. This file records the permission and the licences they come under.

## Factory Yard

- Source: <https://github.com/Khalidabdi1/factory> (author: Khalid Abdi).
- Copied unchanged into [`vendor/factory-yard/`](vendor/factory-yard/) as the reference the
  simulation is ported from: `index.html` and `README.md` at commit
  [`bbef63f`](https://github.com/Khalidabdi1/factory/commit/bbef63fbf98a7209fbd358826fe0130c5de225c8)
  (5 Oct 2026), the last version of Factory Yard that was a single HTML file. Later commits
  moved it to Next.js. Its `docs/` images are not copied.
- Licence: **the repository has no licence file.** Under default copyright, cloning and
  adapting it needs the author's permission.
- Permission: the owner of this repository reports that Factory Yard's author has allowed the
  repository to be cloned and adapted.
  - Reported to us: 7 October 2026, in Brief B4 (`docs/sim/brief-b4.md`).
  - Date the author gave the permission: **[PLACEHOLDER: date to be supplied by the owner]**
  - Evidence (link to the message, issue or comment, or a screenshot reference):
    **[PLACEHOLDER: link or screenshot reference to be supplied by the owner]**

## ai-iso-skill

- Source: <https://github.com/MrBongoC/ai-iso-skill>.
- Factory Yard's isometric kernel (`P`, `W`, `plane`, `box`, `TOP`, `FRONT`, `SIDE`) and its
  visual language are adapted from ai-iso-skill; the simulation keeps them.
- Licence: MIT, reproduced below.

```
MIT License

Copyright (c) 2026 Tolga Cohce

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## three.js

- Source: <https://threejs.org>, installed from npm (`three`, see `package.json`), including
  its `examples/jsm` add-ons (`LineSegments2`, `LineSegmentsGeometry`, `LineMaterial`,
  `OrbitControls`).
- Licence: MIT, reproduced below.

```
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
