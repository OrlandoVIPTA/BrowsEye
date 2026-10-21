import { IfcAPI } from 'web-ifc';
self.onmessage=async({data})=>{
  const api=new IfcAPI();let model;
  try{
    api.SetWasmPath('/vendor/',true);await api.Init();
    model=api.OpenModel(new Uint8Array(data.buffer),{COORDINATE_TO_ORIGIN:true});
    if(model<0)throw new Error('IFC konnte nicht geöffnet werden.');
    const meshes=[];
    api.StreamAllMeshes(model,flat=>{
      let name=`IFC #${flat.expressID}`;try{const p=api.GetLine(model,flat.expressID);name=p.Name?.value||name;}catch{}
      for(let i=0;i<flat.geometries.size();i++){
        const placed=flat.geometries.get(i),g=api.GetGeometry(model,placed.geometryExpressID);
        const vertices=api.GetVertexArray(g.GetVertexData(),g.GetVertexDataSize()),indices=api.GetIndexArray(g.GetIndexData(),g.GetIndexDataSize()).slice();
        const positions=new Float32Array(vertices.length/2),normals=new Float32Array(vertices.length/2);
        for(let j=0,k=0;j<vertices.length;j+=6,k+=3){positions.set(vertices.subarray(j,j+3),k);normals.set(vertices.subarray(j+3,j+6),k);}
        meshes.push({positions,normals,indices,matrix:Array.from(placed.flatTransformation),color:[placed.color.x,placed.color.y,placed.color.z,placed.color.w],name:String(name),expressID:flat.expressID});
        g.delete();
      }
    });
    if(!meshes.length)throw new Error('Keine darstellbare IFC-Geometrie gefunden.');
    self.postMessage({result:meshes},meshes.flatMap(m=>[m.positions.buffer,m.normals.buffer,m.indices.buffer]));
  }catch(error){self.postMessage({error:error.message});}
  finally{if(model!==undefined&&model>=0)api.CloseModel(model);api.Dispose();}
};
