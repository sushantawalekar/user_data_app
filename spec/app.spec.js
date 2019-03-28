/* eslint-env mocha */
import app from '../src/javascript/app'
import client from '../src/javascript/lib/extended_client'
import * as helpers from '../src/javascript/lib/helpers'
import apiHelpers from '../src/javascript/lib/api_helpers'
import assert from 'assert'
import sinon from 'sinon'

const sandbox = sinon.createSandbox()

describe('App', () => {
  afterEach(() => {
    sandbox.restore()
  })

  describe('#toLocaleDate', () => {
    let date

    before(() => {
      date = '2018-10-01T00:00:00+00:00' // October 1st, 2018
    })

    describe("dates are formatted for the user's locale", () => {
      it('formats date for en-US', () => {
        const result = app.toLocaleDate(date, 0, 'en-US')
        assert.strictEqual(result, '10/1/2018')
      })

      it('formats date for en-GB', () => {
        const result = app.toLocaleDate(date, 0, 'en-GB')
        assert.strictEqual(result, '01/10/2018')
      })

      it('formats date for ko-KR', () => {
        const result = app.toLocaleDate(date, 0, 'ko-KR')
        assert.strictEqual(result, '2018. 10. 1.')
      })
    })

    describe("the date respects agent's timezone", () => {
      it('shifts to a day earlier for negative timezone offsets', () => {
        const result = app.toLocaleDate(date, -660, 'en-US')
        assert.strictEqual(result, '9/30/2018')
      })

      it('displays the same day or shifts to a day ahead for positive timezone offsets', () => {
        const result = app.toLocaleDate(date, 780, 'en-US')
        assert.strictEqual(result, '10/1/2018')
      })
    })
  })

  describe('#couldHideField', () => {
    let hideEmptyFields
    const field = {}

    beforeEach(() => {
      sandbox.stub(helpers, 'setting').callsFake(() => {
        return hideEmptyFields
      })
    })

    it('return false when setting is false', () => {
      hideEmptyFields = false
      assert.strictEqual(app.couldHideField(field), false)
    })

    it('return false when field has a value', () => {
      hideEmptyFields = true
      field.value = 'test'
      assert.strictEqual(app.couldHideField(field), false)
    })

    it('return false when field is editable', () => {
      hideEmptyFields = true
      field.value = ''
      field.editable = true
      assert.strictEqual(app.couldHideField(field), false)
    })

    it('return true when field has a value', () => {
      hideEmptyFields = true
      field.value = ''
      field.editable = false
      assert.strictEqual(app.couldHideField(field), true)
    })
  })

  describe('#makeTicketsLinks', () => {
    beforeEach(() => {
      sandbox.stub(helpers, 'parseQueryString').callsFake(() => {
        return { origin: 'https://zd.com' }
      })
      helpers.storage('ticketId', 100)
    })

    describe('running the makeTicketsLinks', () => {
      beforeEach(() => {
        sandbox.stub(client, 'get').callsFake(() => {
          return Promise.resolve([{id: 100}, null, {id: 200}])
        })
      })

      it('returns requester and organization links', (done) => {
        app.makeTicketsLinks('requester').then((links) => {
          const expected = {
            user: { href: 'https://zd.com/agent/users/100/requested_tickets' },
            org: { href: 'https://zd.com/agent/organizations/200/tickets' }
          }

          assert.deepStrictEqual(links, expected)
          done()
        })
      })
    })

    describe('when on a existing ticket with an ID', () => {
      beforeEach(() => {
        sandbox.stub(client, 'get').callsFake(() => {
          return [{id: 100}, 50, {id: 200}]
        })
      })

      it('generates links for user', (done) => {
        app.makeTicketsLinks('requester', { number: 3 }).then((links) => {
          const expected = {
            user: { href: 'https://zd.com/agent/tickets/50/requester/requested_tickets' },
            org: { href: 'https://zd.com/agent/tickets/50/organization/tickets' },
            number: { href: 'https://zd.com/agent/tickets/50/requester/requested_tickets', value: 3 }
          }

          assert.deepStrictEqual(links, expected)
          done()
        })
      })

      it('generates links for organization', (done) => {
        app.makeTicketsLinks('organization', { number: 5 }).then((links) => {
          const expected = {
            user: { href: 'https://zd.com/agent/tickets/50/requester/requested_tickets' },
            org: { href: 'https://zd.com/agent/tickets/50/organization/tickets' },
            number: { href: 'https://zd.com/agent/tickets/50/organization/tickets', value: 5 }
          }

          assert.deepStrictEqual(links, expected)
          done()
        })
      })
    })

    describe('when on a new ticket', () => {
      beforeEach(() => {
        sandbox.stub(client, 'get').callsFake(() => {
          return Promise.resolve([{id: 100}, null, {id: 200}])
        })
      })

      it('generates links for user', (done) => {
        app.makeTicketsLinks('requester', { number: 7 }).then((links) => {
          const expected = {
            user: { href: 'https://zd.com/agent/users/100/requested_tickets' },
            org: { href: 'https://zd.com/agent/organizations/200/tickets' },
            number: { href: 'https://zd.com/agent/users/100/requested_tickets', value: 7 }
          }

          assert.deepStrictEqual(links, expected)
          done()
        })
      })

      it('generates links for organization', (done) => {
        app.makeTicketsLinks('organization', { number: 9 }).then((links) => {
          const expected = {
            user: { href: 'https://zd.com/agent/users/100/requested_tickets' },
            org: { href: 'https://zd.com/agent/organizations/200/tickets' },
            number: { href: 'https://zd.com/agent/organizations/200/tickets', value: 9 }
          }

          assert.deepStrictEqual(links, expected)
          done()
        })
      })
    })
  })

  describe('link actions', () => {
    let invokeSpy

    beforeEach((done) => {
      document.body.innerHTML = ('<section data-main></section>')

      invokeSpy = sandbox.spy(client, 'invoke')

      helpers.setting('orgFieldsActivated', true)

      sandbox.stub(client, 'get').callsFake(() => {
        return Promise.resolve([{id: 100}, {id: 200}, {}, 50])
      })

      sandbox.stub(apiHelpers, 'getTicketsCounters').callsFake(() => {
        return Promise.resolve({tickets: {new: 23}})
      })

      sandbox.stub(apiHelpers, 'getUser').callsFake(() => {
        return Promise.resolve({id: 100})
      })

      sandbox.stub(apiHelpers, 'getLocales').callsFake(() => {
        return Promise.resolve({'en-US': 'English'})
      })

      sandbox.stub(apiHelpers, 'getUserFields').callsFake(() => {
        return Promise.resolve([ {key: 'userField', name: 'userField'} ])
      })

      sandbox.stub(apiHelpers, 'getOrganizationFields').callsFake(() => {
        return Promise.resolve([ {key: 'organizationField', name: 'organizationField'} ])
      })

      sandbox.stub(app, 'makeTicketsLinks').callsFake(() => {
        return Promise.resolve({
          user: {href: 'http://zendesk.com/agent/tickets/50/requester/requested_tickets'},
          org: {href: 'http://zendesk.com/agent/tickets/50/organization/tickets'},
          new: {href: 'http://zendesk.com/'}
        })
      })

      app.showDisplay().then(done)
    })

    it('routes to the requester when clicked on the name', (done) => {
      document.querySelector('.card.user .contacts .name a').click()
      setTimeout(() => {
        assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('requester/requested_tickets')).called)
        done()
      }, 5)
    })

    it('routes to the requester when clicked on the ticket numbers', (done) => {
      document.querySelector('.card.user .count.new a').click()
      setTimeout(() => {
        assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('requester/requested_tickets')).called)
        done()
      }, 5)
    })

    it('routes to the organization when clicked on the name', (done) => {
      document.querySelector('.card.org .contacts .name a').click()
      setTimeout(() => {
        assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('organization/tickets')).called)
        done()
      }, 5)
    })

    it('routes to the organization when clicked on the ticket numbers', (done) => {
      document.querySelector('.card.org .count.new a').click()
      setTimeout(() => {
        assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('organization/tickets')).called)
        done()
      }, 5)
    })
  })
})
