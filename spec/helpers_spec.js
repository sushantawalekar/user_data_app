/* eslint-env jasmine */
import * as helpers from '../src/javascript/lib/helpers'
import requests from '../src/javascript/lib/requests'
import client from '../src/javascript/lib/client'

describe('Helpers', () => {
  beforeAll(() => {
    requests.getLocales = {
      url: '/api/v2/locales.json'
    }
  })

  describe('#ajaxPaging', function () {
    const ajaxPaging = helpers.ajaxPaging

    it('returns a promise', function () {
      const result = ajaxPaging()
      expect(typeof result.then).toEqual('function')
    })

    describe('single calls', function () {
      beforeAll(function () {
        const ticketsResponse = {
          next_page: null,
          previous_page: null,
          count: 4,
          tickets: [1, 2, 3, 4]
        }

        spyOn(client, 'request').and.callFake(function () {
          return Promise.resolve(ticketsResponse)
        })
      })

      it('makes a ticket requests', function (done) {
        ajaxPaging('getLocales').then(function (data) {
          expect(data).toEqual({count: 4, tickets: [1, 2, 3, 4]})
          done()
        })
      })
    })

    describe('multiple calls', function () {
      let idx

      beforeEach(function () {
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

        spyOn(client, 'request').and.callFake(function (request) {
          return Promise.resolve(ticketsResponse[idx++])
        })
      })

      it('makes a ticket request to multiple pages', function (done) {
        ajaxPaging('getLocales').then(function (data) {
          expect(data.tickets).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
          done()
        })
      })
    })

    describe('multiple calls with errors', function () {
      let idx

      beforeEach(function () {
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

        spyOn(client, 'request').and.callFake(function (request) {
          const r = ticketsResponse[idx++]
          return (idx === 2) ? Promise.reject(new Error('error')) : Promise.resolve(r)
        })
      })

      it('makes a ticket request to multiple pages', function (done) {
        ajaxPaging('getLocales').then(function (data) {
          expect(data.tickets).toEqual([1, 2, 3, 4, 9, 10, 11, 12])
          done()
        })
      })
    })
  })
})
