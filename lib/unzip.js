var Writable = require('readable-stream').Writable;
var util = require('util');
var BufferList = require('bl');
var async = require('async');
var _ = require('underscore');

var C = require('./constants');

var badzip = new Error('Bad zip file, expected header init PK');

function Unzip(opts) {


  this._buffer = new Buffer([]);

  this._sig = null;
  this._waiting = false;
  this._header = null;
  this._entry = null;
  this._rawHeader = null;
  this._waitsize = 0;
  this._info = null;

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
    case 0x0874b50:
      return 'data';
    case 0x02014b50:
      return 'cd';
    case 0x06054b50:
      return 'end';
    default:
      return null;
  }
}

Unzip.prototype._write = function(data, enc, cb) {
  if(!data) {
    return;
  }
  this.buffer(data);
  var buf = this._buffer,
      len = buf.length,
      sig = this._sig,
      head = this._header,
      rhead = this._rawHeader,
      info = this._info;

  // TODO: I bet all these return statements can be consolidated into one if statement at the end.
  //
  //       Reorder the ifs so we don't do any redundant checks.
  //
  //       Delete the header after parsing it so that we don't need to use the dataOffset

  if(buf[0] === C.P && buf[1] === C.K) {
    switch(this._state) {
      case 0:
        if(len >= 4) {
          sig = this._sig = buf.readUInt32LE(0);
          if(sig && toName(sig)) {
            if(C.headers[toName(sig)]) {
              info = this._info = C.headers[toName(sig)];
              this._state = info.state;
            } else {
              this._buffer = buf.slice(1);
              break;
            }
          } else {
            this._buffer = buf.slice(1);
            break;
          }
        } else {
          break;
        }
      case 1:
        if(len >= info.min) {
          head = this._header = this.parseHeader();
          if(head) {
            this._state = info.next;
          } else {
            break;
          }
        }
      case 2:
        if(len >= head.compressedSize) {
          this._entry = new BufferList();
          this.emitEntry(buf.slice(head.length, head.eof));
          this._buffer = buf.slice(head.eof);
          this._state = 0;
        }
        break;
    }
  } else {
    this._buffer = buf.slice(1);
  }
  /*if(this._sig) {
    var maybe;
    if(maybe) {
      return true;
    } else {
      this._rawHeader = parseHeader();
      this._header = {
       filename = this._header.filename,
       filesize = this._header.uncompressedSize,
       path = this._header.path,
       checksum = this._header.cksum
      };
      this._waitsize = this._rawHeader.dataOffset+this._header.filesize;
      this._entry = new BufferList();
      if(buf.length >= this._waitsize) {
        emitEntry();
        return true;
      } else {
        this._waiting = true;
        return true;
      }
    }

  }
  if(this._waiting && buf.length < this._waitsize) {
    return true;
  } else if(this._waiting) {
    emitEntry();
    return true;
  }
  // If we got here something's wrong.
  throw "oops";
  */

  cb();

};

Unzip.prototype.parseHeader = function() {
  var head = this._info.head,
      buf = this._buffer,
      min = this._info.min,
      vals = {};

  var values = _.map(Object.keys(head), function(key) {
    var action = head[key];
    var ret = [key, buf[action[0]](action.slice(1)[0])];
    if(key === 'extraFieldLength' || key === 'fileNameLength' ||
      key === 'compressedSize') {
      vals[key] = ret[1];
    }
    return ret;
  });
  vals.length = min + vals.fileNameLength + vals.extraFieldLength
  if(buf.length >= vals.length) {
    values.push(['filename', buf.slice(min, min+= vals.fileNameLength).toString()]);
    values.push(['extraField', buf.slice(min, min+= vals.extraFieldLength)]);
    values.push(['length', min]);
    values.push(['eof', min+vals.compressedSize]);
    return _.object(values);
  } else {
    return null;
  }
};

Unzip.prototype.emitEntry = function(entry) {
  this._entry.end(entry);
  this.emit('entry', this._entry, this._header);
  this._entry = null;
  this._header = null;
  this._state = 0;
  //this._rawHeader = null;
  this._sig = null;
  //this._waitsize = 0;
  this._waiting = false;
};
