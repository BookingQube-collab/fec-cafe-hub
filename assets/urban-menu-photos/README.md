# Urban Café studio images

The 70 canonical WebP images are AI-generated visual interpretations inspired
by the supplied menu, not photographs taken at the café. They retain the source
serving shapes, cups, boards and toppings. Café staff should review the imagery.

- `*.webp`: optimized 1024 × 1024 delivery images, about 7 MB in total.
- `prompts.json`: generation prompts and source-reference mappings.
- `manifest.json`: item identity, delivery paths, sizes and SHA-256 fingerprints.

Duplicate PNG working originals were removed during cleanup; canonical WebP
assets and live uploads remain intact. Original generation fingerprints and byte
counts are retained as provenance. Run `node scripts/verify-photo-assets.mjs`
from the app root to verify all canonical delivery files without credentials or
external services. Upload replacement photos through the manager dashboard.
