# RomanWay production assets

This directory is the canonical, shared source for RomanWay Classroom and Forum.
Commit original binary files, not links to temporary attachments or deployed caches.

- `sprites/`: 28 original WebP atlases, with their original names.
- `textbook/sheets/`: 14 original JPEG atlases, sheet00.jpg through sheet13.jpg.
- `textbook/figures/`: 218 individual figure images for maintenance and recovery.
- `textbook/figures-index.csv`: figure keys, lessons, captions, credits and provenance.
- `manifest.json`: full SHA-256, byte size, dimensions, legacy route mapping and unresolved worksheet IDs.

Both editions must consume the same reviewed asset revision. Do not regenerate,
recompress or rename source files merely to deploy them. Figure 49 retains its
original embedded coin image; Figure 168 uses the recovered PDF illustration;
Figure 185 is credited to Melissa Toomey. Preserve the distinction between
author-confirmed, PDF-verified and unverified source credits.

Run `python scripts/verify-assets.py` for release readiness; it deliberately
fails while any required asset is absent, changed unexpectedly or unresolved.
Use `--graphics-only` only for an explicitly non-release recovery check.
Run `--deployment PATH` to check the actual static output as well. CI must be
required before merging, and each Vercel build must run the release check.
Never regenerate the manifest automatically in CI: review changes to it and
the corresponding binaries together. Tag verified releases so every deployment
can be reconstructed from a checkout.

The binary import is a separate commit. Until that commit lands and the six
worksheet PDFs are resolved, this branch is intentionally not release-ready.
