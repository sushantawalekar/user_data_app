/* eslint-env mocha */
var assert = require('assert')
var sinon = require('sinon')
var path = require('path')
var fs = require('fs')
var TranslationsPlugin = require('../webpack/translations-plugin')

describe('#TranslationsPlugin', function () {
  var options = {
    path: 'src/translations/'
  }

  describe('with a src directory', function () {
    var readFile, writeFile

    before(function () {
      readFile = sinon.spy(fs, 'readFile')
      writeFile = sinon.spy(fs, 'writeFile')
    })

    after(function () {
      fs.readFile.restore()
      fs.writeFile.restore()
    })

    it('should read en.yml', function (done) {
      TranslationsPlugin(options)

      setTimeout(function () {
        assert(readFile.called)
        assert.strictEqual(readFile.firstCall.args[0], path.resolve(options.path, `en.yml`))
        done()
      }, 20)
    })

    it('should write to en.json', function (done) {
      TranslationsPlugin(options)

      setTimeout(function () {
        assert(writeFile.called)
        assert.strictEqual(writeFile.firstCall.args[0], path.resolve(options.path, `en.json`))
        done()
      }, 20)
    })
  })

  describe('with a src directory', function () {
    var readFile, writeFile

    before(function () {
      readFile = sinon.stub(fs, 'readFile').callsFake(function () {
        var yml = fs.readFileSync('./test/en.yml', 'utf8')
        readFile.firstCall.args[2](undefined, yml)
      })
      writeFile = sinon.stub(fs, 'writeFile').callsFake(function () {
        writeFile.firstCall.args[2]()
      })
    })

    after(function () {
      fs.readFile.restore()
      fs.writeFile.restore()
    })

    it('should flatten en.yml', function (done) {
      TranslationsPlugin(options)

      setTimeout(function () {
        var result = JSON.parse(writeFile.firstCall.args[1])
        assert.deepStrictEqual(result, {name: 'Test App'})
        done()
      }, 20)
    })
  })
})
