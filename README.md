molecules
=========

Break large streaming archives apart into their component files

### Why another unzip library?

There are several existing zip/unzip libraries out there for JavaScript, including [adm-zip](https://github.com/cthackers/adm-zip), [node-unzip](https://github.com/EvanOxfeld/node-unzip), and [yauzl](https://github.com/thejoshwolfe/yauzl). They are each built with slightly different goals in mind, and these differences can mean a lot in production. Molecules was designed for the following qualities:

- Memory efficient: The parser only holds as much data as it needs to emit the next entry, then forgets it.
- CPU efficient: The parser yields to the event loop at the earliest available opportunity.
- Forgiving: If an unsupported compression method occurs, or if some but not all of the zip file is corrupted, an error will be printed and the parser will simply move on to the next header.
  
In particular, molecules was designed for situations where you need to unzip A LOT of files over a network.

#### Differences between molecules and other libraries

- *adm-zip*: Not streaming.
- *node-unzip*: Doesn't gracefully handle certain files or errors.
- *yauzl*: Not streaming.

### Installation

```
npm install molecules
```

### Usage

```
var Unzip = require('molecules').Unzip;
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

fs.createReadStream('./archive.zip').pipe(Unzip()).on('entry', function(entry, header) {

  if(!header.folder) {
    console.log('Writing ' + header.filename);
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
```

### Not yet implemented

- No CRC32 Checking
- No ZIP64 support


### Credits

This library started out as a fork of alunny's well-intentioned but unfinished [zstream](https://github.com/alunny/zstream) before becoming a complete rewrite. My fork can be found [here](https://github.com/kanatzidis/zstream).
