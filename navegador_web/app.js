import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const $=id=>document.getElementById(id), view=$('view'), status=$('status');
let renderer; try{renderer=new T.WebGLRenderer({antialias:false,powerPreference:'low-power'});}catch(e){status.textContent='WebGL 2 indisponível neste dispositivo.';throw e;}
view.append(renderer.domElement);const scene=new T.Scene();scene.background=new T.Color(0xaec9dc);scene.fog=new T.Fog(0xaec9dc,45,110);// Ajustes globais da câmera (distâncias em unidades do mapa, ângulos em graus).
const CEILING_HEIGHT=2.8;
const CAMERA_HEIGHT=1.65;
const CAMERA_DISTANCE=1.5;
const CAMERA_PITCH=2;
const CAMERA_FOV=75;
const camera=new T.PerspectiveCamera(CAMERA_FOV,1,.1,120);let world=new T.Group();scene.add(world);scene.add(new T.HemisphereLight(0xffffff,0x777777,2));const light=new T.DirectionalLight(0xffffff,1.3);light.position.set(10,20,5);scene.add(light);
let map,blocked,bounds,route=[],pos=new T.Vector3(),angle=0,ratio=1,frames=0,elapsed=0,fps=0,notice='',last=performance.now();const key=(x,y)=>x+','+y;const point=p=>({x:Number(p.x),y:Number(p.y)});const valid=p=>Number.isFinite(p.x)&&Number.isFinite(p.y);const cell=p=>({x:Math.floor(p.x),y:Math.floor(p.y)});const mat=color=>new T.MeshLambertMaterial({color});

