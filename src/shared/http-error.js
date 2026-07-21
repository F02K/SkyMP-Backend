'use strict'

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
    this.expose = status < 500
  }
}

function errorBody(error) {
  const body = {
    error: {
      code: error.code || 'internalError',
      message: error.expose ? error.message : 'Internal server error.',
    },
  }
  if (error.expose && error.details !== undefined) body.error.details = error.details
  return body
}

module.exports = { HttpError, errorBody }
