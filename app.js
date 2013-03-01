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
      return this.event.type === "Comment";
    };

    this.spokeData = function(){
      var data = /spoke_id_(.*)\nspoke_account_(.*)\nrequester_email_(.*)\nrequester_phone_(.*)/.exec(this.event.body);

      return {
        id: data[1].trim(),
        account: data[2].trim(),
        email: data[3].trim(),
        phone: data[4].trim()
      };
    };
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

  function UserView($el, template){
    this.$el = $el;
    this.template = template;

    this.render = function(params){
      return this.$el.html(this.template('user', params));
    };

    this.locale = function(locale){
      var locale_for_flag = locale.locale.split('-');
      locale_for_flag = locale_for_flag[1] || locale_for_flag[0];

      if(_.isEmpty(locale_for_flag))
        return;

      return this.$el.find('i.locale').addClass('flag-' + locale_for_flag.toLowerCase())
        .attr("title", locale.name + ' ('+locale.locale+')');
    };

    this.email = function(email){
      return this.$el.find('span.email').html(email);
    };

    this.ticketCount = function(count, type){
      var selector = 'ticket-count';
      var html = count;

      if (type && !_.isEmpty(type))
        selector =  selector + '-' + type;

      if (this.$el.find('span.' + selector).data('label'))
        html = _.template('<strong><%= label %> (<%= count %>)</strong>',{
          label: this.$el.find('span.' + selector).data('label'),
          count: count
        });

      return this.$el.find('span.' + selector)
        .html(html);
    };
  }

  function OrganizationView($el, template){
    this.$el = $el;
    this.template = template;

    this.render = function(params){
      return this.$el.html(this.template('organization', params));
    };

    // Not dry, it's the same as UserView#ticketCount...
    // Look at inheritance using javascript.
    this.ticketCount = function(count, type){
      var selector = 'ticket-count';
      var html = count;

      if (type && !_.isEmpty(type))
        selector =  selector + '-' + type;

      if (this.$el.find('span.' + selector).data('label'))
        html = _.template('<strong><%= label %> (<%= count %>)</strong>',{
          label: this.$el.find('span.' + selector).data('label'),
          count: count
        });

      return this.$el.find('span.' + selector)
        .html(html);
    };

    this.toggle = function(){
      return this.$el.find('.well').toggle();
    };
  }

  function SpokeTicketView($el, template){
    this.$el = $el;
    this.template = template;

    this.render = function(params){
      return this.$el.html(this.template('spoke-ticket', params));
    };
  }

  function DetailsNotesView($el, template){
    this.$el = $el;
    this.template = template;

    this.render = function(params){
      return this.$el.html(this.template('details-notes', params));
    };

    this.toggle = function(){
      return this.$el.find('.well').toggle();
    };

    this.details = function(){
      return this.$el.find('.details').val();
    };

    this.notes = function(){
      return this.$el.find('.notes').val();
    };
  }


  function AppView($el, template){
    this.$el = $el;
    this.template = template;

    this.header = new HeaderView(this.$el.find('header'));
    this.user = new UserView(this.$el.find('section[data-user]'), this.template);
    this.organization = new OrganizationView(this.$el.find('section[data-organization]'), this.template);
    this.spokeTicket = new SpokeTicketView(this.$el.find('section[data-spoke-ticket]'), this.template);
    this.detailsNotes = new DetailsNotesView(this.$el.find('section[data-details-notes]'), this.template);

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
    searchableTicketStatuses: ['', 'new', 'open','pending', 'hold'],

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

      searchTickets: function(condition){
        return {
          url: '/api/v2/search.json?query=type:ticket '+ condition,
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
      'change textarea.details_or_notes': 'detailsOrNotesChanged',
      'keyup textarea.details_or_notes' : 'detailsOrNotesChanged',
      'input textarea.details_or_notes' : 'detailsOrNotesChanged',
      'paste textarea.details_or_notes' : 'detailsOrNotesChanged',
      'click a.details_and_notes'       : function(){ this.appView.detailsNotes.toggle(); },
      'click a.organization'            : function(){ this.appView.organization.toggle(); }
    },

    onActivated: function(data) {
      if (data.firstLoad){
        this.doneLoading = false;

        this.loadIfDataReady();
      }
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
      var self = this;

      this.appView = new AppView(this.$(),
                                 function(tmpl,params){
                                   return self.renderTemplate(tmpl,params);
                                 });

      this.ajax('fetchUser', this.ticket().requester().id());
      this.ajax('fetchTicketAudits', this.ticket().id());

      if (this.setting('unfolded_on_startup'))
        this.appView.toggle();
    },

    fetchUserDone: function(data){
      var user = data.user;
      var organization = data.organizations[0];
      var ticket = new TicketAsJson(this.ticket());

      this.fetchUserMetrics(user);
      this.ajax('fetchLocale', user.locale_id);

      this.appView.header.renderUser({
        name: user.name,
        email: user.email || "-"
      });

      this.appView.user.render({
        user: user,
        ticket: ticket,
        user_has_organization: !!organization
      });

      this.appView.detailsNotes.render({
        details: user.details,
        notes: user.notes
      });

      if (organization){
        this.appView.organization.render({
          organization: organization,
          ticket: ticket
        });
        this.fetchOrganizationMetrics(organization);
      }
    },

    fetchTicketAuditsDone: function(data){
      _.each(data.audits, function(audit){
        _.each(audit.events, function(e){
          var event = new AuditEvent(e);

          if (event.containsSpokeData()){
            var spokeData = event.spokeData();

            this.appView.header.renderUser({
              name: this.ticket().requester().name(),
              email: spokeData.email
            });

            this.appView.user.email(spokeData.email);

            return this.appView.spokeTicket.render(spokeData);
          }
        }, this);
      }, this);
    },

    detailsOrNotesChanged: _.debounce(function(){
      this.ajax('updateUser', this.ticket().requester().id(), {
        user: {
          details: this.appView.detailsNotes.details(),
          notes: this.appView.detailsNotes.notes()
        }
      });
    },400),

    fetchUserMetrics: function(user){
      if (_.isEmpty(user.email))
        return;

      _.each(this.searchableTicketStatuses, function(status){
        var condition = (_.isEmpty(status) ? '' : 'status:' + status) +
          ' requester:' + encodeURIComponent(user.email);

        this.ajax('searchTickets', condition)
          .done(function(data) {
            this.appView.user.ticketCount(data.count, status);
          });
      }, this);
    },

    fetchOrganizationMetrics: function(organization){
      _.each(this.searchableTicketStatuses, function(status){
        var condition = (_.isEmpty(status) ? '' : 'status:' + status) +
          ' organization:'+organization.name;

        this.ajax('searchTickets', condition)
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
