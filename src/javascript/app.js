import I18n from './lib/i18n'
import eClient from './lib/extended_client'

import { ajax, urlify, delegateEvents, appResize, localStorage, render, setting, parseNum, parseQueryString, promiseChain } from './lib/helpers'
import copyToClipboard from 'copy-to-clipboard'
import apiHelpers from './lib/api_helpers'

import renderAdmin from '../templates/admin.hdbs'
import renderDisplay from '../templates/display.hdbs'
import renderNoRequester from '../templates/no_requester.hdbs'
import errorMessage from '../templates/error.hdbs'
import renderSpoke from '../templates/spoke.hdbs'
import renderTags from '../templates/tags.hdbs'

import $ from 'jquery/src/core'
import 'jquery/src/core/parseHTML'
import 'jquery/src/manipulation'
import 'jquery/src/attributes'
import 'jquery/src/css/hiddenVisibleSelectors'
import 'jquery/src/effects'
import 'jquery/src/dimensions'
import 'jquery/src/css'
import 'jquery/src/data'

import { debounce, map, find, reduce, compact } from 'lodash'

const MINUTES_TO_MILLISECONDS = 60000

const app = {
  init: function () {
    return eClient.get('ticket.requester').then((requester) => {
      if (!requester) {
        render(renderNoRequester)
        return appResize()
      }

      return app.showDisplay()
    }).catch((err) => {
      console.error(err)
      render(errorMessage, { msg: err.message })
      appResize()
    })
  },

  formatFields: function (target, fields, selected, values, currentUser, locales) {
    return compact(map(selected, function (key) {
      const field = find(fields, function (field) {
        return field.key === key
      })

      if (!field) { return null }

      const result = {
        key: key,
        description: field.description,
        title: field.title,
        editable: field.editable
      }

      if (key.indexOf('##builtin') === 0) {
        const subkey = key.split('_')[1]
        result.name = subkey
        result.value = target[subkey]
        result.simpleKey = ['builtin', subkey].join(' ')

        if (app.couldHideField(result)) { return null }

        if (subkey === 'tags') {
          result.value = renderTags({tags: result.value})
          result.html = true
        } else if (subkey === 'locale') {
          result.value = locales[result.value]
        } else if (!result.editable && typeof result.value === 'string') {
          result.value = result.value.replace(/\n/g, '<br>')
          result.html = true
        }
      } else {
        result.simpleKey = ['custom', key].join(' ')
        result.value = values[key]

        if (app.couldHideField(result)) { return null }

        if (typeof result.value === 'string' && result.value.indexOf('http') > -1) {
          result.html = true
          result.value = urlify(result.value)
        }

        if (field.type === 'date') {
          result.value = (result.value ? app.toLocaleDate(result.value, currentUser.timeZone.offset, currentUser.locale) : '')
        } else if (field.type === 'dropdown' && field.custom_field_options) {
          const option = find(field.custom_field_options, function (option) {
            return option.value === result.value
          })
          result.value = (option) ? option.name : ''
        } else if (!result.editable && typeof result.value === 'string') {
          result.value = result.value.replace(/\n/g, '<br>')
          result.html = true
        }
      }
      return result
    }))
  },

  fieldsForCurrentUser: function (currentUser, locales, user, userFields) {
    if (!user) { return {} }
    return app.formatFields(
      user,
      userFields,
      setting('selectedFields') ? JSON.parse(setting('selectedFields')) : ['##builtin_tags', '##builtin_details', '##builtin_notes'],
      user.user_fields,
      currentUser,
      locales
    )
  },

  fieldsForCurrentOrg: function (currentUser, locales, organization, organizationFields) {
    if (!organization) { return {} }
    return app.formatFields(
      organization,
      organizationFields,
      setting('orgFields') ? JSON.parse(setting('orgFields')) : [],
      organization.organizationFields,
      currentUser,
      locales
    )
  },

  // Converts numbers into strings for all counters. 1000 => 1k, 0 => '-', 122332 => 123k, etc
  parseNumbers: function (counters) {
    return reduce(counters, function (memo, status) {
      memo[status] = counters[status] ? parseNum(counters[status]) : '-'
      return memo
    }, counters)
  },

  couldHideField: function (field) {
    return setting('hideEmptyFields') && !field.value && !field.editable
  },

  toLocaleDate: function (date, timeZoneOffset, locale) {
    const userTimeZoneOffset = timeZoneOffset * MINUTES_TO_MILLISECONDS // offset in milliseconds
    const utcTimestamp = new Date(date).getTime()
    const localDate = new Date(utcTimestamp + userTimeZoneOffset)

    return localDate.toLocaleDateString(locale)
  },

  showDisplay: function () {
    return promiseChain([
      eClient.get(['ticket.requester', 'ticket.organization', 'currentUser', 'ticket.id'])
    ]).then(([chain, [requester, ticketOrganization]]) => {
      return chain([
        requester && apiHelpers.getTicketCounters('requester', requester.id),
        ticketOrganization && apiHelpers.getTicketCounters('organization', ticketOrganization.id)
      ])
    }).then(([chain, _, requesterCounters, organizationCounters]) => {
      return chain([
        apiHelpers.getUser(),
        apiHelpers.getLocales(),
        apiHelpers.getUserFields(),
        apiHelpers.getOrganizationFields(),
        app.makeTicketsLinks('requester', app.parseNumbers(requesterCounters)),
        app.makeTicketsLinks('organization', app.parseNumbers(organizationCounters))
      ])
    }).then(([chain, [requester, ticketOrganization, currentUser, ticketId], requesterCounters, organizationCounters, user, locales, userFields, organizationFields, requesterCounterLinks, organizationCounterLinks]) => {
      const view = renderDisplay({
        ticketId: ticketId,
        isAdmin: currentUser.role === 'admin',
        user: user,
        tickets: requesterCounterLinks,
        fields: app.fieldsForCurrentUser(currentUser, locales, user, userFields),
        orgFields: app.fieldsForCurrentOrg(currentUser, locales, ticketOrganization, organizationFields),
        orgFieldsActivated: ticketOrganization && setting('orgFieldsActivated'),
        org: user && user.organization,
        orgTickets: organizationCounterLinks
      })

      $('[data-main]').html(view)
      appResize()

      app.displaySpoke()

      if (localStorage('expanded')) {
        app.onClickExpandBar({}, true)
      }
    })
  },

  makeTicketsLinks: function (type, counters = {}) {
    return Promise.all([
      eClient.get(['ticket.requester', 'ticket.id', 'ticket.organization'])
    ]).then(([[requester, ticketId, ticketOrganization]]) => {
      const origin = parseQueryString().origin
      const base = `${origin}/agent`

      const user = (ticketId) ? `tickets/${ticketId}/requester/requested_tickets` : `users/${requester.id}/requested_tickets`
      const org = (ticketId) ? `tickets/${ticketId}/organization/tickets` : `organizations/${ticketOrganization.id}/tickets`

      const links = Object.keys(counters).reduce((memo, status) => {
        const value = counters[status]
        if (!value || value === '0' || value === '-') return memo

        const paths = {
          requester: `${base}/${user}`,
          organization: `${base}/${org}`
        }

        memo[status] = {
          href: paths[type],
          value
        }

        return memo
      }, {
        user: { href: `${base}/${user}` },
        org: { href: `${base}/${org}` }
      })

      return links
    })
  },

  onRequesterEmailChanged: function () {
    app.init()
  },

  onClickExpandBar: function (event, immediate) {
    const additional = $('.more-info')
    const expandBar = $('.expand_bar svg')
    const visible = additional.is(':visible')
    additional.toggle(!visible, appResize)
    localStorage('expanded', !visible)
    expandBar.toggleClass('expanded')
    appResize()
  },

  onCogClick: function () {
    return Promise.all([
      apiHelpers.getOrganizationFields(),
      apiHelpers.getUserFields()
    ]).then(([organizationFields, userFields]) => {
      const html = renderAdmin({
        fields: userFields,
        orgFields: organizationFields,
        orgFieldsActivated: setting('orgFieldsActivated'),
        hideEmptyFields: setting('hideEmptyFields')
      })
      $('.admin').html(html).show()
      $('.whole').hide()
      appResize()
    })
  },

  onBackClick: function () {
    $('.admin').hide()
    $('.whole').show()
    appResize()
  },

  onSaveClick: function () {
    const keys = $('.fields-list input:checked').map(function () { return $(this).val() })
    const orgKeys = $('.org_fields_list input:checked').map(function () { return $(this).val() })
    const hideEmptyFields = $('input.hide_empty_fields').is(':checked')
    setting('hideEmptyFields', hideEmptyFields)

    $('input, button').prop('disabled', true)
    $('.save .text').hide()
    $('.save .spinner').show()

    ajax('saveSelectedFields', keys, orgKeys).then(app.init)
  },

  onNotesOrDetailsChanged: debounce(function (e) {
    return Promise.all([
      eClient.get('ticket.requester'),
      apiHelpers.getUser()
    ]).then(([requester, user]) => {
      const $textarea = $(e.currentTarget)
      const $textareas = $textarea.parent().parent().find('[data-editable =true] textarea')
      const type = $textarea.data('fieldType')
      const typeSingular = type.slice(0, -1)
      const data = {}
      const id = (type === 'organizations') ? user.organization.id : requester.id

      // Build the data object, with the valid resource name and data
      data[typeSingular] = {}
      $textareas.each(function (index, element) {
        const $element = $(element)
        const fieldName = $element.data('fieldName')

        data[typeSingular][fieldName] = $element.val()
      })

      // Execute request
      return ajax('updateNotesOrDetails', type, id, data).then(function () {
        eClient.invoke('notify', (I18n.t('update_' + typeSingular + '_done')))
      })
    })
  }, 1500),

  onActivateOrgFieldsChange: function (event) {
    const activate = $(event.target).is(':checked')
    setting('orgFieldsActivated', activate)
    $('.org_fields_list').toggle(activate)
    appResize()
  },

  displaySpoke: function () {
    apiHelpers.getTicketAudits().then(({spokeData}) => {
      if (!spokeData) return

      const html = renderSpoke(spokeData)
      $('.spoke').html(html)
      appResize()
    })
  },

  // HACK for navigating to a url, since routeTo doesn't support this.
  // https://developer.zendesk.com/apps/docs/support-api/all_locations#routeto
  goToTab: function (event, tabType) {
    const isMeta = event.metaKey || event.ctrlKey
    if (isMeta) return

    event.preventDefault()

    return app.makeTicketsLinks(tabType).then((links) => {
      const href = (tabType === 'requester') ? links.user.href : links.org.href
      const url = href.replace(/.*\/agent\//, '../../')

      return eClient.invoke('routeTo', 'nav_bar', '', url)
    })
  },

  onEmailClick: function (event) {
    copyToClipboard(event.target.innerText)
    // TODO: change 'Copied' & 'Copy email' -> "I18n.t('email.copied')" & "I18n.t('email.click_to_copy')", respectively
    $('.email-tooltip').text('Copied')
    setTimeout(() => {
      $('.email-tooltip').text('Copy email')
    }, 500)
  }
}

delegateEvents({
  'ticket.requester.email.changed': 'onRequesterEmailChanged',
  'click .copy-email': 'onEmailClick',
  'click a.expand_bar': 'onClickExpandBar',
  'click .cog': 'onCogClick',
  'change keyup input paste .notes-or-details': 'onNotesOrDetailsChanged',
  'change .org_fields_activate': 'onActivateOrgFieldsChange',
  'click .icon_circle_arrow_left': 'onBackClick',
  'click .save': 'onSaveClick',
  'mouseup textarea': debounce(appResize, 300),
  'click .card.user .counts a, .card.user .contacts .name a': (event) => app.goToTab(event, 'requester'),
  'click .card.org .counts a, .card.user .contacts .organization a, .card.org .contacts .name a': (event) => app.goToTab(event, 'organization')
}, app)

export default app
