# 2026-11-11 local task-loop evidence

Development branch only. All data, counts and observation notes are synthetic fixtures. No model calls, customer study, business result, merge or deployment is represented here.

| Evidence | Result |
| --- | --- |
| `baseline-core-state.log` / `baseline-rules.log` / `baseline-release.log` | Original 37 tests, 21 rules and 58 guards pass before edits |
| `final-core-state.log` / `final-rules.log` / `final-release.log` | Original 37 + separate new 8 = 45 tests; 21 rules and 58 guards pass |
| `original-assertions.sha256` / `original-assertions-verified.log` | Original assertion files, both original browser scripts and model engine remain byte-for-byte intact |
| `task-loop-tests.log` | Separate deterministic edge and integration cases |
| `build.log` | Final static production build succeeds |
| `browser-checks.json` / `browser.log` | Four workflow groups across 1280/768/390, keyboard, reduced motion, downloads, reload and CSV provenance; no page errors or page overflow |
| `original-browser-regression.log` | Unmodified original browser script: 14 workflow groups pass, including invalid input, corrupt storage and unavailable local storage |

`comparison-{width}.json/.md`, `plan-{width}.json/.md` and `comparison-csv.json` are actual browser downloads. JSON plan checks use frozen assumptions even though the live cost input was later changed from 40% to 80%. A crossed condition remains a conditional model check, not launch approval.

Screenshots show the existing worksheet with the new controls and actual full-capacity/frozen-observation states. Each image is captured from the rendered browser. Matrix tables scroll within their region on narrow screens; no full-page horizontal overflow was observed.

- [1280 workspace](workspace-1280.png)
- [1280 matrix and full capacity](matrix-full-1280.png) · [768](matrix-full-768.png) · [390](matrix-full-390.png)
- [1280 frozen observations](frozen-observations-1280.png) · [768](frozen-observations-768.png) · [390](frozen-observations-390.png)

An early local-server connection reset prevented one script chunk from loading. Only this task’s preview was restarted with a larger connection queue; the final complete checks above passed without weakening product assertions.
