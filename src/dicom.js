import dicomParser from 'dicom-parser';
import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { surfaceMaterial } from './geometry.js';
const numbers = (s) => s?.split('\\').map(Number);
export function decodeDicom(buffer){
  let ds;try{ds=dicomParser.parseDicom(new Uint8Array(buffer));}catch{throw new Error('DICOM konnte nicht gelesen werden. Erwartet wird eine Part-10-Datei.');}
  const syntax=ds.string('x00020010');
  if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1'].includes(syntax))throw new Error('DICOM-Transfer-Syntax nicht unterstützt: bitte unkomprimiert als Little Endian exportieren.');
  const rows=ds.uint16('x00280010'),cols=ds.uint16('x00280011'),bits=ds.uint16('x00280100'),stored=ds.uint16('x00280101'),high=ds.uint16('x00280102'),signed=ds.uint16('x00280103');
  const photo=ds.string('x00280004'),frames=Number(ds.string('x00280008')||1),samples=ds.uint16('x00280002');
  if(!rows||!cols||![8,16].includes(bits)||!stored||stored>bits||high!==stored-1||![0,1].includes(signed)||samples!==1||frames!==1||!['MONOCHROME1','MONOCHROME2'].includes(photo))throw new Error('DICOM: nur einzelne monochrome 8/16-Bit-Frames mit standardmäßiger Bit-Anordnung.');
  const el=ds.elements.x7fe00010,count=rows*cols;
  if(!el||el.encapsulatedPixelData||el.length<count*bits/8||el.dataOffset+count*bits/8>buffer.byteLength)throw new Error('DICOM-Pixeldaten fehlen oder sind unvollständig.');
  const slope=Number(ds.string('x00281053')||1),intercept=Number(ds.string('x00281052')||0);
  if(!Number.isFinite(slope)||!Number.isFinite(intercept)||slope===0)throw new Error('Ungültige DICOM-Intensitätsskalierung.');
  const dv=new DataView(buffer,el.dataOffset,count*bits/8),pixels=new Float32Array(count);let min=Infinity,max=-Infinity;
  for(let i=0;i<count;i++){let value=(bits===8?dv.getUint8(i):dv.getUint16(i*2,true))&((1<<stored)-1);if(signed&&value>=(1<<(stored-1)))value-=1<<stored;value=value*slope+intercept;pixels[i]=value;min=Math.min(min,value);max=Math.max(max,value);}
  return{rows,cols,pixels,min,max,invert:photo==='MONOCHROME1',position:numbers(ds.string('x00200032')),orientation:numbers(ds.string('x00200037')),spacing:numbers(ds.string('x00280030')),series:ds.string('x0020000e'),thickness:Number(ds.string('x00180050')||1)};
}
export function assembleDicom(slices){
  if(!slices.length)throw new Error('Keine DICOM-Bilder ausgewählt.');
  const first=slices[0],multiple=slices.length>1;
  if(slices.some(s=>s.rows!==first.rows||s.cols!==first.cols||s.series!==first.series||s.invert!==first.invert))throw new Error('Bitte nur Bilder einer DICOM-Serie mit gleicher Bildgröße auswählen.');
  const hasGeometry=slices.every(s=>s.position?.length===3&&s.orientation?.length===6&&s.spacing?.length===2&&[...s.position,...s.orientation,...s.spacing].every(Number.isFinite)&&s.spacing.every(x=>x>0));
  if(multiple&&(!first.series||!hasGeometry))throw new Error('Für eine räumliche Serie fehlen SeriesInstanceUID, Bildposition, Orientierung oder Pixelabstand.');
  const orientation=hasGeometry?first.orientation:[1,0,0,0,1,0],spacing=hasGeometry?first.spacing:[1,1];
  const x=new T.Vector3(...orientation.slice(0,3)),y=new T.Vector3(...orientation.slice(3,6));
  if(Math.abs(x.length()-1)>.001||Math.abs(y.length()-1)>.001||Math.abs(x.dot(y))>.001)throw new Error('Ungültige DICOM-Bildorientierung.');
  const z=new T.Vector3().crossVectors(x,y).normalize();
  if(hasGeometry&&slices.some(s=>s.orientation.some((v,i)=>Math.abs(v-orientation[i])>.0001)||s.spacing.some((v,i)=>Math.abs(v-spacing[i])>.0001)))throw new Error('Unterschiedliche Schnittebenen/Pixelabstände werden noch nicht unterstützt.');
  if(hasGeometry)slices.sort((a,b)=>new T.Vector3(...a.position).dot(z)-new T.Vector3(...b.position).dot(z));
  let gap=Number.isFinite(first.thickness)&&first.thickness>0?first.thickness:1;
  if(multiple){
    const origin=new T.Vector3(...slices[0].position),next=new T.Vector3(...slices[1].position);gap=next.clone().sub(origin).dot(z);
    if(gap<.0001)throw new Error('Doppelte DICOM-Schnittpositionen.');
    slices.forEach((s,i)=>{const delta=new T.Vector3(...s.position).sub(origin);if(Math.abs(delta.dot(z)-i*gap)>Math.max(.01,gap*.01)||Math.abs(delta.dot(x))>.01||Math.abs(delta.dot(y))>.01)throw new Error('Unregelmäßige oder versetzte DICOM-Serie: bitte vorher auf ein reguläres Volumen resamplen.');});
  }
  return{slices,rows:first.rows,cols:first.cols,gap,spacing,orientation,hasGeometry,min:Math.min(...slices.map(s=>s.min)),max:Math.max(...slices.map(s=>s.max))};
}
export function dicomObject(volume){
  const {slices,cols,rows,spacing,gap}=volume,group=new T.Group();
  const extent=new T.Vector3(Math.max(1,cols-1)*spacing[1],Math.max(1,rows-1)*spacing[0],Math.max(1,slices.length-1)*gap);
  const basis=new T.Matrix4().makeBasis(new T.Vector3(...volume.orientation.slice(0,3)),new T.Vector3(...volume.orientation.slice(3,6)),new T.Vector3().crossVectors(new T.Vector3(...volume.orientation.slice(0,3)),new T.Vector3(...volume.orientation.slice(3,6))));
  group.setRotationFromMatrix(basis);group.name='DICOM · Forschungsansicht';
  const bytes=new Uint8Array(rows*cols*4),texture=new T.DataTexture(bytes,cols,rows,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
  const plane=new T.Mesh(new T.PlaneGeometry(extent.x,extent.y),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));plane.name='Schnittebene';group.add(plane);
  const box=new T.Box3(extent.clone().multiplyScalar(-.5),extent.clone().multiplyScalar(.5));
  const helper=new T.Box3Helper(box,0x63857d);group.add(helper);group.userData.localBounds=box.clone().applyMatrix4(basis);
  let surface=null;
  const controller={index:Math.floor(slices.length/2),threshold:(volume.min+volume.max)/2,window:Math.max(1,volume.max-volume.min),level:(volume.min+volume.max)/2,
    setSlice(index){this.index=index;const s=slices[index],low=this.level-this.window/2;for(let i=0;i<s.pixels.length;i++){let c=Math.round(255*T.MathUtils.clamp((s.pixels[i]-low)/this.window,0,1));if(s.invert)c=255-c;bytes.set([c,c,c,255],i*4);}texture.needsUpdate=true;plane.position.z=slices.length>1?index*gap-extent.z/2:0;},
    setSurface(enabled,threshold=this.threshold){
      this.threshold=threshold;
      if(!enabled){if(surface)surface.visible=false;return;}
      if(slices.length<3)throw new Error('Eine Isofläche benötigt mindestens drei reguläre Schichten.');
      if(!surface){const n=48;surface=new MarchingCubes(n,surfaceMaterial(0xddc4a2),false,false,150000);surface.name='Isofläche · 48³ Vorschau';
        for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++)surface.field[x+y*n+z*n*n]=slices[Math.round(z/(n-1)*(slices.length-1))].pixels[Math.round(y/(n-1)*(rows-1))*cols+Math.round(x/(n-1)*(cols-1))];
        surface.scale.copy(extent).multiplyScalar(n/(n-1)/2);surface.position.copy(extent).multiplyScalar(1/(2*(n-1)));group.add(surface);
      }surface.visible=true;surface.isolation=threshold;surface.update();
    },volume};
  controller.setSlice(controller.index);return{object:group,controller};
}
