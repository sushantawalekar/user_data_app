const flatten = require('lodash/flatten')

function translationFlatten (object, flattened = {}, currentKeys = []) {
  Object.keys(object).map(function (key) {
    if (['title', 'value'].indexOf(key) >= 0 && typeof object[key] !== 'object') {
      flattened[currentKeys.join('.')] = object['value']
    } else if (object[key] && typeof object[key] === 'object') {
      translationFlatten(object[key], flattened, flatten([currentKeys, key]))
    } else {
      flattened[flatten([currentKeys, key]).join('.')] = object[key]
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
