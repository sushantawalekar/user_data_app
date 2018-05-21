import I18n from './i18n'

const orgClient = window.ZAFClient.init()
function Client () {}
Client.prototype = orgClient
const client = new Client()

function handleClientError (error) {
  let errorMessage = I18n.t('client.get.error', { error: error.message })
  console.error(errorMessage)
  client.invoke('notify', errorMessage, 'error')
}

client.get = function (stringOrArray) {
  if (typeof stringOrArray !== 'string' && !Array.isArray(stringOrArray)) { throw new Error('type for get not supported.') }

  return orgClient.get(stringOrArray).then((data) => {
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

export default client
