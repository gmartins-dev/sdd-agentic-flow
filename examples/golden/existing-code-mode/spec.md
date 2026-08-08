# Specification — discount-calculator

## Requirement REQ-1: Percentage discount calculation (Observed)

`applyDiscount(amount, percent)` returns `amount` reduced by `percent` percent, rounded to 2
decimal places. Directly shown by the function body.

## Requirement REQ-2: Reject out-of-range percentages (Observed)

`applyDiscount` throws a `RangeError` when `percent < 0` or `percent > 100`. Directly shown by
the function body's guard clause.

## Requirement REQ-3: Non-negative amount (Unknown)

Whether `amount` must be non-negative is not enforced or tested by the observed code; this
requirement is a gap neither the code nor its tests answer.

## Acceptance criteria

- `applyDiscount(100, 10)` returns `90`.
- `applyDiscount(100, -1)` and `applyDiscount(100, 101)` throw `RangeError`.
- REQ-3 is an open question pending confirmation; no acceptance criterion is asserted for it
  yet.
