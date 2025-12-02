const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

/**
 * Split an atlas image into separate sprites based on transparency.
 * @param {string} imagePath - Path to the input image.
 * @param {string} outputDir - Directory to save the output images.
 * @param {number} gap - Max distance between pixels to consider them connected.
 * @param {function} onProgress - Callback for progress updates.
 */
async function splitAtlas(imagePath, outputDir, gap = 2, onProgress = () => {}) {
    onProgress('Reading image...');
    console.log(`Reading image: ${imagePath}`);
    console.log(`Using gap tolerance: ${gap} pixels`);
    try {
        const image = await Jimp.read(imagePath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const data = image.bitmap.data; // Buffer

        const visited = new Uint8Array(width * height); // 0 = unvisited, 1 = visited
        const components = [];

        // Helper to get index in visited array
        const visitedIdx = (x, y) => y * width + x;

        // Helper to get index in bitmap data
        const idx = (x, y) => (y * width + x) * 4;

        // Check if pixel is opaque (alpha > 0)
        // You can adjust the threshold if needed
        const isOpaque = (x, y) => {
            const i = idx(x, y);
            return data[i + 3] > 0; 
        };

        console.log('Scanning image for components...');
        onProgress('Scanning image...');

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (visited[visitedIdx(x, y)]) continue;

                if (isOpaque(x, y)) {
                    // Found a new component, start BFS
                    const queue = [x, y];
                    visited[visitedIdx(x, y)] = 1;

                    let minX = x, maxX = x, minY = y, maxY = y;
                    let qHead = 0;

                    while(qHead < queue.length) {
                        const cx = queue[qHead++];
                        const cy = queue[qHead++];

                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;

                        // Check neighbors within gap
                        for (let ny = cy - gap; ny <= cy + gap; ny++) {
                            for (let nx = cx - gap; nx <= cx + gap; nx++) {
                                if (nx === cx && ny === cy) continue;
                                
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const vIdx = visitedIdx(nx, ny);
                                    if (visited[vIdx] === 0 && isOpaque(nx, ny)) {
                                        visited[vIdx] = 1;
                                        queue.push(nx, ny);
                                    }
                                }
                            }
                        }
                    }

                    components.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
                }
            }
        }

        console.log(`Found ${components.length} components.`);
        onProgress(`Found ${components.length} components. Saving...`);

        if (!fs.existsSync(outputDir)){
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const baseName = path.basename(imagePath, path.extname(imagePath));

        for (let i = 0; i < components.length; i++) {
            onProgress(`Saving sprite ${i + 1}/${components.length}...`);
            const comp = components[i];
            // Clone the original image to crop
            const sprite = image.clone().crop({ x: comp.x, y: comp.y, w: comp.w, h: comp.h });
            const outPath = path.join(outputDir, `${baseName}_${i + 1}.png`);
            await sprite.write(outPath);
            console.log(`Saved ${outPath} (x:${comp.x}, y:${comp.y}, w:${comp.w}, h:${comp.h})`);
        }
        console.log('Done.');
        onProgress('Done.');

    } catch (err) {
        console.error('Error processing image:');
        try {
            console.error(err.message);
            console.error(err.stack);
        } catch (e) {
            console.error('Could not print error details');
        }
        throw err; // Rethrow to let caller handle it
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log('Usage: node image.js <image_path> [output_dir]');
        process.exit(1);
    }
    const imgPath = args[0];
    const outDir = args[1] || 'output';
    const gap = args[2] ? parseInt(args[2]) : 2;
    splitAtlas(imgPath, outDir, gap);
}

module.exports = splitAtlas;
