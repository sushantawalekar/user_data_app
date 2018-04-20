import I18n from './i18n'

const orgClient = window.ZAFClient.init()
function Client () {}
Client.prototype = orgClient
const client = new Client()

function handleClientError (error) {
  client.invoke('notify', I18n.t('client.get.error', error.message))
}

client.get = function (stringOrArray) {
  if (typeof stringOrArray !== 'string' && !Array.isArray(stringOrArray)) { throw new Error('type for get not supported.') }

  return orgClient.get(stringOrArray).then((data) => {
    let error

    if (typeof stringOrArray === 'string') {
      if (data[stringOrArray]) return data[stringOrArray]
      error = new Error(data.errors[stringOrArray])
      handleClientError(error)
      return error
    } else {
      return stringOrArray.reduce((returnValue, key) => {
        if (data[key]) {
          returnValue.push(data[key])
        } else {
          error = new Error(data.errors[key])
          handleClientError(error)
          returnValue.push(error)
        }
        return returnValue
      }, [])
    }
  })
}

export default client