function pattern(brick){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 let seed=12345;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 g.fillStyle=brick?'#a5a5a0':'#aaa9a4';g.fillRect(0,0,128,128);
 if(brick){for(let row=0;row<4;row++){for(let x=-64+(row%2)*32;x<128;x+=64){const v=225+Math.floor(rand()*15);g.fillStyle='rgb('+v+','+v+','+(v-4)+')';g.fillRect(x+1,row*32+1,62,30);}}}
 else{for(let i=0;i<4200;i++){const v=100+Math.floor(rand()*100);g.fillStyle='rgb('+v+','+v+','+(v-3)+')';g.fillRect(Math.floor(rand()*128),Math.floor(rand()*128),1+Math.floor(rand()*2),1);}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(2,renderer.capabilities.getMaxAnisotropy());return t;
}
const brickTexture=pattern(true),floorTexture=pattern(false);
// Forro branco em réguas de 20 cm, com encaixes discretos.
function makeCeilingTexture(){
 const c=document.createElement('canvas');c.width=128;c.height=64;
 const g=c.getContext('2d');
 const gradient=g.createLinearGradient(0,0,128,0);
 gradient.addColorStop(0,'#d2d3d4');gradient.addColorStop(.025,'#f4f4f3');
 gradient.addColorStop(.12,'#fafafa');gradient.addColorStop(.94,'#f7f7f6');
 gradient.addColorStop(1,'#e2e3e4');
 g.fillStyle=gradient;g.fillRect(0,0,128,64);
 g.fillStyle='#c8c9ca';g.fillRect(0,0,2,64);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
 t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 return t;
}
const ceilingTexture=makeCeilingTexture();
function wallMaterial(){return new T.MeshLambertMaterial({map:brickTexture});}
function wallGeometry(){const geo=new T.BoxGeometry(1,2.8,1),uv=geo.attributes.uv;for(let i=0;i<16;i++)uv.setY(i,uv.getY(i)*2.8);return geo;}

function instances(items,geo,material,height){if(!items.length){geo.dispose();material.dispose();return;}const mesh=new T.InstancedMesh(geo,material,items.length),m=new T.Matrix4();items.forEach((p,i)=>{m.makeTranslation(p.x+.5,height,p.y+.5);mesh.setMatrixAt(i,m)});mesh.computeBoundingSphere();world.add(mesh)}

// Sprite provisório: uma única textura RGBA, gerada uma vez e compartilhada.
function makeTreeTexture(){
 const c=document.createElement('canvas');c.width=128;c.height=128;const g=c.getContext('2d');
 let seed=8341;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 g.fillStyle='#76543a';g.beginPath();g.moveTo(57,126);g.lineTo(70,126);g.lineTo(66,57);g.lineTo(61,57);g.closePath();g.fill();
 g.strokeStyle='#705038';g.lineWidth=4;for(const [x,y] of [[30,53],[93,48],[46,31],[78,25]]){g.beginPath();g.moveTo(64,91);g.lineTo(x,y);g.stroke();}
 for(let i=0;i<780;i++){const x=64+(rnd()-.5)*112,y=49+(rnd()-.5)*86; if(((x-64)/54)**2+((y-49)/40)**2>1)continue;const r=3+rnd()*7;const v=Math.floor(65+rnd()*70+(1-y/128)*20);g.fillStyle='rgb('+Math.floor(v*.62)+','+v+','+Math.floor(v*.43)+')';g.beginPath();g.ellipse(x,y,r,r*.75,rnd()*3,0,Math.PI*2);g.fill();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
const treeTexture=makeTreeTexture();
function addTrees(items){
 if(!items.length)return;
 const material=new T.SpriteMaterial({map:treeTexture,alphaTest:.5,transparent:false,depthWrite:true});
 for(const p of items){const s=new T.Sprite(material);s.center.set(.5,0);s.scale.set(3.5,3.5,1);s.position.set(p.x+.5,0,p.y+.5);world.add(s);}
}

let returnTimer=0; const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function results(){const terms=normalize($('search').value).trim().split(/\s+/);const list=$('results');list.replaceChildren();for(const [i,d] of (map?.dest||[]).entries()){if(!terms.every(t=>normalize(d.nome).includes(t)))continue;const b=document.createElement('button');b.textContent=d.nome;b.onclick=()=>{ $('dest').value=i; $('go').click(); };list.append(b);}if(!list.children.length)list.textContent=map?'Nenhum destino encontrado.':'Carregando mapa…';}
function consult(message=''){clearTimeout(returnTimer);route=[];$('navigation').hidden=true;$('consult').hidden=false;$('search').value='';$('feedback').textContent=message;results();}
$('search').addEventListener('input',results);for(const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM','1234567890']){const line=document.createElement('div');line.className='keys';for(const c of row){const b=document.createElement('button');b.textContent=c;b.onclick=()=>{$('search').value+=c;results()};line.append(b)}$('keyboard').append(line)}for(const [id,action] of [['space',s=>s+' '],['backspace',s=>s.slice(0,-1)],['clear',()=> '']])$(id).onclick=()=>{$('search').value=action($('search').value);results()};
function load(data){if(!data.inicio||!Array.isArray(data.paredes)||!Array.isArray(data.destinos))throw Error('JSON requer inicio, paredes e destinos.');const rawStart=point(data.inicio),walls=data.paredes.map(point),objects=(data.objetos||[]).map(p=>({...point(p),nome:String(p.nome||p.tipo||'')})),rawDest=data.destinos.map(p=>({...point(p),nome:String(p.nome||'Destino')}));if(data.rotas!==undefined&&!Array.isArray(data.rotas))throw Error('A camada rotas deve ser uma lista.');
 const coverages=normalizeCoverages(data.coberturas||[]);
 const routePoints=(data.rotas||[]).flatMap(r=>Array.isArray(r?.pontos)?r.pontos.map(p=>point(p||{})):[]);
 const all=[rawStart,...walls,...objects,...rawDest,...routePoints,...coverages.flatMap(c=>c.pontos)];if(!all.every(valid))throw Error('Coordenadas x e y devem ser números finitos.');if(!walls.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)))throw Error('Coordenadas das paredes devem ser inteiras em x e y.');/* O editor salva posições contínuas; A* trabalha com células de 1 metro. */const start=cell(rawStart),dest=rawDest.map(p=>({...p,...cell(p)}));let minX=start.x,maxX=start.x,minY=start.y,maxY=start.y;for(const p of all){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}bounds={minX:minX-2,maxX:maxX+2,minY:minY-2,maxY:maxY+2};map={start,dest,rawStart,rawDest,manualRoutes:data.rotas||[]};blocked=new Set([...walls,...objects].map(p=>key(Math.floor(p.x),Math.floor(p.y))));scene.remove(world);world.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});world=new T.Group();scene.add(world);floorTexture.repeat.set((maxX-minX+5)/2,(maxY-minY+5)/2);const floor=new T.Mesh(new T.PlaneGeometry(maxX-minX+5,maxY-minY+5),new T.MeshLambertMaterial({map:floorTexture}));floor.rotation.x=-Math.PI/2;floor.position.set((minX+maxX+1)/2,0,(minY+maxY+1)/2);world.add(floor);
 addCoverages(coverages);
 const groups=new Map();for(const p of walls){const k=key(Math.floor(p.x/16),Math.floor(p.y/16));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)}for(const g of groups.values())instances(g,wallGeometry(),wallMaterial(),1.4);const trees=objects.filter(p=>/arvore|árvore|tree/i.test(p.nome));addTrees(trees);instances(objects.filter(p=>!trees.includes(p)),new T.CylinderGeometry(.28,.38,1.8,6),mat(0x527445),.9);$('dest').replaceChildren(...dest.map((p,i)=>new Option(p.nome,i)));pos.set(start.x+.5,1.65,start.y+.5);angle=0;route=[];notice='Mapa carregado';consult();}
