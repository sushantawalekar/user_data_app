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
      }).catch(console.error)
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

  describe('#getTickets', () => {
    let ajaxStub, searchData, ticketData

    beforeEach(() => {
      ajaxStub = sandbox.stub(helpers, 'ajax').callsFake((r, x) => {
        const data = (r === 'searchTickets') ? searchData : ticketData
        return Promise.resolve(data)
      })
    })

    it('returns after 1 call with the data', (done) => {
      searchData = { count: 1, results: [{ id: 123, status: 'open' }] }

      apiHelpers.getTicketsCounters('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert.deepStrictEqual(result, searchData)
        done()
      })
    })

    it('makes additional calls when count is between 1 and up to 100', (done) => {
      searchData = { count: 2, results: [{ id: 123, status: 'open' }] }
      ticketData = { count: 2, tickets: [{ id: 123, status: 'open' }, { id: 456, status: 'open' }] }

      apiHelpers.getTicketsCounters('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert(ajaxStub.withArgs('getTickets', 1).called)
        assert.deepStrictEqual(result, ticketData)
        done()
      })
    })

    it('makes additional calls when count is > 100', (done) => {
      searchData = { count: 101, results: [{ id: 123, status: 'open' }] }

      apiHelpers.getTicketsCounters('requester', 1).then((result) => {
        assert(ajaxStub.withArgs('searchTickets', 'requester:1').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:open').called)
        assert(ajaxStub.withArgs('searchTickets', 'requester:1 status:closed').called)
        assert.deepStrictEqual(result, [searchData, searchData, searchData, searchData, searchData, searchData])
        done()
      })
    })
  })
})
