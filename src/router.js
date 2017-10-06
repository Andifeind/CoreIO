/**
 * Router module
 *
 * @module Router
 *
 * @example {js}
 * const router = new CoreIO.Router();
 * router.registerRoutes({
 *   slug: '/foo',
 *   get: (ctx) => {
 *     return Promise.resolve('Foo');
 *   }
 * })
 */

'use strict';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export default function Router(CoreIO) {
  let log = require('logtopus').getLogger('coreio');

  class Router {
    constructor(conf) {
      conf = conf || {};

      const server = new CoreIO.Server({
        port: CoreIO.getConf('httpPort'),
        host: CoreIO.getConf('httpHost'),
        noServer: conf.noServer
      });

      this.server = server;
      this.app = server.app;

      if (conf.slug) {
        this.registerRoutes(conf);
      }
    }

    registerRoutes(conf) {
      conf.allow = conf.allow || ['READ'];

      if (conf.model || conf.list) {
        conf = this.createConfig(conf);
      } else {
        conf = [conf];
      }

      for (const c of conf) {
        if (c.slug) {
          for (const method of HTTP_METHODS) {
            if (c[method]) {
              log.sys(`Register route ${method.toUpperCase()} ${c.slug}`);
              this.server.route(method, c.slug, this.requestHandler(c[method]))
            }
          }
        }
      }

      return this;
    }

    registerHTMLPage(slug, view, data) {
      const app = this.app;
      app.get(slug, function(req, res) {
        res.render(view, data);
      });
    }

    createConfig(conf) {
      const newConf = [];

      if (conf.model) {
        const Model = conf.model;
        if (conf.allow.indexOf('READ') !== -1) {
          newConf.push({
            slug: conf.slug.replace(/\/$/, '') + '/:id',
            get(req, res, next) {
              const model = new Model();
              return model.fetch(req.params.id).then(() => {
                return model.get();
              });
            }
          });
        }

        if (conf.allow.indexOf('CREATE') !== -1) {
          newConf.push({
            slug: conf.slug.replace(/\/$/, ''),
            post(req, res, next) {
              const model = new Model();
              model.set(req.body);
              return model.save();
            }
          });
        }

        if (conf.allow.indexOf('UPDATE') !== -1) {
          newConf.push({
            slug: conf.slug.replace(/\/$/, '') + '/:id',
            put(req, res, next) {
              const model = new Model();
              const id = model.get('id');
              model.replace(req.body)
              model.set('id', id);
              return model.save();
            }
          });

          newConf.push({
            slug: conf.slug.replace(/\/$/, '') + '/:id',
            patch(req, res, next) {
              const model = new Model();
              model.set(req.body);
              return model.save();
            }
          });
        }

        if (conf.allow.indexOf('DELETE') !== -1) {
          newConf.push({
            slug: conf.slug.replace(/\/$/, '') + '/:id',
            delete(req, res, next) {
              const model = new Model();
              return model.delete(req.params.id);
            }
          });
        }
      }

      if (conf.list) {
        const List = conf.list;
        if (conf.allow.indexOf('READ') !== -1) {
          newConf.push({
            slug: conf.slug.replace(/\/$/, ''),
            get(req, res, next) {
              const list = new List();
              return list.fetch().then(() => {
                return list.toArray();
              });
            }
          });
        }
      }

      return newConf;
    }

    requestHandler(fn) {
      return (req, res, next) => {
        const p = typeof fn === 'object' ? fn : fn(req, res, next);
        if (!p) {
          if (p === '') {
            res.type('text/plain')
            res.status(204)
            res.end()
          }

          return
        }

        if (typeof p.then === 'function' && typeof p.catch === 'function') {
          p.then((data) => {
            res.status(200);
            typeof data === 'object' && req.accepts('json') ? res.json(data) : data;
          }).catch((err) => {
            res.status(err.statusCode || 500);
            res.send(err.message);
          });
        } else {
          res.status(200)
          typeof p === 'object' && req.accepts('json') ? res.json(p) : p;
        }
      };
    }

    removeRoute(path) {
      let i = 0
      while (true) {
        const layer = this.app._router.stack[i]
        if (!layer) {
          break
        }

        if (layer.path === path) {
          this.app._router.stack.splice(i, 1)
        } else {
          i += 1
        }
      }
    }

    resetRoutes() {
      let i = 0
      while (true) {
        const layer = this.app._router.stack[i]
        if (!layer) {
          break
        }

        if (layer.name === 'bound dispatch') {
          this.app._router.stack.splice(i, 1)
        } else {
          i += 1
        }
      }
    }
  }

  return Router;
}
