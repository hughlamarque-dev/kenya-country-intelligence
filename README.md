# Kenya Country Atlas

Published at https://hughlamarque-dev.github.io/kenya-country-intelligence/.

The opening page loads a small continental overview. Map layers, analysis tables,
and donor records are fetched on demand from the existing national atlas.

## Delivery

`atlas-bundle-05104e1.bin` is the exact original index.html from commit
05104e1a82f9e362a62d30a167832ec044c0d5d1. It is a data archive, not an entry page.
Keep its bytes unchanged: `assets/atlas-manifest.json` records byte offsets and
SHA-256 checksums of its individually compressed assets. GitHub Pages byte-range
requests retrieve only the required assets. If a server does not support ranges (including compression proxies),
the loader falls back to a single full download. Failed loads can be retried.

`assets/atlas-loader.js` applies the Kenya country-label correction to the map
template and attaches `assets/section-tabs.css` to both analysis pages. The
underlying national data and financial records are preserved. The home overview
uses the existing Natural Earth continental geometry; detailed map boundaries
continue to use the national QGIS export.

Run `node tools/verify-delivery.cjs` (Node 22+) to check all 39 embedded assets,
range loading, fallback, retry, label correction and page script syntax.

The original portable atlas remains available in Git history. Publishing a new
portable index from QGIS would replace the lightweight entry page; integrate new
exports with this delivery format to retain on-demand loading.
