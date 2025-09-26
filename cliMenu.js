#!/usr/bin/env node
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import path from 'path';

// Utility to run a Node script with arguments
function runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [scriptName, ...args], { stdio: 'inherit' });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${scriptName} exited with code ${code}`));
        });
    });
}

(async () => {
    try {
        // Step 1: Choose download type
        const { type } = await inquirer.prompt([
            {
                name: 'type',
                type: 'list',
                message: 'Select download type:',
                choices: ['Video', 'Image'],
            },
        ]);

        // Step 2: Enter URL
        const { url } = await inquirer.prompt([
            {
                name: 'url',
                type: 'input',
                message: 'Enter the post or video URL:',
                validate(input) {
                    if (!input || !/^https?:\/\//.test(input)) return 'Please enter a valid URL.';
                    return true;
                },
            },
        ]);

        // Step 3: Ask for FPS if video
        let fps = '10';
        if (type === 'Video') {
            const { fpsInput } = await inquirer.prompt([
                {
                    name: 'fpsInput',
                    type: 'input',
                    message: 'Enter FPS for frame extraction (default 10):',
                    default: '10',
                    validate(val) {
                        const n = Number(val);
                        if (isNaN(n) || n <= 0) return 'Enter a valid positive number.';
                        return true;
                    },
                },
            ]);
            fps = fpsInput;
        }

        console.log(`Starting ${type.toLowerCase()} download for URL: ${url}`);

        // Step 4: Determine script and args
        const script = type === 'Video' ? 'downloadSocialMedia.js' : 'downloadSocialMediaImages.js';
        const args = type === 'Video' ? [url, fps] : [url];

        // Run the appropriate script
        await runScript(path.join('.', script), args);

        console.log(`${type} download finished successfully!`);
    } catch (err) {
        console.error('Download failed:', err.message);
    }
})();