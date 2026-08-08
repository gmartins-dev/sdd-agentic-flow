'use strict';

function applyDiscount(amount, percent) {
  if (percent < 0 || percent > 100) throw new RangeError('percent must be between 0 and 100');
  return Math.round(amount * (1 - percent / 100) * 100) / 100;
}

module.exports = { applyDiscount };
