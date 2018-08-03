import app from './app'
import client from './lib/client'
import { storage, setting } from './lib/helpers'

client.on('app.registered', function (context) {
  const installationId = context.metadata.installationId
  storage('installationId', installationId)

  client.get('currentUser').then((currentUser) => {
    return currentUser.role === 'admin'
  }).then((isAdmin) => {
    return (isAdmin) ? client.request(`/api/v2/apps/installations/${installationId}.json`) : Promise.reject(new Error('not an agent'))
  }).then((data) => {
    return data.settings
  }).catch(() => {
    return context.metadata.settings
  }).then((settings) => {
    Object.keys(settings).forEach((key) => {
      let value = settings[key]

      // convert true/false string into bool
      if (value === 'true') value = true
      else if (value === 'false') value = false

      setting(key, value)
    })
    app.init()
  })
})

client.on('ticket.requester.email.changed', app.onRequesterEmailChanged)
