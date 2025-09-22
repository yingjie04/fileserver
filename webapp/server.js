const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// パスワード保存用ファイル
const PASSWORDS_FILE = path.join(__dirname, 'file_passwords.json');

// パスワード情報を読み書きする関数
function loadPasswords() {
  if (!fs.existsSync(PASSWORDS_FILE)) return {};
  return JSON.parse(fs.readFileSync(PASSWORDS_FILE, 'utf8'));
}
function savePasswords(obj) {
  fs.writeFileSync(PASSWORDS_FILE, JSON.stringify(obj, null, 2));
}

// Multer設定
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// ファイル一覧取得
function getFileList() {
  const dir = path.join(__dirname, 'public/uploads');
  if (!fs.existsSync(dir)) return [];
  const passwords = loadPasswords();
  return fs.readdirSync(dir).map(filename => {
    const filePath = path.join(dir, filename);
    let mime = 'application/octet-stream';
    try {
      const ext = path.extname(filename).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) {
        mime = `image/${ext.replace('.', '') === 'jpg' ? 'jpeg' : ext.replace('.', '')}`;
      } else if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
        mime = 'text/plain';
        if (ext === '.md') mime = 'text/markdown';
        if (ext === '.csv') mime = 'text/csv';
        if (ext === '.json') mime = 'application/json';
      }
    } catch {}
    return {
      name: filename,
      url: '/uploads/' + filename,
      mime,
      hasPassword: !!passwords[filename]
    };
  });
}

// トップページ
app.get('/', (req, res) => {
  const files = getFileList();
  res.render('index', { files });
});

// プレビュー用エンドポイント
app.get('/preview/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'public/uploads', filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) {
    res.sendFile(filePath);
  } else if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
    res.type('text/plain');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(415).send('プレビュー非対応ファイル');
  }
});

// ファイルアップロード（パスワード付き）
app.post('/upload', upload.single('file'), (req, res) => {
  const password = req.body.password || '';
  if (req.file && password) {
    const passwords = loadPasswords();
    passwords[req.file.filename] = password;
    savePasswords(passwords);
  }
  res.redirect('/');
});

// ファイル削除
app.post('/delete/:filename', (req, res) => {
  const filename = req.params.filename;
  const password = req.body.password || '';
  const passwords = loadPasswords();
  const filePath = path.join(__dirname, 'public/uploads', filename);

  // パスワードが設定されていない場合はパスワード不要で削除
  if (!passwords[filename]) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    delete passwords[filename];
    savePasswords(passwords);
    return res.redirect('/');
  }

  // パスワードが設定されている場合は認証
  if (passwords[filename] !== password) {
    // クエリパラメータでエラーを通知
    return res.redirect('/?error=wrong_password');
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  delete passwords[filename];
  savePasswords(passwords);
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});