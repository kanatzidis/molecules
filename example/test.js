var Unzip = require('../index').Unzip;
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

fs.createReadStream('./archive.zip').pipe(Unzip()).on('entry', function(entry, header) {

  if(!header.folder) {
    console.log('Writing ' + path.dirname(header.filename));
    mkdirp(path.dirname(header.filename), function(err) {
      if(err) throw err;
      entry.pipe(fs.createWriteStream(header.filename)).on('finish', function() {

        console.log('Finished writing ' + header.filename);

      });
    });
  }

}).on('finish', function() {
  console.log('Extraction complete.');
});

