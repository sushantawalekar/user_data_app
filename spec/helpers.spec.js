/* eslint-env mocha */
import * as helpers from '../src/javascript/lib/helpers'
import requests from '../src/javascript/lib/requests'
import client from '../src/javascript/lib/extended_client'
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

  describe('#escapeSpecialChars', () => {
    it('should escape open/close html tags', () => {
      const str = helpers.escapeSpecialChars('<script></script>')
      assert.strictEqual(str, '&lt;script&gt;&lt;/script&gt;')
    })
    it('should escape ampersand', () => {
      const str = helpers.escapeSpecialChars('a && b')
      assert.strictEqual(str, 'a &amp;&amp; b')
    })
    it('should escape quotes and back tick', () => {
      const str = helpers.escapeSpecialChars('"string" \'string\' `string`')
      assert.strictEqual(str, '&quot;string&quot; &#x27;string&#x27; &#x60;string&#x60;')
    })
    it('should escape equal sign', () => {
      const str = helpers.escapeSpecialChars('a = b')
      assert.strictEqual(str, 'a &#x3D; b')
    })
    it('should escape unsafe tags and characters', () => {
      const str = helpers.escapeSpecialChars('Test Ticket for Text App</a><script>javascript:alert(1);</script>')
      assert.strictEqual(str, 'Test Ticket for Text App&lt;/a&gt;&lt;script&gt;javascript:alert(1);&lt;/script&gt;')
    })
  })

  describe('#find', () => {
    it('should return a positive in an array', () => {
      const result = helpers.find([1, 2, 3], (i) => {
        return i === 2
      })
      assert.strictEqual(result, 2)
    })

    it('should return undefined if not found in an array', () => {
      const result = helpers.find([1, 2, 3], (i) => {
        return i === 4
      })
      assert.strictEqual(result, undefined)
    })

    it('should return a positive in an object', () => {
      const result = helpers.find({ a: 'yes', b: 'no' }, (i) => {
        return i === 'yes'
      })
      assert.strictEqual(result, 'yes')
    })

    it('should return undefined if not found in an object', () => {
      const result = helpers.find({ a: 'yes', b: 'no' }, (i) => {
        return i === 'maybe'
      })
      assert.strictEqual(result, undefined)
    })
  })

  describe('#parseNum', () => {
    it('always returns a string', () => {
      const numbers = [1, 11, 111, 1111, 11111, 111111]
      numbers.forEach((number) => {
        const result = helpers.parseNum(number)
        assert.strictEqual(typeof result, 'string')
      })
    })

    it('converts into a string', () => {
      const numbers = [
        1, 11, 111, 1111, 11111, 111111, 1111111, 11111111, 111111111, 1111111111,
        5, 55, 555, 5555, 55555, 555555, 5555555, 55555555, 555555555, 5555555555,
        9, 99, 999, 9999, 99999, 999999, 9999999, 99999999, 999999999, 9999999999
      ]
      const answers = [
        '1', '11', '111', '1111', '11k', '111k', '1.1M', '11M', '111M', '1.1G',
        '5', '55', '555', '5555', '55k', '555k', '5.5M', '55M', '555M', '5.5G',
        '9', '99', '999', '9999', '99k', '999k', '9.9M', '99M', '999M', '9.9G'
      ]

      numbers.forEach((number, i) => {
        const answer = answers[i]
        const result = helpers.parseNum(number)
        assert.strictEqual(result, answer)
      })
    })
  })

  describe('#parseQueryString', () => {
    it('parses without leading ?', () => {
      const result = helpers.parseQueryString('foo=bar')
      assert.deepStrictEqual(result, {
        foo: 'bar'
      })
    })

    it('parses booleans', () => {
      const result = helpers.parseQueryString('?bool_true=true&bool_false=false')
      assert.deepStrictEqual(result, {
        bool_true: true,
        bool_false: false
      })
    })

    it('parses numbers', () => {
      const result = helpers.parseQueryString('?number=123&float=118.1')
      assert.deepStrictEqual(result, {
        number: 123,
        float: 118.1
      })
    })

    it('parses arrays', () => {
      const result = helpers.parseQueryString('?arr=[1,2,"test",[true, false]]')
      assert.deepStrictEqual(result, {
        arr: [1, 2, 'test', [true, false]]
      })
    })

    it('parses booleans', () => {
      const result = helpers.parseQueryString('?obj={"foo":"bar","num":123,"bool":true}')
      assert.deepStrictEqual(result, {
        obj: { foo: 'bar', num: 123, bool: true }
      })
    })
  })

  describe('#promiseChain', () => {
    it('takes a promise and resolve it with a chain function as the first argument', (done) => {
      helpers.promiseChain(Promise.resolve(100)).then((data) => {
        const chain = data.shift()
        assert.strictEqual(typeof chain, 'function')
        assert.deepStrictEqual(data, [ 100 ])
        done()
      })
    })

    it('takes an array of promises', (done) => {
      helpers.promiseChain([ Promise.resolve(100), Promise.resolve(200) ]).then((data) => {
        const chain = data.shift()
        assert.strictEqual(typeof chain, 'function')
        assert.deepStrictEqual(data, [ 100, 200 ])
        done()
      })
    })

    it('alwyas resolves with all arguments of all promises in the order they were added to the chain', (done) => {
      helpers.promiseChain(Promise.resolve(100)).then((data) => {
        const chain = data.shift()
        return chain(Promise.resolve(200))
      }).then((data) => {
        const chain = data.shift()
        assert.strictEqual(typeof chain, 'function')
        assert.deepStrictEqual(data, [ 100, 200 ])
        return chain([ Promise.resolve(300), Promise.resolve(400) ])
      }).then((data) => {
        const chain = data.shift()
        assert.strictEqual(typeof chain, 'function')
        assert.deepStrictEqual(data, [ 100, 200, 300, 400 ])
        done()
      })
    })
  })
})
