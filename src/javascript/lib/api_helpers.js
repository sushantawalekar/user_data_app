import eClient from './extended_client'
import I18n from './i18n'
import { ajax, setting, promiseChain } from './helpers'
import TICKET_STATUSES from './ticket_statuses'

import { includes, find, filter, map, sortBy, fromPairs, each, isEmpty, groupBy, reduce } from 'lodash'

const apiHelpers = {
  getUser: function () {
    return promiseChain([
      eClient.get(['ticket.requester', 'ticket.organization'])

    ]).then(([chain, [requester]]) => {
      return chain([
        ajax('getUser', requester.id)
      ])
    }).then(([chain, [requester, ticketOrganization], data]) => {
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

      return user
    })
  },

  getCustomRoles: function () {
    return Promise.all([
      ajax('getCustomRoles'),
      eClient.get('currentUser'),
      apiHelpers.getOrganizationFields()
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

  getLocales: function () {
    return ajax('getLocales').then((data) => {
      const locales = fromPairs(map(data.locales, function (locale) {
        return [locale.locale, locale.name]
      }))

      return locales
    })
  },

  getTicketCounters: function (type, id) {
    const TYPES = {
      requester: 'getTickets',
      organization: 'getOrganizationTickets'
    }

    if (!TYPES[type]) Promise.reject(new Error('No such type defined'))

    // First use search to decide what to do
    return ajax('searchTickets', `${type}:${id}`).then((data) => {
      // A) If only 1 result, we already have that, so return it
      if (data.count === 1) {
        return data

      // B) If we only needed 1 requests
      } else if (data.count <= 100) {
        return ajax(TYPES[type], id)

      // C) If we need more requests
      } else {
        return apiHelpers.getTicketsThroughSearch(`${type}:${id}`)
      }
    }).then((data) => {
      let counters = {}

      // C) If data is an array, it's a `getTicketsThroughSearch` response
      if (Array.isArray(data)) {
        counters = TICKET_STATUSES.reduce((memo, status, i) => {
          memo[status] = data[i].count
          return memo
        }, {})

      // B) If data.tickets it means it's a api/v2/tickets response
      } else if (data.tickets) {
        const grouped = groupBy(data.tickets, 'status')
        counters = fromPairs(map(grouped, (value, key) => {
          return [key, value.length]
        }))

      // A) Else it was a single search response, with 1 ticket
      } else {
        const status = data.results[0].status
        counters = {}
        counters[status] = data.count // should always be 1
      }

      return reduce(TICKET_STATUSES, function (memo, status) {
        memo[status] = memo[status] || 0
        return memo
      }, counters)
    })
  },

  getTicketsThroughSearch: function (searchTerm) {
    const promises = TICKET_STATUSES.map((status) => {
      return ajax('searchTickets', `${searchTerm} status:${status}`)
    })
    return Promise.all(promises)
  },

  isOrganizationEditable: function () {
    return eClient.get('currentUser.role').then((currentUserRole) => {
      if (currentUserRole === 'admin') return true

      if (['admin', 'agent'].indexOf(currentUserRole) === -1) {
        return apiHelpers.getCustomRoles().then(({roles}) => {
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
        return apiHelpers.getCustomRoles().then(({roles}) => {
          const role = find(roles, (role) => {
            return role.id === currentUserRole
          })

          return role && role.configuration.organization_notes_editing
        })
      }

      return true
    })
  },

  getTicketAudits: function () {
    return eClient.get('ticket.id').then((ticketId) => {
      return ticketId ? ajax('getTicketAudits', ticketId) : { audits: { audits: [] } }
    }).then((data) => {
      let sd

      each(data.audits.audits, (audit) => {
        each(audit.events, (e) => {
          if (apiHelpers.auditEventIsSpoke(e)) {
            sd = apiHelpers.spokeData(e)
          }
        })
      })

      return {
        audits: data.audits,
        spokeData: sd
      }
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
    return Promise.all([
      ajax('getOrganizationFields'),
      apiHelpers.isOrganizationEditable(),
      apiHelpers.isOrganizationNotesEditable()
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

      const activeFields = filter(fields, (field) => {
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

      return sortBy(restrictedFields, 'position')
    })
  },

  getUserFields: function () {
    return Promise.all([
      ajax('getUserFields'),
      apiHelpers.getUser()
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
          editable: apiHelpers.isUserEditable(user)
        },
        {
          key: '##builtin_notes',
          title: I18n.t('notes'),
          description: '',
          position: Number.MAX_SAFE_INTEGER,
          active: true,
          editable: apiHelpers.isUserEditable(user)
        }
      ].concat(data.user_fields)

      const activeFields = filter(fields, (field) => {
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

      return sortBy(restrictedFields, 'position')
    })
  },

  isUserEditable: function (user) {
    return user.abilities && user.abilities.can_edit
  }
}

export default apiHelpers
