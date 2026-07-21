'use strict'

const { JsonStore } = require('../../shared/storage/json-store')
const { resolveDataFile } = require('../../shared/storage/paths')

const store = new JsonStore({
  filePath: resolveDataFile('balances'),
  defaultValue: {},
  validate: value => value && typeof value === 'object' && !Array.isArray(value),
})

function get(profileId) {
  const value = store.read()[profileId]
  return typeof value === 'number' ? value : 0
}

function set(profileId, balance) {
  store.update(values => {
    values[profileId] = balance
    return values
  })
  return balance
}

function purchase(profileId, amount) {
  if (typeof amount !== 'number' || amount < 0) {
    const error = new Error('balanceToSpend must be a non-negative number.')
    error.status = 400
    throw error
  }
  const current = get(profileId)
  if (current < amount) return { balanceSpent: 0, success: false }
  set(profileId, current - amount)
  return { balanceSpent: amount, success: true }
}

module.exports = { get, purchase, set }
