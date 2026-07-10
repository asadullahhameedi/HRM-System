/**
 * Small date helpers used across modules to avoid repeated Date math.
 */

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0); // last day of current month
  d.setHours(23, 59, 59, 999);
  return d;
}

function diffDays(a, b) {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// `monthKey` and `format` removed — neither was called from anywhere in the
// project. Views format dates inline with `new Date(x).toLocaleDateString(...)`.

module.exports = {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  diffDays,
};
