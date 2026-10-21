// Classic worker keeps Open CASCADE's Emscripten loader independent of the app bundle.
importScripts('/vendor/occt/occt-import-js.js');
let engine;
self.onmessage=async({data})=>{
  try{
    engine??=await occtimportjs({locateFile:name=>`/vendor/occt/${name}`});
    const method=['step','stp'].includes(data.ext)?'ReadStepFile':['iges','igs'].includes(data.ext)?'ReadIgesFile':'ReadBrepFile';
    const result=engine[method](new Uint8Array(data.buffer),{linearUnit:'meter',linearDeflectionType:'bounding_box_ratio',linearDeflection:.0025,angularDeflection:.5});
    if(!result.success||!result.meshes?.length)throw new Error('Keine darstellbaren CAD-Flächen gefunden.');
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
