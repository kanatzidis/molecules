var r16 = 'readUInt16LE';
var r32 = 'readUInt32LE';

module.exports = {
    P: 0x50, K: 0x4b,
    headers: {
      file: {
              state: 1,
              next: 2,
              min: 30,
              head: {
                versionNeededToExtract: [r16, 4],
                generalPurposeBitFlag: [r16, 6],
                compressionMethod: [r16, 8],
                lastModificationTime: [r16, 10],
                lastModificationDate: [r16, 12],
                crc32: [r32, 14],
                compressedSize: [r32, 18],
                uncompressedSize: [r32, 22],
                fileNameLength: [r16, 26],
                extraFieldLength: [r16, 28]
              }
            },
      data: {
              state: 2,
              next: 0,
              min: 16,
              head: {
                crc32: [r32, 4],
                compressedSize: [r32, 8],
                uncompressedSize: [r32, 12]
              }
            },
      cd: {
            state: 3,
            next: 4,
            min: 46,
            head: {
                versionNeededToExtract: [r16, 6],
                generalPurposeBitFlag: [r16, 8],
                compressionMethod: [r16, 10],
                lastModificationTime: [r16, 12],
                lastModificationDate: [r16, 14],
                crc32: [r32, 18],
                compressedSize: [r32, 22],
                uncompressedSize: [r32, 26],
                fileNameLength: [r16, 30],
                extraFieldLength: [r16, 32],
                fileCommentLength: [r16, 34],
                fileStartDiskNumber: [r16, 36],
                internalFileAttr: [r32, 38],
                externalFileAttr: [r32, 42]
            }
          },
      end: {
             state: 4,
             min: 22,
             head: {
               //this.diskNumber         = buf.readUInt16LE(this._offset += 4);
               //this.cdStartDisk        = buf.readUInt16LE(this._offset += 2);
               //this.CDRecordsOnDisk    = buf.readUInt16LE(this._offset += 2);
               //this.totalCDRecord      = buf.readUInt16LE(this._offset += 2);
               //this.CDSize             = buf.readUInt32LE(this._offset += 2);
               //this.CDOffset           = buf.readUInt32LE(this._offset += 4);
               //this.commentLength      = buf.readUInt16LE(this._offset += 4);
             }
           }
    }
};
