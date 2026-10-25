import React,{useId,useState} from 'react';
import type {Soil} from './sojaModel';
type PlantProps={day:number;growth:number;stress:number;senescence:number;variant?:number;prefix:string};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function Leaf({x=0,y=0,angle=0,size=1,prefix,back=false}:{x?:number;y?:number;angle?:number;size?:number;prefix:string;back?:boolean}){
 return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}><path d="M0 0C-10 -4 -25 -20 -21 -37C-19 -48 -8 -52 1 -61C7 -49 24 -42 22 -28C21 -13 9 -3 0 0Z" fill={`url(#${prefix}-${back?'back':'leaf'})`} stroke="#4e7137" strokeWidth=".65"/>
 <path d="M0 -1Q2 -29 1 -57" fill="none" stroke="#c5d899" strokeWidth="1" opacity=".8"/>{[12,23,34,44].map((v,i)=><g key={v} stroke="#c6d49b" strokeWidth=".55" fill="none" opacity=".6"><path d={`M1 ${-v}Q${-9+i} ${-v-2} ${-17+i*3} ${-v-10}`}/><path d={`M1 ${-v}Q${10-i} ${-v-1} ${17-i*3} ${-v-10}`}/></g>)}<path d="M1 -5Q13 -20 14 -39" stroke="white" opacity=".09" strokeWidth="7" fill="none"/></g>;
}
function Compound({x,y,size,angle,prefix,back}:{x:number;y:number;size:number;angle:number;prefix:string;back:boolean}){
 return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}><path d="M0 14L0 -12M0 0L-11 -10M0 0L12 -10" stroke="#789452" strokeWidth="1.5" fill="none"/><Leaf x={-10} y={-8} angle={-57} size={.82} prefix={prefix} back={back}/><Leaf x={11} y={-8} angle={55} size={.88} prefix={prefix} back={!back}/><Leaf y={-12} size={1.02} angle={-5} prefix={prefix} back={back}/></g>;
}
function Flower({x,y}:{x:number;y:number}){return <g transform={`translate(${x} ${y})`}><path d="M0 9L0 -5M0 5L6 0" stroke="#668044" fill="none"/>{[-1,1].map((s)=><g key={s} transform={`translate(${s*3} ${s*4})`}><path d="M0 0C-9 -4 -6 -12 0 -9C6 -12 9 -4 0 0" fill="#b37dc5"/><path d="M0 0C-8 4 -6 8 0 5C6 8 8 4 0 0" fill="#e0b5e2"/><path d="M-2 1Q0 7 2 1" stroke="#f5e5ac" strokeWidth="2"/></g>)}</g>;}
function Pod({x,y,angle,maturity,size}:{x:number;y:number;angle:number;maturity:number;size:number}){return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}><path d="M0 -6L1 1" stroke="#6d7e47" strokeWidth="1.3"/><path d="M1 0C13 4 16 12 12 20C16 29 9 39 0 42C-7 35 -7 26 -5 20C-9 10 -4 3 1 0Z" fill={maturity>.2?'#bc9b60':'#8d9c4e'} stroke={maturity>.2?'#8d7449':'#647b39'} strokeWidth="1"/><path d="M2 4Q10 17 3 37" fill="none" stroke="#d4cd8c" opacity=".65"/>{[9,20,30].map(v=><ellipse key={v} cx="3" cy={v} rx="4" ry="4.7" fill={maturity>.2?'#d1b579':'#b0b86a'} opacity=".65"/>)}</g>;}
export function BotanicalSoybean({day,growth,stress,senescence,variant=0,prefix}:PlantProps){
 const h=22+growth*2.65,mature=clamp((day-105)/15),droop=stress*.32;
 const nodes=Array.from({length:8},(_,i)=>{const appear=18+i*6;const scale=clamp((day-appear)/9);const side=i%2?1:-1;const y=-h*(.2+i*.097);const reach=(50+(i%3)*17)*(1-i*.045);return {i,scale,side,y,x:side*reach*(.92+variant*.025),endY:y-35-i*3};});
 const leafVisible=(i:number)=>senescence<55+i*5 && !(stress>75&&i<2);
 if(day<8)return <g><ellipse cx="0" cy="6" rx="7" ry="5" fill="#c8ad76" stroke="#9e865b"/>{day>2&&<path d={`M0 9Q-5 15 2 ${10+day*3}`} fill="none" stroke="#dbc394" strokeWidth="2"/>}{day>5&&<path d="M0 5Q-7 -15 2 -10Q7 -6 4 0" fill="none" stroke="#91aa62" strokeWidth="3"/>}</g>;
 return <g transform={`skewX(${(variant-2)*.65})`}>
 <path d={`M0 0C-5 ${-h*.32} 9 ${-h*.65} 3 ${-h}`} fill="none" stroke={mature>.4?'#9a864d':'#5b7c3e'} strokeWidth={4+growth*.025} strokeLinecap="round"/><path d={`M1 -2Q2 ${-h*.5} 4 ${-h*.98}`} fill="none" stroke="#b9c88b" strokeWidth="1.3" opacity=".7"/>
 {nodes.map(n=>n.scale>0&&<g key={`stem${n.i}`}><path d={`M1 ${n.y+26}Q${n.x*.45} ${n.y+6} ${n.x} ${n.endY}`} stroke={mature>.3?'#a18e59':'#728849'} strokeWidth={2.7-n.i*.14} fill="none" strokeLinecap="round"/><ellipse cx="2" cy={n.y+26} rx="4" ry="3" fill={mature>.3?'#a99564':'#729149'}/>{n.i<4&&day>40&&<path d={`M${n.x*.6} ${n.y-4}Q${n.x*.85} ${n.y-30} ${n.x*.65} ${n.y-61}`} fill="none" stroke="#809458" strokeWidth="1.7"/>}</g>)}
 {day<23&&[-1,1].map(s=><g key={s}><path d={`M0 -12L${s*12} -23`} stroke="#8fa66a" strokeWidth="2"/><ellipse cx={s*17} cy="-22" rx="14" ry="7" transform={`rotate(${s*20} ${s*17} -22)`} fill="#9caf65"/></g>)}
 {day<32&&[-1,1].map(s=><Leaf key={s} x={s*8} y={-h*.4} angle={s*58} size={.48} prefix={prefix} back={s===-1}/>)}
 {nodes.map(n=>n.scale>0&&leafVisible(n.i)&&<g key={`leaf${n.i}`}><Compound x={n.x} y={n.endY} size={n.scale*(.54+(n.i%3)*.06)*(1-stress*.002)} angle={n.side*(19+droop)+(n.i%3-1)*8} prefix={prefix} back={n.i%3===0}/>{n.i<3&&day>40&&<Compound x={n.x*.65} y={n.y-61} size={n.scale*.43} angle={-n.side*(18+droop)} prefix={prefix} back={true}/>}</g>)}
 {day>=66&&day<=88&&nodes.slice(1,6).map(n=><Flower key={n.i} x={n.x*.32} y={n.y+12}/>)}
 {day>=81&&nodes.slice(0,Math.max(2,7-Math.floor(stress/25))).map(n=><g key={n.i}><Pod x={n.x*.35} y={n.y+8} angle={n.side*12} maturity={mature} size={.45+.35*clamp((day-80)/20)}/>{day>90&&<Pod x={n.x*.48} y={n.y+4} angle={-n.side*19} maturity={mature} size={.6}/>}</g>)}
 {day>=23&&leafVisible(7)&&<Compound x={3} y={-h+2} size={.38} angle={-12} prefix={prefix} back={false}/>}
 </g>;
}
export function SoybeanScene({day,growth,stress,senescence,rootDepth,soil,stage}:{day:number;growth:number;stress:number;senescence:number;rootDepth:number;soil:Soil;stage:string}){
 const id=useId().replace(/[^a-zA-Z0-9]/g,'');const [roots,setRoots]=useState(true);
 if(day<18)return <GerminationScene day={day} prefix={id}/>;
 const total=soil.layers.reduce((a,l)=>a+l.thickness,0),depth=200*Math.min(rootDepth,total)/total;
 const mature=clamp((senescence-25)/75);
 const color=mature>.75?'#ae8846':mature>.3?'#9ba34b':'#56862c';
 return <div><div className="flex flex-wrap gap-3 justify-between px-5 pb-3 text-xs text-slate-500"><span>Estudo botânico em SVG · baseado na fotografia fornecida</span><label className="flex gap-2 items-center cursor-pointer"><input type="checkbox" checked={roots} onChange={e=>setRoots(e.target.checked)}/>Mostrar raízes em corte</label></div>
 <svg role="img" aria-label={`Planta de soja em detalhe, dia ${day}, ${stage}. Raízes a ${rootDepth.toFixed(2)} metros.`} viewBox={`0 0 900 ${roots?675:465}`} className="w-full bg-[#eff4ea]">
 <defs><linearGradient id={`${id}-leaf`} x1="0" x2="1" y1="0" y2=".6"><stop stopColor={mature>.4?'#ccbd62':'#8caa42'}/><stop offset=".5" stopColor={color}/><stop offset="1" stopColor={mature>.4?'#a28c44':'#315b24'}/></linearGradient><linearGradient id={`${id}-back`}><stop stopColor={mature>.4?'#c9bd7e':'#a6b783'}/><stop offset="1" stopColor={mature>.4?'#aa955c':'#648749'}/></linearGradient><linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#f1f6ee"/><stop offset="1" stopColor="#dae7d0"/></linearGradient><clipPath id={`${id}-soil`}><rect x="0" y="435" width="900" height="200"/></clipPath></defs>
 <rect width="900" height="435" fill={`url(#${id}-sky)`}/><circle cx="780" cy="75" r="34" fill="#eadba5" opacity=".6"/><path d="M0 385Q250 345 440 373T900 350V435H0" fill="#c7d7b9"/>
 {[0,1,2,3].map(i=><g key={i} transform={`translate(${95+i*235} 424) scale(.56)`} opacity=".52"><BotanicalSoybean day={day} growth={growth} stress={stress} senescence={senescence} variant={i} prefix={id}/></g>)}
 <path d="M0 435Q230 424 450 435T900 435V465H0" fill="#998468"/>
 <ellipse cx="450" cy="435" rx="102" ry="10" fill="#34482a" opacity=".14"/>
 <g transform="translate(450 435)"><BotanicalSoybean day={day} growth={growth} stress={stress} senescence={senescence} variant={2} prefix={id}/></g>
 <rect x="22" y="20" width="230" height="62" rx="10" fill="white" opacity=".9"/><text x="36" y="45" fill="#284c30" fontSize="15" fontWeight="600">{stage}</text><text x="36" y="65" fill="#68805d" fontSize="12">Folhas, flores e vagens por fase</text>
 {roots&&<g><g clipPath={`url(#${id}-soil)`}>{soil.layers.map((l,i)=>{const top=soil.layers.slice(0,i).reduce((a,v)=>a+v.thickness,0);return <g key={i}><rect x="0" y={435+200*top/total} width="900" height={200*l.thickness/total} fill={['#aa9170','#b49b7e','#c4b092'][i]}/><path d={`M0 ${435+200*top/total}H900`} stroke="#e3d4bd" strokeDasharray="4 5" opacity=".55"/><text x="22" y={454+200*top/total} fontSize="12" fill="#4e422e">Camada {i+1} · {(top*100).toFixed(0)}–{((top+l.thickness)*100).toFixed(0)} cm</text></g>;})}
 <g transform="translate(450 435)" fill="none" stroke="#e5d6ac" strokeLinecap="round"><path d={`M0 0Q-5 ${depth*.32} 5 ${depth*.64}T0 ${depth}`} strokeWidth="3"/>{Array.from({length:9},(_,i)=>{const y=depth*(.1+i*.09),span=(1-i/12)*Math.min(85,depth*.55);return [-1,1].map(side=><g key={`${i}-${side}`}><path d={`M0 ${y}Q${span*side*.45} ${y+4} ${span*side} ${Math.min(depth,y+depth*.14)}`} strokeWidth={1.6-i*.1}/>{[.4,.7,1].map(f=><path key={f} d={`M${span*side*f} ${y+depth*.14*f}l${side*8} ${Math.min(12,depth*.05)}`} strokeWidth=".65"/>)}</g>);})}</g></g>
 <line x1="735" x2="765" y1={435+depth} y2={435+depth} stroke="#584d35"/><text x="775" y={439+depth} fontSize="12" fill="#54482f">{rootDepth.toFixed(2)} m</text><text x="450" y="658" textAnchor="middle" fontSize="12" fill="#6d755d">Raízes ilustrativas · profundidade e camadas vinculadas ao modelo</text></g>}
 </svg></div>;
}

