/* eslint-env mocha */
import app from '../src/javascript/app'
import client from '../src/javascript/lib/client'
import * as helpers from '../src/javascript/lib/helpers'
import * as storage from '../src/javascript/lib/storage'
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
        assert.deepStrictEqual(storage.storage('locales'), {
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
      sinon.stub(storage, 'setting').callsFake(() => {
        return hideEmptyFields
      })
    })

    after(() => {
      storage.setting.restore()
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

  describe('a click triggers the right event', () => {
    let invokeSpy

    before(() => {
      document.body.innerHTML = ('<section data-main><img class="loader" src="dot.gif"/></section>')

      invokeSpy = sinon.stub(client, 'invoke').callsFake(() => {
        return Promise.resolve()
      })

      storage.storage('currentUser', {})
      storage.storage('ticketsCounters', {
        new: 23
      })
    })

    after(() => {
      client.invoke.restore()
    })

    it('invokes routeTo when we click <a>', () => {
      app.showDisplay()
      document.querySelector('.card.user .counts .new a').click()
      assert(invokeSpy.withArgs('routeTo').calledOnce)
    })
  })
})
