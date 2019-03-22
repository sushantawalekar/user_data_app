import app from './app'
import eClient from './lib/extended_client'
import { storage, setting } from './lib/helpers'

eClient.on('app.registered', function (context) {
  const installationId = context.metadata.installationId
  storage('installationId', installationId)

  eClient.get('currentUser').then((currentUser) => {
    return currentUser.role === 'admin'
  }).then((isAdmin) => {
    return (isAdmin) ? eClient.request(`/api/v2/apps/installations/${installationId}.json`) : Promise.reject(new Error('not an agent'))
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

eClient.on('ticket.requester.email.changed', app.onRequesterEmailChanged)
