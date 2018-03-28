import { setting, storage } from './storage'
import toArray from 'lodash/toArray'

export default {
  getLocales: {
    url: '/api/v2/locales.json'
  },

  getOrganizationFields: {
    url: '/api/v2/organization_fields.json'
  },

  getCustomRoles: {
    url: '/api/v2/custom_roles.json'
  },

  getUserFields: {
    url: '/api/v2/user_fields.json'
  },

  getOrganizationTickets: function (orgId) {
    return {
      url: `/api/v2/organizations/${orgId}/tickets.json`
    }
  },

  getTicketAudits: function (id) {
    return {
      url: `/api/v2/tickets/${id}/audits.json`
    }
  },

  getTickets: function (userId) {
    return {
      url: `/api/v2/users/${userId}/tickets/requested.json`
    }
  },

  searchTickets: function (userId, status) {
    return {
      url: `/api/v2/search.json?query=type:ticket requester:${userId} status:${status}`
    }
  },

  getUser: function (userId) {
    return {
      url: `/api/v2/users/${userId}.json?include=identities,organizations`
    }
  },

  saveSelectedFields: function (keys, orgKeys) {
    const installationId = storage('installationId')

    setting('selectedFields', JSON.stringify(toArray(keys)))
    setting('orgFields', JSON.stringify(toArray(orgKeys)))

    // For dev
    if (installationId < 1) return {}

    return {
      url: `/api/v2/apps/installations/${installationId}.json`,
      type: 'PUT',
      data: {
        'settings': setting(),
        'enabled': true
      }
    }
  },

  updateNotesOrDetails: function (type, id, data) {
    return {
      url: `/api/v2/${type}/${id}.json`,
      type: 'PUT',
      data: data
    }
  }
}
