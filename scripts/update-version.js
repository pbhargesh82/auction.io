#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Updating version to ${version} in environment files...`);

// Environment files to update
const envFiles = [
  'src/environments/environment.ts',
  'src/environments/environment.prod.ts'
];

envFiles.forEach(envFile => {
  const envPath = path.join(__dirname, '..', envFile);
  
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    
    // Update version in environment file
    const versionRegex = /version:\s*['"`][^'"`]*['"`]/;
    const newVersionLine = `version: '${version}'`;
    
    if (versionRegex.test(content)) {
      content = content.replace(versionRegex, newVersionLine);
    } else {
      // Add version if it doesn't exist
      content = content.replace(
        /export const environment = {/,
        `export const environment = {\n  version: '${version}',`
      );
    }
    
    fs.writeFileSync(envPath, content);
    console.log(`✅ Updated ${envFile}`);
  } else {
    console.log(`⚠️  File not found: ${envFile}`);
  }
});

console.log('Version update complete!'); 