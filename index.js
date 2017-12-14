/*!
 * finalhandler
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */
//引用非全局模块　
//中间件其实就是函数，中间件有点类似JavaScript事件循环的一个概念，将所有的中间件函数都存在一个栈中，请求到达时然后按顺序调用。
//先看一下开头部分已引入的模块，
//debug模块是用来开发调试的，EventEmitter是事件模块，finalhandler模块是让函数作为最后一个响应request，http模块是控制客户端请求与服务端响应的模块，
//merge是将属性从源对象合并到目标对象，parseUrl是解析给定请求对象的URL（查看req.url属性）并返回结果。
var debug = require('debug')('finalhandler')
var encodeUrl = require('encodeurl')
var escapeHtml = require('escape-html')
var onFinished = require('on-finished')
var parseUrl = require('parseurl')
var statuses = require('statuses')
var unpipe = require('unpipe')

/**
 * Module variables.
 * @private
 */
//模块 变量
var DOUBLE_SPACE_REGEXP = /\x20{2}/g
var NEWLINE_REGEXP = /\n/g

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function (fn) { process.nextTick(fn.bind.apply(fn, arguments)) }
var isFinished = onFinished.isFinished

/**
 * Create a minimal HTML document.
 *
 * @param {string} message
 * @private
 */
//创建最小HTML文档
function createHtmlDocument (message) {
  var body = escapeHtml(message)
    .replace(NEWLINE_REGEXP, '<br>')
    .replace(DOUBLE_SPACE_REGEXP, ' &nbsp;')

  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<title>Error</title>\n' +
    '</head>\n' +
    '<body>\n' +
    '<pre>' + body + '</pre>\n' +
    '</body>\n' +
    '</html>\n'
}

/**
 * Module exports.
 * @public
 */
//模块 输出finalhandler
module.exports = finalhandler

/**
 * Create a function to handle the final response.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Object} [options]
 * @return {Function}
 * @public
 */
//创建处理最终响应的函数。
function finalhandler (req, res, options) {
  var opts = options || {}

  // get environment
  //获得环境
  var env = opts.env || process.env.NODE_ENV || 'development'

  // get error callback
  //获取错误回调
  var onerror = opts.onerror

  return function (err) {
    var headers
    var msg
    var status

    // ignore 404 on in-flight response
    //忽略404机上的响应
    if (!err && headersSent(res)) {
      debug('cannot 404 after headers sent')
      return
    }

    // unhandled error
    //未处理错误
    if (err) {
      // respect status code from error
      //从错误里设置状态代码
      status = getErrorStatusCode(err)

      // respect headers from error
      //设置一个headers来获取错误headers
      if (status !== undefined) {
        headers = getErrorHeaders(err)
      }

      // fallback to status code on response
      //回退到响应时的状态代码
      if (status === undefined) {
        status = getResponseStatusCode(res)
      }

      // get error message
      //得到错误信息
      msg = getErrorMessage(err, status, env)
    } else {
      // not found
      //找不到
      status = 404
      msg = 'Cannot ' + req.method + ' ' + encodeUrl(parseUrl.original(req).pathname)
    }

    debug('default %s', status)

    // schedule onerror callback
    //调度错误回调
    if (err && onerror) {
      defer(onerror, err, req, res)
    }

    // cannot actually respond
    //实际上无法响应
    if (headersSent(res)) {
      debug('cannot %d after headers sent', status)
      req.socket.destroy()
      return
    }

    // send response
    //发送响应
    send(req, res, status, headers, msg)
  }
}

/**
 * Get headers from Error object.
 *
 * @param {Error} err
 * @return {object}
 * @private
 */
//从Error对象获取标头。
function getErrorHeaders (err) {
  if (!err.headers || typeof err.headers !== 'object') {
    return undefined
  }

  var headers = Object.create(null)
  var keys = Object.keys(err.headers)

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    headers[key] = err.headers[key]
  }

  return headers
}

/**
 * Get message from Error object, fallback to status message.
 *
 * @param {Error} err
 * @param {number} status
 * @param {string} env
 * @return {string}
 * @private
 */
//从错误对象获取消息，回退到状态消息。
function getErrorMessage (err, status, env) {
  var msg

  if (env !== 'production') {
    // use err.stack, which typically includes err.message
    //使用err . stack，它通常包括err . message
    msg = err.stack

    // fallback to err.toString() when possible
    //尽可能回退到err . tostring ( )
    if (!msg && typeof err.toString === 'function') {
      msg = err.toString()
    }
  }

  return msg || statuses[status]
}

/**
 * Get status code from Error object.
 *
 * @param {Error} err
 * @return {number}
 * @private
 */
//从错误对象获取状态代码。
function getErrorStatusCode (err) {
  // check err.status
  //检查错误状态
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 600) {
    return err.status
  }

  // check err.statusCode
  //检查err . status code
  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600) {
    return err.statusCode
  }

  return undefined
}

/**
 * Get status code from response.
 *
 * @param {OutgoingMessage} res
 * @return {number}
 * @private
 */
//从响应中获取状态代码。
function getResponseStatusCode (res) {
  var status = res.statusCode

  // default status code to 500 if outside valid range
  //如果超出有效范围，则默认状态代码为500
  if (typeof status !== 'number' || status < 400 || status > 599) {
    status = 500
  }

  return status
}

/**
 * Determine if the response headers have been sent.
 *
 * @param {object} res
 * @returns {boolean}
 * @private
 */
//确定是否已发送响应标头
function headersSent (res) {
  return typeof res.headersSent !== 'boolean'
    ? Boolean(res._header)
    : res.headersSent
}

/**
 * Send response.
 *
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 * @param {number} status
 * @param {object} headers
 * @param {string} message
 * @private
 */
//发送响应
function send (req, res, status, headers, message) {
  function write () {
    // response body
    //body响应
    var body = createHtmlDocument(message)

    // response status
    //status响应
    res.statusCode = status
    res.statusMessage = statuses[status]

    // response headers
    //headers响应
    setHeaders(res, headers)

    // security headers
    //保护化headers
    res.setHeader('Content-Security-Policy', "default-src 'self'")
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // standard headers
    //标准化headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'))

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    res.end(body, 'utf8')
  }

  if (isFinished(req)) {
    write()
    return
  }

  // unpipe everything from the request
  //从请求中删除所有内容
  unpipe(req)

  // flush the request
  //清除请求
  onFinished(req, write)
  req.resume()
}

/**
 * Set response headers from an object.
 *
 * @param {OutgoingMessage} res
 * @param {object} headers
 * @private
 */
//从object里设置响应headers
function setHeaders (res, headers) {
  if (!headers) {
    return
  }

  var keys = Object.keys(headers)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    res.setHeader(key, headers[key])
  }
}
