const multer = require('multer');
const path = require('path');

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads'); // Directory to save uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Custom filename
  }
});

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png/;
    const isValidExtension = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const isValidMimeType = allowedTypes.test(file.mimetype);

    if (isValidExtension && isValidMimeType) {
      return cb(null, true);
    } else {
      return cb(new Error('Error: Images Only!'));
    }
  }
});


module.exports = upload;
