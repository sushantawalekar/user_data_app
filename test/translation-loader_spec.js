/* eslint-env mocha */
var assert = require('assert')
var TranslationsLoader = require('../webpack/translations-loader')

describe('#TranslationsLoader', function () {
  describe('with an object', function () {
    var input = {
      first: 'yes',
      sub: {
        second: 'ok'
      }
    }

    it('should flatten the object', function () {
      var result = {
        first: 'yes',
        'sub.second': 'ok'
      }

      assert.strictEqual(
        TranslationsLoader(JSON.stringify(input)),
        `module.exports = ${JSON.stringify(result)}`
      )
    })
  })

  describe('in a title/value pair', function () {
    var input = {
      first: {
        title: 'the title property',
        value: 'yes'
      },
      sub: {
        second: {
          title: 'the second title property',
          value: 'ok'
        }
      }
    }

    it('should use the value', function () {
      var result = {
        first: 'yes',
        'sub.second': 'ok'
      }

      assert.strictEqual(
        TranslationsLoader(JSON.stringify(input)),
        `module.exports = ${JSON.stringify(result)}`
      )
    })
  })

  describe('with a title', function () {
    var input = {
      title: 'yes',
      sub: {
        title: 'ok'
      }
    }

    it('should function normally, as long as there is no value key present', function () {
      var result = {
        title: 'yes',
        'sub.title': 'ok'
      }

      assert.strictEqual(
        TranslationsLoader(JSON.stringify(input)),
        `module.exports = ${JSON.stringify(result)}`
      )
    })
  })
})
