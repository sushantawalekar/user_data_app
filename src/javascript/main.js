import app from './app'
import I18n from './lib/i18n'
import client from './lib/client'
import { storage, setting } from './lib/storage'

// we start off with en, and once we have the user.locale we switch it.
I18n.loadTranslations('en')

client.on('app.registered', function (context) {
  const installationId = context.metadata.installationId
  storage('installationId', installationId)

  client.get('currentUser').then((currentUser) => {
    return currentUser.role === 'admin'
  }).then((isAdmin) => {
    return (isAdmin) ? client.request(`/api/v2/apps/installations/${installationId}.json`) : Promise.reject()
  }).then((data) => {
    return data.settings
  }).catch(() => {
    return context.metadata.settings
  }).then((settings) => {
    Object.keys(settings).forEach((key) => {
      const value = settings[key]
      setting(key, value)
    })
    app.init()
  })
})

client.on('ticket.requester.email.changed', app.onRequesterEmailChanged)
