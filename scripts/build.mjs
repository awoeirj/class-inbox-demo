import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
const ui=await build({entryPoints:['source/app.js'],bundle:true,format:'esm',write:false,minify:true,target:'es2022'});
const server=await build({entryPoints:['source/server.mjs'],bundle:true,platform:'node',format:'esm',write:false,minify:true,target:'node22',banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"}});
for(const folder of ['class-inbox-demo-windows','class-inbox-demo-mac']){
 const dest=`plugins/${folder}`;mkdirSync(`${dest}/dist`,{recursive:true});
 writeFileSync(`${dest}/server.bundle.mjs`,server.outputFiles[0].text);
 writeFileSync(`${dest}/dist/inbox.html`,readFileSync('source/template.html','utf8').replace('__APP_SCRIPT__',()=>ui.outputFiles[0].text.replaceAll('</script','<\\/script')));
}

mkdirSync('source/dist',{recursive:true});copyFileSync('plugins/class-inbox-demo-mac/dist/inbox.html','source/dist/inbox.html');
