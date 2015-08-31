import archiver from 'archiver'
import http from 'http'
import fs from 'fs'
import p from 'path'
import prettyBytes from 'pretty-bytes'
import Stat from '../job/stat.js'

let debug = require('debug')('explorer:job:archive')

let stat = new Stat('archive')

function ArchiveJob(ipc = null) {
  if(!(this instanceof Archive)) { return new Archive(ipc) }
  this.ipc = ipc
}

/**
 * Creates an archive
 * @see routes/tree.js
 * data : {
 *   name, temp, directories, paths, root, stream (string|http.ServerResponse), options (req.options)
 * }
 */
ArchiveJob.prototype.create = function(data, user, config) {
  let archive = archiver('zip') 
  let self = this

  archive.on('error', function(err) {
    archive.abort()
    if(!(data.stream instanceof http.ServerResponse)) {
      self.ipc.send('archive.error', err.stack)
      return stat.add(user.username, {error: err.message})
    } else {
      return data.stream.status(500).send(err);
    }
  })

  //on stream closed we can end the request
  archive.on('end', function() {
    let b = archive.pointer()

    debug('Archive wrote %d bytes', b)

    if(!(data.stream instanceof http.ServerResponse)) {
      self.ipc.send('archive.create', user.username, data)
      return stat.add(user.username, {message: `${prettyBytes(b)} written in ${data.temp}`, path: p.dirname(data.temp), name: data.name})
    }
  })

  if(data.stream instanceof http.ServerResponse) {
    //set the archive name
    data.stream.attachment(`${data.name}.zip`)
  } else if(typeof data.stream == 'string') {

    data.stream = fs.createWriteStream(data.stream) 
    stat.add(user.username, {message: `Compressing data from ${data.root} to ${data.temp}`, name: data.name})
  }

  archive.pipe(data.stream)

  for(let i in data.paths) {
    archive.append(fs.createReadStream(data.paths[i]), {name: p.basename(data.paths[i])}) 
  }

  for(let i in data.directories) {
    archive.directory(data.directories[i], data.directories[i].replace(data.root, ''))
  }

  archive.finalize()
}

export default ArchiveJob
