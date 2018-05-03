/* eslint-env jasmine */
import I18n from '../src/javascript/lib/i18n'

const en = {
  'one': 'the first translation',
  'two.one': 'the second for: {{name}}',
  'two.two': 'the second for: {{name}}-{{other}}',
  'three.one.one': 'the {{name}} for {{name}} should be {{name}}'
}

describe('I18n', () => {
  const t = I18n.t

  beforeAll(function () {
    spyOn(I18n, 'tryRequire').and.callFake(function (locale) {
      return en
    })

    I18n.loadTranslations('en')
  })

  describe('#t', function () {
    it('returns a string', function () {
      const result = t('one')
      expect(result).toEqual('the first translation')
    })

    it('interpolates one string', function () {
      const result = t('two.one', {
        name: 'olaf'
      })
      expect(result).toEqual('the second for: olaf')
    })

    it('interpolates multiple strings', function () {
      const result = t('two.two', {
        name: 'olaf',
        other: 'test'
      })
      expect(result).toEqual('the second for: olaf-test')
    })

    it('interpolates duplicates strings', function () {
      const result = t('three.one.one', {
        name: 'olaf'
      })
      expect(result).toEqual('the olaf for olaf should be olaf')
    })
  })
})
