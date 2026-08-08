# Design — discount-calculator

## Decision

- Observed: the discount calculation is a pure function with no side effects, dependencies, or
  I/O.
- Inferred: rounding to 2 decimal places suggests currency-amount semantics, though no
  currency type or formatting is present in the observed code — this reading is not directly
  confirmed by a test.

## Path ownership

- `source/discount.js` — discount calculation only.
