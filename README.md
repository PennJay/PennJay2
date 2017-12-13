# finalhandler
node
# finalhandler
这是通过NPM注册表提供的node .js模块。安装是使用NPM install命令完成的:
    $ npm install finalhandler
# API
    var finalhandler = require('finalhandler')
# finalhandler(req, res, [options])
返回要作为给定请求和res的最后一步调用的函数。此函数将作为fn ( err)调用。如果err为falsy，则处理程序将向res写入404响应。如果是trusy，则将向res写入错误响应
写入错误时，将向响应中添加以下信息:
1. res . status code是从err . status (或err . status code)设置的。如果此值超出4xx或5xx范围，则将设置为500。
2. res . statusmessage是根据状态代码设置的。
3. 如果env是“production”，则正文将是状态代码消息的HTML，否则将是err . stack
4. err .headers对象中指定的任何标头。
当调用请求时，最终处理程序也将从请求中取消任何操作。
## options.env
默认情况下，环境由NODE _ENV变量确定，但它可以被此选项覆盖。
## options.onerror
当err存在时，提供要与err一起调用的函数。可用于将错误写入中央位置，而不会产生过多的函数。称为on error (错误、请求、res)。
Examples
 
# always 404

    var finalhandler = require('finalhandler')
    var http = require('http')

    var server = http.createServer(function (req, res) {
      var done = finalhandler(req, res)
      done()
    })

    server.listen(3000)
# perform simple action

    var finalhandler = require('finalhandler')
    var fs = require('fs')
    var http = require('http')

    var server = http.createServer(function (req, res) {
      var done = finalhandler(req, res)

      fs.readFile('index.html', function (err, buf) {
        if (err) return done(err)
        res.setHeader('Content-Type', 'text/html')
        res.end(buf)
      })
    })

    server.listen(3000)
# use with middleware-style functions

    var finalhandler = require('finalhandler')
    var http = require('http')
    var serveStatic = require('serve-static')

    var serve = serveStatic('public')

    var server = http.createServer(function (req, res) {
      var done = finalhandler(req, res)
      serve(req, res, done)
    })

    server.listen(3000)
# keep log of all errors

    var finalhandler = require('finalhandler')
    var fs = require('fs')
    var http = require('http')

    var server = http.createServer(function (req, res) {
      var done = finalhandler(req, res, {onerror: logerror})

      fs.readFile('index.html', function (err, buf) {
        if (err) return done(err)
        res.setHeader('Content-Type', 'text/html')
        res.end(buf)
      })
    })

    server.listen(3000)

    function logerror (err) {
      console.error(err.stack || err.toString())
    }
# License

MIT
