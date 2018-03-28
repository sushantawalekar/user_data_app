import app from './app'
import client from './lib/client'
import { storage, setting } from './lib/storage'

client.on('app.registered', function (context) {
  storage('installationId', context.metadata.installationId)

  Object.keys(context.metadata.settings).forEach((key) => {
    setting(key, context.metadata.settings[key])
  })

  app.init()
})

client.on('ticket.requester.email.changed', app.onRequesterEmailChanged)
