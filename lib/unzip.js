var Writable = require('readable-stream').Writable;
var util = require('util');
var BufferList = require('bl');
var async = require('async');
var _ = require('underscore');
var zlib = require('zlib');

var C = require('./constants');

var badzip = new Error('Bad zip file, expected header init PK');

function Unzip(opts) {


  this._buffer = new Buffer([]);

  this._sig = null;
  this._header = null;
  this._entry = null;
  this._rawHeader = null;
  this._info = null;
  this._waitingForFileData = false;

  this._state = 0; /*0: Waiting for sig, 1: Waiting for min head,
                     2. Waiting for full head, 3. Waiting for data.
                   */
  Writable.call(this);
}
module.exports = Unzip;

util.inherits(Unzip, Writable);

Unzip.prototype.buffer = function(data) {
  this._buffer = Buffer.concat([this._buffer, data]);
}

function toName(sig) {
  switch(sig) {
    case 0x04034b50:
      return 'file';
    case 0x08074b50:
      return 'data';
    case 0x02014b50:
      return 'cd';
    case 0x06054b50:
      return 'end';
    default:
      return null;
  }
}

  var ignore = 0;

Unzip.prototype.parse = function() {
  console.log(ignore);
  var buf = (this._waitingForFileData?this._buffer.slice(ignore):this._buffer),
      len = buf.length,
      sig = this._sig,
      head = this._header,
      rhead = this._rawHeader,
      info = this._info,
      self = this;


  // This is ugly but efficient; worth maybe seeking a compromise.
  //
  // If we don't have enough information to "forget" the data, we
  // break right away to yield to additional I/O.
  if(buf[0] === C.P && buf[1] === C.K) {
      console.log('state '+self._state);
    switch(self._state) {
      case C.WAITING_FOR_SIG:
        if(len >= 4) {
          sig = self._sig = buf.readUInt32LE(0);
          if(sig && toName(sig)) {
            console.log(toName(sig))
            if(C.headers[toName(sig)]) {
              info = self._info = C.headers[toName(sig)];
              self._state = info.state;
            } else {
              console.error('Unsupported zip signature');
              self._buffer = buf.slice(1);
              break;
            }
          } else {
            if(!self._waitingForFileData) self._buffer = buf.slice(1);
            else {
              console.log('fuck');
              ignore++;
            }
            break;
          }
        } else {
          break;
        }
      case C.WAITING_FOR_LOCAL_FILE_HEADER:
        if(len >= info.min) {
          head = self._header = self.parseHeader();
          if(head) {
            console.log(info.next);
            self._state = info.next(head.generalPurposeBitFlag);
            if(self._state === C.WAITING_FOR_SIG) {
              self._waitingForFileData = true;
              ignore++;
              break;
            }
          } else {
            break;
          }
        }
      case C.WAITING_FOR_ENTRY:
        if(len >= head.compressedSize) {
          self._entry = new BufferList();
          self.emitEntry(buf.slice(head.length, head.eof));
          self._buffer = buf.slice(head.eof);
          self._state = C.WAITING_FOR_SIG;
        }
      case C.WAITING_FOR_DATA_DESCRIPTOR:
        if(!self._waitingForFileData) break;
        if(len >= info.min) {
          head = self._header = _.extend(self._header, self.parseHeader());
          console.log(JSON.stringify(head, null, 2));

          self._entry = new BufferList();
          self.emitEntry(self._buffer.slice(head.length , head.compressedSize));
          self._buffer = self._buffer.slice(head.length + head.compressedSize + info.min);
          self._state = info.next;
          ignore = 0;

          self._waitingForFileData = false;
        } else {
          break;
        }
      case C.WAITING_FOR_GODOT:
        self._buffer = buf.slice(buf.length);

    }
  } else {
    // this isn't necessarily the best way to deal with this;
    // this should usually be an edge case.
    if(self._waitingForFileData) ignore++;
    else self._buffer = buf.slice(1);
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

Unzip.prototype.parseHeader = function() {

  // TODO: change this to switch(this._state) and call a corresponding function
  var head = this._info.head,
      buf = this._buffer,
      min = this._info.min,
      vals = {},
      file_header = this._state === C.WAITING_FOR_LOCAL_FILE_HEADER;

  var values = _.map(Object.keys(head), function(key) {
    var action = head[key];
    var ret = [key, buf[action[0]](action.slice(1)[0])];
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
    var ret = _.object(values);
    return ret;
  } else {
    return null;
  }
};

Unzip.prototype.emitEntry = function(entry) {
  console.log(JSON.stringify(this._header));
  this._entry.end(entry);
  var fname = this._header.filename;
  if(this._header.compressionMethod !== 0) {
    var candidate = this._entry.pipe(zlib.createInflateRaw()).on('error', function(err) { console.error(fname + ' error'); throw err; });
  } else {
    var candidate = this._entry;
  }
  this.emit('entry', candidate, this._header);

  this._entry = null;
  this._header = null;
  //this._info = null;
  this._sig = null;
};

Unzip.prototype.end = function(data) {
  if(data) {
    this.write(data);
  }
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
