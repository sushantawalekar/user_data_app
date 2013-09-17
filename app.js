(function() {
  return {

    storage: {
      user: null,
      ticketsCounters: {
      },
      requestsCount: 0,
      fields: [],
      selectedKeys: []
    },

    events: {
      // App
      'app.activated': 'onAppActivation',

      // Requests
      'getUser.done': 'onGetUserDone',
      'getUserFields.done': 'onGetUserFieldsDone',

      // UI
      'click .expandBar': 'onClickExpandBar',
      'click .cog': 'onCogClick',
      'click .back': 'onBackClick',

      // Misc
      'requestsFinished': 'onRequestsFinished',
    },

    requests: {
      'getUser': function(id) {
        return {
          url: helpers.fmt("/api/v2/users/%@.json", id),
          dataType: 'json',
          proxy_v2: true
        };
      },

      'getUserFields': {
        url: '/api/v2/user_fields.json',
        proxy_v2: true
      },

      'searchTickets': function(cond) {
        return {
          url: helpers.fmt("/api/v2/search.json?query=type:ticket %@", cond),
          dataType: 'json',
          proxy_v2: true
        };
      },

      'saveSelectedFields': function(keys) {
        var appId = this.installationId();
        var fieldsString = JSON.stringify(_.toArray(keys));
        if (!appId) {
          this.settings.selectedFields = fieldsString;
        }
        return {
          type: 'PUT',
          url: helpers.fmt("/api/v2/apps/installations/%@.json", appId),
          dataType: 'json',
          data: {
            'settings': {'selectedFields': fieldsString},
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

    fetchUserMetrics: function(email) {
      var TICKET_STATUSES = ['new', 'open', 'pending', 'hold', 'closed', 'solved'];
      _.each(TICKET_STATUSES, (function(status) {
        var condition = helpers.fmt("status:%@ requester:%@", status, email);
        this.countedAjax('searchTickets', condition)
          .done(this.partial(this.onSearchResultDone, status));
      }).bind(this));
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

    fieldsForCurrentUser: function() {
      return _.map(this.storage.selectedKeys, (function(key) {
        var result = { key: key };
        if (key.indexOf('##builtin') === 0) {
          var name = key.split('_')[1];
          result.value = this.storage.user[name];
          result.title = this.I18n.t(name);
        }
        else {
          var field = _.find(this.storage.fields, function(field) {
            return field.key === key;
          });
          result.title = field.title;
          result.description = field.description;
          result.value = this.storage.user.user_fields[key];
        }
        return result;
      }).bind(this));
    },

    // EVENTS ==================================================================

    onAppActivation: function() {
      _.defer((function() {
        var defaultSelection = '["##builtin_tags", "##builtin_notes", "##builtin_details"]';
        this.storage.selectedKeys = JSON.parse(this.setting('selectedFields') || defaultSelection);
        if (this.ticket().requester()) {
          this.countedAjax('getUser', this.ticket().requester().id());
        }
        this.countedAjax('getUserFields');
      }).bind(this));
    },

    onRequestsFinished: function() {
      _.each(this.storage.ticketsCounters, function(value, key, ticketCounters) {
        if (!value) {
          ticketCounters[key] = '-';
        }
      });
      this.switchTo('display', {
        isAdmin: this.currentUser().role() === 'admin',
        user: this.storage.user,
        tickets: this.storage.ticketsCounters,
        fields: this.fieldsForCurrentUser()
      });
    },

    onClickExpandBar: function() {
      var additional = this.$('.additional');
      var expandBar = this.$('.expandBar span');
      expandBar.attr('class', 'ui-icon');
      if (additional.is(':visible')) {
        additional.slideUp();
        expandBar.addClass('ui-icon-triangle-1-s');
      }
      else {
        additional.slideDown();
        expandBar.addClass('ui-icon-triangle-1-n');
      }
    },

    onCogClick: function() {
      this.switchTo('admin', {
        fields: this.storage.fields
      });
    },

    onBackClick: function() {
      var that = this;
      var keys = this.$('input:checked').map(function() { return that.$(this).val(); });
      this.$('input').prop('disabled', true);
      this.$('.waitSpin').show();
      this.ajax('saveSelectedFields', keys).always(this.onAppActivation.bind(this));
    },

    // REQUESTS ================================================================

    onGetUserDone: function(data) {
      this.storage.user = data.user;
      if (data.user.email) {
        this.fetchUserMetrics(data.user.email);
      }
    },

    onSearchResultDone: function(status, data) {
      this.storage.ticketsCounters[status] = parseInt(data.count, 10);
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
          key: "##builtin_notes",
          title: this.I18n.t("notes"),
          description: "",
          position: Number.MAX_VALUE - 1,
          active: true
        },
        {
          key: "##builtin_details",
          title: this.I18n.t("details"),
          description: "",
          position: Number.MAXVALUE,
          active: true
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
          selected: _.contains(selectedFields, field.key)
        };
      });
      this.storage.fields = _.sortBy(restrictedFields, 'position');
    }
  };
}());
