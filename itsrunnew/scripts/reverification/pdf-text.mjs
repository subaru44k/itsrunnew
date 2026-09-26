import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const bytes = new Uint8Array(await readFile(process.argv[2]));
const document = await getDocument({ data: bytes, useSystemFonts: true }).promise;
const pages = [];
for (let index = 1; index <= Math.min(document.numPages, 12); index += 1) {
  const page = await document.getPage(index);
  const content = await page.getTextContent();
  pages.push(`PAGE ${index}\n${content.items.map((item) => item.str ?? '').join(' ')}`);
}
process.stdout.write(pages.join('\n'));
