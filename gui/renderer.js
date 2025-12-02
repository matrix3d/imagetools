const path = require('path');
const { webUtils, ipcRenderer } = require('electron');
const fs = require('fs');
const QRCode = require('qrcode');
const { Jimp } = require('jimp');
// Directly require the image processing module
// Since nodeIntegration is true, we can do this.
const splitAtlas = require('../image.js');

const dropZone = document.getElementById('drop-zone');
const qrDropZone = document.getElementById('qr-drop-zone');
const resizeDropZone = document.getElementById('resize-drop-zone');
const qrResult = document.getElementById('qr-result');
const statusDiv = document.getElementById('status');
const gapInput = document.getElementById('gap');

// QR Controls
const qrText = document.getElementById('qr-text');
const qrBtn = document.getElementById('qr-btn');

// Resize Controls
const resizeScaleInput = document.getElementById('resize-scale');
const resizeWidthInput = document.getElementById('resize-width');
const resizeHeightInput = document.getElementById('resize-height');
const resizePng8Checkbox = document.getElementById('resize-png8');
const resizeOverwriteCheckbox = document.getElementById('resize-overwrite');
const resizeSuffixInput = document.getElementById('resize-suffix');
const resizeModeRadios = document.getElementsByName('resize-mode');

// HSV Controls
const hsvHInput = document.getElementById('hsv-h');
const hsvSInput = document.getElementById('hsv-s');
const hsvVInput = document.getElementById('hsv-v');
const hsvHVal = document.getElementById('hsv-h-val');
const hsvSVal = document.getElementById('hsv-s-val');
const hsvVVal = document.getElementById('hsv-v-val');

// Real-time Preview Controls
const rtDropZone = document.getElementById('rt-drop-zone');
// const rtScaleInput = document.getElementById('rt-scale'); // Removed
const rtPreview = document.getElementById('rt-preview');
const rtImage = document.getElementById('rt-image');

// Update HSV value displays
function syncInputs(rangeInput, numberInput) {
    rangeInput.addEventListener('input', () => {
        numberInput.value = rangeInput.value;
        updatePreviewFilter();
    });
    numberInput.addEventListener('input', () => {
        rangeInput.value = numberInput.value;
        updatePreviewFilter();
    });
}

function updatePreviewFilter() {
    if (rtImage.src) {
        const h = parseInt(hsvHInput.value) || 0;
        const s = parseInt(hsvSInput.value) || 0;
        const v = parseInt(hsvVInput.value) || 0;
        
        // Map to CSS filters
        // Hue: deg
        // Saturation: 100% is base. -100 -> 0%, 100 -> 200%
        // Brightness: 100% is base. -100 -> 0%, 100 -> 200%
        
        const cssS = 100 + s;
        const cssV = 100 + v;
        
        const filterStr = `hue-rotate(${h}deg) saturate(${cssS}%) brightness(${cssV}%)`;
        rtImage.style.filter = filterStr;

        // sync filter to external preview window
        ipcRenderer.send('update-preview-filter', { h, s, v });
    }
}

syncInputs(hsvHInput, hsvHVal);
syncInputs(hsvSInput, hsvSVal);
syncInputs(hsvVInput, hsvVVal);

statusDiv.textContent = 'Ready (Direct Mode)';

// Prevent default drag behaviors globally
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
    dropZone.textContent = 'Drop it!';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    dropZone.innerHTML = 'Drag and drop an image here<br>(Split Atlas)';
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    dropZone.textContent = 'Processing...'+files;
    if (files.length > 0) {
        const file = files[0];
        let filePath = file.path;
        if (!filePath && webUtils) {
            filePath = webUtils.getPathForFile(file);
        }
        dropZone.textContent = 'Processing...'+filePath;
        // Check if it's an image
        if (!file.type.startsWith('image/') && !filePath.endsWith('.png')) {
            statusDiv.textContent = 'Please drop an image file.';
            dropZone.innerHTML = 'Drag and drop an image here<br>(Split Atlas)';
            return;
        }

        statusDiv.textContent = `Processing ${path.basename(filePath)}...`;
        
        const gap = parseInt(gapInput.value) || 2;
        const fileDir = path.dirname(filePath);
        const fileName = path.basename(filePath, path.extname(filePath));
        const outputDir = path.join(fileDir, `${fileName}_sprites`);

        try {
            // Call the function directly
            await splitAtlas(filePath, outputDir, gap, (msg) => {
                statusDiv.textContent = msg;
                // Force UI update if needed, though usually automatic
                console.log(msg);
            });
            
            statusDiv.textContent = `Done! Saved to ${outputDir}`;
            dropZone.textContent = 'Success!';
            setTimeout(() => {
                dropZone.innerHTML = 'Drag and drop an image here<br>(Split Atlas)';
            }, 2000);
        } catch (err) {
            console.error(err);
            statusDiv.textContent = `Error: ${err.message}`;
            dropZone.textContent = 'Error!';
        }
    }
});

