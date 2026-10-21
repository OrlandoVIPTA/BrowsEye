import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { StereoOutput } from './stereo.js';
import { disposeObject } from './geometry.js';
export class Viewer{
  constructor(container,onStats,onSelect,onError){
    this.container=container;this.scene=new T.Scene();this.scene.background=new T.Color(0x17242a);
    this.renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.renderer.domElement.setAttribute('aria-label','Interaktiver 3D-Viewer');container.prepend(this.renderer.domElement);
    this.camera=new T.PerspectiveCamera(42,1,.01,1000);this.camera.position.set(12,8,12);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=.05;this.controls.maxDistance=150;
    this.output=new StereoOutput(this.renderer);this.strength=30;this.convergence=0;this.root=new T.Group();this.scene.add(this.root);
    this.scene.add(new T.HemisphereLight(0xcbe8f5,0x48534b,2.5));const light=new T.DirectionalLight(0xfff1d3,3.2);light.position.set(7,12,8);this.scene.add(light);const fill=new T.DirectionalLight(0x9ec4ed,1.8);fill.position.set(-8,4,-5);this.scene.add(fill);
    this.grid=new T.GridHelper(40,40,0x44635f,0x2c3f43);this.grid.material.transparent=true;this.grid.material.opacity=.45;this.scene.add(this.grid);
    this.clip=new T.Plane(new T.Vector3(-1,0,0),5);this.highlight=null;this.busySpark=false;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    let start=0,frames=0;this.renderer.setAnimationLoop(time=>{try{
      this.controls.update();const distance=this.camera.position.distanceTo(this.controls.target);
      if(this.spark&&this.current?.splat&&!this.busySpark){this.busySpark=true;this.spark.update({scene:this.scene,camera:this.camera}).catch(e=>{onError(e.message);this.spark.visible=false;}).finally(()=>this.busySpark=false);}
      this.output.render(this.scene,this.camera,distance*this.strength/10000,distance*(1+this.convergence/100));
      frames++;if(time-start>1000){onStats({fps:Math.round(frames*1000/(time-start)),triangles:this.renderer.info.render.triangles,mode:this.output.mode});start=time;frames=0;}
    }catch(e){this.renderer.setAnimationLoop(null);onError(`Darstellung angehalten: ${e.message}`);}});
    let down;this.renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});this.renderer.domElement.addEventListener('pointerup',e=>{
      if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||this.output.mode!=='mono'||this.output.calibration||this.current?.splat)return;
      const r=this.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hit=ray.intersectObject(this.root,true).find(h=>h.object.isMesh);this.select(hit?.object);onSelect(hit?.object);
    });
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.renderer.setAnimationLoop(null);onError('Grafikspeicher-Kontext verloren. Bitte die Seite neu laden oder eine kleinere Datei verwenden.');});
  }
  resize(){const r=this.container.getBoundingClientRect();this.renderer.setSize(Math.max(1,r.width),Math.max(1,r.height));this.camera.aspect=r.width/Math.max(1,r.height);this.camera.updateProjectionMatrix();}
  async setModel(data){
    const bounds=data.bounds?.clone()||new T.Box3().setFromObject(data.object);
    if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)){disposeObject(data.object);throw new Error('Die Datei enthält keine endliche, sichtbare 3D-Geometrie.');}
    if(data.splat&&!this.spark){const {SparkRenderer}=await import('@sparkjsdev/spark');this.spark=new SparkRenderer({renderer:this.renderer,autoUpdate:false,enableLod:false});this.scene.add(this.spark);}
    this.select(null);if(this.current){this.root.remove(this.current.object);disposeObject(this.current.object);}
    this.current=data;this.root.position.set(0,0,0);this.root.scale.setScalar(1);this.root.rotation.set(0,0,0);
    this.root.add(data.object);const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=10/Math.max(size.x,size.y,size.z,1e-6);
    this.root.scale.setScalar(scale);this.root.position.copy(center).multiplyScalar(-scale);this.grid.position.y=-size.y*scale/2-.05;
    this.normalizedSize=size.clone().multiplyScalar(scale);this.sourceSize=size;this.scale=scale;this.renderer.clippingPlanes=[];
    this.fit();if(this.spark)this.spark.visible=!!data.splat;this.setPointSize(3);return{size,scale};
  }
  fit(direction){
    const size=this.normalizedSize||new T.Vector3(10,10,10),radius=size.length()/2;
    const angle=Math.min(T.MathUtils.degToRad(this.camera.fov/2),Math.atan(Math.tan(T.MathUtils.degToRad(this.camera.fov/2))*this.camera.aspect));
    const distance=radius/Math.sin(angle)*1.08;this.controls.target.set(0,0,0);const d=direction||new T.Vector3(1,.65,1.1).normalize();this.camera.position.copy(d).normalize().multiplyScalar(distance);this.camera.near=Math.max(.001,distance/10000);this.camera.far=Math.max(1000,distance*100);this.camera.updateProjectionMatrix();this.controls.update();
  }
  focusPoint(point,{distance}={}){
    if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))throw new Error('Dieser Ausstellungspunkt enthält keine gültige 3D-Position.');
    // Curators enter positions in the coordinate system of the supplied model.
    // `setModel` recentres and scales that model for presentation, so map the
    // station back into that same presentation space here.
    const scale=Math.abs(this.root.scale.x||this.scale||1);
    const target=new T.Vector3(...point).multiplyScalar(scale).add(this.root.position);
    const direction=this.camera.position.clone().sub(this.controls.target);
    if(direction.lengthSq()<1e-8)direction.set(1,.65,1.1);
    direction.normalize();
    const suggested=Number.isFinite(distance)&&distance>0?distance*scale:Math.max(.75,(this.normalizedSize?.length()||10)*.38);
    this.controls.target.copy(target);
    this.camera.position.copy(this.controls.target).add(direction.multiplyScalar(suggested));
    this.camera.near=Math.max(.001,suggested/10000);this.camera.far=Math.max(1000,suggested*100);
    this.camera.updateProjectionMatrix();this.controls.update();
  }
  setAutoRotate(enabled){this.controls.autoRotate=enabled;this.controls.autoRotateSpeed=.75;}
  /** Applies an incremental orbit supplied by a local gesture controller. */
  applyHandOrbit(dx,dy){
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    this.controls.autoRotate=false;
    const offset=this.camera.position.clone().sub(this.controls.target);
    const spherical=new T.Spherical().setFromVector3(offset);
    spherical.theta-=dx*4.2;
    spherical.phi=T.MathUtils.clamp(spherical.phi+dy*3.2,.08,Math.PI-.08);
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
  }
  /** Positive spread means zoom in, while preserving the current target. */
  applyHandZoom(delta){
    if(!Number.isFinite(delta)||!this.normalizedSize)return;
    this.controls.autoRotate=false;
    const offset=this.camera.position.clone().sub(this.controls.target);
    const min=Math.max(.03,this.normalizedSize.length()*.035),max=Math.max(min*2,this.normalizedSize.length()*8);
    const distance=T.MathUtils.clamp(offset.length()*Math.exp(-delta*2.4),min,max);
    if(offset.lengthSq()<1e-8)offset.set(1,.65,1.1);
    this.camera.position.copy(this.controls.target).add(offset.normalize().multiplyScalar(distance));
    this.camera.lookAt(this.controls.target);
  }
  setPointSize(value){this.root.traverse(o=>{if(o.isPoints)o.material.size=value*.01/this.scale;});}
  setWireframe(value){this.root.traverse(o=>{for(const m of [].concat(o.material||[]))if('wireframe'in m)m.wireframe=value;});}
  setClip(value){this.clip.constant=value/100*10-5;this.renderer.clippingPlanes=value>=100||this.current?.splat?[]:[this.clip];}
  select(object){if(this.highlight){this.scene.remove(this.highlight);this.highlight.geometry.dispose();this.highlight.material.dispose();this.highlight=null;}if(object){this.highlight=new T.BoxHelper(object,0x9eefcd);this.scene.add(this.highlight);}}
  screenshot(){this.output.render(this.scene,this.camera,this.camera.position.distanceTo(this.controls.target)*this.strength/10000,this.camera.position.distanceTo(this.controls.target)*(1+this.convergence/100));return new Promise(resolve=>this.renderer.domElement.toBlob(resolve,'image/png'));}
}
