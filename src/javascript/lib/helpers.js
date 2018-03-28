import forEach from 'lodash/forEach'
import requests from './requests'
import client from './client'

export function ajax (...args) {
  const funcName = args.shift()
  const funcOrObj = requests[funcName]
  const obj = typeof funcOrObj === 'function' ? funcOrObj.apply(window, args) : funcOrObj
  if (!obj.url) return Promise.resolve()
  return client.request(obj)
}

/**
 * this.ajaxPaging('getViews')
 *
 * If any of the calls fails, it will still try to continue to the next page or throw an error.
 * It cannot continue when it's either the first page or when it has two consecutive fails.
 */
export function ajaxPaging (...args) {
  return new Promise(function (resolve, reject) {
    const allData = []
    let lastNextPage = null

    ajax.apply(window, args).then(done).catch(fail)

    function done (data) {
      allData.push(data)

      if (data.next_page) {
        lastNextPage = data.next_page

        client.request({
          url: data.next_page
        }).then(done).catch(fail)
      } else {
        resolve(allData)
      }
    }

    function fail (err) {
      if (lastNextPage) {
        const nextPage = lastNextPage.replace(/([?|&])page=(\d+)/, (match, connector, page) => { return connector + 'page=' + (+page + 1) })

        lastNextPage = null

        client.request({
          url: nextPage
        }).then(done).catch(fail)
      } else {
        reject(err)
      }
    }
  }).then((allData) => {
    const groupedData = allData.reduce((groupedData, subData) => {
      forEach(subData, (value, key) => {
        // remove the next_page/previous_page properties because they don't make sense anymore.
        if (key === 'next_page' || key === 'previous_page') return
        groupedData[key] = (groupedData[key] instanceof Array) ? groupedData[key].concat(value) : value
      })
      return groupedData
    }, {})

    return groupedData
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
      match: match[0],         // "http://www.google.com/test/image.png?te=1&amp;ab=2#/tickets/2345"
      href: elm.href,          // "http://www.google.com/test/image.png?te=1&amp;ab=2#/tickets/2345"
      protocol: elm.protocol,  // "http:"
      host: elm.host,          // "www.google.com"
      hostname: elm.hostname,  // "www.google.com"
      port: elm.port,          // ""
      pathname: elm.pathname,  // "/test/image.png"
      hash: elm.hash,          // "#/tickets/2345"
      search: elm.search       // "?te=1&amp;ab=2"
    })
  }

  return urls.reduce(function (message, url) {
    return message.replace(url.match, `<a class="link link-external" target="_blank" href="${url.href}">${url.href}</a>`)
  }, message)
}
