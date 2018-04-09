import { ajax, ajaxPaging, urlify } from './lib/helpers'
import { localStorage, storage, setting } from './lib/storage'
import I18n from './lib/i18n'
import client from './lib/client'

import admin from '../templates/admin.hdbs'
import display from '../templates/display.hdbs'
import spoke from '../templates/spoke.hdbs'
import tags from '../templates/tags.hdbs'

import $ from 'jquery/src/core'
import 'jquery/src/core/parseHTML'
import 'jquery/src/manipulation'
import 'jquery/src/attributes'
import 'jquery/src/css/hiddenVisibleSelectors'
import 'jquery/src/effects'
import 'jquery/src/dimensions'
import 'jquery/src/css'
import 'jquery/src/data'

import debounce from 'lodash/debounce'
import filter from 'lodash/filter'
import map from 'lodash/map'
import find from 'lodash/find'
import reduce from 'lodash/reduce'
import includes from 'lodash/includes'
import sortBy from 'lodash/sortBy'
import each from 'lodash/each'
import compact from 'lodash/compact'
import groupBy from 'lodash/groupBy'
import fromPairs from 'lodash/fromPairs'
import isEmpty from 'lodash/isEmpty'

const TICKET_STATUSES = ['new', 'open', 'solved', 'pending', 'hold', 'closed']

