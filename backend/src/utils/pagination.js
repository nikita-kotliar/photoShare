function toPage(items, total, { page, limit }) {
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

function skipFor({ page, limit }) {
  return (page - 1) * limit;
}

module.exports = { toPage, skipFor };
