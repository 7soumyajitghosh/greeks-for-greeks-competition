// In-memory store. Swap with Prisma (see prisma/schema.prisma) in Phase 3.
// Map<id, analysis>. Only stores when user explicitly saves (POST /api/history).
const crypto = require("crypto");
const store = new Map();

function save(entry) {
  const id = crypto.randomUUID();
  const record = { id, createdAt: new Date().toISOString(), ...entry };
  store.set(id, record);
  return record;
}

function get(id) {
  return store.get(id) || null;
}

function list() {
  return [...store.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

module.exports = { save, get, list, _store: store };