const app = {
  init: function () {
    storage('ticketsCounters', {})
    storage('orgTicketsCounters', {})
    storage('user', null)
    storage('tickets', [])
    storage('promise', null)
    storage('locales', null)
    storage('organizationFields', null)
    storage('userFields', null)
    storage('userEditable', true)
    storage('selectedKeys', null)
    storage('selectedOrgKeys', null)
    storage('orgFieldsActivated', false)

    client.get(['ticket.requester', 'ticket.id', 'ticket.organization', 'currentUser']).then((data) => {
      const [ requester, ticketId, ticketOrg, currentUser ] = data
      const promises = []
      let promise

      storage('currentUser', currentUser)
      storage('requester', requester)
      storage('ticketId', ticketId)
      storage('orgEditable.general', currentUser.role === 'admin')
      storage('orgEditable.notes', true)

      I18n.loadTranslations(currentUser.locale)

      promise = ajax('getUser', requester.id).then((data) => {
        const promises = []
        const user = data.user
        let promise

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
        if (ticketOrg) {
          user.organization = data.organizations.find(function (org) {
            return org.id === ticketOrg.id
          })
        }
        promises.push(user)
        storage('user', user)

        if (data.user.organization_id) {
          promise = ajax('getOrganizationTickets', data.user.organization_id).then((data) => {
            const grouped = groupBy(data.tickets, 'status')
            const res = fromPairs(map(grouped, (value, key) => {
              return [key, value.length]
            }))
            storage('orgTicketsCounters', res)
            return res
          })
          promises.push(promise)
        }

        if (ticketId) {
          promise = ajax('getTicketAudits', ticketId).then((data) => {
            each(data.audits, (audit) => {
              each(audit.events, (e) => {
                if (app.auditEventIsSpoke(e)) {
                  const spokeData = app.spokeData(e)

                  if (spokeData) {
                    storage('spokeData', spokeData)
                    const user = storage('user')
                    user.email = spokeData.email
                    storage('user', user)
                    app.displaySpoke()
                  }
                }
              })
            })
            return data.audits
          })
          promises.push(promise)
        }

        promise = ajaxPaging('getTickets', user.id).then((data) => {
          const grouped = groupBy(data.tickets, 'status')
          const res = fromPairs(map(grouped, (value, key) => {
            return [key, value.length]
          }))
          storage('ticketsCounters', res)
          return res
        })
        promises.push(promise)

        return Promise.all(promises)
      })

      promises.push(promise)

      // If not admin or agent
      if (['admin', 'agent'].indexOf(currentUser.role) === -1) {
        promise = ajax('getCustomRoles').then((data) => {
          const currentUser = storage('currentUser')
          const roles = data.custom_roles

          const role = find(roles, (role) => {
            return role.id === currentUser.role
          })

          storage('orgEditable.general', role.configuration.organization_editing)
          storage('orgEditable.notes', role.configuration.organization_notes_editing)
          storage('userEditable', role.configuration.end_user_profile_access === 'full')

          each(storage('organizationFields'), (field) => {
            if (field.key === '##builtin_tags') {
              return
            } else if (field.key === '##builtin_notes') {
              field.editable = storage('orgEditable.notes')
            } else {
              field.editable = storage('orgEditable.general')
            }
          })
          return data
        })
        promises.push(promise)
      }

      promise = ajax('getLocales').then((data) => {
        const locales = fromPairs(map(data.locales, function (locale) {
          return [locale.locale, locale.name]
        }))

        storage('locales', locales)
        return locales
      })
      promises.push(promise)

      promise = ajax('getOrganizationFields').then(app.onGetOrganizationFieldsDone)
      promises.push(promise)

      promise = ajax('getUserFields').then(app.onGetUserFieldsDone)
      promises.push(promise)

      return Promise.all(promises)
    }).then((data) => {
      const [[user, organizationTicketCounters, audits, ticketCounters], locales, organizationFields, userFields] = data

      app.fillEmptyStatuses(ticketCounters)
      app.fillEmptyStatuses(organizationTicketCounters)

      app.showDisplay()
    })
  },

  fieldsForCurrent: function (target, fields, selected, values, locales) {
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

        if (subkey === 'tags') {
          result.value = tags({tags: result.value})
          result.html = true
        } else if (subkey === 'locale') {
          result.value = locales[result.value]
        } else if (!result.editable) {
          result.value = result.value.replace(/\n/g, '<br>')
          result.html = true
        }
      } else {
        result.simpleKey = ['custom', key].join(' ')
        result.value = values[key]

        if (typeof result.value === 'string' && result.value.indexOf('http') > -1) {
          result.html = true
          result.value = urlify(result.value)
        }

        if (field.type === 'date') {
          result.value = (result.value ? app.toLocaleDate(result.value) : '')
        } else if (field.type === 'dropdown' && field.custom_field_options) {
          result.value = find(field.custom_field_options, function (option) {
            return option.value === result.value
          }).name
        } else if (!result.editable && result.value) {
          if (typeof result.value === 'string') {
            result.value = result.value.replace(/\n/g, '<br>')
          }
          result.html = true
        }
      }
      return result
    }))
  },

  fieldsForCurrentUser: function () {
    if (!storage('user')) { return {} }
    return app.fieldsForCurrent(storage('user'),
                                storage('userFields'),
                                setting('selectedFields') ? JSON.parse(setting('selectedFields')) : ['##builtin_tags', '##builtin_details', '##builtin_notes'],
                                storage('user').user_fields,
                                storage('locales'))
  },

  fieldsForCurrentOrg: function () {
    if (!storage('user') || !storage('user').organization) { return {} }
    return app.fieldsForCurrent(storage('user').organization,
                                storage('organizationFields'),
                                setting('orgFields') ? JSON.parse(setting('orgFields')) : [],
                                storage('user').organization.organization_fields,
                                storage('locales'))
  },

  fillEmptyStatuses: function (list) {
    return reduce(TICKET_STATUSES, function (list, key) {
      if (!list[key]) {
        list[key] = '-'
      }
      return list
    }, list)
  },

  toLocaleDate: function (date) {
    const localDate = new Date(date)
    return `${localDate.getDate()}/${localDate.getMonth() + 1}/${localDate.getFullYear()}`
  },

  showDisplay: function () {
    const currentUser = storage('currentUser')
    const view = display({
      ticketId: storage('ticketId'),
      isAdmin: currentUser.role === 'admin',
      user: storage('user'),
      tickets: app.makeTicketsLinks(storage('ticketsCounters')),
      fields: app.fieldsForCurrentUser(),
      orgFields: app.fieldsForCurrentOrg(),
      orgFieldsActivated: storage('user') && setting('orgFieldsActivated') && storage('user').organization,
      org: storage('user') && storage('user').organization,
      orgTickets: app.makeTicketsLinks(storage('orgTicketsCounters'))
    })

    $('[data-main]').html(view)
    app.resize()

    if (storage('spokeData')) {
      app.displaySpoke()
    }
    if (localStorage('expanded')) {
      app.onClickExpandBar({}, true)
    }
  },

  makeTicketsLinks: function (counters) {
    const links = {}
    const link = `#/tickets/${storage('ticketId')}/requester/requested_tickets`
    const tag = $('<div>').append($('<a>').attr('href', link))
    each(counters, function (value, key) {
      if (value && value !== '-') {
        tag.find('a').html(value)
        links[key] = tag.html()
      } else {
        links[key] = value
      }
    })
    app.resize()
    return links
  },

  onRequesterEmailChanged: function (event, email) {
    const requester = storage('requester')
    if (email && requester.email !== email) {
      app.init()
    }
  },

  onClickExpandBar: function (event, immediate) {
    const additional = $('.more-info')
    const expandBar = $('.expand-bar i')
    expandBar.attr('class', 'arrow')
    const visible = additional.is(':visible')
    additional.toggle(!visible, app.resize)
    localStorage('expanded', !visible)
    expandBar.addClass(visible ? 'arrow-down' : 'arrow-up')
    app.resize()
  },

  resize: function () {
    setTimeout(function () {
      const body = document.querySelector('body')
      client.invoke('resize', { width: '100%', height: body.scrollHeight })
    }, 5)
  },

  onCogClick: function () {
    const html = admin({
      fields: storage('userFields'),
      orgFields: storage('organizationFields'),
      orgFieldsActivated: setting('orgFieldsActivated')
    })
    $('.admin').html(html).show()
    $('.whole').hide()
    app.resize()
  },

  onBackClick: function () {
    $('.admin').hide()
    $('.whole').show()
    app.resize()
  },

  onSaveClick: function () {
    const keys = $('.fields-list input:checked').map(function () { return $(this).val() })
    const orgKeys = $('.org-fields-list input:checked').map(function () { return $(this).val() })
    $('input, button').prop('disabled', true)
    $('.save').hide()
    $('.wait-spin').show()

    storage('promise', null) // we need to reset the promise object to have getUserFields run again

    ajax('saveSelectedFields', keys, orgKeys).then(app.init)
  },

  onNotesOrDetailsChanged: debounce(function (e) {
    const $textarea = $(e.currentTarget)
    const $textareas = $textarea.parent().parent().find('[data-editable =true] textarea')
    const type = $textarea.data('fieldType')
    const typeSingular = type.slice(0, -1)
    const data = {}
    const requester = storage('requester')
    const id = type === 'organizations' ? storage('user').organization.id : requester.id

    // Build the data object, with the valid resource name and data
    data[typeSingular] = {}
    $textareas.each(function (index, element) {
      const $element = $(element)
      const fieldName = $element.data('fieldName')

      data[typeSingular][fieldName] = $element.val()
    })

    // Execute request
    ajax('updateNotesOrDetails', type, id, data).then(function () {
      client.invoke('notify', (I18n.t('update_' + typeSingular + '_done')))
    })
  }, 1500),

  onActivateOrgFieldsChange: function (event) {
    const activate = $(event.target).is(':checked')
    setting('orgFieldsActivated', activate)
    $('.org-fields-list').toggle(activate)
    app.resize()
  },

  displaySpoke: function () {
    const html = spoke(storage('spokeData'))
    $('.spoke').html(html)
    app.resize()
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

  onGetOrganizationFieldsDone: function (data) {
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
        editable: storage('orgEditable.general')
      },
      {
        key: '##builtin_notes',
        title: I18n.t('notes'),
        description: '',
        position: Number.MAX_SAFE_INTEGER,
        active: true,
        editable: storage('orgEditable.notes')
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

    storage('organizationFields', sortBy(restrictedFields, 'position'))
    return restrictedFields
  },

  onGetUserFieldsDone: function (data) {
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
        editable: storage('userEditable')
      },
      {
        key: '##builtin_notes',
        title: I18n.t('notes'),
        description: '',
        position: Number.MAX_SAFE_INTEGER,
        active: true,
        editable: storage('userEditable')
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
        type: field.type
      }
    })

    storage('userFields', sortBy(restrictedFields, 'position'))
    return restrictedFields
  }
}

$(document).on('click', 'a.expand-bar', app.onClickExpandBar)
$(document).on('click', '.cog', app.onCogClick)
$(document).on('change keyup input paste', '.notes-or-details', app.onNotesOrDetailsChanged)
$(document).on('change', '.org-fields-activate', app.onActivateOrgFieldsChange)
$(document).on('click', '.back', app.onBackClick)
$(document).on('click', '.save', app.onSaveClick)
$(document).on('mouseup', 'textarea', debounce(app.resize, 300))

export default app
