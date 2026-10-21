import * as T from 'three';
import { surfaceMaterial, moleculeObject, pointObject } from './geometry.js';
const box=(x,y,z,material,position=[0,0,0])=>{const m=new T.Mesh(new T.BoxGeometry(x,y,z),material);m.position.set(...position);return m;};
export const demoList=[{id:'atrium',name:'Atrium',category:'Architektur',label:'Raum, Licht & Struktur',icon:'building'},{id:'mechanical',name:'Getriebestudie',category:'CAD',label:'Flächen & Bauteile',icon:'cube'},{id:'terrain',name:'Höhenlandschaft',category:'Geospatial',label:'62.500 farbige Punkte',icon:'terrain'},{id:'molecule',name:'Ethanol',category:'Biochemie',label:'Atome & Bindungen',icon:'molecule'},{id:'medical',name:'Volumenphantom',category:'Medizin',label:'Synthetische Schichten',icon:'layers'}];
function architecture(){
  const root=new T.Group();root.name='Atrium · Architekturstudie';
  const concrete=surfaceMaterial(0xd9d4c2),dark=surfaceMaterial(0x34474b),metal=surfaceMaterial(0x638b80),wood=surfaceMaterial(0xaf8d60);
  const glass=new T.MeshStandardMaterial({color:0x8ec7ba,transparent:true,opacity:.27,roughness:.18,metalness:.3,side:T.DoubleSide,depthWrite:false});
  root.add(box(12,.25,9,concrete,[0,-.25,0]));
  for(let floor=0;floor<4;floor++){
    const storey=new T.Group();storey.name=`Ebene ${floor+1}`;const y=floor*1.55;
    const slab=new T.Shape();slab.moveTo(-4,-3);slab.lineTo(4,-3);slab.lineTo(4,3);slab.lineTo(-4,3);slab.closePath();
    const hole=new T.Path();hole.moveTo(-1.3,-1.4);hole.lineTo(-1.3,1.4);hole.lineTo(1.3,1.4);hole.lineTo(1.3,-1.4);hole.closePath();slab.holes.push(hole);
    const geometry=new T.ExtrudeGeometry(slab,{depth:.18,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
    const deck=new T.Mesh(geometry,concrete);deck.position.y=y;deck.name='Deckenplatte mit Lichthof';storey.add(deck);
    if(floor<3){
      for(const x of [-3.7,-1.8,1.8,3.7])for(const z of [-2.7,2.7])storey.add(box(.13,1.55,.13,dark,[x,y+.78,z]));
      storey.add(box(7.8,1.24,.035,glass,[0,y+.8,-2.87]),box(.035,1.24,5.8,glass,[-3.9,y+.8,0]),box(.035,1.24,5.8,glass,[3.9,y+.8,0]));
      for(let x=-3.8;x<3.9;x+=.39){const fin=box(.06,1.2,.36,wood,[x,y+.82,2.8]);fin.rotation.y=.42;storey.add(fin);}
      for(let z=-2.6;z<=2.6;z+=1.3){storey.add(box(1.45,.1,.55,wood,[-2.6,y+.73,z]));}
    }
    root.add(storey);
  }
  const roof=new T.Group();roof.name='Dach · Solarfelder';
  for(let x=-3.5;x<=3.5;x+=1)for(const z of [-2.2,2.2]){const solar=box(.87,.04,1,metal,[x,4.93,z]);solar.rotation.x=-.15;roof.add(solar);}root.add(roof);
  for(let i=0;i<4;i++)root.add(box(4-i*.2,.12,1.1,concrete,[0,-.12+i*.10,3.65-i*.24]));
  const garden=new T.Group();garden.name='Freiraum & Bepflanzung';
  for(const [x,z,s] of [[-4.8,-3.3,1],[-4.9,2.9,.8],[4.9,-2.8,.85],[4.9,2.8,1.05],[-.1,0,.65]]){
    garden.add(box(.12,1.1,.12,wood,[x,.45,z]));const crown=new T.Mesh(new T.IcosahedronGeometry(.7*s,1),surfaceMaterial(0x6e9984));crown.position.set(x,1.3*s,z);crown.scale.y=1.15;garden.add(crown);
  }root.add(garden);return{object:root,kind:'Architektur-Demo',unit:'Meter',note:'Prozedurale Architekturstudie · keine importierte IFC-Datei'};
}
function mechanical(){
  const root=new T.Group(),steel=surfaceMaterial(0xa5b9c4),teal=surfaceMaterial(0x82baaa),dark=surfaceMaterial(0x516677);
  root.name='Getriebestudie';
  root.add(box(9,.6,6,steel,[0,-1,0]));
  for(const [x,r,teeth] of [[-1.7,2,24],[1.65,1.3,16]]){
    const shape=new T.Shape();for(let i=0;i<=teeth*4;i++){const angle=i/(teeth*4)*Math.PI*2,rad=r*(i%4===1||i%4===2?1:0.88);const px=Math.cos(angle)*rad,py=Math.sin(angle)*rad;if(i===0)shape.moveTo(px,py);else shape.lineTo(px,py);}shape.closePath();
    const h=new T.Path();h.absarc(0,0,.37,0,Math.PI*2,true);shape.holes.push(h);const g=new T.ExtrudeGeometry(shape,{depth:.65,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:1});g.rotateX(-Math.PI/2);const gear=new T.Mesh(g,x<0?teal:steel);gear.position.set(x,0,0);gear.name=`Zahnrad · ${teeth} Zähne`;root.add(gear);
    const shaft=new T.Mesh(new T.CylinderGeometry(.32,.32,2.5,32),dark);shaft.position.set(x,.3,0);shaft.name='Welle';root.add(shaft);
  }return{object:root,kind:'CAD-Demo',unit:'nicht angegeben',note:'Prozedurale Bauteile · kein importiertes STEP-Modell'};
}
function terrain(){
  const n=250,positions=new Float32Array(n*n*3),colors=new Float32Array(n*n*3),c=new T.Color();
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const px=x/(n-1)*14-7,pz=z/(n-1)*14-7,y=2.5*Math.exp(-((px+2)**2+(pz-1)**2)/12)+1.8*Math.exp(-((px-3)**2+(pz+2)**2)/6)+.22*Math.sin(px*2)*Math.cos(pz*1.5);const i=(z*n+x)*3;positions.set([px,y,pz],i);c.setHSL(.46-y*.055,.28,.25+y*.13);colors.set([c.r,c.g,c.b],i);}
  const object=pointObject({positions,colors});object.name='Synthetische Höhenlandschaft';return{object,kind:'Punktwolken-Demo',unit:'nicht angegeben',note:'62.500 prozedurale Punkte · keine georeferenzierte Messung'};
}
function molecule(){
  const a=[[-.75,0,0,'C'],[.75,0,0,'C'],[1.45,1.1,0,'O'],[-1.13,-.51,.89,'H'],[-1.13,-.51,-.89,'H'],[-1.13,1.02,0,'H'],[1.13,-.51,.89,'H'],[1.13,-.51,-.89,'H'],[2.37,.86,0,'H']];
  const object=moleculeObject({atoms:a.map(([x,y,z,element])=>({x,y,z,element})),bonds:[[0,1],[1,2],[0,3],[0,4],[0,5],[1,6],[1,7],[2,8]]});object.name='Ethanol · Kugel-Stab-Modell';return{object,kind:'Molekül-Demo',unit:'Ångström',note:'Vereinfachte Ethanol-Geometrie · Farben nach Element'};
}
async function medical(){
  const {dicomObject,assembleDicom}=await import('./dicom.js');const slices=[],n=64;
  for(let z=0;z<n;z++){const pixels=new Float32Array(n*n);let min=Infinity,max=-Infinity;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const r=Math.sqrt(((x-32)/24)**2+((y-32)/20)**2+((z-32)/26)**2);let v=r<1?200:0;if(r>.75&&r<.9)v=800;if(((x-25)**2+(y-28)**2+(z-30)**2)<60)v=1200;pixels[y*n+x]=v;min=Math.min(min,v);max=Math.max(max,v);}slices.push({pixels,rows:n,cols:n,min,max,position:[0,0,z*1.5],orientation:[1,0,0,0,1,0],spacing:[1,1],thickness:1.5,series:'synthetic',invert:false});}
  const data=dicomObject(assembleDicom(slices));data.controller.setSurface(true,500);return{...data,bounds:data.object.userData.localBounds,kind:'Volumen-Demo',unit:'Millimeter',note:'Synthetisches Phantom · keine Patientendaten · keine diagnostische Verwendung'};
}
export async function createDemo(id){return ({atrium:architecture,mechanical,terrain,molecule,medical}[id]||architecture)();}
