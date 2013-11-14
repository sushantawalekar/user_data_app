(function() {
  return {

    storage: {
      user: null,
      ticketsCounters: {},
      orgTicketsCounters: {},
      requestsCount: 0,
      fields: [],
      selectedKeys: [],
      orgFieldsActivated: false
    },

    events: {
      // App
      'app.activated': 'onAppActivation',
      'ticket.requester.email.changed': 'onAppActivation',

      // Requests
      'getUser.done': 'onGetUserDone',
      'getUserFields.done': 'onGetUserFieldsDone',
      'getOrganizationFields.done': 'onGetOrganizationFieldsDone',
      'getTickets.done': 'onGetTicketsDone',
      'getOrgTickets.done': 'onGetOrgTicketsDone',
      'updateUser.done': 'onUpdateUserDone',

      // UI
      'click .expandBar': 'onClickExpandBar',
      'click .cog': 'onCogClick',
      'click .back': 'onBackClick',
      'click .save': 'onSaveClick',
      'change .activateOrgFields': 'onActivateOrgFieldsChange',
      'change,keyup,input,paste .notes_or_details': 'onNotesOrDetailsChanged',

      // Misc
      'requestsFinished': 'onRequestsFinished'
    },

    requests: {
      'getUser': function(id) {
        return {
          url: helpers.fmt("/api/v2/users/%@.json?include=identities,organizations", id),
          dataType: 'json'
        };
      },

      'updateUser': function(data) {
        return {
          url: helpers.fmt("/api/v2/users/%@.json", this.ticket().requester().id()),
          type: 'PUT',
          dataType: 'json',
          data: { user: data }
        };
      },

      'getUserFields': {
        url: '/api/v2/user_fields.json'
      },

      'getOrganizationFields': {
        url: '/api/v2/organization_fields.json'
      },

      'getTickets': function(userId) {
        return {
          url: helpers.fmt("/api/v2/users/%@/tickets/requested.json", userId)
        };
      },

      'getOrgTickets': function(orgId) {
        return {
          url: helpers.fmt("/api/v2/organizations/%@/tickets.json", orgId)
        };
      },

      'saveSelectedFields': function(keys, orgKeys) {
        var appId = this.installationId();
        var settings = {
          'selectedFields': JSON.stringify(_.toArray(keys)),
          'orgFieldsActivated': this.storage.orgFieldsActivated.toString(),
          'orgFields': JSON.stringify(_.toArray(orgKeys))
        };
        this.settings = _.extend(this.settings, settings);
        return {
          type: 'PUT',
          url: helpers.fmt("/api/v2/apps/installations/%@.json", appId),
          dataType: 'json',
          data: {
            'settings': settings,
            'enabled': true
          }
        };
      }
    },

    // TOOLS ===================================================================

    // Implement the partial() method of underscorejs, because 1.3.3 doesn't
    // include it.
    partial: function(func) {
      var args = Array.prototype.slice.call(arguments, 1);
      return function() {
        return func.apply(this,
                          args.concat(Array.prototype.slice.call(arguments)));
      };
    },

    // Implement the object() method of underscorejs, because 1.3.3 doesn't
    // include it. Simplified for our use.
    toObject: function(list) {
      if (list == null) return {};
      var result = {};
      for (var i = 0, l = list.length; i < l; i++) {
        result[list[i][0]] = list[i][1];
      }
      return result;
    },

    countedAjax: function() {
      this.storage.requestsCount++;
      return this.ajax.apply(this, arguments).always((function() {
        _.defer((this.finishedAjax).bind(this));
      }).bind(this));
    },

    finishedAjax: function() {
      if (--this.storage.requestsCount === 0) {
        this.trigger('requestsFinished');
      }
    },

    fieldsForCurrentOrg: function() {
      if (!this.storage.user.organization) {
        return {};
      }
      return _.map(this.storage.selectedOrgKeys, (function(key) {
        var field = _.find(this.storage.organizationFields, function(field) {
          return field.key === key;
        });
        var result = {
          key: key,
          description: field.description,
          title: field.title,
          editable: field.editable
        };
        if (key.indexOf('##builtin') === 0) {
          var subkey = key.split('_')[1];
          result.value = this.storage.user.organization[subkey];
          result.simpleKey = ["builtin", subkey].join(' ');
          if (subkey === 'tags') {
            result.value = this.renderTemplate('tags', {tags: result.value});
            result.html = true;
          }
        }
        else {
          result.simpleKey = ["custom", key].join(' ');
          result.value = this.storage.user.organization.organization_fields[key];
          if (field.type === 'date') {
            result.value = this.toLocaleDate(result.value);
          }
        }
        return result;
      }).bind(this));
    },

    fieldsForCurrentUser: function() {
      return _.map(this.storage.selectedKeys, (function(key) {
        var field = _.find(this.storage.fields, function(field) {
          return field.key === key;
        });
        var result = {
          key: key,
          description: field.description,
          title: field.title,
          editable: field.editable
        };
        if (key.indexOf('##builtin') === 0) {
          var subkey = key.split('_')[1];
          result.value = this.storage.user[subkey];
          result.simpleKey = ["builtin", subkey].join(' ');
          if (subkey === 'tags') {
            result.value = this.renderTemplate('tags', {tags: result.value});
            result.html = true;
          }
        }
        else {
          result.simpleKey = ["custom", key].join(' ');
          result.value = this.storage.user.user_fields[key];
          if (field.type === 'date') {
            result.value = this.toLocaleDate(result.value);
          }
        }
        return result;
      }).bind(this));
    },

    toLocaleDate: function(date) {
      return new Date(date).toLocaleString(undefined, {
        year: "numeric",
        month: "numeric",
        day: "numeric"
      });
    },

    showDisplay: function() {
      this.switchTo('display', {
        ticketId: this.ticket().id(),
        isAdmin: this.currentUser().role() === 'admin',
        user: this.storage.user,
        tickets: this.makeTicketsLinks(this.storage.ticketsCounters),
        fields: this.fieldsForCurrentUser(),
        orgFields: this.fieldsForCurrentOrg(),
        orgFieldsActivated: this.storage.orgFieldsActivated && this.storage.user.organization,
        org: this.storage.user.organization,
        orgTickets: this.makeTicketsLinks(this.storage.orgTicketsCounters)
      });
      if (this.store('expanded')) {
        this.onClickExpandBar(true);
      }
    },

    makeTicketsLinks: function(counters) {
      var links = {};
      var link = "#/tickets/%@/requester/tickets".fmt(this.ticket().id());
      var tag = this.$('<div>').append(this.$('<a>').attr('href', link));
      _.each(counters, function(value, key) {
        if (value && value !== "-") {
          tag.find('a').html(value);
          links[key] = tag.html();
        }
        else {
          links[key] = value;
        }
      }.bind(this));
      return links;
    },

    // EVENTS ==================================================================

    onAppActivation: function() {
      this.storage.orgFieldsActivated = (this.setting('orgFieldsActivated') == 'true');
      var defaultSelection = '["##builtin_tags", "##builtin_notes", "##builtin_details"]';
      this.storage.selectedKeys = JSON.parse(this.setting('selectedFields') || defaultSelection);
      var defaultOrgSelection = '[]';
      this.storage.selectedOrgKeys = JSON.parse(this.setting('orgFields') || defaultOrgSelection);
      _.defer((function() {
        if (this.ticket().requester()) {
          this.countedAjax('getUser', this.ticket().requester().id());
          this.countedAjax('getUserFields');
          this.countedAjax('getOrganizationFields');
        }
        else {
          this.switchTo('empty');
        }
      }).bind(this));
    },

    onRequestsFinished: function() {
      var ticketsCounters = this.storage.ticketsCounters;
      _.each(['new', 'open', 'hold', 'pending', 'solved', 'closed'], function(key) {
        if (!ticketsCounters[key]) {
          ticketsCounters[key] = '-';
        }
      });
      ticketsCounters = this.storage.orgTicketsCounters;
      _.each(['new', 'open', 'hold', 'pending', 'solved', 'closed'], function(key) {
        if (!ticketsCounters[key]) {
          ticketsCounters[key] = '-';
        }
      });
      this.showDisplay();
    },

    onClickExpandBar: function(event, immediate) {
      var additional = this.$('.moreInfo');
      var expandBar = this.$('.expandBar i');
      expandBar.attr('class', 'arrow');
      var visible = additional.is(':visible');
      if (immediate) {
        additional.toggle(!visible);
      }
      else {
        additional.slideToggle(!visible);
        this.store('expanded', !visible);
      }
      expandBar.addClass(visible ? 'arrow-down' : 'arrow-up');
    },

    onCogClick: function() {
      var html = this.renderTemplate('admin', {
        fields: this.storage.fields,
        orgFields: this.storage.organizationFields,
        orgFieldsActivated: this.storage.orgFieldsActivated
      });
      this.$('.admin').html(html).show();
      this.$('.whole').hide();
    },

    onBackClick: function() {
      this.$('.admin').hide();
      this.$('.whole').show();
    },

    onSaveClick: function() {
      var that = this;
      var keys = this.$('.fields-list input:checked').map(function() { return that.$(this).val(); });
      var orgKeys = this.$('.org-fields-list input:checked').map(function() { return that.$(this).val(); });
      this.$('input, button').prop('disabled', true);
      this.$('.save').hide();
      this.$('.waitSpin').show();
      this.ajax('saveSelectedFields', keys, orgKeys)
        //.always(this.onBackClick.bind(this))
        .always(this.onAppActivation.bind(this));
    },

    onNotesOrDetailsChanged: _.debounce(function() {
      this.ajax('updateUser', {
        notes: this.$('div.builtin.notes textarea').val(),
        details: this.$('div.builtin.details textarea').val()
      });
    }, 1000),

    onActivateOrgFieldsChange: function(event) {
      var activate = this.$(event.target).is(':checked');
      this.storage.orgFieldsActivated = activate;
      this.$('.org-fields-list').toggle(activate);
    },

    // REQUESTS ================================================================

    onUpdateUserDone: function() {
      services.notify(this.I18n.t("update_user_done"));
    },

    onGetUserDone: function(data) {
      this.storage.user = data.user;
      var social = _.filter(data.identities, function(ident) {
        return _.contains(['twitter', 'facebook'], ident.type);
      });
      this.storage.user.identities = _.map(social, function(ident) {
        if (ident.type === 'twitter') {
          ident.value = helpers.fmt("https://twitter.com/%@", ident.value);
        } else if (ident.type === 'facebook') {
          ident.value = helpers.fmt("https://facebook.com/%@", ident.value);
        }
        return ident;
      });
      this.storage.user.organization = data.organizations[0];
      if (data.user.email) {
        this.countedAjax('getTickets', this.storage.user.id);
      }
      if (data.user.organization) {
        this.countedAjax('getOrgTickets', data.user.organization.id);
      }
    },

    onGetTicketsDone: function(data) {
      var grouped = _.groupBy(data.tickets, 'status');
      var res = this.toObject(_.map(grouped, function(value, key) {
        return [key, value.length];
      }));
      this.storage.ticketsCounters = res;
    },

    onGetOrgTicketsDone: function(data) {
      var grouped = _.groupBy(data.tickets, 'status');
      var res = this.toObject(_.map(grouped, function(value, key) {
        return [key, value.length];
      }));
      this.storage.orgTicketsCounters = res;
    },

    onGetOrganizationFieldsDone: function(data) {
      var selectedFields = this.storage.selectedOrgKeys;
      var fields = [
        {
          key: "##builtin_tags",
          title: this.I18n.t("tags"),
          description: "",
          position: 0,
          active: true
        },
        {
          key: "##builtin_notes",
          title: this.I18n.t("notes"),
          description: "",
          position: Number.MAX_VALUE - 1,
          active: true,
          editable: true
        },
        {
          key: "##builtin_details",
          title: this.I18n.t("details"),
          description: "",
          position: Number.MAXVALUE,
          active: true,
          editable: true
        }
      ].concat(data.organization_fields);
      var activeFields = _.filter(fields, function(field) {
        return field.active;
      });
      var restrictedFields = _.map(activeFields, function(field) {
        return {
          key: field.key,
          title: field.title,
          description: field.description,
          position: field.position,
          selected: _.contains(selectedFields, field.key),
          editable: field.editable,
          type: field.type
        };
      });
      this.storage.organizationFields = _.sortBy(restrictedFields, 'position');
    },

    onGetUserFieldsDone: function(data) {
      var selectedFields = this.storage.selectedKeys;
      var fields = [
        {
          key: "##builtin_tags",
          title: this.I18n.t("tags"),
          description: "",
          position: 0,
          active: true
        },
        {
          key: "##builtin_locale",
          title: this.I18n.t("locale"),
          description: "",
          position: 1,
          active: true
        },
        {
          key: "##builtin_notes",
          title: this.I18n.t("notes"),
          description: "",
          position: Number.MAX_VALUE - 1,
          active: true,
          editable: true
        },
        {
          key: "##builtin_details",
          title: this.I18n.t("details"),
          description: "",
          position: Number.MAXVALUE,
          active: true,
          editable: true
        }
      ].concat(data.user_fields);
      var activeFields = _.filter(fields, function(field) {
        return field.active;
      });
      var restrictedFields = _.map(activeFields, function(field) {
        return {
          key: field.key,
          title: field.title,
          description: field.description,
          position: field.position,
          selected: _.contains(selectedFields, field.key),
          editable: field.editable,
          type: field.type
        };
      });
      this.storage.fields = _.sortBy(restrictedFields, 'position');
    }
  };
}());
