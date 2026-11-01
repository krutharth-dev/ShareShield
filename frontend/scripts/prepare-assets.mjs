import {mkdir,copyFile,readdir} from 'node:fs/promises';
await mkdir('public/ocr',{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js','public/ocr/worker.min.js');
for(const f of await readdir('node_modules/tesseract.js-core'))if(/\.wasm(?:\.js)?$/.test(f))await copyFile('node_modules/tesseract.js-core/'+f,'public/ocr/'+f);
for(const lang of ['eng','hin','kan'])await copyFile(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,`public/ocr/${lang}.traineddata.gz`);