export function germinationProgress(day:number){
 return {swelling:clamp(day/2),radicle:clamp((day-2)/5),lift:clamp((day-4)/5),opening:clamp((day-7)/3),leaves:clamp((day-11)/5),secondaryRoots:clamp((day-5)/8)};
}
function GerminationScene({day,prefix}:{day:number;prefix:string}){
 const p=germinationProgress(day),seedY=330-150*p.lift,rootLength=185*p.radicle;
 const title=day<2?'Semente no solo':day<4?'Embebição e emissão da radícula':day<7?'Raiz primária e alongamento do hipocótilo':day<11?'Emergência e abertura dos cotilédones':day<14?'Primeiras folhas unifolioladas':'Plântula e início das folhas trifolioladas';
 return <div><div className="px-5 pb-3 text-xs text-slate-500">Germinação em detalhe ampliado · sequência ilustrativa, sem escala física</div><svg role="img" aria-label={`Dia ${day}: ${title}`} viewBox="0 0 900 620" className="w-full bg-[#eef4e9]">
 <defs><linearGradient id={`${prefix}-seed`} x1=".2" y1="0" x2=".7" y2="1"><stop stopColor="#fff0bf"/><stop offset=".4" stopColor="#e9b460"/><stop offset=".8" stopColor="#c68a36"/><stop offset="1" stopColor="#a6732f"/></linearGradient><linearGradient id={`${prefix}-cotyledon`} x2=".7" y2="1"><stop stopColor="#b7c878"/><stop offset="1" stopColor="#67893c"/></linearGradient><linearGradient id={`${prefix}-leaf`}><stop stopColor="#a4bd62"/><stop offset="1" stopColor="#3c702d"/></linearGradient><linearGradient id={`${prefix}-back`}><stop stopColor="#bdca8e"/><stop offset="1" stopColor="#71994f"/></linearGradient></defs>
 <rect y="275" width="900" height="345" fill="#b89e7b"/><path d="M0 275Q200 265 450 275T900 275" stroke="#8f805b" strokeWidth="5" fill="none"/><path d="M0 415H900M0 540H900" stroke="#d0b999" strokeDasharray="5 8" opacity=".6"/>
 {Array.from({length:30},(_,i)=><circle key={i} cx={30+i*137%840} cy={300+i*71%280} r={1+i%3} fill="#907754" opacity=".25"/>)}
 <rect x="24" y="22" width="620" height="64" rx="12" fill="white" opacity=".9"/><text x="42" y="49" fontSize="17" fontWeight="600" fill="#2c4b30">{title}</text><text x="42" y="70" fontSize="12" fill="#758167">Dia {day} · semente → radícula → caule → cotilédones → folhas</text>
 <text x="30" y="254" fontSize="13" fill="#72815e">Superfície do solo</text>
 {p.radicle>0&&<g fill="none" stroke="#efe0b7" strokeLinecap="round"><path d={`M446 337Q432 ${345+rootLength*.2} 451 ${337+rootLength*.55}Q466 ${337+rootLength*.8} 446 ${337+rootLength}`} strokeWidth="5"/>{Array.from({length:8},(_,i)=>{const age=clamp((day-5-i*.7)/5);const y=350+i*18;return age>0&&[-1,1].map(side=><g key={`${i}-${side}`}><path d={`M450 ${y}Q${450+side*28*age} ${y+5} ${450+side*(62-i*3)*age} ${y+25*age}`} strokeWidth={2-i*.12}/>{[.5,.8].map(f=><path key={f} d={`M${450+side*(62-i*3)*age*f} ${y+25*age*f}l${side*10*age} ${13*age}`} strokeWidth=".8"/>)}</g>);})}</g>}
 {p.lift>0&&<g><path d={`M448 337Q${431-20*(1-p.lift)} ${seedY+65} 450 ${seedY+9}`} stroke="#76944a" strokeWidth="7" fill="none" strokeLinecap="round"/><path d={`M449 330Q440 ${seedY+50} 451 ${seedY+12}`} stroke="#b4c77e" strokeWidth="2" fill="none"/></g>}
 <g transform={`translate(450 ${seedY}) scale(${1+p.swelling*.12})`}>
 {p.opening<1?<g transform={`rotate(${-8+p.lift*20})`}><path d="M-39 -7C-36 -28 -7 -33 18 -26C44 -21 51 3 35 20C17 35 -23 29 -37 12C-42 7 -42 0 -39 -7Z" fill={`url(#${prefix}-seed)`} stroke="#c1944b" strokeWidth="1.2"/><path d="M-23 8C-12 0 5 1 14 8C7 17 -13 19 -23 8Z" fill="#63513c" stroke="#ba9b67"/><path d="M-19 9Q-3 4 10 8" fill="none" stroke="#d4bb85" strokeWidth="1.5"/><path d="M-27 -14Q-2 -30 24 -13" stroke="#fff8de" strokeWidth="7" opacity=".45" fill="none" strokeLinecap="round"/>{p.radicle>.1&&<path d="M-31 5L-26 15L-20 19" stroke="#8d642e" fill="none"/>}</g>:<g>{[-1,1].map(side=><g key={side} transform={`rotate(${side*22})`}><ellipse cx={side*21} cy="0" rx="24" ry="13" fill={`url(#${prefix}-cotyledon)`} stroke="#6f8d45"/><path d={`M${side*3} 1L${side*37} -2`} stroke="#ccd8a0" fill="none" opacity=".7"/></g>)}</g>}
 </g>
 {p.opening>.3&&<path d={`M450 ${seedY}Q453 ${seedY-15} 451 ${seedY-25-25*p.leaves}`} stroke="#75994b" strokeWidth="4" fill="none"/>}
 {p.leaves>0&&[-1,1].map(side=><Leaf key={side} x={450+side*4} y={seedY-25} angle={side*57} size={.65*p.leaves} prefix={prefix} back={side<0}/>)}
 {day>=15&&<Compound x={451} y={seedY-53} size={.35*clamp((day-14)/4)} angle={-8} prefix={prefix} back={false}/>}
 <g fontSize="12" fill="#494d32" stroke="#7c805c" strokeWidth="1"><path d={`M505 ${seedY}H630`} fill="none"/><text x="640" y={seedY+4} stroke="none">{p.opening<1?'Semente · tegumento e hilo':'Cotilédones'}</text>{p.radicle>0&&<><path d={`M460 ${337+rootLength*.8}H630`} fill="none"/><text x="640" y={341+rootLength*.8} stroke="none">Raiz primária</text></>}{p.lift>.2&&<><path d={`M460 ${seedY+65}H630`} fill="none"/><text x="640" y={seedY+69} stroke="none">Hipocótilo · caule inicial</text></>}</g>
 <text x="450" y="596" textAnchor="middle" fontSize="12" fill="#554b38">Cronologia didática. A partir do dia 18, a vista mostra a planta e as camadas em conjunto.</text>
 </svg></div>;
}