// QR Button Click
qrBtn.addEventListener('click', async () => {
    const text = qrText.value;
    if (!text) {
        statusDiv.textContent = 'Please enter text to generate QR.';
        return;
    }
    try {
        const qrImage = await QRCode.toDataURL(text, { width: 400, margin: 1 });
        qrResult.innerHTML = `<img src="${qrImage}" />`;
        statusDiv.textContent = 'QR Code Generated!';
    } catch (err) {
        console.error(err);
        statusDiv.textContent = `Error: ${err.message}`;
    }
});

// QR Drop Zone Event Listeners
qrDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    qrDropZone.classList.add('dragover');
    qrDropZone.textContent = 'Drop it!';
});

qrDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    qrDropZone.classList.remove('dragover');
    qrDropZone.innerHTML = 'Drag and drop a file here<br>(Generate QR)';
});

qrDropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    qrDropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        let filePath = file.path;
        if (!filePath && webUtils) {
            filePath = webUtils.getPathForFile(file);
        }
        
        qrDropZone.textContent = 'Processing...';
        statusDiv.textContent = `Generating QR for ${path.basename(filePath)}...`;

        try {
            // Read file as text
            const text = fs.readFileSync(filePath, 'utf-8');
            qrText.value = text; // Fill the text area
            
            // Generate QR immediately
            const qrImage = await QRCode.toDataURL(text, { width: 400, margin: 1 });
            
            qrResult.innerHTML = `<img src="${qrImage}" />`;
            statusDiv.textContent = 'QR Code Generated from file!';
            qrDropZone.textContent = 'Success!';
             setTimeout(() => {
                qrDropZone.innerHTML = 'Drag and drop a file here<br>(Generate QR)';
            }, 2000);

        } catch (err) {
            console.error(err);
            statusDiv.textContent = `Error: ${err.message}`;
            qrDropZone.textContent = 'Error!';
        }
    }
});

// Resize Drop Zone Event Listeners
resizeDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeDropZone.classList.add('dragover');
    resizeDropZone.textContent = 'Drop it!';
});

resizeDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeDropZone.classList.remove('dragover');
    resizeDropZone.innerHTML = 'Drag & Drop Image<br>(Resize/Convert)';
});

resizeDropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeDropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        resizeDropZone.textContent = 'Processing...';
        let processedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let filePath = file.path;
            if (!filePath && webUtils) {
                filePath = webUtils.getPathForFile(file);
            }

            if (!file.type.startsWith('image/') && !filePath.endsWith('.png') && !filePath.endsWith('.jpg') && !filePath.endsWith('.jpeg')) {
                console.warn(`Skipping non-image file: ${filePath}`);
                continue;
            }

            statusDiv.textContent = `Processing ${i + 1}/${files.length}: ${path.basename(filePath)}...`;

            try {
                const image = await Jimp.read(filePath);
                
                // Apply HSV Adjustments
                const h = parseInt(hsvHInput.value) || 0;
                const s = parseInt(hsvSInput.value) || 0;
                const v = parseInt(hsvVInput.value) || 0;

                if (h !== 0 || s !== 0 || v !== 0) {
                    console.log(`Applying HSV: H=${h}, S=${s}, V=${v}`);
                    // Hue
                    if (h !== 0) {
                        image.color([{ apply: 'hue', params: [h] }]);
                    }
                    // Saturation
                    if (s !== 0) {
                        if (s > 0) {
                            // Jimp saturate takes 0-100 usually
                            image.color([{ apply: 'saturate', params: [s] }]);
                        } else {
                            image.color([{ apply: 'desaturate', params: [Math.abs(s)] }]);
                        }
                    }
                    // Value (Brightness)
                    if (v !== 0) {
                        // Jimp brightness is -1 to 1
                        image.brightness(v / 100.0);
                    }
                }

                // Determine resize mode
                let mode = 'scale';
                for (const radio of resizeModeRadios) {
                    if (radio.checked) {
                        mode = radio.value;
                        break;
                    }
                }

                if (mode === 'scale') {
                    const scale = parseFloat(resizeScaleInput.value) || 1.0;
                    if (scale !== 1.0) {
                        image.scale(scale);
                    }
                } else {
                    const w = parseInt(resizeWidthInput.value);
                    const h = parseInt(resizeHeightInput.value);
                    const resizeOpts = {};
                    if (!isNaN(w)) resizeOpts.w = w;
                    if (!isNaN(h)) resizeOpts.h = h;

                    if (Object.keys(resizeOpts).length > 0) {
                        image.resize(resizeOpts);
                    }
                }

                // Handle PNG8 (Quantization)
                let outputPath;
                if (resizePng8Checkbox.checked) {
                    const { execFile } = require('child_process');
                    const path = require('path');
                    const fs = require('fs');

                    // Find pngquant executable
                    let pngquantPath;
                    if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'app.asar.unpacked'))) {
                        // Production environment
                        pngquantPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'pngquant-bin', 'vendor', 'pngquant.exe');
                    } else {
                        // Development environment
                        try {
                            pngquantPath = require('pngquant-bin');
                        } catch (e) {
                            // Fallback to manual path if require fails
                            pngquantPath = path.join(__dirname, '..', 'node_modules', 'pngquant-bin', 'vendor', 'pngquant.exe');
                        }
                    }

                    console.log('Using pngquant at:', pngquantPath);

                    const pngBuffer = await image.getBuffer('image/png');
                    
                    // Determine output path
                    if (resizeOverwriteCheckbox.checked) {
                        outputPath = filePath;
                    } else {
                        const dir = path.dirname(filePath);
                        const ext = path.extname(filePath);
                        const name = path.basename(filePath, ext);
                        const suffix = resizeSuffixInput.value || '_resized';
                        outputPath = path.join(dir, `${name}${suffix}${ext}`);
                    }

                    // Use execFile to pipe buffer to pngquant
                    await new Promise((resolve, reject) => {
                        const child = execFile(pngquantPath, ['--quality=60-80', '-', '--output', outputPath], {
                            encoding: 'buffer',
                            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                        }, (error, stdout, stderr) => {
                            if (error) {
                                // pngquant returns 98 or 99 for low quality, which is technically an error but might be acceptable.
                                // However, usually we want it to succeed.
                                console.error('pngquant error:', error);
                                console.error('pngquant stderr:', stderr.toString());
                                reject(error);
                            } else {
                                resolve();
                            }
                        });

                        child.stdin.write(pngBuffer);
                        child.stdin.end();
                    });

                } else {
                    // Determine output path
                    if (resizeOverwriteCheckbox.checked) {
                        outputPath = filePath;
                    } else {
                        const dir = path.dirname(filePath);
                        const ext = path.extname(filePath);
                        const name = path.basename(filePath, ext);
                        const suffix = resizeSuffixInput.value || '_resized';
                        outputPath = path.join(dir, `${name}${suffix}${ext}`);
                    }
                    await image.write(outputPath);
                }
                processedCount++;
            } catch (err) {
                console.error(`Error processing ${filePath}:`, err);
                errorCount++;
            }
        }

        statusDiv.textContent = `Done! Processed ${processedCount} files. ${errorCount > 0 ? `(${errorCount} errors)` : ''}`;
        resizeDropZone.textContent = 'Success!';
        setTimeout(() => {
            resizeDropZone.innerHTML = 'Drag & Drop Image<br>(Resize/Convert)';
        }, 2000);
    }
});

// Real-time Preview Drop Zone Event Listeners
rtDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    rtDropZone.classList.add('dragover');
    rtDropZone.textContent = 'Drop it!';
});

rtDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    rtDropZone.classList.remove('dragover');
    rtDropZone.innerHTML = 'Drag & Drop Image<br>(Preview)';
});

rtDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    rtDropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                rtImage.src = e.target.result;
                rtPreview.style.display = 'block';
                rtDropZone.textContent = 'Image Loaded';
                statusDiv.textContent = 'Image loaded for preview. Adjust HSV sliders to see changes.';
                // Apply current filters
                updatePreviewFilter();
                rtImage.style.width = '100%';

                // Also open in separate preview window
                ipcRenderer.send('open-preview-window', { dataUrl: e.target.result });
            };
            reader.readAsDataURL(file);
        } else {
            statusDiv.textContent = 'Please drop an image file.';
        }
    }
});

// rtScaleInput removed
/*
rtScaleInput.addEventListener('input', (e) => {
    const val = e.target.value;
    rtImage.style.width = `${val}%`;
    statusDiv.textContent = `Scale: ${val}%`;
});
*/
