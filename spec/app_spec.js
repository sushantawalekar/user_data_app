import app from '../src/javascript/app'

describe('App', () => {
  beforeAll(function () {
  })

  describe('#toLocaleDate', function () {
    it('returns a string', function () {
      const result = app.toLocaleDate('2018-10-02T00:00:00Z')
      expect(result).toEqual('2/10/2018')
    })
  })
})
