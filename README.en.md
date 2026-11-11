# Bundle Lab

A bundle can sell more and earn less. Bring your products and basket composition, separate incremental contribution from discounts to existing customers, and decide what to test next.

[Open the simulation](https://andyzhang666666.github.io/bundle-lab/simulate/) · [Explore orders and associations](https://andyzhang666666.github.io/bundle-lab/) · [Design decisions](docs/DECISIONS.md) · [中文](README.md)

> No model key needed. Use manual inputs or import CSV; results are conditional scenarios per 100 covered orders.

![Actual Bundle Lab workspace: incremental contribution, discount leakage and net contribution change](docs/assets/product-depth-20261109/desktop-1280.png)

## Try a scenario

1. Open the simulation and choose an illustrative basket or enter your own 2–3 products. You can also upload or paste order CSV, inspect the composition and confirm reference prices before applying it.
2. Adjust discount and adoption. Read incremental contribution, discount leakage and net contribution change together. Keep scenario A, change an input and keep B to compare assumptions and break-even boundaries.
3. Freeze the current inputs in a validation plan with an audience, period, metric and guardrails. Later, append treatment/control counts, inspect missing values and differences from the assumptions, and export the comparison and plan.

The condition map previews changes before applying them. Observation rates also require confirmation before a copy of the frozen plan becomes a new manual input. Existing CSV baselines, plans and saved scenarios stay unchanged.

## 2026-11-11 development branch: connect the next decision

Three targeting assumptions set existing full-basket discount take-up to public menu 100%, manual coupon 50% or checkout add-on 15%; a custom rate remains available. Only `existingRedemption` changes. Adoption and provenance stay intact. These are estimates, not demonstrated customer isolation, and 15% still leaks discounts. The original model gives −49.51, −1.70 and +31.76 per 100 covered orders for the default cola/rice scenario.

Save a matrix preview directly into the next actual A/B/C comparison position, keeping exact assumptions and CSV provenance while preserving the working input and uncommitted name. Full capacity explains how to export and free a position. Observation checks use **the selected plan’s frozen break-even adoption**, show a percentage-point shortfall below it, and remain undecided for unknown/zero denominators or unavailable thresholds. Crossing the condition still requires cost, discount and baseline checks; it does not authorize a launch.

This work is on a development branch only, without merge or deployment. [Implementation, conditions and synthetic local evidence](docs/TASK-LOOP-20261111.md). Additional checks: `npm run test:loops`.

## One discount, two customer groups

Customers who already buy the full basket may also claim the discount. The same ledger separates their discount cost from contribution gained through new adoption, including negative results and unreachable break-even states. Basket association helps find candidates; the next decision depends on explicit cost and behaviour assumptions.

## Read inputs and results correctly

Use built-in synthetic orders, a manual baseline or your CSV. Sources are saved separately; failed or cancelled imports preserve the current input. CSV accepts up to 2MB, 10,000 rows and 100 SKUs. Preview line-price distributions for 2–3 products, confirm reference prices, then apply. Quantity, payment discounts and refunds are excluded from the model.

The 100-order unit is a normalised comparison basis, not an observed sample size. Contribution excludes operating and fulfilment costs. Imports and user-entered observations remain unaudited; unknown values stay unknown. Scenarios do not establish causal lift, statistical significance or optimal pricing.

Markdown and JSON exports include the choice reason, assumption sources, frozen plans and subsequent observations.

## Run locally

Use Node.js 22 from the complete repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/bundle-lab/simulate/`. Core tasks run in the browser without a model key.

Reproduce the deterministic checks and static build:

```sh
npm run test:rules
npm run test:simulation
npm run test:depth
npm run build
```

These checks cover calculations and product state, not measured business returns.

## Design and verification

[Current release · 2026-11-09](docs/RELEASE-20261109.md) · [Feature scope and data contracts](docs/PRODUCT-DEPTH-20261109.md) · [Assumptions and formulae](docs/ASSUMPTIONS.md) · [Design decisions](docs/DECISIONS.md) · [Validation records](docs/VALIDATION.md) · [Changelog](CHANGELOG.md) · [PR checks](https://github.com/AndyZhang666666/bundle-lab/actions/workflows/checks.yml)

[All projects](https://github.com/AndyZhang666666/AndyZhang666666/blob/main/PROJECTS.en.md)

## Interface follow-up

2026-11-09: sensitivity analysis directly follows the workbench; the duplicate break-even figure is removed and adoption/discount limits share a row on desktop. Calculations and state contracts are unchanged. [Before/after evidence and checks](docs/LAYOUT-POLISH-20261109.md).

## Iteration history and earlier verification

<details>
<summary>Expand the original release notes and implementation records</summary>

The notes below retain their original wording. “Local” and “unpublished” describe the stage at each recorded date. See the [2026-11-09 release record](docs/RELEASE-20261109.md) for current scope and deployment status. Earlier feature limits and validation figures keep their original context.

**Approved release batch · 2026-11-09.** Preserve the reviewed source commits and verify deployment separately. [Release scope and verification](docs/RELEASE-20261109.md)

Bring your products and a basket-composition baseline, then ask whether incremental contribution can cover discounts to customers who already buy the full basket. Results use **100 covered orders as a normalized unit**, never an observed sample count.

- **Personal baselines:** count-assisted manual inputs or UTF-8 CSV (2MB, 10,000 rows, 100 SKUs). Preview 2–3 products, inspect line-price distributions, confirm one reference price for each, then apply. Quantity, payment discounts and refunds are excluded.
- **Explain the limit:** query the existing two-population model for the highest break-even discount. The ledger, diagnosis and Markdown/JSON exports share that engine; no revised profit formula or price-elasticity claim.
- **Freeze a validation plan:** record the audience, baseline period, allocation/control, duration, metric and guardrails. Append treatment/control counts and cost provenance; show missing values and differences from the frozen assumptions.
- **Adopt deliberately:** preview known observation rates before replacing the manual working input with a copy of the frozen plan. Existing CSV baselines, plans and up to three scenario snapshots remain unchanged. Exports include provenance, plans and observations.

All core tasks run in the browser without a key. Imported composition and user-entered observations remain unaudited. Unknown or zero-denominator rates are not filled with zero; the tool does not infer causal lift, significance or optimal pricing.

[Design, data contracts and review path](docs/PRODUCT-DEPTH-20261109.md) · [Changelog](CHANGELOG.md) · [中文](README.md)

## New task path

Open the simulation workspace → paste/upload a baseline or enter your own assumptions → confirm prices and population → inspect contribution, leakage and both break-even boundaries → keep A/B/C → preview conditions → write a frozen validation plan → append observations → explicitly adopt known rates into a new manual input → export the comparison and plans.

Checks run locally: 26 existing model/state checks, 11 new product-depth checks, 21 existing deterministic rule checks, release-path check and static production build. Also passed 14 real Chrome task checks at 1280 and 390 widths, including downloads, invalid inputs, corrupted drafts and unavailable storage; evidence is linked above. This batch is approved for publication; the release record distinguishes source, deployment and live checks. Automated checks do not establish real-user task completion or business outcomes.

<details>
<summary>Earlier iteration and release notes (historical status)</summary>

2026-11-03 release batch: verified task clarity, draft recovery and final display/export details. [Release scope and validation limits](docs/RELEASE-20261103.md). Earlier local-only notes remain as history.

Final display/export polish verified locally; calculation and persistence contracts retained. Unpublished. [Changes and checks](docs/FINAL-DETAIL-20261103.md).

Independent task-flow rechecks passed; changes remain local and unpublished. [Review scope and untested limits](docs/INDEPENDENT-REVIEW-20261103.md).

2026-11-03 local review fixes: sibling tools open in new tabs; unfinished text is restored separately from confirmed results. No push, merge or publication. [Behavior and checks](docs/DRAFT-RECOVERY-20261103.md).

Local iteration, 2026-11-03 — not published: Five key inputs now carry source and validation notes; synthetic and manually entered values never become certified observations. All three scenario values remain readable without relying on color. Assumption and comparison exports include the same provenance. Model/state checks (25), rule checks (21) and the build passed; actual files and phone-viewport actions were checked. [验收与边界](docs/TASK-CLARITY-20261103.md)。

Visual refresh approved after user review, 2026-11-02: [design, references and before/after screenshots](docs/VISUAL-CRAFT-20261102.md). Existing product behavior is preserved; the merge commit and Pages workflow record publication.



</details>

[中文](README.md) · [Project index](https://github.com/AndyZhang666666/AndyZhang666666/blob/main/PROJECTS.en.md) · [Live demo](https://andyzhang666666.github.io/bundle-lab/)

Why can a frequently bought combination earn less after a discount?

Approved release, 2026-11-02: Keep up to three immutable scenario snapshots, inspect changes relative to baseline A, record a choice reason and export comparison cards. Every discount-by-adoption cell uses the existing model; preview first, apply explicitly. Restoring defaults clears stale feedback without changing saved scenarios. Model checks, a static build and integrated browser review are complete; this release ships with the portfolio. [Implementation and checks](docs/STRATEGY-WORKBENCH.md).

![Actual Bundle Lab interface](docs/assets/product-depth-20261109/desktop-1280.png)

<!-- github-evidence-20261031 -->

[Design decisions](docs/DECISIONS.md) · [Validation records](docs/VALIDATION.md) · [PR core checks](https://github.com/AndyZhang666666/bundle-lab/actions/workflows/checks.yml)

## 2026-11-11 development branch: connect the next decision

Three targeting assumptions set existing full-basket discount take-up to public menu 100%, manual coupon 50% or checkout add-on 15%; a custom rate remains available. Only `existingRedemption` changes. Adoption and provenance stay intact. These are estimates, not demonstrated customer isolation, and 15% still leaks discounts. The original model gives −49.51, −1.70 and +31.76 per 100 covered orders for the default cola/rice scenario.

Save a matrix preview directly into the next actual A/B/C comparison position, keeping exact assumptions and CSV provenance while preserving the working input and uncommitted name. Full capacity explains how to export and free a position. Observation checks use **the selected plan’s frozen break-even adoption**, show a percentage-point shortfall below it, and remain undecided for unknown/zero denominators or unavailable thresholds. Crossing the condition still requires cost, discount and baseline checks; it does not authorize a launch.

This work is on a development branch only, without merge or deployment. [Implementation, conditions and synthetic local evidence](docs/TASK-LOOP-20261111.md). Additional checks: `npm run test:loops`.

## One discount, two customer groups

- Use basket association to propose a candidate, not establish discount impact.
- Separate incremental contribution from discounts to customers who already buy the full basket.
- Use the same assumptions in discovery, simulation, advice and exports, including negative results.

## Walkthrough

1. Pick an illustrative basket or enter your own 2–3 products. Set discount and middle adoption, then inspect population and cost assumptions.
2. Keep baseline A, copy its inputs, adjust and keep B. Compare changed assumptions, new contribution, discount leakage and break-even per 100 covered orders.
3. Preview other discount/adoption conditions in the map before applying them. Select a scenario, record why and export the comparison.
4. Inspect the synthetic orders and basket associations as supporting evidence; built-in proposals and validation plans remain available.

## Run mode and limits

Uses 4,000 synthetic orders and uncalibrated adoption assumptions. The core flow runs in the browser; optional model rewriting is labelled as an unreviewed draft.

The examples support product reasoning, not measured business outcomes. Inspect population definitions, costs and uncalibrated assumptions before applying the result to a real experiment.

## Develop locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/bundle-lab/`. The repository base path is part of the URL.

## Reproduce the core checks

```sh
npm run test:rules
npm run test:simulation
npm run build
```

These commands are provided for reproduction; this documentation update did not run a new model benchmark.

## Documentation

- [Product scope](docs/PRD.md)
- [Assumptions and formulae](docs/ASSUMPTIONS.md)
- [Design decisions](docs/DECISIONS.md)
- [Validation records](docs/VALIDATION.md)
- [Implementation details and original records, Chinese](README.md)

Use the repository’s existing licence and notices. This update does not change usage rights.

[PR core checks](https://github.com/AndyZhang666666/bundle-lab/actions/workflows/checks.yml) reuse the deterministic checks and static build. Only the main-branch Pages workflow deploys.

## Personal inputs and portable results · 2026-11-01

This update adds personal inputs and a portable result, with the reviewed implementation integrated through a release branch. Manual scenarios share the existing two-population contribution model. Outputs use 100 covered orders as a normalised comparison unit, not an observed sample size or a business forecast. Built-in and manual drafts are stored separately.

</details>
