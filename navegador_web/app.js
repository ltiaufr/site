import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
// Escala somente da apresentação; JSON, grade de rotas e colisões mantêm suas coordenadas.
const WORLD_SCALE=.5;
const $=id=>document.getElementById(id), view=$('view'), status=$('status');
let renderer; try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch(e){status.textContent='WebGL 2 indisponível neste dispositivo.';throw e;}
view.append(renderer.domElement);const scene=new T.Scene();scene.background=new T.Color(0xaec9dc);scene.fog=new T.Fog(0xaec9dc,45*WORLD_SCALE,110*WORLD_SCALE);// Ajustes globais da câmera (distâncias em unidades do mapa, ângulos em graus).
const CEILING_HEIGHT=2.8;
const CAMERA_HEIGHT=1.65;
const CAMERA_DISTANCE=1.5;
const CAMERA_PITCH=2;
const CAMERA_FOV=75;
const camera=new T.PerspectiveCamera(CAMERA_FOV,1,.1*WORLD_SCALE,120*WORLD_SCALE);let world=new T.Group();world.scale.setScalar(WORLD_SCALE);scene.add(world);scene.add(new T.HemisphereLight(0xffffff,0x777777,2));const light=new T.DirectionalLight(0xffffff,1.3);light.position.set(10,20,5).multiplyScalar(WORLD_SCALE);scene.add(light);
let map,blocked,objectBlocked,bounds,route=[],pos=new T.Vector3(),angle=0,ratio=1,frames=0,elapsed=0,fps=0,notice='',last=performance.now();const key=(x,y)=>x+','+y;const point=p=>({x:Number(p.x),y:Number(p.y)});const valid=p=>Number.isFinite(p.x)&&Number.isFinite(p.y);const cell=p=>({x:Math.floor(p.x),y:Math.floor(p.y)});const mat=color=>new T.MeshLambertMaterial({color});

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
// Três silhuetas de vegetação, texturas RGBA compartilhadas e billboards instanciados.
function treeType(name){const n=String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /3|grande|alta/.test(n)?2:/2|media/.test(n)?1:0;}
function vegetationTexture(type){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');let seed=1427+type*123;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const trunk=g.createLinearGradient(57,0,72,0);trunk.addColorStop(0,'#493b27');trunk.addColorStop(.5,'#967653');trunk.addColorStop(1,'#57442d');g.fillStyle=trunk;g.beginPath();g.moveTo(57,127);g.lineTo(71,127);g.lineTo(65,38);g.lineTo(61,38);g.closePath();g.fill();
 const clusters=[[[64,42,42,37],[35,60,24,21],[91,58,27,23]],[[64,28,26,26],[42,51,25,28],[84,51,27,28],[64,73,29,20]],[[64,35,39,28],[30,48,28,23],[98,46,28,23],[49,67,30,19],[82,65,29,21]]][type];
 g.strokeStyle='#705339';g.lineWidth=3;for(const [x,y] of clusters){g.beginPath();g.moveTo(64,100);g.lineTo(x,y);g.stroke();}
 for(const [cx,cy,rx,ry] of clusters){for(let i=0;i<420;i++){const a=rnd()*Math.PI*2,rr=Math.sqrt(rnd()),x=cx+Math.cos(a)*rx*rr,y=cy+Math.sin(a)*ry*rr;const v=Math.floor(64+80*rnd()+25*(1-y/128));g.fillStyle='rgb('+Math.floor(v*(type===1?.48:.67))+','+v+','+Math.floor(v*.44)+')';g.beginPath();g.ellipse(x,y,2+rnd()*4,1.5+rnd()*3,rnd()*3,0,Math.PI*2);g.fill();}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
const vegetationTextures=[0,1,2].map(vegetationTexture);
function addTrees(items){
 const sizes=[[2.5,3.5],[3.2,5],[5.5,6.5]];
 for(let type=0;type<3;type++){
  const groups=new Map();for(const p of items){if(treeType(p.nome)!==type)continue;const k=Math.floor(p.x/32)+','+Math.floor(p.y/32);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  for(const list of groups.values()){
   const geo=new T.PlaneGeometry(1,1);geo.translate(0,.5,0);
   const material=new T.MeshBasicMaterial({map:vegetationTextures[type],alphaTest:.5,side:T.DoubleSide,transparent:false});
   material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 center = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
   vec3 sz = vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),1.);
   float ws=length(modelMatrix[0].xyz);
   vec4 mvPosition=center+vec4(position.x*sz.x*ws,position.y*sz.y*ws,0.,0.);
   gl_Position=projectionMatrix*mvPosition;`);};
   const mesh=new T.InstancedMesh(geo,material,list.length),m=new T.Matrix4();
   list.forEach((p,i)=>{const v=.9+.2*Math.abs(Math.sin(p.x*12.9898+p.y*78.233));m.makeScale(sizes[type][0]*v,sizes[type][1]*v,1);m.setPosition(p.x+.5,0,p.y+.5);mesh.setMatrixAt(i,m);});mesh.computeBoundingSphere();mesh.boundingSphere.radius+=8;world.add(mesh);
  }
 }
}
let fences=[];
function readFences(data){return (Array.isArray(data.alambrados)?data.alambrados:[]).map(f=>({a:{x:Number(f.x1),y:Number(f.y1)},b:{x:Number(f.x2),y:Number(f.y2)},height:Number(f.altura??2),step:Number(f.espacamento_postes??2.5),base:Number(f.base_concreto??.2)})).filter(f=>valid(f.a)&&valid(f.b)&&Math.hypot(f.b.x-f.a.x,f.b.y-f.a.y)>.01&&Number.isFinite(f.height)&&f.height>0&&Number.isFinite(f.step)&&f.step>0&&Number.isFinite(f.base)&&f.base>=0);}
function fenceHit(x,y,r){return fences.some(f=>pointSegment({x,y},f.a,f.b)<=r+.06);}
function drawFences(){
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.strokeStyle='#64736d';g.lineWidth=3;for(let i=-64;i<=128;i+=32){g.beginPath();g.moveTo(i,0);g.lineTo(i+64,64);g.moveTo(i,0);g.lineTo(i-64,64);g.stroke();}
 const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;
 const meshMat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,alphaTest:.35,transparent:false});meshMat.userData.fenceTexture=tex;
 for(const f of fences){
  const dx=f.b.x-f.a.x,dy=f.b.y-f.a.y,len=Math.hypot(dx,dy),n=Math.ceil(len/Math.max(.5,f.step)),base=Math.min(f.base,f.height*.9),angle=-Math.atan2(dy,dx);
  // Divide long stretches into short panels so frustum culling remains effective.
  for(let i=0;i<n;i+=12){
   const count=Math.min(12,n-i),lo=len*i/n,hi=len*(i+count)/n,l=hi-lo,cx=f.a.x+dx*(lo+hi)/(2*len),cy=f.a.y+dy*(lo+hi)/(2*len);
   const geo=new T.PlaneGeometry(l,f.height-base),uv=geo.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,uv.getX(j)*l*2,uv.getY(j)*(f.height-base)*2);
   const panel=new T.Mesh(geo,meshMat);panel.position.set(cx,(f.height+base)/2,cy);panel.rotation.y=angle;world.add(panel);
   if(base>0){const footing=new T.Mesh(new T.BoxGeometry(l,base,.14),mat(0xa2a3a0));footing.position.set(cx,base/2,cy);footing.rotation.y=angle;world.add(footing);}
   const posts=new T.InstancedMesh(new T.BoxGeometry(.09,f.height+.06,.09),mat(0x65716e),count+(i+count===n?1:0)),m=new T.Matrix4();for(let j=0;j<posts.count;j++){const t=(i+j)/n;m.makeTranslation(f.a.x+dx*t,(f.height+.06)/2,f.a.y+dy*t);posts.setMatrixAt(j,m);}posts.computeBoundingSphere();world.add(posts);
  }
 }
}

// Converte as células de paredes em trechos contínuos, sem degraus nas diagonais.
let architecture=null,doorViews=[],roadAreas=[];
const WALL_THICKNESS=.20,ROAD_DROP=.15;
function pointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function simplifyWall(points,tolerance=.8){
 if(points.length<3)return points;
 // Um alinhamento rasterizado oscila ao redor de uma única reta; reconhece-o antes de simplificar os cantos.
 const mx=points.reduce((v,p)=>v+p.x,0)/points.length,my=points.reduce((v,p)=>v+p.y,0)/points.length;
 let xx=0,xy=0,yy=0;
 for(const p of points){xx+=(p.x-mx)**2;xy+=(p.x-mx)*(p.y-my);yy+=(p.y-my)**2;}
 const angle=.5*Math.atan2(2*xy,xx-yy);let ux=Math.cos(angle),uy=Math.sin(angle);
 if((points.at(-1).x-points[0].x)*ux+(points.at(-1).y-points[0].y)*uy<0){ux=-ux;uy=-uy;}
 let previous=-Infinity,straight=true;
 for(const p of points){const projection=(p.x-mx)*ux+(p.y-my)*uy;if(projection<previous-1e-6||Math.abs(-(p.x-mx)*uy+(p.y-my)*ux)>.52){straight=false;break;}previous=projection;}
 if(straight)return [points[0],points.at(-1)];
 let best=0,index=0;
 for(let i=1;i<points.length-1;i++){const d=pointSegment(points[i],points[0],points.at(-1));if(d>best){best=d;index=i;}}
 if(best<=tolerance)return [points[0],points.at(-1)];
 return [...simplifyWall(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyWall(points.slice(index),tolerance)];
}
function wallLines(cells){
 const nodes=new Map(cells.map(p=>[key(p.x,p.y),{x:p.x+.5,y:p.y+.5,ix:p.x,iy:p.y,next:[]}]));
 for(const n of nodes.values())for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!dx&&!dy)continue;
  const other=nodes.get(key(n.ix+dx,n.iy+dy));if(!other)continue;
  if(dx&&dy&&(nodes.has(key(n.ix+dx,n.iy))||nodes.has(key(n.ix,n.iy+dy))))continue;
  n.next.push(other);
 }
 const visited=new Set(),lines=[],isolated=[];
 const edge=(a,b)=>[key(a.ix,a.iy),key(b.ix,b.iy)].sort().join('|');
 const trace=(start,next)=>{
  const chain=[start];let prev=start,current=next;visited.add(edge(prev,current));
  while(true){chain.push(current);if(current===start||current.next.length!==2)break;
   const dest=current.next.find(n=>n!==prev);if(visited.has(edge(current,dest)))break;
   visited.add(edge(current,dest));prev=current;current=dest;
  }
  let reduced;
  if(chain.at(-1)===start){
   const ring=chain.slice(0,-1);let far=1;
   for(let i=2;i<ring.length;i++)if(Math.hypot(ring[i].x-start.x,ring[i].y-start.y)>Math.hypot(ring[far].x-start.x,ring[far].y-start.y))far=i;
   reduced=[...simplifyWall(ring.slice(0,far+1)).slice(0,-1),...simplifyWall([...ring.slice(far),start])];
  }else reduced=simplifyWall(chain);
  for(let i=1;i<reduced.length;i++)lines.push({a:{x:reduced[i-1].x,y:reduced[i-1].y},b:{x:reduced[i].x,y:reduced[i].y}});
 };
 for(const n of nodes.values()){
  if(!n.next.length)isolated.push(n);
  if(n.next.length!==2)for(const other of n.next)if(!visited.has(edge(n,other)))trace(n,other);
 }
 for(const n of nodes.values())for(const other of n.next)if(!visited.has(edge(n,other)))trace(n,other);
 return {lines,isolated};
}
function buildArchitecture(cells,definitions){
 const {lines,isolated}=wallLines(cells),pieces=[],lintels=[],doors=[],joints=[];
 const cuts=lines.map(()=>[]);
 for(const d of definitions||[]){
  const a={x:Number(d.x1),y:Number(d.y1)},b={x:Number(d.x2),y:Number(d.y2)};
  const sourceWidth=Math.hypot(b.x-a.x,b.y-a.y),width=Number(d.largura??sourceWidth),height=Number(d.altura??2.1);
  if(!valid(a)||!valid(b)||sourceWidth<.1||!Number.isFinite(width)||width<.4||width>6||!Number.isFinite(height)||height<=0||height>CEILING_HEIGHT)throw Error('Medidas inválidas na porta '+(d.id||''));
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};let chosen=-1,best=Infinity;
  for(let i=0;i<lines.length;i++){
   const l=lines[i],dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,len=Math.hypot(dx,dy),parallel=Math.abs(((b.x-a.x)*dx+(b.y-a.y)*dy)/(sourceWidth*len));
   if(len<width+.16)continue;
   const distance=pointSegment(mid,l.a,l.b);
   if(parallel>.7&&distance<1.6&&distance<best){chosen=i;best=distance;}
  }
  let cx=mid.x,cy=mid.y,ux=(b.x-a.x)/sourceWidth,uy=(b.y-a.y)/sourceWidth;
  if(chosen>=0){
   const l=lines[chosen],len=Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y);ux=(l.b.x-l.a.x)/len;uy=(l.b.y-l.a.y)/len;
   const t=Math.max(width/2,Math.min(len-width/2,(mid.x-l.a.x)*ux+(mid.y-l.a.y)*uy));
   cx=l.a.x+ux*t;cy=l.a.y+uy*t;
   cuts[chosen].push({lo:Math.max(0,t-width/2),hi:Math.min(len,t+width/2),height});
  }
  doors.push({id:d.id||'',cx,cy,ux,uy,width,height,leaves:Number(d.folhas??(width>=1.5?2:1))===2?2:1,matched:chosen>=0});
 }
 const segment=(line,lo,hi)=>{
  const len=Math.hypot(line.b.x-line.a.x,line.b.y-line.a.y),ux=(line.b.x-line.a.x)/len,uy=(line.b.y-line.a.y)/len;
  return {a:{x:line.a.x+ux*lo,y:line.a.y+uy*lo},b:{x:line.a.x+ux*hi,y:line.a.y+uy*hi},width:WALL_THICKNESS};
 };
 for(let i=0;i<lines.length;i++){
  const l=lines[i],len=Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y),breaks=[0,len,...cuts[i].flatMap(c=>[c.lo,c.hi])].sort((a,b)=>a-b);
  for(let j=1;j<breaks.length;j++){
   const lo=breaks[j-1],hi=breaks[j];if(hi-lo<1e-6)continue;
   const opening=cuts[i].filter(c=>c.lo<(lo+hi)/2&&c.hi>(lo+hi)/2);
   if(opening.length){const bottom=Math.max(...opening.map(c=>c.height));if(bottom<CEILING_HEIGHT)lintels.push({...segment(l,lo,hi),bottom,height:CEILING_HEIGHT-bottom});}
   else pieces.push({...segment(l,lo,hi),bottom:0,height:CEILING_HEIGHT});
  }
 }
 const unique=new Set();
 for(const p of [...lines.flatMap(l=>[l.a,l.b]),...isolated]){
  const k=key(p.x,p.y);if(unique.has(k))continue;unique.add(k);
  if(doors.some(d=>Math.abs((p.x-d.cx)*d.ux+(p.y-d.cy)*d.uy)<d.width/2+.5&&Math.abs(-(p.x-d.cx)*d.uy+(p.y-d.cy)*d.ux)<1))continue;
  joints.push({x:p.x,y:p.y,r:WALL_THICKNESS/2});
 }
 const index=new Map();
 const register=(shape,x1,y1,x2,y2)=>{for(let y=Math.floor(y1-.9);y<=Math.floor(y2+.9);y++)for(let x=Math.floor(x1-.9);x<=Math.floor(x2+.9);x++){const k=key(x,y);if(!index.has(k))index.set(k,[]);index.get(k).push(shape);}};
 for(const s of pieces)register(s,Math.min(s.a.x,s.b.x),Math.min(s.a.y,s.b.y),Math.max(s.a.x,s.b.x),Math.max(s.a.y,s.b.y));
 for(const s of joints)register(s,s.x,s.y,s.x,s.y);
 return {pieces,lintels,joints,doors,index,lines};
}
function architectureHit(model,x,y,r=0){
 if(!model)return false;
 for(const s of model.index.get(key(Math.floor(x),Math.floor(y)))||[]){
  if(s.r!==undefined){if(Math.hypot(x-s.x,y-s.y)<=s.r+r)return true;continue;}
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  const t=(x-s.a.x)*ux+(y-s.a.y)*uy,n=-(x-s.a.x)*uy+(y-s.a.y)*ux;
  if(Math.hypot(Math.max(-t,t-len,0),Math.max(Math.abs(n)-s.width/2,0))<=r)return true;
 }
 return false;
}
function drawArchitecture(model){
 for(const s of [...model.pieces,...model.lintels]){
  const len=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y),geo=new T.BoxGeometry(len,s.height,s.width),uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++){uv.setX(i,uv.getX(i)*len);uv.setY(i,uv.getY(i)*s.height);}
  const mesh=new T.Mesh(geo,wallMaterial());mesh.position.set((s.a.x+s.b.x)/2,s.bottom+s.height/2,(s.a.y+s.b.y)/2);
  mesh.rotation.y=-Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x);mesh.userData.parede=true;world.add(mesh);
 }
 for(const p of model.joints){const mesh=new T.Mesh(new T.CylinderGeometry(p.r,p.r,CEILING_HEIGHT,8),wallMaterial());mesh.position.set(p.x,CEILING_HEIGHT/2,p.y);world.add(mesh);}
 doorViews=[];
 for(const d of model.doors){
  const group=new T.Group();group.position.set(d.cx-d.ux*d.width/2,0,d.cy-d.uy*d.width/2);group.rotation.y=-Math.atan2(d.uy,d.ux);
  const frameMaterial=new T.MeshLambertMaterial({color:0x626a6e}),leafMaterial=new T.MeshLambertMaterial({color:d.leaves===2?0x486a50:0x956b42,side:T.DoubleSide});
  const box=(w,h,depth,x,y,z,material,parent=group)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,depth),material);m.position.set(x,y,z);parent.add(m);return m;};
  for(const x of [-.04,d.width+.04])box(.08,d.height+.08,WALL_THICKNESS+.04,x,(d.height+.08)/2,0,frameMaterial);
  box(d.width+.16,.08,WALL_THICKNESS+.04,d.width/2,d.height+.04,0,frameMaterial);
  const hinges=[];
  for(let i=0;i<d.leaves;i++){
   const width=d.width/d.leaves,hinge=new T.Group(),sign=i===1?-1:1;
   hinge.position.x=i===1?d.width:0;group.add(hinge);
   box(width-.025,d.height-.025,.06,sign*width/2,d.height/2,0,leafMaterial,hinge);
   // Maçanetas ou barras de saída nas duas faces: visíveis por dentro e por fora.
   for(const side of [-1,1])box(d.leaves===2?width*.7:.045,.035,.035,sign*(d.leaves===2?width/2:width-.12),1.05,side*.055,frameMaterial,hinge);
   hinges.push({hinge,sign});
  }
  group.userData.porta=d;world.add(group);doorViews.push({...d,group,hinges,angle:0,side:1});
 }
}
function animateDoors(dt){
 for(const d of doorViews){
  const distance=Math.hypot(pos.x-d.cx,pos.z-d.cy),near=route.length>0&&distance<7;
  if(near&&d.angle<.01)d.side=(-(pos.x-d.cx)*d.uy+(pos.z-d.cy)*d.ux)>=0?1:-1;
  const target=near?Math.PI/2:0;d.angle+=(target-d.angle)*(1-Math.exp(-dt*12));
  for(const h of d.hinges)h.hinge.rotation.y=h.sign*d.side*d.angle;
 }
}

let surfaceAreas=[];
function pavementAreas(data){
 return (data.pisos||[]).map(p=>({x:Number(p.x),y:Number(p.y),w:Number(p.largura),h:Number(p.altura),material:String(p.material||'concreto').toLowerCase()})).filter(p=>[p.x,p.y,p.w,p.h].every(Number.isFinite)&&p.w>0&&p.h>0);
}
function subtractRectangle(rect,cut){
 const x=Math.max(rect.x,cut.x),y=Math.max(rect.y,cut.y),right=Math.min(rect.x+rect.w,cut.x+cut.w),bottom=Math.min(rect.y+rect.h,cut.y+cut.h);
 if(right<=x||bottom<=y)return [rect];
 return [{x:rect.x,y:rect.y,w:rect.w,h:y-rect.y},{x:rect.x,y:bottom,w:rect.w,h:rect.y+rect.h-bottom},{x:rect.x,y,w:x-rect.x,h:bottom-y},{x:right,y,w:rect.x+rect.w-right,h:bottom-y}].filter(r=>r.w>1e-6&&r.h>1e-6);
}
function floorElevation(x,y){for(let i=surfaceAreas.length-1;i>=0;i--){const r=surfaceAreas[i];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return /asfalto|rua|paviment/.test(r.material)?-ROAD_DROP:0;}return 0;}
function drawPavements(data,rect){
 const areas=pavementAreas(data);surfaceAreas=areas;roadAreas=areas.filter(p=>/asfalto|rua|paviment/.test(p.material));
 const plane=(r,height,color,texture=floorTexture)=>{
  const geo=new T.PlaneGeometry(r.w,r.h),uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*r.w/2,uv.getY(i)*r.h/2);
  const mesh=new T.Mesh(geo,new T.MeshLambertMaterial({map:texture,color}));mesh.rotation.x=-Math.PI/2;mesh.position.set(r.x+r.w/2,height,r.y+r.h/2);mesh.userData.piso=true;world.add(mesh);return mesh;
 };
 // O piso superior é recortado: a rua rebaixada não fica escondida por um plano em y=0.
 let pieces=[rect];for(const road of roadAreas)pieces=pieces.flatMap(r=>subtractRectangle(r,road));
 plane(rect,-ROAD_DROP-.005,0x575b5d);
 for(const p of pieces)plane(p,0,0xffffff);
 for(const p of areas)plane(p,/asfalto|rua|paviment/.test(p.material)?-ROAD_DROP:.003,
  /asfalto|rua|paviment/.test(p.material)?0x30363b:/grama/.test(p.material)?0x69914f:/terra/.test(p.material)?0xa2835c:0xd2d1c7);
 // Faces verticais de 15 cm somente nas bordas expostas da união das ruas.
 const inside=(x,y)=>roadAreas.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);
 for(const r of roadAreas){
  const edges=[{a:{x:r.x,y:r.y},b:{x:r.x+r.w,y:r.y}},{a:{x:r.x+r.w,y:r.y},b:{x:r.x+r.w,y:r.y+r.h}},{a:{x:r.x+r.w,y:r.y+r.h},b:{x:r.x,y:r.y+r.h}},{a:{x:r.x,y:r.y+r.h},b:{x:r.x,y:r.y}}];
  for(const edge of edges){
   const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
   let intervals=[{lo:0,hi:length}];
   for(const other of roadAreas){if(other===r)continue;
    const horizontal=Math.abs(uy)<.5,constant=horizontal?edge.a.y:edge.a.x;
    const min=horizontal?other.y:other.x,max=min+(horizontal?other.h:other.w);
    if(constant<min-1e-6||constant>max+1e-6)continue;
    const start=horizontal?other.x:other.y,end=start+(horizontal?other.w:other.h);
    const base=horizontal?edge.a.x:edge.a.y,dir=horizontal?ux:uy;
    const lo=Math.min((start-base)/dir,(end-base)/dir),hi=Math.max((start-base)/dir,(end-base)/dir);
    // Remove a parte em contato com outra rua, inclusive bordas coincidentes.
    intervals=intervals.flatMap(v=>hi<=v.lo||lo>=v.hi?[v]:[{lo:v.lo,hi:Math.min(v.hi,lo)},{lo:Math.max(v.lo,hi),hi:v.hi}].filter(q=>q.hi-q.lo>1e-6));
   }
   for(const v of intervals){const t=(v.lo+v.hi)/2,cx=edge.a.x+ux*t,cy=edge.a.y+uy*t;
    if(inside(cx+uy*.01,cy-ux*.01))continue;
    const mesh=new T.Mesh(new T.BoxGeometry(v.hi-v.lo,ROAD_DROP,.015),mat(0xa4a5a1));mesh.position.set(cx,-ROAD_DROP/2,cy);mesh.rotation.y=-Math.atan2(uy,ux);world.add(mesh);
   }
  }
 }
}


const quick=document.createElement('section');quick.hidden=true;quick.style.cssText='height:100%;display:flex;flex-direction:column;background:#eef2f5;color:#24354c';
quick.innerHTML='<div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button id="qBack">Voltar à consulta</button><button id="qReplay">Repetir</button><button id="qFit">Mapa inteiro</button><button id="qRoute">Enquadrar rota</button><button id="qPlus" aria-label="Ampliar">+</button><button id="qMinus" aria-label="Reduzir">−</button><button id="q3d">Navegação 3D</button><strong id="qTitle" role="status"></strong></div><div style="flex:1;min-height:0;position:relative"><canvas id="qCanvas" style="touch-action:none"></canvas></div><div style="padding:8px;text-align:center">● Início (verde) · ● Destino (vermelho) · Linha azul: percurso</div>';
document.body.append(quick);
const choice=document.createElement('dialog');choice.style.cssText='border:0;border-radius:16px;padding:24px;max-width:90vw;color:#24354c;background:#eef2f5';
choice.innerHTML='<h2 id="qChoiceTitle"></h2><p>Escolha a modalidade de consulta</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="qOpen">Consulta rápida 2D</button><button id="qChoose3d">Navegação 3D</button><button id="qCancel">Cancelar</button></div>';document.body.append(choice);
let qPoints=[],qData=null,qStart=0,qFrame=0,qZoom=1,qFocus=null,qLength=0,qDuration=0,qIndex=0,qCumulative=[],qPan={x:0,y:0};
const qc=$('qCanvas'),qg=qc.getContext('2d');
function qSelect(i){$('dest').value=i;$('qChoiceTitle').textContent=map.dest[i].nome;choice.showModal();}
$('qCancel').onclick=()=>choice.close();
$('qChoose3d').onclick=()=>{choice.close();$('go').click();};
function qClose(){cancelAnimationFrame(qFrame);quick.hidden=true;}
function qDraw(now){
 if(quick.hidden)return;
 const w=qc.clientWidth,h=qc.clientHeight;if(!w||!h){qFrame=requestAnimationFrame(qDraw);return;}
 const dpr=Math.min(devicePixelRatio||1,2);if(qc.width!==Math.round(w*dpr)||qc.height!==Math.round(h*dpr)){qc.width=Math.round(w*dpr);qc.height=Math.round(h*dpr);}
 const g=qg;g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#f8fafc';g.fillRect(0,0,w,h);
 const b=qFocus||bounds,scale=Math.max(.0001,Math.min(Math.max(1,w-48)/Math.max(1,b.maxX-b.minX),Math.max(1,h-48)/Math.max(1,b.maxY-b.minY)))*qZoom;
 const X=x=>w/2+(x-(b.minX+b.maxX)/2)*scale+qPan.x,Y=y=>h/2+(y-(b.minY+b.maxY)/2)*scale+qPan.y;
 const line=(a,b,color,width)=>{g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(X(a.x),Y(a.y));g.lineTo(X(b.x),Y(b.y));g.stroke();};
 for(const p of pavementAreas(qData)){g.fillStyle=/asfalto|rua|paviment/.test(p.material)?'#aab1b8':/grama/.test(p.material)?'#cce2b9':/terra/.test(p.material)?'#ddc8ad':'#e4e1da';g.fillRect(X(p.x),Y(p.y),p.w*scale,p.h*scale);}
 for(const c of normalizeCoverages(qData.coberturas||[])){g.fillStyle='#e5ebf1';g.beginPath();c.pontos.forEach((p,i)=>i?g.lineTo(X(p.x),Y(p.y)):g.moveTo(X(p.x),Y(p.y)));g.closePath();g.fill();}
 g.lineCap='round';g.lineJoin='round';
 for(const f of fences)line(f.a,f.b,'#718078',Math.max(1,scale*.12));
 for(const p of architecture.pieces)line(p.a,p.b,'#354657',Math.max(1.2,p.width*scale));
 for(const p of architecture.joints){g.fillStyle='#354657';g.beginPath();g.arc(X(p.x),Y(p.y),Math.max(.7,p.r*scale),0,Math.PI*2);g.fill();}
 for(const d of architecture.doors)line({x:d.cx-d.ux*d.width/2,y:d.cy-d.uy*d.width/2},{x:d.cx+d.ux*d.width/2,y:d.cy+d.uy*d.width/2},'#b78b55',Math.max(1,scale*.12));
 for(const p of qData.objetos||[]){g.fillStyle=/arvore|árvore|tree/i.test(p.nome||p.tipo||'')?'#75a86c':'#8796a3';g.beginPath();g.arc(X(Number(p.x)+.5),Y(Number(p.y)+.5),Math.max(1.5,scale*.35),0,Math.PI*2);g.fill();}
 const progress=Math.min(1,Math.max(0,(now-qStart)/qDuration)),distance=qLength*progress;
 g.beginPath();g.moveTo(X(qPoints[0].x),Y(qPoints[0].z));
 for(let i=1;i<qPoints.length;i++){const a=qPoints[i-1],b=qPoints[i];if(qCumulative[i]<=distance){g.lineTo(X(b.x),Y(b.z));continue;}const t=(distance-qCumulative[i-1])/Math.max(1e-9,qCumulative[i]-qCumulative[i-1]);g.lineTo(X(a.x+(b.x-a.x)*t),Y(a.z+(b.z-a.z)*t));break;}
 g.strokeStyle='#fff';g.lineWidth=7;g.stroke();g.strokeStyle='#1769d2';g.lineWidth=4;g.stroke();
 const marker=(p,color,label)=>{const x=X(p.x),y=Y(p.z);g.fillStyle=color;g.beginPath();g.arc(x,y,6,0,Math.PI*2);g.fill();g.strokeStyle='#fff';g.lineWidth=2;g.stroke();g.font='bold 13px system-ui';g.textAlign=x>w*.65?'right':'left';const tx=x+(x>w*.65?-10:10);g.strokeStyle='#fff';g.lineWidth=4;g.strokeText(label,tx,y-10);g.fillStyle='#24354c';g.fillText(label,tx,y-10);};
 marker(qPoints[0],'#168442','Início');marker(qPoints.at(-1),'#c83b36',map.dest[qIndex].nome);
 if(progress<1)qFrame=requestAnimationFrame(qDraw);
}
function qRefresh(){cancelAnimationFrame(qFrame);qFrame=requestAnimationFrame(qDraw);}
$('qOpen').onclick=()=>{choice.close();try{qIndex=Number($('dest').value);const d=map.dest[qIndex];qPoints=manualPath(d,qIndex)??path(map.start,d);if(!qPoints.length)throw Error('Rota não encontrada para '+d.nome);qCumulative=[0];for(let i=1;i<qPoints.length;i++)qCumulative.push(qCumulative[i-1]+qPoints[i-1].distanceTo(qPoints[i]));qLength=qCumulative.at(-1);qDuration=Math.max(1800,Math.min(12000,qLength*90));qStart=performance.now();qZoom=1;qFocus=null;qPan={x:0,y:0};$('qTitle').textContent=d.nome+' · '+Math.round(qLength)+' m';$('consult').hidden=true;quick.hidden=false;qRefresh();}catch(e){$('feedback').textContent=e.message;}};
$('qBack').onclick=()=>{qClose();$('consult').hidden=false;};
$('q3d').onclick=()=>{qClose();$('dest').value=qIndex;$('go').click();if($('navigation').hidden)$('consult').hidden=false;};
$('qReplay').onclick=()=>{qStart=performance.now();qRefresh();};
$('qFit').onclick=()=>{qFocus=null;qZoom=1;qPan={x:0,y:0};qRefresh();};
$('qRoute').onclick=()=>{let xs=qPoints.map(p=>p.x),ys=qPoints.map(p=>p.z);qFocus={minX:Math.min(...xs)-2,maxX:Math.max(...xs)+2,minY:Math.min(...ys)-2,maxY:Math.max(...ys)+2};qZoom=1;qPan={x:0,y:0};qRefresh();};
$('qPlus').onclick=()=>{qZoom=Math.min(20,qZoom*1.35);qRefresh();};$('qMinus').onclick=()=>{qZoom=Math.max(.3,qZoom/1.35);qRefresh();};
let qDrag=null;qc.addEventListener('pointerdown',e=>{qDrag={x:e.clientX,y:e.clientY};qc.setPointerCapture(e.pointerId);});qc.addEventListener('pointermove',e=>{if(!qDrag)return;qPan.x+=e.clientX-qDrag.x;qPan.y+=e.clientY-qDrag.y;qDrag={x:e.clientX,y:e.clientY};qRefresh();});for(const event of ['pointerup','pointercancel','lostpointercapture'])qc.addEventListener(event,()=>qDrag=null);
new ResizeObserver(()=>{if(!quick.hidden)qRefresh();}).observe(qc);

let returnTimer=0; const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function results(){const terms=normalize($('search').value).trim().split(/\s+/);const list=$('results');list.replaceChildren();for(const [i,d] of (map?.dest||[]).entries()){if(!terms.every(t=>normalize(d.nome).includes(t)))continue;const b=document.createElement('button');b.textContent=d.nome;b.onclick=()=>{ qSelect(i); };list.append(b);}if(!list.children.length)list.textContent=map?'Nenhum destino encontrado.':'Carregando mapa…';}
function consult(message=''){clearTimeout(returnTimer);route=[];$('navigation').hidden=true;$('consult').hidden=false;$('search').value='';$('feedback').textContent=message;results();}
$('search').addEventListener('input',results);for(const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM','1234567890']){const line=document.createElement('div');line.className='keys';for(const c of row){const b=document.createElement('button');b.textContent=c;b.onclick=()=>{$('search').value+=c;results()};line.append(b)}$('keyboard').append(line)}for(const [id,action] of [['space',s=>s+' '],['backspace',s=>s.slice(0,-1)],['clear',()=> '']])$(id).onclick=()=>{$('search').value=action($('search').value);results()};
function load(data){qData=data;fences=readFences(data);if(!data.inicio||!Array.isArray(data.paredes)||!Array.isArray(data.destinos))throw Error('JSON requer inicio, paredes e destinos.');const rawStart=point(data.inicio),walls=data.paredes.map(point),objects=(data.objetos||[]).map(p=>({...point(p),nome:String(p.nome||p.tipo||'')})),rawDest=data.destinos.map(p=>({...point(p),nome:String(p.nome||'Destino')}));if(data.rotas!==undefined&&!Array.isArray(data.rotas))throw Error('A camada rotas deve ser uma lista.');
 const coverages=normalizeCoverages(data.coberturas||[]);
 const routePoints=(data.rotas||[]).flatMap(r=>Array.isArray(r?.pontos)?r.pontos.map(p=>point(p||{})):[]);
 const all=[...fences.flatMap(f=>[f.a,f.b]),rawStart,...walls,...objects,...rawDest,...routePoints,...coverages.flatMap(c=>c.pontos),...(data.portas||[]).flatMap(d=>[{x:Number(d.x1),y:Number(d.y1)},{x:Number(d.x2),y:Number(d.y2)}]),...pavementAreas(data).flatMap(p=>[{x:p.x,y:p.y},{x:p.x+p.w,y:p.y+p.h}])];if(!all.every(valid))throw Error('Coordenadas x e y devem ser números finitos.');if(!walls.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)))throw Error('Coordenadas das paredes devem ser inteiras em x e y.');/* O editor salva posições contínuas; A* trabalha com células de 1 metro. */const start=cell(rawStart),dest=rawDest.map(p=>({...p,...cell(p)}));let minX=start.x,maxX=start.x,minY=start.y,maxY=start.y;for(const p of all){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}bounds={minX:minX-2,maxX:maxX+2,minY:minY-2,maxY:maxY+2};map={start,dest,rawStart,rawDest,manualRoutes:data.rotas||[]};architecture=buildArchitecture(walls,data.portas||[]);blocked=new Set(objects.map(p=>key(Math.floor(p.x),Math.floor(p.y))));objectBlocked=new Set(blocked);for(const k of architecture.index.keys()){const [x,y]=k.split(',').map(Number);if(architectureHit(architecture,x+.5,y+.5))blocked.add(k);}scene.remove(world);world.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});world=new T.Group();world.scale.setScalar(WORLD_SCALE);scene.add(world);drawPavements(data,{x:minX-2,y:minY-2,w:maxX-minX+5,h:maxY-minY+5});
 addCoverages(coverages);
 drawArchitecture(architecture);drawFences();const trees=objects.filter(p=>/arvore|árvore|tree/i.test(p.nome));addTrees(trees);instances(objects.filter(p=>!trees.includes(p)),new T.CylinderGeometry(.28,.38,1.8,6),mat(0x527445),.9);$('dest').replaceChildren(...dest.map((p,i)=>new Option(p.nome,i)));pos.set(start.x+.5,1.65,start.y+.5);angle=0;route=[];notice='Mapa carregado';consult();}
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
 if(x-r<bounds.minX||x+r>bounds.maxX+1||z-r<bounds.minY||z+r>bounds.maxY+1||architectureHit(architecture,x,z,r)||fenceHit(x,z,r))return false;
 for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++)for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++){
  if(!objectBlocked.has(key(i,j)))continue;
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
 if(!free(s.x,s.y)||!free(d.x,d.y)||!safePoint(s.x+.5,s.y+.5,.32)||!safePoint(d.x+.5,d.y+.5,.32))return [];
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
   const x=p.x+dx,y=p.y+dy,n=key(x,y);if(!free(x,y)||!safeSegment(new T.Vector3(p.x+.5,1.65,p.y+.5),new T.Vector3(x+.5,1.65,y+.5)))continue;
   const g=p.g+1+2.4*Math.max(0,2-cachedClearance(x,y))**2;
   if(g>=(cost.get(n)??Infinity))continue;
   cost.set(n,g);prev.set(n,p);push({x,y,g,f:g+h(x,y)});
  }
 }
 return [];
}
let cameraBack=CAMERA_DISTANCE,navSpeed=0,cameraGround=0;
$('go').onclick=()=>{
 if(!map)return;
 const index=Number($('dest').value),d=map.dest[index];if(!d)return;
 clearTimeout(returnTimer);navSpeed=0;cameraBack=CAMERA_DISTANCE;route=[];
 try{
  const manual=manualPath(d,index);
  route=manual===null?path(map.start,d):manual;
  if(!route.length){$('feedback').textContent='Rota não encontrada para '+d.nome;return;}
  pos.copy(route[0]);cameraGround=floorElevation(pos.x,pos.z);
  const next=route.find(p=>p.distanceTo(pos)>1e-6);
  angle=next?Math.atan2(next.x-pos.x,next.z-pos.z):0;
  notice='Navegando para '+d.nome;
  $('feedback').textContent='';$('status').textContent=notice;
  $('consult').hidden=true;$('navigation').hidden=false;resize();
 }catch(error){route=[];$('feedback').textContent=error.message;}
};$('stop').onclick=()=>consult(route.length?'Navegação interrompida.':'Destino alcançado. Selecione outro destino.');$('file').onchange=async e=>{try{load(JSON.parse(await e.target.files[0].text()))}catch(err){notice=err.message}};
function resize(){const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(view);$('quality').onchange=()=>{ratio=$('quality').value==='high'?Math.min(devicePixelRatio,2):$('quality').value==='low'?.65:1;resize()};resize();
// Velocidade em unidades do mapa por segundo; preserva escala, rotas e colisões.
const NAV_MAX_SPEED=12;
const NAV_ACCELERATION=8;
const NAV_BRAKING=8;
const NAV_CURVE_SPEED=2.5;
function plannedSpeed(points,position){
 let target=NAV_MAX_SPEED,travelled=0,a=position;
 for(const door of doorViews){const distance=Math.hypot(position.x-door.cx,position.z-door.cy);if(distance<9)target=Math.min(target,Math.sqrt(2.5*2.5+2*NAV_BRAKING*Math.max(0,distance-2)));}
 const horizon=NAV_MAX_SPEED*NAV_MAX_SPEED/(2*NAV_BRAKING)+8;
 for(let i=0;i<points.length;i++){
  const b=points[i],ab=a.distanceTo(b);
  if(ab<1e-6)continue;
  travelled+=ab;
  if(travelled>horizon)return target;
  let j=i+1;while(j<points.length&&b.distanceTo(points[j])<1e-6)j++;
  if(j<points.length){
   const c=points[j],bc=b.distanceTo(c),ac=a.distanceTo(c);
   const ux=b.x-a.x,uz=b.z-a.z,vx=c.x-b.x,vz=c.z-b.z;
   const cosine=(ux*vx+uz*vz)/(ab*bc);
   const curvature=ac>1e-6?2*Math.abs(ux*vz-uz*vx)/(ab*bc*ac):Infinity;
   // Curvas fechadas exigem redução mesmo quando os vértices estão distantes.
   const limit=cosine<.85?NAV_CURVE_SPEED:
    Math.min(NAV_MAX_SPEED,Math.max(NAV_CURVE_SPEED,Math.sqrt(3/Math.max(curvature,1e-9))));
   target=Math.min(target,Math.sqrt(limit*limit+2*NAV_BRAKING*travelled));
  }
  a=b;
 }
 // Freia para chegar ao destino; o mínimo permite consumir o último trecho sem parar antes dele.
 return Math.min(target,Math.max(.6,Math.sqrt(2*NAV_BRAKING*travelled)));
}

function tick(now){requestAnimationFrame(tick);const raw=(now-last)/1000;last=now;const dt=Math.min(raw,.05)/WORLD_SCALE;if(route.length){
 // O relógio de navegação acompanha a escala: 50% de distância com a mesma velocidade visual.
 // Consome toda a distância do quadro, inclusive em curvas subdivididas.
 const targetSpeed=plannedSpeed(route,pos);
 navSpeed=targetSpeed>navSpeed?Math.min(targetSpeed,navSpeed+dt*NAV_ACCELERATION):
  Math.max(targetSpeed,navSpeed-dt*NAV_BRAKING);
 let budget=dt*navSpeed;
 while(route.length&&budget>0){
  const delta=route[0].clone().sub(pos),dist=delta.length();
  if(dist<=budget+1e-8){pos.copy(route.shift());budget=Math.max(0,budget-dist);}
  else{pos.addScaledVector(delta,budget/dist);budget=0;}
 }
 if(route.length){
  let look=pos.clone(),remaining=Math.max(1.15,navSpeed*.45);
  for(const p of route){const dist=look.distanceTo(p);if(dist>=remaining){look.lerp(p,remaining/Math.max(dist,1e-9));break;}look.copy(p);remaining-=dist;}
  const delta=look.sub(pos);
  if(delta.lengthSq()>1e-8){const desired=Math.atan2(delta.x,delta.z),diff=Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle));angle+=diff*(1-Math.exp(-dt*4.5));}
 }else{notice='Destino alcançado';status.textContent=notice;navSpeed=0;}
}animateDoors(dt);cameraGround+=(floorElevation(pos.x,pos.z)-cameraGround)*(1-Math.exp(-dt*8));const fx=Math.sin(angle),fz=Math.cos(angle);let back=CAMERA_DISTANCE;
// Evita recuar a câmera para dentro de paredes ou objetos.
for(let d=.1;d<=CAMERA_DISTANCE+.1;d+=.1){if(blocked&&!safePoint(pos.x-fx*d,pos.z-fz*d,.22)){back=Math.max(0,d-.2);break;}}
cameraBack=back<cameraBack?back:cameraBack+(back-cameraBack)*(1-Math.exp(-dt*5));
camera.position.set(pos.x-fx*cameraBack,CAMERA_HEIGHT+cameraGround,pos.z-fz*cameraBack).multiplyScalar(WORLD_SCALE);
const pitch=CAMERA_PITCH*Math.PI/180;
camera.lookAt(camera.position.x+fx*Math.cos(pitch),camera.position.y-Math.sin(pitch),camera.position.z+fz*Math.cos(pitch));if(!$('navigation').hidden)renderer.render(scene,camera);frames++;elapsed+=raw;if(elapsed>=2){fps=Math.round(frames/elapsed);frames=0;elapsed=0;if($('quality').value==='auto'&&fps<28&&ratio>.55){ratio=Math.max(.55,ratio-.15);resize()}status.textContent=notice;}}
try{const r=await fetch('./mapa.json',{cache:'no-store'});if(!r.ok)throw Error('Mapa de exemplo indisponível');load(await r.json())}catch(e){notice=e.message;$('feedback').textContent=notice}requestAnimationFrame(tick);