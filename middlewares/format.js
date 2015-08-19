'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _routesRssJs = require('../routes/rss.js');

var _routesRssJs2 = _interopRequireDefault(_routesRssJs);

function getFormat(app) {
  return function format(req, res, next) {
    res.renderBody = function (name, locals) {
      locals = _util2['default']._extend(res.locals, locals ? locals : {});

      res.format({
        'text/html': function textHtml() {
          app.render(name, locals, function (err, body) {
            return res.render('index.haml', _util2['default']._extend(locals, { body: body }));
          });
        },
        'application/rss+xml': function applicationRssXml() {
          res.set('Content-Type', 'application/rss+xml');
          if (locals.tree) {
            res.locals = locals;
            return (0, _routesRssJs2['default'])(req, res, next);
          } else {
            return res.status(406).send('Not acceptable');
          }
        },
        'application/json': function applicationJson() {
          return res.json(locals);
        },
        'default': function _default() {
          return res.status(406).send('Not acceptable');
        }
      });
    };

    res.handle = function () {
      var redirect = arguments[0] === undefined ? 'back' : arguments[0];
      var data = arguments[1] === undefined ? {} : arguments[1];
      var status = arguments[2] === undefined ? 200 : arguments[2];

      res.format({
        'text/html': function textHtml() {
          if (data.info) req.flash('info', data.info);

          return res.redirect(redirect);
        },
        'application/rss+xml': function applicationRssXml() {
          res.set('Content-Type', 'application/rss+xml');
          return res.send('OK');
        },
        'application/json': function applicationJson() {
          return res.status(status).json(_util2['default']._extend(data, { redirect: redirect }));
        },
        'default': function _default() {
          return res.status(406).send('Not acceptable');
        }
      });
    };

    return next();
  };
}

exports.getFormat = getFormat;