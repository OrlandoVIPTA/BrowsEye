const finite = values => values.every(Number.isFinite);
export function parsePointText(text, maxPoints=1_000_000) {
  const lines=text.split(/\r?\n/).filter(l=>l.trim()&&!/^\s*#/.test(l));
  if(lines[0]?.trim().match(/^\d+$/))lines.shift();
  const stride=Math.max(1,Math.ceil(lines.length/maxPoints));
  const positions=[], colors=[]; let origin=null, skipped=0;
  for(let i=0;i<lines.length;i+=stride){
    const values=lines[i].trim().split(/[\s,;]+/).map(Number);
    if(values.length<3||!finite(values.slice(0,3))){skipped++;continue;}
    origin??=values.slice(0,3);positions.push(...values.slice(0,3).map((v,j)=>v-origin[j]));
    const rgb=values.length>=7?values.slice(4,7):values.length===6?values.slice(3,6):null;
    colors.push(...(rgb&&finite(rgb)?rgb.map(v=>Math.min(1,Math.max(0,v/(Math.max(...rgb)>1?255:1)))):[.48,.83,.74]));
  }
  if(!positions.length)throw new Error('Keine gültigen XYZ-Koordinaten gefunden. Erwartet: X Y Z [R G B].');
  return {positions:new Float32Array(positions),colors:new Float32Array(colors),origin,sampled:stride>1,skipped};
}
export function parseLAS(buffer,maxPoints=1_000_000){
  const v=new DataView(buffer); if(v.byteLength<227||new TextDecoder().decode(new Uint8Array(buffer,0,4))!=='LASF')throw new Error('Keine gültige LAS-Datei.');
  if(v.getUint8(24)!==1||v.getUint8(25)>4)throw new Error('Unterstützt wird LAS 1.0 bis 1.4.');
  const format=v.getUint8(104);if(format&192)throw new Error('Komprimierte LAZ-Datei: bitte zuerst nach LAS konvertieren.');
  if(![0,1,2,3,6,7,8].includes(format))throw new Error(`LAS-Punktformat ${format} wird noch nicht unterstützt.`);
  const start=v.getUint32(96,true),length=v.getUint16(105,true),header=v.getUint16(94,true);
  let count=v.getUint32(107,true);
  if(v.getUint8(25)===4&&header>=375&&v.byteLength>=375){const n=Number(v.getBigUint64(247,true));if(n>0)count=n;}
  const minLengths={0:20,1:28,2:26,3:34,6:30,7:36,8:38};
  if(!count||start<header||length<minLengths[format]||!Number.isSafeInteger(count)||start+length*count>v.byteLength)throw new Error('LAS-Punktdaten sind unvollständig oder ungültig.');
  const scale=[131,139,147].map(p=>v.getFloat64(p,true)),offset=[155,163,171].map(p=>v.getFloat64(p,true));
  if(!finite([...scale,...offset])||scale.some(x=>x<=0))throw new Error('Ungültige LAS-Skalierung.');
  const origin=[0,1,2].map(i=>v.getInt32(start+i*4,true)*scale[i]+offset[i]);
  const step=Math.max(1,Math.ceil(count/maxPoints)),n=Math.ceil(count/step);
  const positions=new Float32Array(n*3),colors=new Float32Array(n*3);let j=0;
  const colorOffset={2:20,3:28,7:30,8:30}[format];
  for(let i=0;i<count;i+=step){const p=start+i*length;
    for(let k=0;k<3;k++){positions[j+k]=v.getInt32(p+k*4,true)*scale[k]+offset[k]-origin[k];colors[j+k]=colorOffset===undefined?[.5,.85,.77][k]:v.getUint16(p+colorOffset+k*2,true)/65535;}
    j+=3;
  }
  return{positions,colors,origin,sampled:step>1,total:count,format};
}
export const elements={H:[0xf1f4f2,.31],C:[0x91a7b1,.76],N:[0x6995ff,.71],O:[0xf37070,.66],S:[0xf2cf60,1.05],P:[0xffa963,1.07],F:[0x92e28f,.57],CL:[0x79d68a,1.02],BR:[0xbd7857,1.2],I:[0xae83d0,1.39],FE:[0xe79d74,1.32],CA:[0xaed885,1.76],ZN:[0xa6c7dd,1.22],MG:[0x9cdba5,1.41]};
export function parseMolecule(text,ext){
  const atoms=[],bonds=[];const lines=text.split(/\r?\n/);let explicit=false;
  function atom(x,y,z,element,serial){if(!finite([x,y,z]))throw new Error('Ungültige Atomkoordinaten.');atoms.push({x,y,z,element:element.toUpperCase(),serial});}
  if(ext==='pdb'){
    const ids=new Map();const connects=[];
    for(const l of lines){if(l.startsWith('ENDMDL'))break;
      if(/^(ATOM  |HETATM)/.test(l)){
        if(![' ','A',''].includes(l.slice(16,17)))continue;
        const serial=parseInt(l.slice(6,11));if(ids.has(serial))continue;
        const element=l.slice(76,78).trim()||l.slice(12,16).trim().replace(/^\d+/,'').slice(0,1);
        ids.set(serial,atoms.length);atom(+l.slice(30,38),+l.slice(38,46),+l.slice(46,54),element,serial);
      }else if(l.startsWith('CONECT')){const idsLine=l.slice(6).match(/.{1,5}/g)?.map(Number)||[];connects.push(idsLine);}
    }
    const seen=new Set();for(const c of connects){for(const id of c.slice(1)){const a=ids.get(c[0]),b=ids.get(id);if(a===undefined||b===undefined||a===b)continue;const key=[Math.min(a,b),Math.max(a,b)].join(':');if(!seen.has(key)){seen.add(key);bonds.push([a,b]);}}}
    // PDB CONECT commonly describes only ligands; infer missing covalent bonds too.
  }else if(ext==='mol2'){
    let section='';const ids=new Map();for(const l of lines){if(l.startsWith('@<TRIPOS>')){section=l.trim();continue;}const p=l.trim().split(/\s+/);
      if(section==='@<TRIPOS>ATOM'&&p.length>=6){ids.set(+p[0],atoms.length);atom(+p[2],+p[3],+p[4],p[5].split('.')[0],+p[0]);}
      if(section==='@<TRIPOS>BOND'&&p.length>=4)bonds.push([+p[1],+p[2]]);
    }for(const b of bonds){b[0]=ids.get(b[0]);b[1]=ids.get(b[1]);}explicit=true;
  }else{
    if(!lines[3]||!lines[3].includes('V2000'))throw new Error('MOL/SDF: derzeit nur V2000; bitte entsprechend exportieren.');
    const n=parseInt(lines[3].slice(0,3)),m=parseInt(lines[3].slice(3,6));
    if(!Number.isInteger(n)||!Number.isInteger(m)||n<1||m<0||lines.length<4+n+m)throw new Error('Ungültige MOL/SDF-Zähler.');
    for(let i=0;i<n;i++){const l=lines[4+i];atom(+l.slice(0,10),+l.slice(10,20),+l.slice(20,30),l.slice(31,34).trim(),i+1);}
    for(let i=0;i<m;i++){const l=lines[4+n+i];bonds.push([parseInt(l.slice(0,3))-1,parseInt(l.slice(3,6))-1]);}explicit=true;
  }
  if(!atoms.length)throw new Error('Keine Atome gefunden.');if(atoms.length>50000)throw new Error('Diese Kugel-Stab-Vorschau ist auf 50.000 Atome begrenzt.');
  if(bonds.some(b=>b.some(i=>!Number.isInteger(i)||i<0||i>=atoms.length)))throw new Error('Ungültiger Bindungsverweis.');
  if(!explicit){
    const seen=new Set(bonds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(':'))),cells=new Map(),cell=4;
    atoms.forEach((a,i)=>{const grid=[a.x,a.y,a.z].map(x=>Math.floor(x/cell));
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
        for(const j of cells.get([grid[0]+x,grid[1]+y,grid[2]+z].join(','))||[]){const b=atoms[j];const d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),limit=(elements[a.element]?.[1]||.8)+(elements[b.element]?.[1]||.8)+.4;
          if(d>.35&&d<limit&&!seen.has(`${j}:${i}`)){bonds.push([j,i]);seen.add(`${j}:${i}`);}
        }
      }const key=grid.join(',');if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
    });
  }
  return{atoms,bonds,inferred:!explicit};
}
