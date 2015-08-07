import Promise from 'bluebird'
import p from 'path'
import yaml from 'yamljs'
import {noDotFiles, extend, removeDirectoryContent, handleSystemError} from '../lib/utils.js'
import {User} from '../lib/users.js'
import {tree} from '../lib/tree.js'
import {trashSize, prepareTree} from '../middlewares'
import HTTPError from '../lib/HTTPError.js'

let fs = Promise.promisifyAll(require('fs'))
let debug = require('debug')('explorer:routes:admin')

function validUser(req, res, next) {
  try {
    new User(req.body, false) 
  } catch(e) {
    return next(new HTTPError('User is not valid', 400))
  }

  return next()
}

function isAdmin(config) {
  return function(req, res, next) {
    if(!req.user.admin)
      return next(new HTTPError('Forbidden', 403))

    res.locals.config = config
    res.locals.ymlConfig = yaml.stringify(config, 2, 4) 

    return next()
  }
}

/**
 * @apiDefine UserSchema
 * @apiParam (Admin) {string} username
 * @apiParam (User) {string} password
 * @apiParam (Admin) {string} home 
 * @apiParam (User) {string} key '1' to re-generate
 * @apiParam (Admin) {boolean} admin 
 * @apiParam (Admin) {boolean} readonly 
 * @apiParam (Admin) {array} ignore
 * @apiParam (User) {string} trash
 * @apiParam (User) {string} archive
 * @apiParam (User) {string} upload
 */
let Admin = function(app) {
  let admin = require('express').Router()
  let config = app.get('config')

  admin.use(isAdmin(config))

  admin.get('/', trashSize(config), prepareTree(config), function(req, res) {
    return res.renderBody('admin', {
      users: req.users.users
    })
  })

  admin.get('/create', function(req, res) {
    return res.renderBody('admin/user/create.haml')
  })

  admin.get('/update/:username', function(req, res, next) {
    let u = req.users.get(req.params.username)

    if(!u) {
      return next(new HTTPError('User not found', 404))
    }

    return res.renderBody('admin/user/update.haml', {user: u})
  })

  /**
   * @api {post} /a/trash Empty global trash
   * @apiName emptyTrash
   * @apiGroup Admin
   */
  admin.post('/trash', function(req, res, next) {

    debug('Empty trash %s', config.remove.path)

    removeDirectoryContent(config.remove.path)
    .then(function() {
      return res.handle('back')
    })
    .catch(handleSystemError(next))
  })

  /**
   * @api {get} /a/delete/:username Delete user
   * @apiName deleteUser
   * @apiGroup Admin
   * @apiParam {String} username
   */
  admin.get('/delete/:username', function(req, res, next) {
    if(req.user.username == req.params.username) {
      return next(new HTTPError("You can't delete yourself", 400))
    }

    req.users.delete(req.params.username)
    .then(function() {
      req.flash('info', `User ${req.params.username} deleted`)
      return res.handle('/a') 
    })
    .catch(handleSystemError(next))
  })

  /**
   * @api {post} /a/users Create user
   * @apiName createUser
   * @apiGroup Admin
   * @apiUse UserSchema
   */
  admin.post('/users', validUser, function(req, res, next) {

    if(req.users.get(req.body.username)) {
      return next(new HTTPError('User already exists', 400))
    }

    return new User(req.body) 
    .then(function(user) {
      return user.generateKey()
    })
    .then(function(user) {
      return req.users.put(user)
      .then(function() {
        req.flash('info', `User ${user.username} created`)
        return res.handle('/a', {user: user}, 201)
      })
    })
    .catch(handleSystemError(next))
  })

  /**
   * @api {put} /a/users Update user
   * @apiName updateUser
   * @apiGroup Admin
   * @apiUse UserSchema
   */
  admin.put('/users', function(req, res, next) {
    let u = req.users.get(req.body.username)

    if(!(u instanceof User)) {
      return next(new HTTPError('User not found', 404))
    }
    
    u.update(req.body)
    .then(function(user) {
      return req.users.put(user)
      .then(function() {
        req.flash('info', `User ${user.username} updated`)
        return res.handle('/a')
      })
    })
    .catch(handleSystemError(next))
  })

  app.use('/a', admin)
}

export {Admin}
