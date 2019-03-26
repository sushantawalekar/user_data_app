import { ajax, urlify, appResize, localStorage, storage, setting, parseNum, parseQueryString } from './lib/helpers'
import I18n from './lib/i18n'
import eClient from './lib/extended_client'

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

import { debounce, filter, map, find, reduce, includes, sortBy, each, compact, groupBy, fromPairs, isEmpty } from 'lodash'

const TICKET_STATUSES = ['new', 'open', 'solved', 'pending', 'hold', 'closed']
const MINUTES_TO_MILLISECONDS = 60000

const app = {
  init: function () {
    app.getInformation().then(() => {
      app.showDisplay()
    }).catch((err) => {
      console.error(err)
      const view = (err.message === 'no requester') ? renderNoRequester() : errorMessage({ msg: err.message })
      $('[data-main]').html(view)
      appResize()
    })
  },

  getInformation: function () {
    return eClient.get(['ticket.requester', 'ticket.id', 'currentUser', 'currentUser.organizations']).then((data) => {
      const [ requester, ticketId, currentUser, currentUserOrganizations ] = data
      currentUser.organizations = currentUserOrganizations
      const promises = []

      I18n.loadTranslations(currentUser.locale)

      if (!requester) return Promise.reject(new Error('no requester'))

      promises.push(app.getUserInformation())

      // If not admin or agent
      let getCustomRolesPromise
      if (['admin', 'agent'].indexOf(currentUser.role) === -1) {
        getCustomRolesPromise = app.getCustomRoles()
        promises.push(getCustomRolesPromise)
      }

      return Promise.all(promises)
    })
  },

  getUserInformation: function () {
    return eClient.get(['ticket.requester', 'ticket.id', 'ticket.organization']).then(([requester, ticketId, ticketOrganization]) => {
      return ajax('getUser', requester.id).then((userData) => {
        return [requester, ticketId, ticketOrganization, userData]
      })
    }).then(([requester, ticketId, ticketOrganization, data]) => {
      const promises = []
      const user = data.user

      promises.push(user)

      return Promise.all(promises)
    })
  },

  getUser: function () {
    const user = storage('user')
    if (user !== undefined) return Promise.resolve(user)

    return eClient.get(['ticket.requester', 'ticket.organization']).then(([requester, ticketOrganization]) => {
      return ajax('getUser', requester.id).then((data) => {
        return [requester, ticketOrganization, data]
      })
    }).then(([requester, ticketOrganization, data]) => {
      const user = data.user

      user.identities = data.identities.filter(function (ident) {
        return includes(['twitter', 'facebook'], ident.type)
      }).map(function (ident) {
        if (ident.type === 'twitter') {
          ident.value = `https://twitter.com/${ident.value}`
        } else if (ident.type === 'facebook') {
          ident.value = `https://facebook.com/${ident.value}`
        }
        return ident
      })

      user.organization = data.organizations[0]
      if (ticketOrganization) {
        user.organization = find(data.organizations, function (org) {
          return org.id === ticketOrganization.id
        })
      }

      storage('user', user)
      return user
    })
  },

  getCustomRoles: function () {
    return Promise.all([
      ajax('getCustomRoles'),
      eClient.get('currentUser'),
      app.getOrganizationFields()
    ]).then(([data, currentUser, organizationFields]) => {
      const roles = data.custom_roles

      const role = find(roles, (role) => {
        return role.id === currentUser.role
      })

      each(organizationFields, (field) => {
        if (field.key === '##builtin_tags') {
        } else if (field.key === '##builtin_notes') {
          field.editable = role.configuration.organization_notes_editing
        } else {
          field.editable = role.configuration.organization_editing
        }
      })

      return data
    })
  },

  isUserEditable: function (user) {
    return user.abilities && user.abilities.can_edit
  },

  isOrganizationEditable: function () {
    return eClient.get('currentUser.role').then((currentUserRole) => {
      if (currentUserRole === 'admin') return true

      if (['admin', 'agent'].indexOf(currentUserRole) === -1) {
        return app.getCustomRoles().then(({roles}) => {
          const role = find(roles, (role) => {
            return role.id === currentUserRole
          })

          return role && role.configuration.organization_editing
        })
      }

      return false
    })
  },

  isOrganizationNotesEditable: function () {
    return eClient.get('currentUser.role').then((currentUserRole) => {
      if (['admin', 'agent'].indexOf(currentUserRole) === -1) {
        return app.getCustomRoles().then(({roles}) => {
          const role = find(roles, (role) => {
            return role.id === currentUserRole
          })

          return role && role.configuration.organization_notes_editing
        })
      }

      return true
    })
  },

  getLocales: function () {
    return ajax('getLocales').then((data) => {
      const locales = fromPairs(map(data.locales, function (locale) {
        return [locale.locale, locale.name]
      }))

      return locales
    })
  },

  getTicketAudits: function () {
    return eClient.get('ticket.id').then((ticketId) => {
      return ajax('getTicketAudits', ticketId)
    }).then((data) => {
      let spokeData

      each(data.audits.audits, (audit) => {
        each(audit.events, (e) => {
          if (app.auditEventIsSpoke(e)) {
            spokeData = app.spokeData(e)
          }
        })
      })

      return {
        audits: data.audits,
        spokeData
      }
    })
  },

  getTicketsCounters: function (type, id) {
    const TYPES = {
      requester: { ajax: 'getTickets', storage: 'ticketsCounters' },
      organization: { ajax: 'getOrganizationTickets', storage: 'orgTicketsCounters' }
    }

    if (!TYPES[type]) Promise.reject(new Error('No such type defined'))

    const cache = storage(TYPES[type].storage)
    if (cache !== undefined) return Promise.resolve(cache)

    // First use search to decide what to do
    return ajax('searchTickets', `${type}:${id}`).then((data) => {
      if (data.count === 1) {
        // If only 1 result, we already have that result, and trick processTicketData
        // into thinking we got the data from tickets response
        data.tickets = data.results
        return data
      } else if (data.count <= 100) {
        // If we only needed 1 requests
        return ajax(TYPES[type].ajax, id)
      } else {
        // If we need more requests
        return app.getTicketsThroughSearch(`${type}:${id}`)
      }
    }).then((data) => {
      const res = app.fillEmptyStatuses( app.processTicketData(data) )
      storage(TYPES[type].storage, res)
      return res
    })
  },

  getTicketsThroughSearch: function (searchTerm) {
    const promises = TICKET_STATUSES.map((status) => {
      return ajax('searchTickets', `${searchTerm} status:${status}`)
    })
    return Promise.all(promises)
  },

  processTicketData: function (data) {
    let res

    // If data.tickets it means it's a tickets repsonse
    if (data.tickets) {
      const grouped = groupBy(data.tickets, 'status')
      res = fromPairs(map(grouped, (value, key) => {
        return [key, parseNum(value.length)]
      }))

    // Else it's a search response
    } else {
      res = TICKET_STATUSES.reduce((memo, status, i) => {
        memo[status] = parseNum(data[i].count)
        return memo
      }, {})
    }

    return res
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

  fieldsForCurrentOrg: function (currentUser, locales, user, organizationFields) {
    if (!user || !user.organization) { return {} }
    return app.formatFields(
      user.organization,
      organizationFields,
      setting('orgFields') ? JSON.parse(setting('orgFields')) : [],
      user.organization.organization_fields,
      currentUser,
      locales
    )
  },

  fillEmptyStatuses: function (list) {
    return reduce(TICKET_STATUSES, function (memo, status) {
      memo[status] = list[status] ? list[status] : '-'
      return memo
    }, {})
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
    return Promise.all([
      eClient.get(['currentUser', 'ticket.requester', 'ticket.id', 'ticket.organization.id']),
      app.getLocales(),
      app.getUserFields(),
      app.getOrganizationFields()
    ]).then(([[currentUser, requester, ticketId, ticketOrganizationId], locales, userFields, organizationFields]) => {
      return Promise.all([
        app.getTicketsCounters('requester', requester.id),
        app.getTicketsCounters('organization', ticketOrganizationId)
      ]).then(([requesterCounters, organizationCounters]) => {
        return [currentUser, requester, ticketId, locales, userFields, organizationFields, requesterCounters, organizationCounters]
      })

    }).then(([currentUser, requester, ticketId, locales, userFields, organizationFields, requesterCounters, organizationCounters]) => {
      return Promise.all([
        app.getUser(),
        app.makeTicketsLinks('requester', requesterCounters),
        app.makeTicketsLinks('requester', organizationCounters)
      ]).then(([user, requesterCounterLinks, organizationCounterLinks]) => {
        return [currentUser, requester, ticketId, locales, user, userFields, organizationFields, requesterCounterLinks, organizationCounterLinks]
      })

    }).then(([currentUser, requester, ticketId, locales, user, userFields, organizationFields, requesterCounterLinks, organizationCounterLinks]) => {
      const view = renderDisplay({
        ticketId: ticketId,
        isAdmin: currentUser.role === 'admin',
        user: user,
        tickets: requesterCounterLinks,
        fields: app.fieldsForCurrentUser(currentUser, locales, user, userFields),
        orgFields: app.fieldsForCurrentOrg(currentUser, locales, user, organizationFields),
        orgFieldsActivated: user && setting('orgFieldsActivated') && user.organization,
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
      eClient.get(['ticket.requester', 'ticket.id', 'ticket.organization.id'])
    ]).then(([[requester, ticketId, ticketOrganizationId]]) => {
      const requesterId = requester.id

      const origin = parseQueryString().origin
      const base = `${origin}/agent`

      const user = (ticketId) ? `tickets/${ticketId}/requester/requested_tickets` : `users/${requesterId}/requested_tickets`
      const org = (ticketId) ? `tickets/${ticketId}/organization/tickets` : `organizations/${ticketOrganizationId}/tickets`

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

  onRequesterEmailChanged: function (email) {
    return eClient.get('ticket.requester').then((requester) => {
      if (email && requester.email !== email) {
        app.init()
      }
    })
  },

  onClickExpandBar: function (event, immediate) {
    const additional = $('.more-info')
    const expandBar = $('.expand_bar i')
    expandBar.attr('class', 'arrow')
    const visible = additional.is(':visible')
    additional.toggle(!visible, appResize)
    localStorage('expanded', !visible)
    expandBar.addClass(visible ? 'arrow_down' : 'arrow_up')
    appResize()
  },

  onCogClick: function () {
    return Promise.all([
      app.getOrganizationFields(),
      app.getUserFields()
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
      app.getUser()
    ]).then(([requester, user]) => {
      const $textarea = $(e.currentTarget)
      const $textareas = $textarea.parent().parent().find('[data-editable =true] textarea')
      const type = $textarea.data('fieldType')
      const typeSingular = type.slice(0, -1)
      const data = {}
      const id = type === 'organizations' ? user.organization.id : requester.id

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
    app.getTicketAudits().then(({spokeData}) => {
      if (!spokeData) return

      const html = renderSpoke(spokeData)
      $('.spoke').html(html)
      appResize()
    })
  },

  auditEventIsSpoke: function (event) {
    return event.type === 'Comment' && /spoke_id_/.test(event.body)
  },

  spokeData: function (event) {
    const data = /spoke_id_(.*) *\n *spoke_account_(.*) *\n *requester_email_(.*) *\n *requester_phone_(.*)/.exec(event.body)

    if (isEmpty(data)) {
      return false
    }

    return {
      id: data[1].trim(),
      account: data[2].trim(),
      email: data[3].trim(),
      phone: data[4].trim()
    }
  },

  getOrganizationFields: function () {
    const organizationFields = storage('organizationFields')
    if (organizationFields !== undefined) return Promise.resolve(organizationFields)

    return Promise.all([
      ajax('getOrganizationFields'),
      app.isOrganizationEditable(),
      app.isOrganizationNotesEditable()
    ]).then(([data, isOrganizationEditable, isOrganizationNotesEditable]) => {
      const fields = [
        {
          key: '##builtin_tags',
          title: I18n.t('tags'),
          description: '',
          position: 0,
          active: true
        },
        {
          key: '##builtin_details',
          title: I18n.t('details'),
          description: '',
          position: Number.MAX_SAFE_INTEGER - 1,
          active: true,
          editable: isOrganizationEditable
        },
        {
          key: '##builtin_notes',
          title: I18n.t('notes'),
          description: '',
          position: Number.MAX_SAFE_INTEGER,
          active: true,
          editable: isOrganizationNotesEditable
        }
      ].concat(data.organization_fields)

      const activeFields = filter(fields, function (field) {
        return field.active
      })

      const restrictedFields = map(activeFields, (field) => {
        return {
          key: field.key,
          title: field.title,
          description: field.description,
          custom_field_options: field.custom_field_options,
          position: field.position,
          selected: includes(setting('orgFields') ? JSON.parse(setting('orgFields')) : [], field.key),
          editable: field.editable,
          type: field.type
        }
      })

      const organizationFields = sortBy(restrictedFields, 'position')
      storage('organizationFields', organizationFields)
      return organizationFields
    })
  },

  getUserFields: function () {
    const userFields = storage('userFields')
    if (userFields !== undefined) return Promise.resolve(userFields)

    return Promise.all([
      ajax('getUserFields'),
      app.getUser()
    ]).then(([data, user]) => {
      const fields = [
        {
          key: '##builtin_tags',
          title: I18n.t('tags'),
          description: '',
          position: 0,
          active: true
        },
        {
          key: '##builtin_locale',
          title: I18n.t('locale'),
          description: '',
          position: 1,
          active: true
        },
        {
          key: '##builtin_details',
          title: I18n.t('details'),
          description: '',
          position: Number.MAX_SAFE_INTEGER - 1,
          active: true,
          editable: app.isUserEditable(user)
        },
        {
          key: '##builtin_notes',
          title: I18n.t('notes'),
          description: '',
          position: Number.MAX_SAFE_INTEGER,
          active: true,
          editable: app.isUserEditable(user)
        }
      ].concat(data.user_fields)

      const activeFields = filter(fields, function (field) {
        return field.active
      })

      const restrictedFields = map(activeFields, (field) => {
        return {
          key: field.key,
          title: field.title,
          description: field.description,
          position: field.position,
          selected: includes(setting('selectedFields')
            ? JSON.parse(setting('selectedFields'))
            : ['##builtin_tags', '##builtin_details', '##builtin_notes'], field.key),
          editable: field.editable,
          type: field.type,
          custom_field_options: field.custom_field_options
        }
      })

      const userFields = sortBy(restrictedFields, 'position')
      storage('userFields', userFields)
      return userFields
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
  }
}

$(document).on('click', 'a.expand_bar', app.onClickExpandBar)
$(document).on('click', '.cog', app.onCogClick)
$(document).on('change keyup input paste', '.notes-or-details', app.onNotesOrDetailsChanged)
$(document).on('change', '.org_fields_activate', app.onActivateOrgFieldsChange)
$(document).on('click', '.back', app.onBackClick)
$(document).on('click', '.save', app.onSaveClick)
$(document).on('mouseup', 'textarea', debounce(appResize, 300))
$(document).on('click', '.card.user .counts a, .card.user .contacts .name a', (event) => app.goToTab(event, 'requester'))
$(document).on('click', '.card.org .counts a, .card.user .contacts .organization a, .card.org .contacts .name a', (event) => app.goToTab(event, 'organization'))

export default app
