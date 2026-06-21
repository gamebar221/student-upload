const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Root folder where all student folders will be created
const UPLOAD_ROOT = path.join(__dirname, 'student_data');

// Make sure the root upload folder exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// --- Helper: sanitize name/roll so it's safe to use as a folder name ---
function sanitize(input) {
  return input
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '') // remove characters illegal in folder names
    .replace(/\s+/g, '_');           // spaces -> underscore
}

// --- Multer storage config: decides WHERE and with WHAT NAME to save each file ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const name = sanitize(req.body.studentName || 'unknown');
    const roll = sanitize(req.body.rollNo || 'unknown');
    const folderName = `${name}_${roll}`;
    const studentFolder = path.join(UPLOAD_ROOT, folderName);

    if (!fs.existsSync(studentFolder)) {
      fs.mkdirSync(studentFolder, { recursive: true });
    }

    cb(null, studentFolder);
  },
  filename: function (req, file, cb) {
    // Add a timestamp prefix so re-submissions ADD files instead of overwriting
    const timestamp = Date.now();
    const safeOriginalName = sanitize(path.parse(file.originalname).name);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}_${safeOriginalName}${ext}`);
  }
});

// 50MB per-file safety cap (accidental huge files won't choke the system)
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- Serve the upload form ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Handle the upload ---
app.post('/upload', upload.array('files'), (req, res) => {
  const name = req.body.studentName;
  const roll = req.body.rollNo;
  const fileCount = req.files ? req.files.length : 0;

  if (!name || !roll || fileCount === 0) {
    return res.status(400).send(`
      <h2 style="font-family:sans-serif;color:red;">Error: Name, Roll No, and at least one file are required.</h2>
      <a href="/">Go back</a>
    `);
  }

  res.send(`
    <html>
    <head><title>Upload Successful</title></head>
    <body style="font-family:sans-serif;text-align:center;margin-top:50px;">
      <h2 style="color:green;">✅ Upload Successful!</h2>
      <p><b>${fileCount}</b> file(s) uploaded for <b>${name} (${roll})</b>.</p>
      <a href="/" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:5px;">Upload More / Next Student</a>
    </body>
    </html>
  `);
});

// Handle file-too-large errors gracefully
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).send(`
      <h2 style="font-family:sans-serif;color:red;">Error: One of your files is larger than 50MB. Please compress it and try again.</h2>
      <a href="/">Go back</a>
    `);
  }
  next(err);
});

// --- View uploaded files in browser (no shell access needed) ---
app.get('/files', (req, res) => {
  let html = '<h2 style="font-family:sans-serif;">Uploaded Student Data</h2>';

  if (!fs.existsSync(UPLOAD_ROOT)) {
    html += '<p>No uploads yet.</p>';
    return res.send(html);
  }

  const studentFolders = fs.readdirSync(UPLOAD_ROOT);

  if (studentFolders.length === 0) {
    html += '<p>No uploads yet.</p>';
  } else {
    studentFolders.forEach(folder => {
      const folderPath = path.join(UPLOAD_ROOT, folder);
      const files = fs.readdirSync(folderPath);
      html += `<h3 style="font-family:sans-serif;">${folder} (${files.length} files)</h3><ul style="font-family:sans-serif;">`;
      files.forEach(f => {
        html += `<li>${f}</li>`;
      });
      html += '</ul>';
    });
  }

  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running! Students can access it at:`);
  console.log(`  http://<tumhare-PC-ka-IP>:${PORT}`);
  console.log(`Files will be saved inside: ${UPLOAD_ROOT}`);
});
