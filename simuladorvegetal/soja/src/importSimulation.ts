import {validateLayers, type Layer} from './soilHydraulics';
import {DEFAULT_SOIL,type Soil,type Change,type Env} from './sojaModel';
const ranges:Record<keyof Env,[number,number]>={temperature:[0,45],nutrients:[0,100],humidity:[0,100],wind:[0,10],radiation:[0,25],rain:[0,80],irrigation:[0,30]};
function number(v:unknown,min:number,max:number,label:string){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label}: valor fora de ${min}–${max}.`);return v;}
export function validateImport(input:unknown):{soil:Soil;changes:Change[];day:number}{
 if(!input||typeof input!=='object')throw Error('JSON inválido.');
 const d=input as any;if(d.schemaVersion!==4||d.cycleDays!==120)throw Error('Use uma exportação VegetalLab Soja V4 de 120 dias.');
 const day=number(d.day,0,120,'Dia');if(!Number.isInteger(day))throw Error('Dia deve ser inteiro.');
 if(!d.soil||!Array.isArray(d.soil.layers)||d.soil.layers.length!==3)throw Error('Esperadas três camadas de solo.');
 const layers:Layer[]=d.soil.layers.map((l:any,i:number)=>{
  if(!l||typeof l!=='object')throw Error('Camada inválida.');
  const chemistry={silica:null,iron:null,aluminum:null,calcium:null,magnesium:null,potassium:null,phosphorus:null,nitrogen:null,ph:null,method:''} as Layer['chemistry'];
  for(const [k,max] of Object.entries({silica:100,iron:100,aluminum:100,calcium:100,magnesium:100,potassium:10000,phosphorus:10000,nitrogen:100,ph:14})){
   const v=l.chemistry?.[k];if(v!==null&&v!==undefined)(chemistry as any)[k]=number(v,0,max,k);
  }
  if(l.chemistry?.method!==undefined){if(typeof l.chemistry.method!=='string'||l.chemistry.method.length>5000)throw Error('Método de análise inválido.');chemistry.method=l.chemistry.method;}
  if(!['estimate','measured'].includes(l.mode))throw Error('Modo hidráulico inválido.');
  const layer:Layer={thickness:number(l.thickness,.1,1,'Espessura'),sand:number(l.sand,0,100,'Areia'),clay:number(l.clay,0,100,'Argila'),organic:number(l.organic,0,8,'Matéria orgânica'),density:number(l.density,.7,1.9,'Densidade'),porosity:number(l.porosity,25,75,'Porosidade'),mode:l.mode,fc:number(l.fc,.01,.74,'CC'),wp:number(l.wp,.005,.7,'PMP'),ksat:number(l.ksat,.01,5000,'Ksat'),chemistry};return layer;
 });
 const errors=validateLayers(layers);if(errors.length)throw Error(errors.join(' '));
 const soil:Soil={...DEFAULT_SOIL,layers,maxRoot:number(d.soil.maxRoot,.15,1.5,'Raiz máxima'),initialWater:number(d.soil.initialWater,0,100,'Água inicial')};
 if(!Array.isArray(d.changes)||!d.changes.length||d.changes.length>121||d.changes[0]?.day!==0)throw Error('Histórico de condições inválido.');
 let previous=-1;const changes:Change[]=d.changes.map((c:any)=>{const cd=number(c.day,0,120,'Dia da condição');if(!Number.isInteger(cd)||cd<=previous)throw Error('Condições devem ter dias inteiros em ordem crescente.');previous=cd;const env={} as Env;for(const k of Object.keys(ranges) as (keyof Env)[]){const [min,max]=ranges[k];env[k]=number(c.env?.[k],min,max,k);}return {day:cd,env};});
 return {soil,changes,day};
}
