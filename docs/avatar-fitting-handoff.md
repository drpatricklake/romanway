# Avatar fitting repair — 27 November 2026

Base: Forum preview branch `fix/restore-forum-assets`, commit c16a7e9.
Working branch: `fix/avatar-ankle-proportions`.

The shoe layer includes a donor ankle which protruded outside the native leg. The renderer now clips that upper overlap to the native silhouette and blends into the shoe outline. The male musician's head is reduced within the shared complete-figure renderer, including equipped headwear. No persisted persona or inventory fields change.

Canonical transformation: `developer/apply-avatar-fitting.py`, invoked by `developer/build.py`. Both embedded renderer copies are patched.

Passed: complete canonical rebuild; inline JavaScript syntax; asset integrity; static Public Practice build; Public Practice persistence/isolation suite; 168 stage renders (28 poses × six phases) and all eligible footwear/pose combinations with native canvas. Inspected repaired male metalworker, male musician, and female scribe output.

Repeat rendering from repository root with `ROMANWAY_CANVAS_MODULE` pointing to an installed `@napi-rs/canvas` package: `node developer/tests/avatar-fitting.cjs`. Optional `ROMANWAY_RENDER_DIR` saves Legend figures in an existing directory.

Remaining: actual browser/mobile visual review, selection-to-portrait/wardrobe/scene/home-bust comparison, purchase/equip/remove/refresh regression checks, and separate Classroom verification. Local Chromium wrapper is present but its executable is missing. Native canvas checks do not replace browser acceptance. No production merge or deployment authorized.
