(function() {
  var AuditEvent = function(event){
    this.event = event;
  };

  AuditEvent.prototype = {
    containsSpokeData: function(){
      return this.isComment() && /spoke_id_/.test(this.event.body);
    },

    isComment:function(){
      return this.event.type === "Comment";
    },

    spokeData: function(){
      var data = /spoke_id_(.*)\nspoke_account_(.*)\nrequester_email_(.*)\nrequester_phone_(.*)/.exec(this.event.body);

      if (_.isEmpty(data))
        return;

      return {
        id: data[1].trim(),
        account: data[2].trim(),
        email: data[3].trim(),
        phone: data[4].trim()
      };
    }
  };

  var SpokeTicketView = function($el, template){
    this.$el = $el;
    this.template = template;
  };

  SpokeTicketView.prototype = {
    render: function(params){
      return this.$el.html(this.template('spoke-ticket', params));
    }
  };

  var AppView = function(app){
    this.app = app;
  };

  AppView.prototype = {
    userView: 'section[data-user]',
    detailsNotesView: 'section[data-details-notes]',
    organizationView: 'section[data-organization]',

    toggle: function(){
      var mainView = this.app.$('section[data-main]');

      if (mainView.is(':visible')){
        mainView.hide();
        this.setHeaderIcon('plus');
      } else {
        mainView.show();
        this.setHeaderIcon('minus');
      }
    },

    toggleDetailsAndNotes: function(){
      return this.app.$(this.detailsNotesView + ' .well').toggle();
    },

    toggleOrganization: function(){
      return this.app.$(this.organizationView + ' .well').toggle();
    },

    setHeaderIcon: function(sign){
      return this.app.$('h3 i').attr('class', 'icon-' + sign);
    },

    setHeaderUser: function(user){
      return this.app.$('h3 span')
        .html(user.name + ' <small>('+ (user.email || '-') +')</small>');
    },

    setUser: function(args){
      this.setHeaderUser(args.user);

      this.renderTemplate(this.userView, 'user', args);
      this.renderTemplate(this.detailsNotesView, 'details-notes', {
        details: args.user.details,
        notes: args.user.notes
      });
    },

    setUserLocale: function(locale){
      var locale_for_flag = locale.locale.split('-');
      locale_for_flag = locale_for_flag[1] || locale_for_flag[0];

      if(_.isEmpty(locale_for_flag))
        return;

      return this.app
        .$(this.userView)
        .find('i.locale')
        .addClass('flag-' + locale_for_flag.toLowerCase())
        .attr("title", locale.name + ' ('+locale.locale+')');
    },

    setUserEmail: function(email){
      return this.render(this.userView + ' span.email', email);
    },

    getUserDetails: function(){
      return this.app.$(this.detailsNotesView +' .details').val();
    },

    getUserNotes: function(){
      return this.app.$(this.detailsNotesView +' .notes').val();
    },

    setOrganization: function(args){
      this.renderTemplate(this.organizationView, 'organization', args);
    },

    setTicketCount: function(entity, count, type){
      var el = this.app.$('section[data-'+entity+']');
      var selector = 'ticket-count';
      var html = count;

      if (type && !_.isEmpty(type))
        selector =  selector + '-' + type;

      if (el.find('span.' + selector).data('label'))
        html = _.template('<strong><%= label %> (<%= count %>)</strong>',{
          label: el.find('span.' + selector).data('label'),
          count: count
        });

      return el.find('span.' + selector)
        .html(html);
    },

    setSpokeTicket: function(args){
      return this.renderTemplate('section[data-spoke-ticket]', 'spoke-ticket', args);
    },

    renderTemplate: function(selector, template, args){
      return this.render(selector, this.app.renderTemplate(template, args));
    },

    render: function(selector, html){
      return this.app.$(selector).html(html);
    }
  };

  return {
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
      'fetchLocale.done'                : function(data){ this.appView.setUserLocale(data.locale); },
      'updateUser.done'                 : function(){ services.notify(this.I18n.t("update_user_done")); },
      'fetchUserRequests.done'          : function(data){ this.appView.setTicketCount('user',data.count); },

      'fetchTicketAudits.fail'          : 'genericAjaxFailure',
      'fetchLocale.fail'                : 'genericAjaxFailure',
      'updateUser.fail'                 : 'genericAjaxFailure',
      'fetchUser.fail'                  : 'genericAjaxFailure',
      'fetchUserRequests.fail'          : 'genericAjaxFailure',
      /*
       *  DOM EVENTS
       */
      'click header'                    : function(){ this.appView.toggle(); },
      'change,keyup,input,paste textarea.details_or_notes': 'detailsOrNotesChanged',
      'click a.details_and_notes'       : function(){ this.appView.toggleDetailsAndNotes(); },
      'click a.organization'            : function(){ this.appView.toggleOrganization(); }
    },

    onActivated: function(data) {
        this.doneLoading = false;

        this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if(!this.doneLoading &&
         this.ticket() &&
         this.ticket().id() &&
         this.ticket().requester()){

        this.switchTo('list');

        this.initialize();

        this.doneLoading = true;
      }
    },

    initialize: function(){
      this.appView = new AppView(this);

      this.ajax('fetchUser', this.ticket().requester().id());
      this.ajax('fetchTicketAudits', this.ticket().id());

      if (this.setting('unfolded_on_startup')){
        this.appView.toggle();
        services.appsTray().show();
      }
    },

    fetchUserDone: function(data){
      var user = data.user;
      var organization = data.organizations[0];
      var ticket =  { id: this.ticket().id() };

      this.fetchUserMetrics(user);
      this.ajax('fetchLocale', user.locale_id);

      this.appView.setUser({
        user: user,
        ticket: ticket,
        user_has_organization: !!organization
      });

      if (organization){
        this.appView.setOrganization({
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

            if (spokeData){
              this.appView.setHeaderUser({
                name: this.ticket().requester().name(),
                email: spokeData.email
              });

              this.appView.setUserEmail(spokeData.email);

              return this.appView.setSpokeTicket(spokeData);
            }
          }
        }, this);
      }, this);
    },

    detailsOrNotesChanged: _.debounce(function(){
      this.ajax('updateUser', this.ticket().requester().id(), {
        user: {
          details: this.appView.getUserDetails(),
          notes: this.appView.getUserNotes()
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
            this.appView.setTicketCount('user', data.count, status);
          });
      }, this);
    },

    fetchOrganizationMetrics: function(organization){
      _.each(this.searchableTicketStatuses, function(status){
        var condition = (_.isEmpty(status) ? '' : 'status:' + status) +
          ' organization:'+organization.name;

        this.ajax('searchTickets', condition)
          .done(function(data) {
            this.appView.setTicketCount('organization', data.count, status);
          });
      }, this);
    },

    genericAjaxFailure: function(data){
      services.notify(this.I18n.t("ajax_error"), 'error');
    }
  };
}());
