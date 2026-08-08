# Context — discount-calculator

Source item: none (existing-code mode; scope: `source/discount.js` in this directory)

## Confirmed context

- Observed: `applyDiscount(amount, percent)` computes `amount * (1 - percent / 100)`, rounded
  to 2 decimal places.
- Observed: `applyDiscount` throws a `RangeError` when `percent` is outside `[0, 100]`.

## Scope and non-goals

- Scope: `source/discount.js` only.
- Non-goal: currency formatting, persistence, or multi-currency support — none of these are
  present in the observed code.

## Assumptions and open questions

- Unknown: whether `amount` is expected to be pre-validated as non-negative by the caller — no
  check or test in the observed code covers this.
