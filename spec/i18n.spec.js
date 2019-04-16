/* eslint-env mocha */
import I18n from '../src/javascript/lib/i18n'
import assert from 'assert'
import sinon from 'sinon'

const en = {
  'one': 'the first translation',
  'two.one': 'the second for: {{name}}',
  'two.two': 'the second for: {{name}}-{{other}}',
  'three.one.one': 'the {{name}} for {{name}} should be {{name}}'
}

describe('I18n', () => {
  const t = I18n.t

  before(function () {
    sinon.stub(I18n, 'tryRequire').callsFake((locale) => {
      return en
    })

    I18n.loadTranslations('en')
  })

  describe('#t', function () {
    it('returns a string', function () {
      const result = t('one')
      assert.strictEqual(result, 'the first translation')
    })

    it('interpolates one string', function () {
      const result = t('two.one', {
        name: 'olaf'
      })
      assert.strictEqual(result, 'the second for: olaf')
    })

    it('interpolates multiple strings', function () {
      const result = t('two.two', {
        name: 'olaf',
        other: 'test'
      })
      assert.strictEqual(result, 'the second for: olaf-test')
    })

    it('interpolates duplicates strings', function () {
      const result = t('three.one.one', {
        name: 'olaf'
      })
      assert.strictEqual(result, 'the olaf for olaf should be olaf')
    })
  })
})
