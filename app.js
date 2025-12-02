const express = require('express');
const QRCode = require('qrcode');
const multer = require('multer');
const JSZip = require('jszip');

const app = express();
const PORT = 3000;

const upload = multer();

app.get('/', (req, res) => {
  res.send(`
    <h2>上传文件生成二维码（自动压缩）</h2>
    <form method="POST" enctype="multipart/form-data" action="/upload">
      <input type="file" name="file" />
      <button type="submit">生成二维码</button>
    </form>
    <p>注意：二维码容量有限，仅支持小文件。</p>
  `);
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.send('请上传文件');
    }
    // 压缩文件为zip
    const zip = new JSZip();
    zip.file(req.file.originalname, req.file.buffer);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    // 检查压缩后大小
    //if (zipBuffer.length > 2500) {
    //  return res.send('压缩后文件仍超出二维码容量限制，请上传更小的文件。');
    //}
    const zipBase64 = zipBuffer.toString('latin1');
    const qrImage = await QRCode.toDataURL(zipBase64);
    res.send(`
      <h2>压缩后文件二维码</h2>
      <img src="${qrImage}" />
      <br><a href="/">返回</a>
      <p>二维码内容为zip文件的base64编码。</p>
    `);
  } catch (err) {
    res.status(500).send('生成二维码失败: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`二维码展示页面: http://localhost:${PORT}`);
});
