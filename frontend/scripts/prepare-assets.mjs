import {execFileSync} from 'node:child_process';
import {mkdir,copyFile,readdir,writeFile} from 'node:fs/promises';
await mkdir('public/ocr',{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js','public/ocr/worker.min.js');
for(const f of await readdir('node_modules/tesseract.js-core'))if(/\.wasm(?:\.js)?$/.test(f))await copyFile('node_modules/tesseract.js-core/'+f,'public/ocr/'+f);
for(const lang of ['eng','hin','kan'])await copyFile(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,`public/ocr/${lang}.traineddata.gz`);

const commit=process.env.CF_PAGES_COMMIT_SHA||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Build commit must be an exact Git SHA');
await writeFile('public/build-info.json',JSON.stringify({commit}));
