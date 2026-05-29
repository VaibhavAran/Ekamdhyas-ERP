import multer from 'multer';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png']);

const storage = multer.memoryStorage();
const attendanceCaptureStorage = multer.memoryStorage();

export const uploadStudentFaces = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Invalid file type'));
      return;
    }
    callback(null, true);
  },
});

export const uploadAttendanceCapture = multer({
  storage: attendanceCaptureStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Invalid file type'));
      return;
    }
    callback(null, true);
  },
});
