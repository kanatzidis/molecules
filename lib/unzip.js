var Writable = require('readable-stream').Writable;
var util = require('util');
var BufferList = require('bl');
var _ = require('underscore');
var zlib = require('zlib');

var C = require('./constants'),
    toName = C.toName;

function Unzip(opts) {

  if(!(this instanceof Unzip)) {
    return new Unzip(opts);
  }

  this._buffer = new Buffer([]);

  this._sig = null;
  this._header = null;
  this._entry = null;
  this._info = null;
  this._waitingForFileData = false;

  this._state = C.WAITING_FOR_SIG;

  Writable.call(this);
}
module.exports = Unzip;

util.inherits(Unzip, Writable);

Unzip.prototype.buffer = function(data) {
  this._buffer = Buffer.concat([this._buffer, data]);
}

Unzip.prototype.parse = function() {
  var buf = this._buffer,
      len = buf.length,
      sig = this._sig,
      head = this._header,
      info = this._info,
      self = this;


  // This is ugly but efficient; worth maybe seeking a compromise.
  //
  // If we don't have enough information to process the data, we
  // break right away to yield to additional I/O.


  // If we're waiting for a data descriptor (gBPF=8)
  if(this._waitingForFileData) {
    var i = 0;
    while(buf[i] !== C.P || buf[i+1] !== C.K) {
      i++;
    }
    buf = buf.slice(i);
  }

  // Main state machine
  //
  // At the moment this handles one state before breaking to yield to the event loop.
  // It could probably be made more efficient by turning this into a series of
  // if statements and letting it handle states sequentially where appropriate.
  if(buf[0] === C.P && buf[1] === C.K) {
    //console.log(self._state);
    switch(self._state) {
      case C.WAITING_FOR_SIG:
        if(len >= 4) {
          sig = self._sig = buf.readUInt32LE(0);
          if(sig && toName(sig)) {
            if(C.headers[toName(sig)]) {
              //console.log(toName(sig));
              info = self._info = C.headers[toName(sig)];
              self._state = info.state;
              break;
            } else {
              console.error('Unsupported zip signature');
              self._buffer = buf.slice(1);
              break;
            }
          } else {
            if(!self._waitingForFileData) self._buffer = buf.slice(1);
            break;
          }
        } else {
          break;
        }
      case C.WAITING_FOR_LOCAL_FILE_HEADER:
        if(len >= info.min) {
          head = self._header = self.parseHeader(i);
          if(head) {
            self._state = info.next(head.generalPurposeBitFlag);
            if(self._state === C.WAITING_FOR_SIG) {
              self._waitingForFileData = true;
              break;
            }
          } else {
            break;
          }
        }
      case C.WAITING_FOR_ENTRY:
        if(len >= head.compressedSize) {
          // NOTE: informal tests indicate it's more performant to create the entry before
          // calling emitEntry as opposed to creating it within the emitEntry function.
          // Merits further investigation.
          self._entry = new BufferList();
          self.emitEntry(buf.slice(head.length, head.eof));
          self._buffer = buf.slice(head.eof);
          self._state = C.WAITING_FOR_SIG;
        }
        break;
      case C.WAITING_FOR_DATA_DESCRIPTOR:
        if(!self._waitingForFileData) break;
        if(len >= info.min) {
          head = self._header = _.extend(self._header, self.parseHeader(i));

          self._entry = new BufferList();
          self.emitEntry(self._buffer.slice(i, head.compressedSize));
          self._buffer = self._buffer.slice(i+ info.min);
          self._state = info.next;

          self._waitingForFileData = false;
          break;
        } else {
          break;
        }
        break;
      case C.WAITING_FOR_GODOT:
        self._buffer = buf.slice(info.min);
        self._state = 0;
        //console.log(self._buffer.length);

    }
  } else {
    if(self._waitingForFileData) {/*ignore++;*/}
    else {
      var i = 0;
      while(buf[i] !== C.P || buf[i+1] !== C.K) {
        i++;
      }
      self._buffer = buf.slice(i);
    }
  }

};

Unzip.prototype._write = function(data, enc, cb) {
  if(!data) {
    cb();
    return;
  }
  this.buffer(data);

  this.parse();

  cb();

};

Unzip.prototype.parseHeader = function(offset) {
  // Attempt to create header object. If the whole
  // header isn't available in the buffer returns null.
  //
  // It currently handles both local file headers and data
  // descriptors in a kind of hacky way.

  var head = this._info.head,
      buf = this._buffer.slice(offset),
      min = this._info.min,
      vals = {},
      file_header = this._state === C.WAITING_FOR_LOCAL_FILE_HEADER;

  var values = _.map(Object.keys(head), function(key) {
    var action = head[key];
    var ret = [key, buf[action[0]](action[1])];

    if(file_header &&
      (key === 'extraFieldLength' || key === 'fileNameLength' ||
      key === 'compressedSize')) {
      vals[key] = ret[1];
    }

    return ret;
  });

  vals.length = min + (file_header?(vals.fileNameLength + vals.extraFieldLength):0);
  if(buf.length >= vals.length) {

    values.push(['length', min]);

    if(file_header) {
      values.push(['filename', buf.slice(min, min+= vals.fileNameLength).toString()]);
      values.push(['extraField', buf.slice(min, min+= vals.extraFieldLength)]);
      values.push(['eof', min+vals.compressedSize]);
    }

    return _.object(values);

  } else {
    return null;
  }
};

Unzip.prototype.emitEntry = function(entry) {
  this._entry.end(entry);
  var fname = this._header.filename;

  // Should this param get set in parseHeader instead?
  // Probably makes sense to.
  if(fname[fname.length-1] === '/') {
    this._header.folder = true;
  }

  var candidate;
  if(this._header.compressionMethod !== 0) {
    // This should check that the compression method is DEFLATE in particular. This will break on other compression methods.
    candidate = this._entry.pipe(zlib.createInflateRaw()).on('error', function(err) { console.error(fname + ' error'); throw err; });
  } else {
    // Not compressed, the buffer is the data.
    candidate = this._entry;
  }

  this.emit('entry', candidate, this._header);

  this._entry = null;
  this._header = null;
  this._sig = null;
};

Unzip.prototype.end = function(data) {
  if(data) {
    this.write(data);
  }

  //Process data left over in buffer before finishing.
  var self = this;
  setImmediate(function wrapUp() {
    if(self._buffer.length > 0) {
      self.parse();
      setImmediate(wrapUp);
    } else {
      self.emit('finish');
    }
  });
};
