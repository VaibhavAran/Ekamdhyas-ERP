import { Router } from 'express';
import multer from 'multer';
import { recognizeAttendanceController } from '../controllers/attendanceRecognitionController.js';
import { uploadAttendanceCapture } from '../middlewares/uploadMiddleware.js';

const router = Router();

router.post('/recognize-attendance', (req, res) => {
  uploadAttendanceCapture.single('captured_image')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    if (error instanceof Error) {
      const message = error.message.includes('Invalid file type') ? 'Invalid file type' : error.message;
      res.status(400).json({ success: false, error: message });
      return;
    }

    recognizeAttendanceController(req, res);
  });
});

export default router;