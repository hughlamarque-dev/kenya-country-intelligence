# Partner evidence exports

`tools/partner-export.js` runs inside the donor page closure. It exports the filtered reviewed partners, the saved shortlist or one profile as a seven-sheet Excel workbook. `assets/partner-export-template.json` is a styled artifact-tool workbook packaged as readable XML, fetched only when needed. No new financial amounts, call dates or eligibility terms are inferred.

Filtered exports share the route-card predicate. Supporting records follow their corresponding page filters. Shortlist and individual exports include all available supporting periods and keep measures separate. Source IDs resolve to clickable URLs. Missing numbers remain blank, zeros and negative corrections stay numeric, and partial dates retain their source precision. Original source text is stored as strings, never formulas.

To rebuild the template, run `build-template.mjs OUTPUT_DIRECTORY` with the primary runtime's `@oai/artifact-tool` in a temporary working directory, then `python tools/partner-export/pack-template.py OUTPUT_DIRECTORY`. Regenerate the page with `python tools/build-donor-review.py`.

Validation:

- `node tools/check-donor-review.cjs` with JSDOM available.
- `node tools/check-partner-export.cjs OUTPUT_DIRECTORY` captures real UI downloads using JSDOM.
- `python tools/partner-export/verify-downloads.py OUTPUT_DIRECTORY` reads those downloads and checks their contents and XML. It does not author workbooks.
