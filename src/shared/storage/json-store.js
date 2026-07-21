'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

class JsonStore {
  constructor({ filePath, defaultValue, validate = () => true }) {
    this.filePath = filePath
    this.defaultValue = defaultValue
    this.validate = validate
  }

  read() {
    if (!fs.existsSync(this.filePath)) return structuredClone(this.defaultValue)
    let value
    try {
      value = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
    } catch (error) {
      throw new Error(`Unable to read JSON data ${this.filePath}: ${error.message}`)
    }
    if (!this.validate(value)) throw new Error(`Invalid JSON data shape in ${this.filePath}`)
    return value
  }

  write(value) {
    if (!this.validate(value)) throw new Error(`Refusing to write invalid JSON data to ${this.filePath}`)
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
    try {
      fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
      fs.renameSync(temporary, this.filePath)
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }
    return value
  }

  update(mutator) {
    const current = this.read()
    const next = mutator(current) ?? current
    return this.write(next)
  }
}

module.exports = { JsonStore }
