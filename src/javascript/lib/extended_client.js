import client from './client'
import i18n from './i18n'

const eClient = Object.create(client)

function handleClientError (error) {
  const errorMessage = i18n.t('client.get.error', { error: error.message })
  console.error(errorMessage)
  eClient.invoke('notify', errorMessage, 'error')
}

const _cache = {}
const tools = {
  unqiue: function (obj) {
    if (typeof obj === 'string') return obj
    return Object.keys(obj).map((key) => {
      const value = obj[key]
      return (typeof value === 'object') ? tools.unqiue(value) : `${key}:${value}`
    }).join(' ')
  },

  cache: function (key, value) {
    if (value === undefined) {
      return _cache[key]
    } else {
      _cache[key] = value
      return value
    }
  }
}

eClient.get = function (stringOrArray) {
  if (typeof stringOrArray !== 'string' && !Array.isArray(stringOrArray)) { throw new Error('Type for get not supported, get expects String or Array of Strings') }

  return client.get(stringOrArray).then((data) => {
    let error, str, arr

    if (typeof stringOrArray === 'string') {
      str = stringOrArray
    } else {
      arr = stringOrArray
    }

    if (str) {
      if (data[str]) {
        return data[str]
      } else if (data.errors[str]) {
        error = new Error(data.errors[str].message)
        handleClientError(error)
        return error
      }
    } else {
      return arr.reduce((returnValue, key) => {
        if (data[key]) {
          returnValue.push(data[key])
        } else if (data.errors[key]) {
          error = new Error(data.errors[key].message)
          handleClientError(error)
          returnValue.push(error)
        } else {
          returnValue.push(undefined)
        }
        return returnValue
      }, [])
    }
  })
}

eClient.request = function (obj) {
  // duplicate the object, because we are deleting cachable
  obj = JSON.parse(JSON.stringify(obj))

  const cached = !!obj.cachable
  delete obj.cachable
  const cacheName = tools.unqiue(obj)

  let res
  if (cached) res = tools.cache(cacheName) || tools.cache(cacheName, client.request(obj))
  else res = client.request(obj)
  return res
}

export default eClient
