/* eslint-env mocha */
import app from '../src/javascript/app'
import client from '../src/javascript/lib/client'
import * as helpers from '../src/javascript/lib/helpers'
import assert from 'assert'
import sinon from 'sinon'

describe('App', () => {
  describe('#toLocaleDate', function () {
    it('returns a string', function () {
      const result = app.toLocaleDate('2018-10-02T00:00:00Z')
      assert.strictEqual(result, '2/10/2018')
    })
  })

  describe('#getLocales', () => {
    before(() => {
      sinon.stub(helpers, 'ajax').callsFake(() => {
        return Promise.resolve({
          locales: [
            { id: 1005, locale: 'nl', name: 'Nederlands (Dutch)' },
            { id: 1, locale: 'en-US', name: 'English' }
          ]
        })
      })
    })

    after(() => {
      helpers.ajax.restore()
    })

    it('returns a locales', (done) => {
      app.getLocales().then((data) => {
        assert.deepStrictEqual(data, {
          nl: 'Nederlands (Dutch)',
          'en-US': 'English'
        })
        done()
      })
    })

    it('stores the locales in storage', (done) => {
      app.getLocales().then(() => {
        assert.deepStrictEqual(helpers.storage('locales'), {
          nl: 'Nederlands (Dutch)',
          'en-US': 'English'
        })
        done()
      })
    })
  })

  describe('#couldHideField', () => {
    let hideEmptyFields
    const field = {}

    before(() => {
      sinon.stub(helpers, 'setting').callsFake(() => {
        return hideEmptyFields
      })
    })

    after(() => {
      helpers.setting.restore()
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

  describe('link actions', () => {
    let invokeSpy

    before(() => {
      document.body.innerHTML = ('<section data-main></section>')

      invokeSpy = sinon.spy(client, 'invoke')

      helpers.setting('orgFieldsActivated', true)
      helpers.storage('user', { name: 'User', organization: { name: 'Company' } })
      helpers.storage('ticketId', 100)
      helpers.storage('currentUser', {})
      helpers.storage('ticketsCounters', { new: 23 })
      helpers.storage('orgTicketsCounters', { new: 46 })

      app.showDisplay()
    })

    after(() => {
      client.invoke.restore()
    })

    it('routes to the requester when clicked on the name', () => {
      document.querySelector('.card.user .contacts .name a').click()
      assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('requester/requested_tickets')).called)
    })

    it('routes to the requester when clicked on the ticket numbers', () => {
      document.querySelector('.card.user .count.new a').click()
      assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('requester/requested_tickets')).called)
    })

    it('routes to the organization when clicked on the name', () => {
      document.querySelector('.card.org .contacts .name a').click()
      assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('organization/tickets')).called)
    })

    it('routes to the organization when clicked on the ticket numbers', () => {
      document.querySelector('.card.org .count.new a').click()
      assert(invokeSpy.withArgs('routeTo', 'nav_bar', '', sinon.match('organization/tickets')).called)
    })
  })

  describe('#getTickets', () => {
    let ajaxStub, searchData, ticketData

    before(() => {
      ajaxStub = sinon.stub(helpers, 'ajax').callsFake((r) => {
        const data = (r === 'searchTickets') ? searchData : ticketData
        return Promise.resolve(data)
      })
    })

    after(() => {
      helpers.ajax.restore()
    })

    it('returns after 1 call with the data', (done) => {
      searchData = { count: 1, results: [{ id: 123, status: 'open' }] }

      app.getTickets('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert.deepStrictEqual(result, { open: '1' })
        done()
      })
    })

    it('makes additional calls when count is between 1 and up to 100', (done) => {
      searchData = { count: 2, results: [{ id: 123, status: 'open' }] }
      ticketData = { count: 2, tickets: [{ id: 123, status: 'open' }, { id: 456, status: 'open' }] }

      app.getTickets('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert(ajaxStub.withArgs('getTickets', 1).called)
        assert.deepStrictEqual(result, { open: '2' })
        done()
      })
    })

    it('makes additional calls when count is > 100', (done) => {
      searchData = { count: 101, results: [{ id: 123, status: 'open' }] }

      app.getTickets('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:open').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:closed').called)
        assert.deepStrictEqual(result, {new: '101', open: '101', solved: '101', pending: '101', hold: '101', closed: '101'})
        done()
      })
    })
  })
})
