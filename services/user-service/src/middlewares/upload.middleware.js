import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads/ directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);  // Stored as /app/uploads/ inside Docker
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);  // e.g., .pdf
    const uniqueName = `cv_${req.params.userId}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({ storage });
