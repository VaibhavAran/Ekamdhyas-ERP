import { Router } from 'express';
import multer from 'multer';
import { registerStudentFaceController } from '../controllers/studentFaceController.js';
import { uploadStudentFaces } from '../middlewares/uploadMiddleware.js';

const router = Router();

router.post('/register-student-face', (req, res) => {
  uploadStudentFaces.array('images[]', 10)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({ success: false, error: 'Maximum 10 images allowed' });
        return;
      }
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    if (error instanceof Error) {
      const message = error.message.includes('Invalid file type') ? 'Invalid file type' : error.message;
      res.status(400).json({ success: false, error: message });
      return;
    }

    registerStudentFaceController(req, res);
  });
});

export default router;
