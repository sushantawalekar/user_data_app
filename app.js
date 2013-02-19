(function() {
  function TicketAsJson(ticket){
    return{
      id: ticket.id()
    };
  }

  function AuditEvent(event){
    this.event = event;

    this.containsSpokeData = function(){
      return this.isComment() && /spoke_id_/.test(this.event.body);
    };

    this.isComment = function(){
      return this.event.type === "Comment"
    };

    this.spokeData = function(){
      var data = /spoke_id_(.*)\nspoke_account_(.*)\nrequester_email_(.*)\nrequester_phone_(.*)/.exec(this.event.body);

      return {
        id: data[1],
        account: data[2],
        email: data[3],
        phone: data[4]
      };
    }
  }

  function HeaderView($el){
    this.$el = $el;

    this.renderUser = function(user){
      return this.$el.find('h3 span')
        .html(user.name + ' <small>('+ user.email +')</small>');
    };

    this.setIcon = function(val){
      return this.$el.find('h3 i')
        .attr('class', "icon-" + val);
    };
  }

  function UserView($el){
    this.$el = $el;

    this.render = function(html){
      this.$el.html(html);
    };

    this.locale = function(locale){
      this.$el.find('span.locale')
        .html(locale.name+' <small>('+locale.locale+ ')</small>');
    };

    this.ticketCount = function(count, type){
      this.$el.find('span.ticket-count')
        .html(count);
    };
  }

  function OrganizationView($el){
    this.$el = $el;

    this.render = function(html){
      this.$el.html(html);
    };

    this.ticketCount = function(count, type){
      var selector = 'ticket-count';

      if (type && !_.isEmpty(type))
        selector =  type + '-' + selector;

      this.$el.find('span.' + selector)
        .html(count);
    };
  }

  function SpokeTicketView($el){
    this.$el = $el;

    this.render = function(html){
      this.$el.html(html);
    };
  }

  function AppView($el){
    this.$el = $el;
    this.header = new HeaderView(this.$el.find('header'));
    this.user = new UserView(this.$el.find('section[data-user]'));
    this.organization = new OrganizationView(this.$el.find('section[data-organization]'));
    this.spokeTicket = new SpokeTicketView(this.$el.find('section[data-spoke-ticket]'));

    this.toggle = function(){
      var mainView = this.$el.find('section[data-main]');

      if (mainView.is(':visible')){
        mainView.hide();
        this.header.setIcon('plus');
      } else {
        mainView.show();
        this.header.setIcon('minus');
      }
    };
  }

  return {
    defaultState: 'list',

    requests: {
      fetchUser: function(id) {
        return {
          url: '/api/v2/users/' + id + '.json?include=organizations',
          dataType: 'json'
        };
      },

      fetchUserRequests: function(id){
        return {
          url: '/api/v2/users/' + id + '/requests.json',
          dataType: 'json'
        };
      },

      updateUser: function(id, data){
        return {
          url: '/api/v2/users/' + id + '.json',
          type: 'PUT',
          dataType: 'json',
          data: data
        };
      },

      fetchTicketAudits: function(id){
        return {
          url: '/api/v2/tickets/' + id + '/audits.json',
          dataType: 'json'
        };
      },

      fetchLocale: function(id){
        return {
          url: '/api/v2/locales/' + id +'.json',
          dataType: 'json'
        };
      },

      searchOrganizationTickets: function(name, condition){
        return {
          url: '/api/v2/search.json?query=type:ticket '+condition+' organization:'+name,
          dataType: 'json'
        };
      }
    },

    events: {
      /*
       *  APP EVENTS
       */
      'app.activated'                   : 'onActivated',
      'ticket.requester.id.changed'     : 'loadIfDataReady',
      'ticket.requester.email.changed'  : 'loadIfDataReady',
      /*
       *  AJAX EVENTS
       */
      'fetchUser.done'                  : 'fetchUserDone',
      'fetchTicketAudits.done'          : 'fetchTicketAuditsDone',
      'fetchLocale.done'                : function(data){ this.appView.user.locale(data.locale); },
      'updateUser.done'                 : function(){ services.notify(this.I18n.t("update_user_done")); },
      'fetchUserRequests.done'          : function(data){ this.appView.user.ticketCount(data.count); },

      'fetchTicketAudits.fail'          : 'genericAjaxFailure',
      'fetchLocale.fail'                : 'genericAjaxFailure',
      'updateUser.fail'                 : 'genericAjaxFailure',
      'fetchUser.fail'                  : 'genericAjaxFailure',
      'fetchUserRequests.fail'          : 'genericAjaxFailure',
      /*
       *  DOM EVENTS
       */
      'click header'                    : function(){ this.appView.toggle(); },
      'change #details'                 : 'detailsOrNotesChanged',
      'change #notes'                   : 'detailsOrNotesChanged'
    },

    onActivated: function() {
      this.doneLoading = false;

      this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if(!this.doneLoading &&
         this.ticket() &&
         this.ticket().requester()){

        this.initialize();

        this.doneLoading = true;
      }
    },

    initialize: function(){
      this.appView = new AppView(this.$());

      this.appView.header.renderUser({
        name: this.ticket().requester().name() || this.ticket().requester().id(),
        email: this.ticket().requester().email()
      });

      this.ajax('fetchUser', this.ticket().requester().id());
      this.ajax('fetchTicketAudits', this.ticket().id());
    },

    fetchUserDone: function(data){
      var user = data.user;
      var organization = data.organizations[0];
      var ticket = new TicketAsJson(this.ticket());

      this.appView.user.render(this.renderTemplate('user', {
        user: user,
        ticket: ticket
      }));

      if (organization){
        this.appView.organization.render(this.renderTemplate('organization', {
          organization: organization,
          ticket: ticket
        }));
        this.fetchOrganizationMetrics(organization);
      }

      this.ajax('fetchUserRequests', user.id);
      this.ajax('fetchLocale', user.locale_id);
    },

    fetchTicketAuditsDone: function(data){
      _.each(data.audits, function(audit){
        _.each(audit.events, function(e){
          var event = new AuditEvent(e);

          if (event.containsSpokeData())
            return this.appView.spokeTicket.render(this.renderTemplate('spoke-ticket', event.spokeData()));
        }, this);
      }, this);
    },

    detailsOrNotesChanged: function(){
      this.ajax('updateUser', this.ticket().requester().id(), {
        user: {
          details: this.$('#details').val(),
          notes: this.$('#notes').val()
        }
      });
    },

    fetchOrganizationMetrics: function(organization){
      _.each(['', 'new', 'open','solved', 'closed'], function(status){
        var condition = 'status:' + status;

        if (_.isEmpty(status))
          condition = '';

        this.ajax('searchOrganizationTickets', organization.name, condition)
          .done(function(data) {
            this.appView.organization.ticketCount(data.count, status);
          });
      }, this);
    },

    genericAjaxFailure: function(data){
      services.notify(this.I18n.t("ajax_error"), 'error');
    }
  };
}());
