import * as T from 'three';
import { elements } from './parsers.js';
export const surfaceMaterial = (color=0xc3d9df) => new T.MeshStandardMaterial({color,roughness:.6,metalness:.12,side:T.DoubleSide});
export function pointObject(data){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(data.positions,3));if(data.colors)g.setAttribute('color',new T.BufferAttribute(data.colors,3));return new T.Points(g,new T.PointsMaterial({size:.025,vertexColors:!!data.colors,color:data.colors?0xffffff:0x9aefcd,sizeAttenuation:true}));}
export function moleculeObject({atoms,bonds}){
  const group=new T.Group(),dummy=new T.Object3D();
  const mesh=new T.InstancedMesh(new T.SphereGeometry(1,16,12),surfaceMaterial(),atoms.length);
  atoms.forEach((a,i)=>{dummy.position.set(a.x,a.y,a.z);dummy.scale.setScalar((elements[a.element]?.[1]||.8)*.43);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color(elements[a.element]?.[0]||0xb88ed5));});
  mesh.name=`${atoms.length.toLocaleString('de')} Atome`;mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
  const sticks=new T.InstancedMesh(new T.CylinderGeometry(.09,.09,1,8),surfaceMaterial(0x8196a1),bonds.length),direction=new T.Vector3(),up=new T.Vector3(0,1,0);
  bonds.forEach(([i,j],n)=>{const a=new T.Vector3(atoms[i].x,atoms[i].y,atoms[i].z),b=new T.Vector3(atoms[j].x,atoms[j].y,atoms[j].z);direction.subVectors(b,a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.scale.set(1,direction.length(),1);dummy.quaternion.setFromUnitVectors(up,direction.normalize());dummy.updateMatrix();sticks.setMatrixAt(n,dummy.matrix);});
  sticks.name=`${bonds.length.toLocaleString('de')} Bindungen`;sticks.instanceMatrix.needsUpdate=true;group.add(sticks);return group;
}
export function disposeObject(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{if(o.isSplatMesh||o.constructor?.name==='SplatMesh'){o.dispose?.();return;}if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}
export function meshFromArrays(data){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));if(data.normals)g.setAttribute('normal',new T.Float32BufferAttribute(data.normals,3));if(data.indices)g.setIndex(new T.BufferAttribute(new Uint32Array(data.indices),1));if(!data.normals)g.computeVertexNormals();
  const c=data.color||[.68,.8,.85,1],m=surfaceMaterial(new T.Color(c[0],c[1],c[2]));m.opacity=c[3]??1;m.transparent=m.opacity<1;const mesh=new T.Mesh(g,m);mesh.name=data.name||'Bauteil';if(data.matrix)mesh.applyMatrix4(new T.Matrix4().fromArray(data.matrix));return mesh;
}