// Rotas manuais usam metros contínuos, sem deslocamento de meia célula.
function manualPath(destination,index){
 const definition=map.manualRoutes.find(r=>r&&r.destino===destination.nome&&
   (r.destino_indice===undefined||r.destino_indice===index));
 if(!definition)return null;
 if(!Array.isArray(definition.pontos)||definition.pontos.length<2)
  throw Error('A rota manual de '+destination.nome+' precisa de pelo menos dois pontos.');
 const points=definition.pontos.map(p=>point(p||{}));
 if(!points.every(valid))throw Error('A rota manual contém coordenadas inválidas.');
 const start=map.rawStart,end=map.rawDest[index];
 const raw=[];
 for(const p of [start,...points,end]){
  const v=new T.Vector3(p.x,CAMERA_HEIGHT,p.y);
  if(!raw.length||raw[raw.length-1].distanceTo(v)>1e-6)raw.push(v);
 }
 for(let i=0;i<raw.length;i++){
  if(!safePoint(raw[i].x,raw[i].z,.32)||(i>0&&!safeSegment(raw[i-1],raw[i])))
   throw Error('Rota manual de '+destination.nome+': trecho '+Math.max(1,i)+' próximo demais ou atravessando uma parede/objeto. Ajuste no editor.');
 }
 const curved=smoothPath(raw);
 // A curva só é usada se todo o percurso permanecer livre.
 return curved.every((v,i)=>safePoint(v.x,v.z,.32)&&(!i||safeSegment(curved[i-1],v)))?curved:raw;
}

// Valida e normaliza forros simples (convexos ou côncavos), preservando retângulos antigos.
function normalizeCoverages(areas){
 if(!Array.isArray(areas))throw Error('A camada coberturas deve ser uma lista.');
 const eps=1e-8,cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const on=(a,b,c)=>Math.abs(cross(a,b,c))<=eps&&c.x>=Math.min(a.x,b.x)-eps&&c.x<=Math.max(a.x,b.x)+eps&&c.y>=Math.min(a.y,b.y)-eps&&c.y<=Math.max(a.y,b.y)+eps;
 const intersects=(a,b,c,d)=>{
  const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),z=cross(c,d,b);
  return (((u>eps&&v< -eps)||(u< -eps&&v>eps))&&((w>eps&&z< -eps)||(w< -eps&&z>eps)))||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
 };
 return areas.map((area,index)=>{
  const fail=()=>{throw Error('Cobertura '+(index+1)+': use um polígono com pelo menos 3 vértices e sem linhas cruzadas.');};
  if(!area||typeof area!=='object')return fail();
  let points;
  if(area.pontos!==undefined){
   if(!Array.isArray(area.pontos))return fail();
   points=area.pontos.map(p=>point(p||{}));
  }else{
   const x=Number(area.x),y=Number(area.y),w=Number(area.largura),h=Number(area.altura);
   if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return fail();
   points=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
  }
  if(!points.every(valid))return fail();
  if(points.length>1&&Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<1e-6)points.pop();
  const n=points.length;if(n<3)return fail();
  let twiceArea=0;
  for(let i=0;i<n;i++){
   const a=points[i],b=points[(i+1)%n],c=points[(i+2)%n];
   if(Math.hypot(b.x-a.x,b.y-a.y)<1e-6)return fail();
   if(Math.abs(cross(a,b,c))<=eps&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))<0)return fail();
   twiceArea+=a.x*b.y-b.x*a.y;
   for(let j=i+1;j<n;j++){
    if(j===i+1||(i===0&&j===n-1))continue;
    if(intersects(a,b,points[j],points[(j+1)%n]))return fail();
   }
  }
  if(Math.abs(twiceArea)<=.02)return fail();
  const height=Number(area.altura_teto??CEILING_HEIGHT);
  if(!Number.isFinite(height)||height<=0)return fail();
  return {pontos:points,altura_teto:height};
 });
}

