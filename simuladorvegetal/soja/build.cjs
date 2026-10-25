const fs=require('fs'),path=require('path'),cp=require('child_process');
const out=__dirname;
const Babel=require('@babel/standalone');
const modules={};
for(const name of fs.readdirSync(out+'/src').filter(n=>/\.tsx?$/.test(n))){const id=name.replace(/\.tsx?$/,'');modules[id]=Babel.transform(fs.readFileSync(out+'/src/'+name,'utf8'),{filename:name,presets:[['typescript',{allExtensions:true,isTSX:name.endsWith('tsx')}],['react',{runtime:'classic'}]],plugins:['transform-modules-commonjs'],compact:true}).code;}
modules.react=fs.readFileSync(__dirname+'/node_modules/react/cjs/react.production.min.js','utf8');
modules['react-dom/client']="exports.createRoot=function(c){return require('react-dom').createRoot(c)}";
modules['react-dom']=fs.readFileSync(__dirname+'/node_modules/react-dom/cjs/react-dom.production.min.js','utf8');
modules.scheduler=fs.readFileSync(__dirname+'/node_modules/scheduler/cjs/scheduler.production.min.js','utf8');
const bundle='(()=>{const process={env:{NODE_ENV:"production"}};const M={'+Object.entries(modules).map(([k,v])=>JSON.stringify(k)+':function(module,exports,require){'+v+'\n}').join(',')+'};const cache={};function require(id){id=id.replace(/^\\.\\//,"");if(cache[id])return cache[id].exports;if(!M[id])throw Error("Missing module "+id);const m={exports:{}};cache[id]=m;M[id](m,m.exports,require);return m.exports;}require("main");})();';
fs.writeFileSync(out+'/app.bundle.js',bundle);
const tailwind=fs.readFileSync(__dirname+'/node_modules/@tailwindcss/browser/dist/index.global.js','utf8');
const app=fs.readFileSync(out+'/app.bundle.js','utf8');
const escape=s=>s.replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="VegetalLab Soja: simulador didático de crescimento vegetal e balanço hídrico em três camadas de solo."><title>VegetalLab — Soja V4</title><style>html,body{margin:0;width:100%;font-family:Arial,Helvetica,sans-serif;color:#214431;background:#f3f7f4}*{box-sizing:border-box}button,input,select{outline-offset:3px}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #047857}button:not(:disabled){cursor:pointer}svg{max-width:100%}input[type=number]{min-width:0}input[type=range]{touch-action:pan-y}</style><script>${escape(tailwind)}</script></head><body><noscript>Ative o JavaScript para executar o simulador.</noscript><div id="root"></div><footer style="padding:20px;text-align:center;font-size:12px;color:#647467">VegetalLab Soja V4 · versão independente 4.1.0 · modelo didático não calibrado<br>Arquivos JSON são processados no seu navegador.</footer><script>${escape(app)}</script></body></html>`;
fs.writeFileSync(out+'/index.html',html);fs.writeFileSync(out+'/.nojekyll','');console.log('HTML independente:',Buffer.byteLength(html),'bytes');

