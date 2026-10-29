# Bundle Lab

[中文](README.md) · [Project index](https://github.com/AndyZhang666666/AndyZhang666666/blob/main/PROJECTS.en.md) · [Live demo](https://andyzhang666666.github.io/bundle-lab/)

Why can a frequently bought combination earn less after a discount?

![Actual Bundle Lab interface](https://andyzhang666666.github.io/assets/work/showcase/bundle-crop.jpg)

## Product decisions

- Use basket association to propose a candidate, not establish discount impact.
- Separate incremental contribution from discounts to customers who already buy the full basket.
- Use the same assumptions in discovery, simulation, advice and exports, including negative results.

## Walkthrough

1. Choose a candidate and inspect its association direction and covered orders.
2. Adjust adoption and discounts; reconcile contribution, discount leakage and break-even.
3. Compare candidates and export a rule-based proposal with a validation plan.

## Run mode and limits

Uses 4,000 synthetic orders and uncalibrated adoption assumptions. The core flow runs in the browser; optional model rewriting is labelled as an unreviewed draft.

The examples support product reasoning, not measured business outcomes. Inspect population definitions, costs and uncalibrated assumptions before applying the result to a real experiment.

## Develop locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/bundle-lab/`. The repository base path is part of the URL.

## Lightweight checks

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
