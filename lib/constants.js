var r16 = 'readUInt16LE';
var r32 = 'readUInt32LE';

var C = {
  P: 0x50, K: 0x4b,
  WAITING_FOR_SIG: 0,
  WAITING_FOR_LOCAL_FILE_HEADER: 1,
  WAITING_FOR_ENTRY: 2,
  WAITING_FOR_DATA_DESCRIPTOR: 3,
  WAITING_FOR_GODOT: 4
};

C.headers = {
  file: {
          state: C.WAITING_FOR_LOCAL_FILE_HEADER,
          next: function(generalPurposeBigFlag) {
            if(generalPurposeBigFlag === 8) return C.WAITING_FOR_SIG;
            else if(generalPurposeBigFlag === 0) return C.WAITING_FOR_ENTRY;
            else throw new Error('Unsupported zip file');
          },
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
          state: C.WAITING_FOR_DATA_DESCRIPTOR,
          next: C.WAITING_FOR_SIG,
          min: 16,
          head: {
            crc32: [r32, 4],
            compressedSize: [r32, 8],
            uncompressedSize: [r32, 12]
          }
        },
  cd: {
        state: C.WAITING_FOR_GODOT,
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
           diskNumber         : [r16, 4],
           cdStartDisk        : [r16, 6],
           CDRecordsOnDisk    : [r16, 8],
           totalCDRecord      : [r16, 10],
           CDSize             : [r32, 12],
           CDOffset           : [r32, 16],
           commentLength      : [r16, 20]
         }
       }
};

C.toName = function (sig) {
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
};

module.exports = C;