function addCoverages(areas){
 for(const area of areas){
  const shape=new T.Shape();
  area.pontos.forEach((p,i)=>{if(i===0)shape.moveTo(p.x,p.y);else shape.lineTo(p.x,p.y);});
  shape.closePath();
  const geo=new T.ShapeGeometry(shape),uv=geo.attributes.uv,positions=geo.attributes.position;
  // Textura ancorada às coordenadas do mapa, sem esticar o polígono para um retângulo.
  for(let i=0;i<uv.count;i++)uv.setXY(i,positions.getX(i)/.20,positions.getY(i));
  const roof=new T.Mesh(geo,new T.MeshLambertMaterial({map:ceilingTexture,
   color:0xf1f5f7,side:T.DoubleSide,transparent:true,opacity:.82,depthWrite:false}));
  // ShapeGeometry está em XY; +90° leva y do mapa para z, preservando recuos e orientação.
  roof.rotation.x=Math.PI/2;roof.position.set(0,area.altura_teto,0);
  roof.userData.cobertura=true;world.add(roof);
 }
}

function free(x,y){return x>=bounds.minX&&x<=bounds.maxX&&y>=bounds.minY&&y<=bounds.maxY&&!blocked.has(key(x,y))}
// A* ponderado: prefere o centro de corredores sem impedir passagens estreitas.
function clearance(x,y){
 let best=3;
 for(let j=-3;j<=3;j++)for(let i=-3;i<=3;i++)if(!free(x+i,y+j))
  best=Math.min(best,Math.hypot(Math.max(0,Math.abs(i)-.5),Math.max(0,Math.abs(j)-.5)));
 return best;
}
function safePoint(x,z,r=.28){
 for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++)for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++){
  if(free(i,j))continue;
  const dx=x-Math.max(i,Math.min(i+1,x)),dz=z-Math.max(j,Math.min(j+1,z));
  if(dx*dx+dz*dz<=r*r)return false;
 }
 return true;
}
function safeSegment(a,b){
 const n=Math.max(1,Math.ceil(a.distanceTo(b)/.06));
 for(let i=0;i<=n;i++){const t=i/n;if(!safePoint(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.32))return false;}
 return true;
}
function smoothPath(raw){
 if(raw.length<3)return raw;
 const simplified=[raw[0]];
 for(let i=1;i<raw.length-1;i++){
  const a=raw[i-1],b=raw[i],c=raw[i+1];
  if(b.clone().sub(a).dot(c.clone().sub(b))<.99*a.distanceTo(b)*b.distanceTo(c))simplified.push(b);
 }
 simplified.push(raw[raw.length-1]);
 const out=[simplified[0]];
 for(let i=1;i<simplified.length-1;i++){
  const a=simplified[i-1],b=simplified[i],c=simplified[i+1];
  let rounded=false;
  for(let radius=Math.min(1.25,a.distanceTo(b)*.45,b.distanceTo(c)*.45);radius>=.12;radius*=.5){
   const entry=b.clone().lerp(a,radius/a.distanceTo(b)),exit=b.clone().lerp(c,radius/b.distanceTo(c));
   const samples=[entry];for(let k=1;k<=Math.max(4,Math.ceil(radius*20));k++){
    const t=k/Math.max(4,Math.ceil(radius*20));samples.push(entry.clone().multiplyScalar((1-t)**2).addScaledVector(b,2*t*(1-t)).addScaledVector(exit,t*t));
   }
   if(samples.every((v,j)=>safeSegment(j?samples[j-1]:out[out.length-1],v))){out.push(...samples);rounded=true;break;}
  }
  if(!rounded)out.push(b);
 }
 out.push(simplified[simplified.length-1]);return out;
}
function path(s,d){
 if(!free(s.x,s.y)||!free(d.x,d.y))return [];
 const target=key(d.x,d.y),start=key(s.x,s.y),prev=new Map([[start,null]]),cost=new Map([[start,0]]),heap=[];
 const push=v=>{let i=heap.length;heap.push(v);while(i){const j=(i-1)>>1;if(heap[j].f<=v.f)break;heap[i]=heap[j];i=j;}heap[i]=v;};
 const pop=()=>{const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[j].f>=v.f)break;heap[i]=heap[j];i=j;}heap[i]=v;}return top;};
 // Reaproveita a distância dos obstáculos durante esta busca.
 const clearances=new Map();
 const cachedClearance=(x,y)=>{const k=key(x,y);if(!clearances.has(k))clearances.set(k,clearance(x,y));return clearances.get(k);};
 const h=(x,y)=>Math.abs(x-d.x)+Math.abs(y-d.y);
 push({...s,g:0,f:h(s.x,s.y)});
 // A grade possui limites finitos; percorre a busca até encontrar o destino ou esgotar as células acessíveis.
 while(heap.length){
  const p=pop(),k=key(p.x,p.y);if(p.g!==cost.get(k))continue;
  if(k===target){const raw=[];let cur=p;while(cur){raw.push(new T.Vector3(cur.x+.5,1.65,cur.y+.5));cur=prev.get(key(cur.x,cur.y));}return smoothPath(raw.reverse());}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=p.x+dx,y=p.y+dy,n=key(x,y);if(!free(x,y))continue;
   const g=p.g+1+2.4*Math.max(0,2-cachedClearance(x,y))**2;
   if(g>=(cost.get(n)??Infinity))continue;
   cost.set(n,g);prev.set(n,p);push({x,y,g,f:g+h(x,y)});
  }
 }
 return [];
}
let cameraBack=CAMERA_DISTANCE,navSpeed=0;
$('go').onclick=()=>{
 if(!map)return;
 const index=Number($('dest').value),d=map.dest[index];if(!d)return;
 clearTimeout(returnTimer);navSpeed=0;cameraBack=CAMERA_DISTANCE;route=[];
 try{
  const manual=manualPath(d,index);
  route=manual===null?path(map.start,d):manual;
  if(!route.length){$('feedback').textContent='Rota não encontrada para '+d.nome;return;}
  pos.copy(route[0]);
  const next=route.find(p=>p.distanceTo(pos)>1e-6);
  angle=next?Math.atan2(next.x-pos.x,next.z-pos.z):0;
  notice='Navegando para '+d.nome;
  $('feedback').textContent='';$('status').textContent=notice;
  $('consult').hidden=true;$('navigation').hidden=false;resize();
 }catch(error){route=[];$('feedback').textContent=error.message;}
};$('stop').onclick=()=>consult(route.length?'Navegação interrompida.':'Destino alcançado. Selecione outro destino.');$('file').onchange=async e=>{try{load(JSON.parse(await e.target.files[0].text()))}catch(err){notice=err.message}};
function resize(){const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(view);$('quality').onchange=()=>{ratio=$('quality').value==='high'?Math.min(devicePixelRatio,2):$('quality').value==='low'?.65:1;resize()};resize();
function tick(now){requestAnimationFrame(tick);const raw=(now-last)/1000;last=now;const dt=Math.min(raw,.05);if(route.length){
 // Consome toda a distância do quadro, inclusive em curvas subdivididas.
 navSpeed=Math.min(3,navSpeed+dt*5);
 let budget=dt*navSpeed;
 while(route.length&&budget>0){
  const delta=route[0].clone().sub(pos),dist=delta.length();
  if(dist<=budget+1e-8){pos.copy(route.shift());budget=Math.max(0,budget-dist);}
  else{pos.addScaledVector(delta,budget/dist);budget=0;}
 }
 if(route.length){
  let look=pos.clone(),remaining=1.15;
  for(const p of route){const dist=look.distanceTo(p);if(dist>=remaining){look.lerp(p,remaining/Math.max(dist,1e-9));break;}look.copy(p);remaining-=dist;}
  const delta=look.sub(pos);
  if(delta.lengthSq()>1e-8){const desired=Math.atan2(delta.x,delta.z),diff=Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle));angle+=diff*(1-Math.exp(-dt*4.5));}
 }else{notice='Destino alcançado';status.textContent=notice;navSpeed=0;}
}const fx=Math.sin(angle),fz=Math.cos(angle);let back=CAMERA_DISTANCE;
// Evita recuar a câmera para dentro de paredes ou objetos.
for(let d=.1;d<=CAMERA_DISTANCE+.1;d+=.1){if(blocked&&!safePoint(pos.x-fx*d,pos.z-fz*d,.22)){back=Math.max(0,d-.2);break;}}
cameraBack=back<cameraBack?back:cameraBack+(back-cameraBack)*(1-Math.exp(-dt*5));
camera.position.set(pos.x-fx*cameraBack,CAMERA_HEIGHT,pos.z-fz*cameraBack);
const pitch=CAMERA_PITCH*Math.PI/180;
camera.lookAt(camera.position.x+fx*Math.cos(pitch),camera.position.y-Math.sin(pitch),camera.position.z+fz*Math.cos(pitch));if(!$('navigation').hidden)renderer.render(scene,camera);frames++;elapsed+=raw;if(elapsed>=2){fps=Math.round(frames/elapsed);frames=0;elapsed=0;if($('quality').value==='auto'&&fps<28&&ratio>.55){ratio=Math.max(.55,ratio-.15);resize()}status.textContent=notice;}}
try{const r=await fetch('./mapa.json',{cache:'no-store'});if(!r.ok)throw Error('Mapa de exemplo indisponível');load(await r.json())}catch(e){notice=e.message;$('feedback').textContent=notice}requestAnimationFrame(tick);