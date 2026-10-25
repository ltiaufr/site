import {defaultLayers, hydraulic, type Layer} from './soilHydraulics';
export type Env = {temperature:number; nutrients:number; humidity:number; wind:number; radiation:number; rain:number; irrigation:number};
export type Soil = {maxRoot:number; initialWater:number;layers:Layer[]};
export type Change = {day:number; env:Env};
export const DEFAULT_ENV:Env={temperature:26,nutrients:80,humidity:65,wind:2,radiation:12,rain:0,irrigation:5};
export const DEFAULT_SOIL:Soil={maxRoot:1,initialWater:75,layers:defaultLayers};
export const stages=[
 {start:0,end:7,code:'Semente',name:'Germinação',short:'0 · Germinação'},
 {start:8,end:20,code:'VE–VC',name:'Emergência / plântula',short:'8 · Plântula'},
 {start:21,end:45,code:'V inicial',name:'Vegetativo inicial',short:'21 · Vegetativo'},
 {start:46,end:65,code:'V avançado',name:'Vegetativo avançado',short:'46 · Expansão'},
 {start:66,end:80,code:'R1–R2',name:'Florescimento',short:'66 · Flores'},
 {start:81,end:105,code:'R3–R6',name:'Formação de vagens',short:'81 · Vagens'},
 {start:106,end:120,code:'R7–R8',name:'Maturação',short:'106 · Maturação'}
];
export const scenarios=[
 {name:'Irrigação regular',env:DEFAULT_ENV},
 {name:'Seca e calor',env:{...DEFAULT_ENV,irrigation:0,rain:0,temperature:35,humidity:30,wind:4,radiation:17}},
 {name:'Período chuvoso',env:{...DEFAULT_ENV,irrigation:0,rain:12,humidity:85,radiation:7}},
 {name:'Pouca radiação',env:{...DEFAULT_ENV,radiation:3,temperature:23}},
 {name:'Solo pobre',env:{...DEFAULT_ENV,nutrients:20}},
 {name:'Chuva intensa',env:{...DEFAULT_ENV,rain:60,irrigation:0}}
];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const band=(v:number,lo:number,hi:number,min:number,max:number)=>clamp(v<lo?(v-min)/(lo-min):v>hi?(max-v)/(max-hi):1);
export function environmentAt(changes:Change[],day:number):Env {let env=DEFAULT_ENV;for(const c of changes){if(c.day>day)break;env=c.env;}return env;}
// Daily FAO-56 Penman–Monteith equation. Approximation: mean T/RH for vapour
// pressure, fixed sea-level gamma; user supplies net radiation, G=0.
export function referenceET(e:Env) {
 const es=.6108*Math.exp(17.27*e.temperature/(e.temperature+237.3));
 const delta=4098*es/(e.temperature+237.3)**2;
 const gamma=.0674;
 const deficit=es*(1-e.humidity/100);
 return Math.max(0,(.408*delta*e.radiation+gamma*900/(e.temperature+273)*e.wind*deficit)/(delta+gamma*(1+.34*e.wind)));
}
export function cropCoefficient(day:number){return day<=20?.4:day<=65?.4+.75*(day-20)/45:day<=100?1.15:1.15-.65*(day-100)/20;}
export function simulate(changes:Change[],soil:Soil=DEFAULT_SOIL) {
 const hs=soil.layers.map(hydraulic), layers=soil.layers;
 const stores=layers.map((l,i)=>1000*l.thickness*(hs[i].wp+(hs[i].fc-hs[i].wp)*soil.initialWater/100));
 const totalDepth=layers.reduce((a,l)=>a+l.thickness,0);
 const rootAt=(d:number)=>Math.min(totalDepth,.15+(soil.maxRoot-.15)*clamp(d/65));
 const fractions=(d:number)=>{let top=0;return layers.map(l=>{const f=clamp((rootAt(d)-top)/l.thickness);top+=l.thickness;return f;});};
 const reserve=(fr:number[])=>layers.reduce((a,l,i)=>a+Math.max(0,Math.min(stores[i],hs[i].fc*l.thickness*1000)-hs[i].wp*l.thickness*1000)*fr[i],0);
 let accumulated=0,damage=0,reproductive=0,totalET=0,totalDeficit=0,totalRain=0,totalIrrigation=0;
 return Array.from({length:121},(_,day)=>{
  const fr=fractions(day),previousProfile=stores.reduce((a,v)=>a+v,0);
  let et0=0,kc=cropCoefficient(day),potentialET=0,actualET=0,rain=0,irrigation=0,runoff=0,drainage=0,ks=1,infiltration=0;
  const layerDrainage=layers.map(()=>0),uptake=layers.map(()=>0);
  const capacity=layers.reduce((a,l,i)=>a+1000*l.thickness*(hs[i].fc-hs[i].wp)*fr[i],0);
  if(day>0){
   const e=environmentAt(changes,day-1);rain=e.rain;irrigation=e.irrigation;
   // Daily cascade: flux bounded by each layer's Ksat and receiving pore space.
   const move=(i:number)=>{
    const l=layers[i],h=hs[i];const excess=Math.max(0,stores[i]-h.fc*l.thickness*1000);
    const room=i===layers.length-1?Infinity:Math.max(0,hs[i+1].sat*layers[i+1].thickness*1000-stores[i+1]);
    const q=Math.min(excess,h.ksat,i===layers.length-1?Infinity:hs[i+1].ksat,room);
    stores[i]-=q;layerDrainage[i]+=q;if(i===layers.length-1)drainage+=q;else stores[i+1]+=q;
   };
   for(let i=layers.length-1;i>=0;i--)move(i);
   infiltration=Math.min(rain+irrigation,hs[0].ksat,Math.max(0,hs[0].sat*layers[0].thickness*1000-stores[0]));
   runoff=rain+irrigation-infiltration;stores[0]+=infiltration;
   // Remaining daily conductivity budget prevents double-counting Ksat.
   for(let i=0;i<layers.length;i++){
    const excess=Math.max(0,stores[i]-hs[i].fc*layers[i].thickness*1000);
    const room=i===layers.length-1?Infinity:Math.max(0,hs[i+1].sat*layers[i+1].thickness*1000-stores[i+1]);
    const q=Math.min(excess,Math.max(0,hs[i].ksat-layerDrainage[i]),i===layers.length-1?Infinity:Math.max(0,hs[i+1].ksat-layerDrainage[i+1]),room);
    stores[i]-=q;layerDrainage[i]+=q;if(i===layers.length-1)drainage+=q;else stores[i+1]+=q;
   }
   et0=referenceET(e);kc=cropCoefficient(day-1);potentialET=et0*kc;
   const p=Math.max(.1,Math.min(.8,.5+.04*(5-potentialET)));
   ks=clamp(reserve(fr)/((1-p)*capacity));
   let demand=potentialET*ks;
   const accessible=layers.map((l,i)=>Math.max(0,stores[i]-hs[i].wp*l.thickness*1000)*fr[i]);
   const available=accessible.reduce((a,v)=>a+v,0);
   actualET=Math.min(available,demand);
   layers.forEach((l,i)=>{uptake[i]=available?actualET*accessible[i]/available:0;stores[i]-=uptake[i];});
   totalET+=actualET;totalDeficit+=potentialET-actualET;totalRain+=rain;totalIrrigation+=irrigation;
   const factors=[ks,clamp(e.radiation/10),band(e.temperature,24,30,5,45),band(e.nutrients,70,100,0,110)];
   const quality=factors.reduce((a,b)=>a*b,1)**.25;damage=clamp(damage*.985+(1-Math.min(...factors))*.025);
   if(day<=80)accumulated+=quality*(1-damage*.35);if(day>=66&&day<=105)reproductive+=quality*(1-damage*.5);
  }
  const water=reserve(fr),profileWater=stores.reduce((a,v)=>a+v,0),growth=100*clamp(accumulated/80);
  const senescence=100*clamp(Math.max(0,(day-105)/15)+damage*.25);
  return {day,growth,height:day<8?0:95*growth/100,coverage:Math.min(95,growth*1.1)*(1-senescence/100),stress:damage*100,vigor:100*(1-damage)*(1-Math.max(0,day-105)/15*.65),senescence,reproductiveIndex:100*reproductive/40,
   water,capacity,waterPercent:100*water/capacity,rootDepth:rootAt(day),et0,kc,ks,potentialET,actualET,rain,irrigation,infiltration,runoff,drainage,rootAccess:0,previousWater:previousProfile,profileWater,totalET,totalDeficit,totalRain,totalIrrigation,
   layers:layers.map((l,i)=>({theta:stores[i]/(l.thickness*1000),storage:stores[i],rootFraction:fr[i],drainage:layerDrainage[i],uptake:uptake[i],...hs[i]})),
   balanceError:profileWater-previousProfile-rain-irrigation+runoff+drainage+actualET};
 });
}

