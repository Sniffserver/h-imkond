const fs = require('fs');
let content = fs.readFileSync('src/services/messageService.ts', 'utf-8');

// add static import
content = "import { queueMessageForSync } from './meshSync';\n" + content;

// replace dynamic import
content = content.replace(
  /    const \{ queueMessageForSync \} = await import\('\.\/meshSync'\);\n    queueMessageForSync\(message\);/,
  "    queueMessageForSync(message);"
);

fs.writeFileSync('src/services/messageService.ts', content, 'utf-8');
console.log('Fixed messageService.ts');
