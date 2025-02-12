const { execSync } = require('child_process');
const fs = require('fs');
const path = '/mnt/c/Users/z0045v4b/AppData/Local/electron-builder/Cache/appimage/appimage-12.0.1/linux-x64/mksquashfs';

console.log('Checking if mksquashfs exists at:', path);

if (fs.existsSync(path)) {
  console.log('mksquashfs found.');
  process.env.APPIMAGE_TOOL = '/mnt/c/Users/z0045v4b/AppData/Local/electron-builder/Cache/appimage/appimage-12.0.1/linux-x64';
  try {
    // Adiciona o caminho do node_modules/.bin ao PATH
    const env = Object.assign({}, process.env, {
      PATH: `${process.env.PATH}:${process.cwd()}/node_modules/.bin`
    });
    console.log('Executing electron-builder...');
    execSync('electron-builder --linux', { stdio: 'inherit', env });
    console.log('electron-builder executed successfully.');
  } catch (error) {
    console.error('Error executing electron-builder:', error);
    process.exit(1);
  }
} else {
  console.error('mksquashfs not found at', path);
  console.error('Please download or install mksquashfs and place it at the specified path.');
  process.exit(1);
}