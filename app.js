(function() {
  return {

    storage: {
      user: null,
      ticketsCounters: {
      },
      requestsCount: 0
    },

    events: {
      // App
      'app.activated': 'onAppActivation',

      // Requests
      'getUser.done': 'onGetUserDone',

      // UI
      'click .expandBar': 'onClickExpandBar',

      // Misc
      'requestsFinished': 'onRequestsFinished'
    },

    requests: {
      'getUser': function(id) {
        return {
          url: helpers.fmt("/api/v2/users/%@.json", id),
          dataType: 'json',
          proxy_v2: true
        };
      },

      'searchTickets': function(cond) {
        return {
          url: helpers.fmt("/api/v2/search.json?query=type:ticket %@", cond),
          dataType: 'json',
          proxy_v2: true
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

    // EVENTS ==================================================================

    onAppActivation: function() {
      _.defer((function() {
        if (this.ticket().requester()) {
          this.countedAjax('getUser', this.ticket().requester().id());
        }
      }).bind(this));
    },

    onRequestsFinished: function() {
      _.each(this.storage.ticketsCounters, function(value, key, ticketCounters) {
        if (!value) {
          ticketCounters[key] = '-';
        }
      });
      this.switchTo('display', {
        user: this.storage.user,
        tickets: this.storage.ticketsCounters
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

    // REQUESTS ================================================================

    onGetUserDone: function(data) {
      this.storage.user = data.user;
      if (data.user.email) {
        this.fetchUserMetrics(data.user.email);
      }
    },

    onSearchResultDone: function(status, data) {
      this.storage.ticketsCounters[status] = parseInt(data.count, 10);
    }
  };
}());
