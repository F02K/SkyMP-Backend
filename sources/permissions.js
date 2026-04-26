'use strict'
// ── Permission resolution ─────────────────────────────────────────────────────
// Maps Discord role IDs to flat permission strings using data/role-permissions.json.

const fs   = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'data', 'role-permissions.json')

function _load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return { roles: {} }
  }
}

/**
 * Given an array of Discord role ID strings, returns a deduplicated flat array
 * of permission strings based on the role-permissions config.
 * @param {string[]} roleIds
 * @returns {string[]}
 */
function resolvePermissions(roleIds) {
  const config = _load()
  const perms  = new Set()
  for (const roleId of roleIds) {
    const entry = config.roles[roleId]
    if (entry) entry.permissions.forEach(p => perms.add(p))
  }
  return [...perms]
}

/**
 * Returns true if the given permissions array grants the required permission.
 * 'admin.*' is a wildcard that grants every permission.
 * @param {string[]} permissions
 * @param {string} required
 * @returns {boolean}
 */
function hasPermission(permissions, required) {
  if (permissions.includes('admin.*')) return true
  return permissions.includes(required)
}

module.exports = { resolvePermissions, hasPermission }
