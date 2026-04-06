const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Map of classes to inject dark versions
      const map = {
        'bg-white': 'dark:bg-slate-900',
        'bg-gray-50': 'dark:bg-slate-950',
        'bg-gray-100': 'dark:bg-slate-800',
        'text-gray-900': 'dark:text-white',
        'text-gray-800': 'dark:text-slate-100',
        'text-gray-700': 'dark:text-slate-200',
        'text-gray-600': 'dark:text-slate-300',
        'text-gray-500': 'dark:text-slate-400',
        'text-gray-400': 'dark:text-slate-500',
        'border-gray-200': 'dark:border-slate-700',
        'border-gray-100': 'dark:border-slate-800',
        'border-gray-50': 'dark:border-slate-800/50',
        'text-indigo-600': 'dark:text-indigo-400',
        'bg-indigo-50': 'dark:bg-indigo-900/40',
        'text-indigo-700': 'dark:text-indigo-300',
        'hover:bg-gray-50': 'dark:hover:bg-slate-800',
        'hover:bg-gray-100': 'dark:hover:bg-slate-700',
      };
      
      let changed = false;
      for (const [light, dark] of Object.entries(map)) {
        // Regex to match exact class name inside class attribute
        const regex = new RegExp(`\\b${light}\\b(?!.*\\b${dark}\\b)`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, `${light} ${dark}`);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('src/app');
