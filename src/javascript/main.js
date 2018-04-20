import app from './app'
import I18n from './lib/i18n'
import client from './lib/client'
import { storage, setting } from './lib/storage'

client.on('app.registered', function (context) {
  storage('installationId', context.metadata.installationId)

  Object.keys(context.metadata.settings).forEach((key) => {
    setting(key, context.metadata.settings[key])
  })

  // we start off with en, and once we have the user.locale we switch it.
  I18n.loadTranslations('en')

  app.init()
})

client.on('ticket.requester.email.changed', app.onRequesterEmailChanged)
