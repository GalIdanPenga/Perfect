#!/bin/bash
# Perfect - Node.js Offline Package Downloader
# Run this script on an ONLINE computer to download all npm dependencies

echo "========================================"
echo "Node.js Offline Package Downloader"
echo "========================================"
echo ""

# Create packages directory if it doesn't exist
if [ ! -d "offline_packages" ]; then
    echo "[INFO] Creating 'offline_packages' directory..."
    mkdir -p offline_packages
fi

echo "[INFO] Downloading all npm packages as tarballs..."
echo "[INFO] This may take several minutes..."
echo ""

# Clean the directory first
rm -rf offline_packages/*

# Download all dependencies and devDependencies as tarballs
npm pack --pack-destination=offline_packages $(node -pe "
  const pkg = require('./package.json');
  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  [...deps, ...devDeps].join(' ');
")

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to download some packages!"
    echo "[ERROR] Make sure you have an internet connection and npm is installed."
    exit 1
fi

# Also need to pack all transitive dependencies
# The best way is to do a clean install first, then pack everything from node_modules
echo ""
echo "[INFO] Installing dependencies to get all transitive dependencies..."
npm install

echo ""
echo "[INFO] Packing all dependencies (including transitive)..."
echo "[INFO] This will take a while..."

# Create a list of all installed packages
node -e "
const fs = require('fs');
const path = require('path');

function getAllPackages(dir) {
  const packages = [];

  function traverse(currentDir) {
    const nodeModulesPath = path.join(currentDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) return;

    const items = fs.readdirSync(nodeModulesPath);

    for (const item of items) {
      if (item.startsWith('.')) continue;

      const itemPath = path.join(nodeModulesPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        if (item.startsWith('@')) {
          // Scoped package
          const scopedItems = fs.readdirSync(itemPath);
          for (const scopedItem of scopedItems) {
            const scopedPath = path.join(itemPath, scopedItem);
            const scopedStat = fs.statSync(scopedPath);
            if (scopedStat.isDirectory()) {
              const pkgJsonPath = path.join(scopedPath, 'package.json');
              if (fs.existsSync(pkgJsonPath)) {
                const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                packages.push({\${item}/\${scopedItem}@\${pkgJson.version}});
              }
            }
          }
        } else {
          // Regular package
          const pkgJsonPath = path.join(itemPath, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            packages.push({\${item}@\${pkgJson.version}});
          }
        }
      }
    }
  }

  traverse(dir);
  return packages;
}

const packages = getAllPackages('.');
console.log(packages.join('\n'));
" > offline_packages/package_list.txt

echo ""
echo "[INFO] Found $(wc -l < offline_packages/package_list.txt) packages to download"
echo ""

# Download each package
while IFS= read -r package; do
  echo "[INFO] Downloading: $package"
  npm pack "$package" --pack-destination=offline_packages 2>/dev/null
done < offline_packages/package_list.txt

# Copy package.json and package-lock.json
cp package.json offline_packages/
cp package-lock.json offline_packages/ 2>/dev/null || true

# Create a registry mapping file for offline installation
node -e "
const fs = require('fs');
const path = require('path');

const tarballs = fs.readdirSync('offline_packages')
  .filter(f => f.endsWith('.tgz'));

console.log('Found ' + tarballs.length + ' tarballs');

const mapping = {};
tarballs.forEach(tarball => {
  // Parse package name and version from tarball filename
  // Format: package-name-version.tgz or @scope-package-name-version.tgz
  const match = tarball.match(/^(@?.+?)-(\d+\..+?)\.tgz$/);
  if (match) {
    const name = match[1].replace(/-/g, '/', 1); // Handle scoped packages
    const version = match[2];
    if (!mapping[name]) mapping[name] = {};
    mapping[name][version] = tarball;
  }
});

fs.writeFileSync('offline_packages/registry.json', JSON.stringify(mapping, null, 2));
"

echo ""
echo "========================================"
echo "[SUCCESS] Download completed!"
echo "========================================"
echo ""
echo "Total size: $(du -sh offline_packages | cut -f1)"
echo "Total files: $(ls -1 offline_packages/*.tgz 2>/dev/null | wc -l)"
echo ""
echo "Next steps:"
echo "1. Copy the 'offline_packages' directory to your offline computer"
echo "2. Run the setup script on the offline computer:"
echo "   - Windows: setup_node_offline.bat"
echo "   - Linux/Mac: ./setup_node_offline.sh"
echo ""
