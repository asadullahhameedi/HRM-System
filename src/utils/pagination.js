/**
 * Parse pagination, sorting and search query params consistently
 * across list endpoints. Returns a normalized options object.
 */
function parseQuery(req, { searchableFields = [], defaultSort = { createdAt: -1 } } = {}) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  // Sorting: ?sort=-createdAt  (minus = desc)
  let sort = defaultSort;
  if (req.query.sort) {
    const field = req.query.sort.replace(/^-/, '');
    const dir = req.query.sort.startsWith('-') ? -1 : 1;
    if (field) sort = { [field]: dir };
  }

  // Search across provided fields (case-insensitive)
  let search = {};
  if (req.query.search && searchableFields.length) {
    const q = req.query.search.trim();
    search = {
      $or: searchableFields.map((f) => ({ [f]: { $regex: q, $options: 'i' } })),
    };
  }

  // Generic status filter
  const filter = {};
  if (req.query.status && ['active', 'inactive'].includes(req.query.status)) {
    filter.status = req.query.status;
  }

  return { page, limit, skip, sort, search, filter };
}

/**
 * Render pagination metadata for EJS partials.
 */
function paginate(total, page, limit, baseUrl = '') {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(page, totalPages);
  return {
    total,
    totalPages,
    current,
    limit,
    hasPrev: current > 1,
    hasNext: current < totalPages,
    from: total === 0 ? 0 : (current - 1) * limit + 1,
    to: Math.min(current * limit, total),
    baseUrl,
  };
}

module.exports = { parseQuery, paginate };
