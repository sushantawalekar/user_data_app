/* eslint-env mocha */
import app from '../src/javascript/app'
import assert from 'assert'

describe('App', () => {
  describe('#toLocaleDate', function () {
    it('returns a string', function () {
      const result = app.toLocaleDate('2018-10-02T00:00:00Z')
      assert.strictEqual(result, '2/10/2018')
    })
  })
})
