import fs from 'fs';
import path from 'path';

const framesDir = path.resolve('./frames');
const imagesDir = path.resolve('./images');

function cleanupFolder(folderPath, folderName) {
    if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
        console.log(`Deleted all contents of the ${folderName} folder.`);
    } else {
        console.log(`${folderName} folder does not exist. Creating it...`);
    }
    fs.mkdirSync(folderPath, { recursive: true });
}

cleanupFolder(framesDir, 'frames');
cleanupFolder(imagesDir, 'images');