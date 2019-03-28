import app from './app'
import eClient from './lib/extended_client'
import I18n from './lib/i18n'
import { storage, setting } from './lib/helpers'

eClient.on('app.registered', function (context) {
  const { appId, installationId } = context.metadata
  storage('appId', appId)
  storage('installationId', installationId)

  eClient.get('currentUser').then((currentUser) => {
    I18n.loadTranslations(currentUser.locale)
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
