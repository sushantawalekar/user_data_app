/* eslint-env mocha */
import * as helpers from '../src/javascript/lib/helpers'
import requests from '../src/javascript/lib/requests'
import client from '../src/javascript/lib/client'
import assert from 'assert'
import sinon from 'sinon'

describe('Helpers', () => {
  before(() => {
    requests.getLocales = {
      url: '/api/v2/locales.json'
    }
  })

  describe('#ajaxPaging', function () {
    const ajaxPaging = helpers.ajaxPaging

    it('returns a promise', function () {
      const result = ajaxPaging('getLocales')
      assert.strictEqual(typeof result.then, 'function')
    })

    describe('single calls', function () {
      before(() => {
        const ticketsResponse = {
          next_page: null,
          previous_page: null,
          count: 4,
          tickets: [1, 2, 3, 4]
        }

        sinon.stub(client, 'request').callsFake(() => {
          return Promise.resolve(ticketsResponse)
        })
      })

      after(() => {
        client.request.restore()
      })

      it('makes a ticket requests', function (done) {
        ajaxPaging('getLocales').then(function (data) {
          assert.deepStrictEqual(data, {count: 4, tickets: [1, 2, 3, 4]})
          done()
        })
      })
    })

    describe('multiple calls', function () {
      let idx

      beforeEach(() => {
        idx = 0
        const ticketsResponse = [
          {
            next_page: 't?page=2',
            tickets: [1, 2, 3, 4]
          }, {
            next_page: 't?page=3',
            tickets: [5, 6, 7, 8]
          }, {
            next_page: null,
            tickets: [9, 10, 11, 12]
          }
        ]

        sinon.stub(client, 'request').callsFake(() => {
          return Promise.resolve(ticketsResponse[idx++])
        })
      })

      after(() => {
        client.request.restore()
      })

      it('makes a ticket request to multiple pages 1', function (done) {
        ajaxPaging('getLocales').then(function (data) {
          assert.deepStrictEqual(data.tickets, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
          done()
        })
      })
    })

    describe('multiple calls with errors', function () {
      let idx

      beforeEach(() => {
        idx = 0
        const ticketsResponse = [
          {
            next_page: 't?page=2',
            tickets: [1, 2, 3, 4]
          }, {
            next_page: 't?page=3',
            tickets: [5, 6, 7, 8]
          }, {
            next_page: null,
            tickets: [9, 10, 11, 12]
          }
        ]

        sinon.stub(client, 'request').callsFake(() => {
          const r = ticketsResponse[idx++]
          return (idx === 2) ? Promise.reject(new Error('error')) : Promise.resolve(r)
        })
      })

      after(() => {
        client.request.restore()
      })

      it('makes a ticket request to multiple pages 2', function (done) {
        ajaxPaging('getLocales').then(function (data) {
          assert.deepStrictEqual(data.tickets, [1, 2, 3, 4, 9, 10, 11, 12])
          done()
        })
      })
    })
  })
})
