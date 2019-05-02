import requests from './requests'
import eClient from './extended_client'

const MAX_PAGES = 10

export function ajax (...args) {
  const funcName = args.shift()
  const funcOrObj = requests[funcName]
  const obj = typeof funcOrObj === 'function' ? funcOrObj.apply(window, args) : funcOrObj
  if (!obj) return Promise.reject(new Error(`no such request: "${funcName}"`))
  if (!obj.url) return Promise.resolve()
  return eClient.request(obj)
}

/**
 * this.ajaxPaging('getViews')
 *
 * If any of the calls fails, it will still try to continue to the next page or throw an error.
 * It cannot continue when it's either the first page or when it has two consecutive fails.
 */
export function ajaxPaging (...args) {
  let pages = 1

  return new Promise(function (resolve, reject) {
    const allData = []
    let lastNextPage = null

    const done = function (data) {
      allData.push(data)

      if (pages < MAX_PAGES && data.next_page) {
        lastNextPage = data.next_page
        pages++

        eClient.request({
          url: data.next_page
        }).then(done).catch(fail)
      } else {
        resolve(allData)
      }
    }

    const fail = function (err) {
      // Limit the pages we will request to not create an endless flow of requests
      if (pages === MAX_PAGES) return resolve(allData)

      if (lastNextPage) {
        // if we have a lastPage url, we replace.
        const nextPage = lastNextPage.replace(/([?|&])page=(\d+)/, (match, connector, page) => { return connector + 'page=' + (+page + 1) })

        lastNextPage = null

        eClient.request({
          url: nextPage
        }).then(done).catch(fail)
      } else {
        reject(err)
      }
    }

    ajax.apply(window, args).then(done).catch(fail)
  }).then((allData) => {
    return allData.reduce((groupedData, subData) => {
      Object.keys(subData).forEach((key) => {
        const value = subData[key]
        // remove the next_page/previous_page properties because they don't make sense anymore.
        if (key === 'next_page' || key === 'previous_page') return
        groupedData[key] = (groupedData[key] instanceof Array) ? groupedData[key].concat(value) : value
      })
      return groupedData
    }, {})
  })
}

export function urlify (message, hostname) {
  const urlRegExp = /((www\.|https?:\/\/|\/\/)\S+\.[^\s.]+)\S*/gi
  const urls = []
  let match

  while ((match = urlRegExp.exec(message)) !== null) {
    const elm = document.createElement('a')
    elm.href = (match[0].indexOf('www') === 0) ? 'http://' + match[0] : match[0]

    urls.push({
      match: match[0], // "http://www.google.com/test/image.png?te=1&amp;ab=2#/tickets/2345"
      href: elm.href, // "http://www.google.com/test/image.png?te=1&amp;ab=2#/tickets/2345"
      protocol: elm.protocol, // "http:"
      host: elm.host, // "www.google.com"
      hostname: elm.hostname, // "www.google.com"
      port: elm.port, // ""
      pathname: elm.pathname, // "/test/image.png"
      hash: elm.hash, // "#/tickets/2345"
      search: elm.search // "?te=1&amp;ab=2"
    })
  }

  return urls.reduce(function (message, url) {
    return message.replace(url.match, `<a class="link link-external" target="_blank" href="${url.href}">${url.href}</a>`)
  }, message)
}

export function appResize (height, width) {
  return Promise.resolve().then(() => {
    if (width) return eClient.invoke('resize', { width })
  }).then(() => {
    let newHeight = height || Math.max(document.body.offsetHeight, 50)
    eClient.invoke('resize', { height: newHeight })
  })
}

export function templatingLoop (set, getTemplate) {
  let accumulator = ''
  Object.keys(set).forEach((index) => {
    const item = set[index]
    accumulator += getTemplate(item, index)
  })
  return accumulator
}

export function escapeSpecialChars (str) {
  const escape = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;',
    '=': '&#x3D;'
  }
  return /[&<>"'`=]/.test(str) ? str.replace(/[&<>"'`=]/g, function (m) { return escape[m] }) : str
}

export function localStorage (keyOrObject, value) {
  const installationId = storage('installationId')

  if (value === undefined) {
    return JSON.parse(window.localStorage.getItem(`${installationId}:${keyOrObject}`))
  } else if (typeof keyOrObject === 'string') {
    window.localStorage.setItem(`${installationId}:${keyOrObject}`, JSON.stringify(value))
  } else if (typeof keyOrObject === 'object') {
    Object.keys(keyOrObject).forEach((key) => {
      window.localStorage.setItem(`${installationId}:${key}`, JSON.stringify(keyOrObject[key]))
    })
  }
}

const _settings = {}
export function setting (key, value) {
  if (key === undefined) {
    return _settings
  } else if (value === undefined) {
    return _settings[key]
  } else {
    _settings[key] = value
  }
}

