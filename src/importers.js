import * as T from 'three';
import { extension, maxFileBytes, unsupportedMessage } from './formats.js';
import { parseLAS,parsePointText,parseMolecule } from './parsers.js';
import { pointObject,moleculeObject,meshFromArrays,surfaceMaterial } from './geometry.js';
const text = buffer => new TextDecoder().decode(buffer);
export function runWorker(worker,buffer,ext){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('Import nach 120 Sekunden beendet. Bitte kleinere Datei oder gröbere Tessellierung verwenden.'));},120000);
    const finish=()=>{clearTimeout(timer);worker.terminate();};
    worker.onmessage=({data})=>{finish();data.error?reject(new Error(data.error)):resolve(data.result);};worker.onerror=e=>{finish();reject(new Error(e.message||'Importer konnte nicht gestartet werden.'));};
    worker.postMessage({buffer,ext},[buffer]);
  });
}
function localManager(files, primary){
  const urls=[], byPath=new Map(), byName=new Map();
  const normalize=p=>decodeURIComponent(p).replaceAll('\\','/').replace(/^\.\//,'');
  for(const file of files){const p=normalize(file.webkitRelativePath||file.name);byPath.set(p,file);const list=byName.get(file.name)||[];list.push(file);byName.set(file.name,list);}
  const primaryPath=normalize(primary.webkitRelativePath||primary.name),base=primaryPath.includes('/')?primaryPath.slice(0,primaryPath.lastIndexOf('/')+1):'';
  const manager=new T.LoadingManager();let failed=null;
  manager.setURLModifier(url=>{
    if(url.startsWith('data:')||url.startsWith('blob:')||url.startsWith('/vendor/draco/'))return url;
    const clean=normalize(url),name=clean.split('/').pop();
    const file=byPath.get(base+clean)||byPath.get(clean)||(byName.get(name)?.length===1?byName.get(name)[0]:null);
    if(!file)throw new Error(`Begleitdatei fehlt oder ist nicht eindeutig: ${name}. Bitte das Modell samt Texturen gemeinsam auswählen.`);
    const objectUrl=URL.createObjectURL(file);urls.push(objectUrl);return objectUrl;
  });
  manager.onError=url=>{failed=`Begleitdatei konnte nicht geladen werden: ${url.startsWith('blob:')?'Textur/Geometrie':url}`;};
  return{manager,release:()=>{urls.forEach(u=>URL.revokeObjectURL(u));},getError:()=>failed};
}
export async function importFile(file,files=[file]){
  if(file.size>maxFileBytes)throw new Error('Einzeldateien sind in dieser Version auf 256 MB begrenzt.');
  const buffer=await file.arrayBuffer(),ext=extension(file.name);let object,kind='3D-Modell',note='',unit='nicht angegeben',bounds,splat=false;
  const result=()=>({object,kind,note,unit,bounds,splat});
  if(['step','stp','iges','igs','brep'].includes(ext)){
    const data=await runWorker(new Worker('/vendor/cad-worker.js'),buffer,ext);
    object=new T.Group();
    const buildNode=node=>{const group=new T.Group();group.name=node.name||'Baugruppe';for(const i of node.meshes||[]){const m=data.meshes[i];const mesh=meshFromArrays({positions:m.attributes.position.array,normals:m.attributes.normal?.array,indices:m.index.array,color:m.color,name:m.name});
      // OCCT face colours are triangle ranges in an otherwise shared mesh.
      const materials=[mesh.material];for(const f of m.brep_faces||[]){if(!f.color)continue;const material=surfaceMaterial(new T.Color(...f.color));materials.push(material);mesh.geometry.addGroup(f.first*3,(f.last-f.first+1)*3,materials.length-1);}
      if(materials.length>1){const groups=mesh.geometry.groups.slice().sort((a,b)=>a.start-b.start);mesh.geometry.clearGroups();let cursor=0;for(const g of groups){if(g.start>cursor)mesh.geometry.addGroup(cursor,g.start-cursor,0);mesh.geometry.addGroup(g.start,g.count,g.materialIndex);cursor=g.start+g.count;}if(cursor<mesh.geometry.index.count)mesh.geometry.addGroup(cursor,mesh.geometry.index.count-cursor,0);mesh.material=materials;}
      group.add(mesh);
    }for(const child of node.children||[])group.add(buildNode(child));return group;};
    object.add(buildNode(data.root));kind='CAD';unit=ext==='brep'?'nicht angegeben':'Meter';note='Flächen tesselliert · Originaldatei bleibt unverändert';return result();
  }
  if(ext==='ifc'){
    const meshes=await runWorker(new Worker(new URL('./ifc.worker.js',import.meta.url),{type:'module'}),buffer,ext);object=new T.Group();for(const m of meshes){const mesh=meshFromArrays(m);mesh.userData.expressID=m.expressID;object.add(mesh);}kind='BIM / IFC';unit='Meter';note='Lokaler Ursprung · Bauteilnamen und Express-IDs';return result();
  }
  if(['pdb','sdf','mol','mol2'].includes(ext)){const data=parseMolecule(text(buffer),ext);object=moleculeObject(data);kind='Molekül';unit='Ångström';note=`${data.atoms.length} Atome · ${data.bonds.length} Bindungen${data.inferred?' (teilweise geometrisch geschätzt)':''} · erstes Modell`;return result();}
  if(['las','xyz','pts'].includes(ext)){const data=ext==='las'?parseLAS(buffer):parsePointText(text(buffer));object=pointObject(data);if(ext==='las')object.rotation.x=-Math.PI/2;object.userData.sourceOrigin=data.origin;kind='Punktwolke';note=`${data.positions.length/3} Punkte${data.sampled?' · ausgedünnte Vorschau':''} · lokaler Ursprung ${data.origin.map(v=>v.toFixed(2)).join(', ')}${data.skipped?` · ${data.skipped} ungültige Zeilen ausgelassen`:''}`;return result();}
  const header=ext==='ply'?text(buffer.slice(0,16384)):'';
  if(['spz','splat','ksplat','sog'].includes(ext)||(ext==='ply'&&(/property\s+float\s+(scale_0|f_dc_0)/.test(header)||/element\s+chunk\s/.test(header)))){
    const {SplatMesh,SplatFileType}=await import('@sparkjsdev/spark');
    object=new SplatMesh({fileBytes:new Uint8Array(buffer),fileType:SplatFileType[ext.toUpperCase()],fileName:file.name,enableLod:false});await object.initialized;
    object.rotation.x=Math.PI;object.updateMatrixWorld();bounds=object.getBoundingBox().applyMatrix4(object.matrixWorld);kind='Gaussian Splat';note='Spark · statische Szene';splat=true;return result();
  }
  const local=localManager(files,file);
  try{
    if(ext==='glb'||ext==='gltf'){
      const [{GLTFLoader},{DRACOLoader},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/loaders/DRACOLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
      const draco=new DRACOLoader(local.manager).setDecoderPath('/vendor/draco/');try{const gltf=await new GLTFLoader(local.manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer,'');object=gltf.scene;note=gltf.animations.length?'Animationen: statische Ausgangspose':'';}finally{draco.dispose();}
    }else if(ext==='obj'){
      const {OBJLoader}=await import('three/addons/loaders/OBJLoader.js');const loader=new OBJLoader(local.manager),source=text(buffer),mtlNames=[...source.matchAll(/^mtllib\s+(.+)$/gm)].map(m=>m[1].trim());
      if(mtlNames.length){const {MTLLoader}=await import('three/addons/loaders/MTLLoader.js');const all={};for(const name of mtlNames){const candidates=files.filter(f=>f.name===name.split('/').pop());if(candidates.length!==1)throw new Error(`OBJ-Materialdatei fehlt oder ist mehrdeutig: ${name}`);const materials=new MTLLoader(local.manager).parse(await candidates[0].text(),'');Object.assign(all,materials.materialsInfo);}const combined=new MTLLoader(local.manager).parse('','');combined.setManager(local.manager);combined.setMaterials(all);loader.setMaterials(combined);}
      object=loader.parse(source);
    }else if(ext==='ply'){
      const {PLYLoader}=await import('three/addons/loaders/PLYLoader.js');const g=new PLYLoader().parse(buffer);if(g.index){g.computeVertexNormals();const m=surfaceMaterial();m.vertexColors=!!g.attributes.color;object=new T.Mesh(g,m);}else{object=new T.Points(g,new T.PointsMaterial({size:.025,vertexColors:!!g.attributes.color,color:g.attributes.color?0xffffff:0x9aefcd}));kind='Punktwolke';}
    }else if(ext==='stl'){
      const {STLLoader}=await import('three/addons/loaders/STLLoader.js');const g=new STLLoader().parse(buffer),m=surfaceMaterial();m.vertexColors=!!g.attributes.color;object=new T.Mesh(g,m);
    }else if(ext==='fbx'){const {FBXLoader}=await import('three/addons/loaders/FBXLoader.js');object=new FBXLoader(local.manager).parse(buffer,'');note='Statische Ausgangspose';
    }else if(ext==='dae'){const {ColladaLoader}=await import('three/addons/loaders/ColladaLoader.js');object=new ColladaLoader(local.manager).parse(text(buffer),'').scene;
    }else if(ext==='3mf'){const {ThreeMFLoader}=await import('three/addons/loaders/3MFLoader.js');object=new ThreeMFLoader(local.manager).parse(buffer);unit='gemäß Datei';
    }else if(ext==='pcd'){const {PCDLoader}=await import('three/addons/loaders/PCDLoader.js');object=new PCDLoader().parse(buffer);kind='Punktwolke';
    }else if(ext==='vtk'){const {VTKLoader}=await import('three/addons/loaders/VTKLoader.js');const g=new VTKLoader().parse(buffer);if(!g.attributes.normal)g.computeVertexNormals();object=new T.Mesh(g,surfaceMaterial());
    }else throw new Error(unsupportedMessage(file.name));
    // Let texture decoding finish before releasing the local object URLs.
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Texturimport hat das Zeitlimit überschritten.')),15000);local.manager.onLoad=()=>{clearTimeout(t);resolve();};setTimeout(()=>{if(!object)return;const maps=[];object.traverse(o=>{for(const m of [].concat(o.material||[]))for(const val of Object.values(m))if(val?.isTexture&&val.image?.tagName==='IMG'&&!val.image.complete)maps.push(val.image);});if(!maps.length){clearTimeout(t);resolve();}},0);});
    if(local.getError())note=(note?note+' · ':'')+'Mindestens eine Textur konnte nicht geladen werden.';
    if(!object)throw new Error('Keine Geometrie gefunden.');return result();
  }finally{local.release();}
}
export async function importDicom(files){
  if(files.reduce((n,f)=>n+f.size,0)>512*1024*1024)throw new Error('DICOM-Serien sind auf 512 MB begrenzt.');
  const {decodeDicom,assembleDicom,dicomObject}=await import('./dicom.js');const slices=[];
  for(const file of files)slices.push(decodeDicom(await file.arrayBuffer()));
  const volume=assembleDicom(slices),data=dicomObject(volume);
  return{...data,bounds:data.object.userData.localBounds,kind:'DICOM-Serie',unit:volume.hasGeometry?'Millimeter':'Pixel (Geometrie fehlt)',note:`${slices.length} Schichten · ${volume.cols} × ${volume.rows} · Forschungsansicht, nicht diagnostisch validiert`};
}
