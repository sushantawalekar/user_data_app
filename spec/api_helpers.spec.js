/* eslint-env mocha */
import * as helpers from '../src/javascript/lib/helpers'
import apiHelpers from '../src/javascript/lib/api_helpers'
import assert from 'assert'
import sinon from 'sinon'

const sandbox = sinon.createSandbox()

describe('Api Helpers', () => {
  beforeEach(() => {
    sandbox.stub(helpers, 'storage').callsFake(() => undefined)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#getOrganizationFields', () => {
    before(() => {
      sandbox.stub(helpers, 'ajax').callsFake(() => Promise.resolve({ organization_fields: [ { title: 'test', active: true } ] }))
      sandbox.stub(apiHelpers, 'isOrganizationEditable').callsFake(() => Promise.resolve(true))
      sandbox.stub(apiHelpers, 'isOrganizationNotesEditable').callsFake(() => Promise.resolve(true))
    })

    it('it combines the standard fields with the ajax "getOrganizationFields" requests', (done) => {
      apiHelpers.getOrganizationFields().then((fields) => {
        assert.strictEqual(fields.length, 4)
        done()
      })
    })
  })

  describe('#getLocales', () => {
    before(() => {
      sandbox.stub(helpers, 'ajax').callsFake(() => {
        return Promise.resolve({
          locales: [
            { id: 1005, locale: 'nl', name: 'Nederlands (Dutch)' },
            { id: 1, locale: 'en-US', name: 'English' }
          ]
        })
      })
    })

    it('returns the locales', (done) => {
      apiHelpers.getLocales().then((data) => {
        assert.deepStrictEqual(data, {
          nl: 'Nederlands (Dutch)',
          'en-US': 'English'
        })
        done()
      })
    })
  })

  describe('#getTicketCounters', () => {
    let ajaxStub, searchData, ticketData

    beforeEach(() => {
      ajaxStub = sandbox.stub(helpers, 'ajax').callsFake((r, x) => {
        const data = (r === 'searchTickets') ? searchData : ticketData
        return Promise.resolve(data)
      })

      sandbox.stub(apiHelpers, 'getTicketsThroughSearch').callsFake(() => {
        return Promise.resolve([
          { count: 1 },
          { count: 2 },
          { count: 3 },
          { count: 4 },
          { count: 5 },
          { count: 6 }
        ])
      })
    })

    it('A) returns after 1 call with the data when there is only 1 ticket', (done) => {
      searchData = { count: 1, results: [{ id: 123, status: 'open' }] }
      ticketData = null

      apiHelpers.getTicketCounters('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert.deepStrictEqual(result, { new: 0, open: 1, pending: 0, hold: 0, solved: 0, closed: 0 })
        done()
      })
    })

    it('B) makes additional calls when count is between 1 and up to 100', (done) => {
      searchData = { count: 3, results: [{ id: 123, status: 'open' }] }
      ticketData = { count: 3, tickets: [{ id: 123, status: 'open' }, { id: 456, status: 'open' }, { id: 789, status: 'new' }] }

      apiHelpers.getTicketCounters('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert(ajaxStub.withArgs('getTickets', 1).called)
        assert.deepStrictEqual(result, { new: 1, open: 2, pending: 0, hold: 0, solved: 0, closed: 0 })
        done()
      })
    })

    it('C) makes additional calls when count is > 100', (done) => {
      searchData = { count: 101, results: [{ id: 123, status: 'open' }] }
      ticketData = null

      apiHelpers.getTicketCounters('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert.deepStrictEqual(result, { new: 1, open: 2, pending: 3, hold: 4, solved: 5, closed: 6 })
        done()
      })
    })
  })

  describe('#getTicketsThroughSearch', () => {
    let ajaxStub

    beforeEach(() => {
      ajaxStub = sandbox.stub(helpers, 'ajax').callsFake((r, x) => {
        return Promise.resolve({ count: 101, results: [{ id: 123, status: 'open' }] })
      })
    })

    it('makes additional calls when count is > 100', (done) => {
      apiHelpers.getTicketCounters('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:new').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:open').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:pending').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:hold').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:solved').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:closed').called)
        done()
      })
    })
  })
})
