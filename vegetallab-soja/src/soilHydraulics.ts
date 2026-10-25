export type Chemistry={silica:number|null;iron:number|null;aluminum:number|null;calcium:number|null;magnesium:number|null;potassium:number|null;phosphorus:number|null;nitrogen:number|null;ph:number|null;method:string};
export type Layer={thickness:number;sand:number;clay:number;organic:number;density:number;porosity:number;mode:'estimate'|'measured';fc:number;wp:number;ksat:number;chemistry:Chemistry};
export const emptyChemistry:Chemistry={silica:null,iron:null,aluminum:null,calcium:null,magnesium:null,potassium:null,phosphorus:null,nitrogen:null,ph:null,method:''};
export const defaultLayers:Layer[]=[{thickness:.2,sand:45,clay:30,organic:3,density:1.3,porosity:51,mode:'estimate',fc:.31,wp:.17,ksat:80,chemistry:{...emptyChemistry}},{thickness:.4,sand:40,clay:38,organic:1.5,density:1.4,porosity:47,mode:'estimate',fc:.34,wp:.21,ksat:35,chemistry:{...emptyChemistry}},{thickness:.6,sand:38,clay:42,organic:.8,density:1.45,porosity:45,mode:'estimate',fc:.36,wp:.24,ksat:20,chemistry:{...emptyChemistry}}];
export function hydraulic(l:Layer){
 const S=l.sand/100,C=l.clay/100,OM=l.organic;
 const w=-.024*S+.487*C+.006*OM+.005*S*OM-.013*C*OM+.068*S*C+.031;
 const f=-.251*S+.195*C+.011*OM+.006*S*OM-.027*C*OM+.452*S*C+.299;
 const sat=l.porosity/100;
 const rawWP=1.14*w-.02,rawFC=f+1.283*f*f-.374*f-.015;
 const wp=l.mode==='measured'?l.wp:Math.max(.005,Math.min(sat-.02,rawWP));
 const fc=l.mode==='measured'?l.fc:Math.max(wp+.01,Math.min(sat-.005,rawFC));
 const lambda=Math.log(fc/wp)/Math.log(1500/33);
 const ksat=l.mode==='measured'?l.ksat:24*1930*Math.pow(Math.max(.001,sat-fc),3-lambda);
 return {wp,fc,sat,ksat,lambda,adjusted:l.mode==='estimate'&&(Math.abs(wp-rawWP)>.00001||Math.abs(fc-rawFC)>.00001)};
}
export function retention(l:Layer,kpa:number){const h=hydraulic(l);return kpa<=0?h.sat:kpa<33?h.sat+(h.fc-h.sat)*Math.log(1+kpa)/Math.log(34):Math.max(h.wp,h.fc*Math.pow(kpa/33,-h.lambda));}
export function validateLayers(layers:Layer[]){const errors:string[]=[];layers.forEach((l,i)=>{const h=hydraulic(l);if(l.sand+l.clay>100||l.sand<0||l.clay<0)errors.push(`Camada ${i+1}: areia + argila deve ser ≤ 100%.`);if(!(h.wp>0&&h.wp<h.fc&&h.fc<h.sat&&h.sat<1))errors.push(`Camada ${i+1}: exigir 0 < PMP < CC < porosidade < 1.`);if(l.thickness<=0||l.ksat<=0||l.density<=0)errors.push(`Camada ${i+1}: espessura, densidade e Ksat devem ser positivos.`);});return errors;}