const _storage = {}
export function storage (key, value) {
  if (key === undefined) {
    return _storage
  } else if (value === undefined) {
    return _storage[key]
  } else {
    _storage[key] = value
  }
}

export function isDev () {
  return storage('appId') === 0
}

function parseIntWithDefault (num, def) {
  return parseInt(num, 10) || def || 0
}

function addInsignificantZero (n) {
  return (n < 10 ? '0' : '') + n
}

export function secondsToTimeString (seconds) {
  if (typeof seconds !== 'number') throw new Error('secondsToTimeString takes a Number argument')
  const negative = seconds < 0
  const absValue = Math.abs(seconds)
  const hours = Math.floor(absValue / 3600)
  const minutes = Math.floor((absValue - (hours * 3600)) / 60)
  const secs = absValue - (hours * 3600) - (minutes * 60)
  const timeString = `${addInsignificantZero(hours)}:${addInsignificantZero(minutes)}:${addInsignificantZero(secs)}`

  return negative ? `-${timeString}` : timeString
}

const simpleFormat = /^-?\d+$/
const complexFormat = /^(\d{0,2}):(\d{0,2}):(\d{0,2})$/

export function timeStringToSeconds (timeString, simple = false) {
  let result

  if (simple) {
    result = timeString.match(simpleFormat)

    if (!result) throw new Error('bad_time_format')

    return parseInt(result[0], 10) * 60
  } else {
    result = timeString.match(complexFormat)

    if (!result || result.length !== 4) throw new Error('bad_time_format')

    return parseIntWithDefault(result[1]) * 3600 +
      parseIntWithDefault(result[2]) * 60 +
      parseIntWithDefault(result[3])
  }
}

export function delegateEvents (events, instance) {
  Object.keys(events).forEach((key) => {
    delegateEvent(key, events[key], instance)
  })
}

export function delegateEvent (eventString, fn, instance) {
  const [ eventName, selector ] = eventString.split(/ (.*)/, 2)
  if (typeof fn === 'string') fn = instance[fn]
  if (typeof fn !== 'function') throw new Error(`Event: ${eventName} has no function`)
  if (!selector) return eClient.on(eventName, fn.bind(instance))

  document.addEventListener(eventName, (event) => {
    const path = event.path || []

    if (!path.length) {
      let a = event.target
      while (a) {
        path.unshift(a)
        a = a.parentNode
      }
    }

    let elm
    path.forEach((element) => {
      // Fix for IE11
      element.matches = element.matches || element.msMatchesSelector
      if (!element.matches) return false

      const e = element.matches(selector)
      if (e) elm = e
    })

    if (!elm) return
    event.eventTarget = elm

    fn.call(instance, event)
  })
}

// Function to fix arrays that are accidentally an object
export function fixArray (obj) {
  return Object.keys(obj).map((key) => {
    return obj[key]
  })
}

export function find (set, fn) {
  let el

  const keys = Object.keys(set)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = set[key]
    if (fn(value)) {
      el = value
      break
    }
  }

  return el
}

export function render (htmlString, selector = '[data-main]') {
  document.querySelector(selector).innerHTML = htmlString
}

export function setMainClass (name) {
  const $main = document.querySelector('[data-main]')
  // Remove all classes and only add the new one
  $main.className = name
}

export function createModal () {
  return eClient.invoke('instances.create', {
    location: 'modal',
    url: 'assets/modal.html'
  }).then((modalContext) => {
    const instanceGuid = modalContext['instances.create'][0].instanceGuid
    const modalClient = eClient.instance(instanceGuid)

    return new Promise((resolve) => {
      modalClient.on('model.done', () => {
        resolve(modalClient)
      })
    })
  })
}

export function parseNum (num) {
  return (num >= 1e+9 && (num / 1e+9).toString().slice(0, 3).replace(/\.$/, '') + 'G') ||
         (num >= 1e+6 && (num / 1e+6).toString().slice(0, 3).replace(/\.$/, '') + 'M') ||
         (num >= 1e+4 && (num / 1e+3).toString().slice(0, 3).replace(/\.$/, '') + 'k') ||
         num.toString()
}

// search param can be used for testing
export function parseQueryString (search = document.location.search) {
  if (search.indexOf('?') === 0) search = search.slice(1)
  const searchData = search.split('&')

  return searchData.reduce((obj, data) => {
    let [key, value] = data.split('=')
    key = decodeURIComponent(key)
    value = decodeURIComponent(value)

    try {
      value = JSON.parse(value)
    } catch (err) {}

    obj[key] = value
    return obj
  }, {})
}

export function promiseChain (promiseOrArray) {
  const _cache = []
  return chain(promiseOrArray)

  function chain (promiseOrArray = []) {
    const promiseArray = Array.isArray(promiseOrArray) ? promiseOrArray : [ promiseOrArray ]
    return Promise.all(promiseArray).then((dataArray) => {
      _cache.push(...dataArray)
      return [].concat(chain, _cache)
    })
  }
}
