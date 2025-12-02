const { ipcRenderer } = require('electron');

const img = document.getElementById('preview-img');

ipcRenderer.on('set-image', (_event, dataUrl) => {
    img.src = dataUrl;
});

ipcRenderer.on('set-filter', (_event, { h, s, v }) => {
    const cssS = 100 + (parseInt(s) || 0);
    const cssV = 100 + (parseInt(v) || 0);
    const hVal = parseInt(h) || 0;
    img.style.filter = `hue-rotate(${hVal}deg) saturate(${cssS}%) brightness(${cssV}%)`;
});
