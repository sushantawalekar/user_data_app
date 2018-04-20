import forEach from 'lodash/forEach'
import requests from './requests'
import client from './client'

const MAX_PAGES = 10

export function ajax (...args) {
  const funcName = args.shift()
  const funcOrObj = requests[funcName]
  const obj = typeof funcOrObj === 'function' ? funcOrObj.apply(window, args) : funcOrObj
  if (!obj.url) return Promise.reject(new Error('request function did not return a url'))
  return client.request(obj)
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

        client.request({
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

        client.request({
          url: nextPage
        }).then(done).catch(fail)
      } else {
        reject(err)
      }
    }

    ajax.apply(window, args).then(done).catch(fail)
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
