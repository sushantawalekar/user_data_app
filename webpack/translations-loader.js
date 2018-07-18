function flatten(array) {
  return array.reduce((memo, item) => {
    if (Array.isArray(item)) memo = memo.concat( flatten(item) )
    else memo.push(item)
    return memo
  }, [])
}

/**
 * {
 *   name: 'test app'
 *   author: {
 *     title: 'the author',
 *     value: 'mr programmer'
 *   },
 *   app: {
 *     instructions: 'install'
 *     steps: {
 *       click: 'this button'
 *     }
 *   }
 * }
 *
 * becomes
 *
 * {
 *   name: 'test app',
 *   author: 'mr programmer',
 *   app.instructions: 'install',
 *   app.steps.click: 'this button'
 * }
 */
function translationFlatten (object, flattened = {}, currentKeys = []) {
  Object.keys(object).map(function (key) {
    const value = object[key]
    const keyArr = flatten([currentKeys, key])

    if (typeof value === 'object') {
      if (value.title && value.value) {
        flattened[keyArr.join('.')] = value.value
      } else {
        translationFlatten(value, flattened, keyArr)
      }
    } else {
      flattened[keyArr.join('.')] = value
    }
  })
  return flattened
}

// It compiles the Handlebars templates for the translation file to be used within the app's i18n shim
function TranslationsLoader (content) {
  this.cacheable && this.cacheable()
  const translationsInput = JSON.parse(content)
  const compiledTranslations = translationFlatten(translationsInput)
  return `module.exports = ${JSON.stringify(compiledTranslations)}`
}

module.exports = TranslationsLoader
