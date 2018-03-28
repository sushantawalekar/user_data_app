const orgClient = ZAFClient.init()
function Client () {}
Client.prototype = orgClient
const client = new Client()

client.get = function (stringOrArray) {
  if (typeof stringOrArray !== 'string' && !(stringOrArray instanceof Array)) { throw new Error('type for get not supported.') }

  return orgClient.get(stringOrArray).then((data) => {
    if (typeof stringOrArray === 'string') {
      return data[stringOrArray] || data.errors[stringOrArray]
    } else {
      return stringOrArray.reduce((returnValue, key) => {
        returnValue.push(data[key] || data.errors[key])
        return returnValue
      }, [])
    }
  })
}

export default client
