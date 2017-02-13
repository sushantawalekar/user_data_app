module.exports = {
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

  getOrganizationTickets: function(orgId) {
    return {
      url: helpers.fmt('/api/v2/organizations/%@/tickets.json', orgId)
    };
  },

  getTicketAudits: function(id){
    return {
      url: helpers.fmt('/api/v2/tickets/%@/audits.json', id)
    };
  },

  getTickets: function(userId, page) {
    page = page || 1;
    return {
      url: helpers.fmt('/api/v2/users/%@/tickets/requested.json?page=%@', userId, page)
    };
  },

  searchTickets: function(userId, status) {
    return {
      url: helpers.fmt('/api/v2/search.json?query=type:ticket requester:%@ status:%@', userId, status)
    };
  },

  getUser: function(userId) {
    return {
      url: helpers.fmt('/api/v2/users/%@.json?include=identities,organizations', userId)
    };
  },

  saveSelectedFields: function(keys, orgKeys) {
    var appId = this.installationId();
    var settings = {
      selectedFields: JSON.stringify(_.toArray(keys)),
      orgFieldsActivated: this.storage.orgFieldsActivated.toString(),
      orgFields: JSON.stringify(_.toArray(orgKeys))
    };

    this.settings = _.extend(this.settings, settings);

    return {
      url: helpers.fmt('/api/v2/apps/installations/%@.json', appId),
      data: {
        'settings': settings,
        'enabled': true
      }
    };
  },

  updateNotesOrDetails: function(type, id, data) {
    return {
      url: helpers.fmt('/api/v2/%@/%@.json', type, id),
      data: data
    };
  }
};
