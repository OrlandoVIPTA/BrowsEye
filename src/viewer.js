import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { StereoOutput } from './stereo.js';
import { disposeObject } from './geometry.js';
import { detectGamepadProfile, gamepadNavigationFrame, movementIntent } from './navigation.js';
export class Viewer{
  constructor(container,onStats,onSelect,onError,onNavigationChange=()=>{}){
    this.container=container;this.scene=new T.Scene();this.scene.background=new T.Color(0x17242a);
    this.renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.renderer.domElement.setAttribute('aria-label','Interaktiver 3D-Viewer');container.prepend(this.renderer.domElement);
    this.camera=new T.PerspectiveCamera(42,1,.01,1000);this.camera.position.set(12,8,12);this.camera.rotation.order='YXZ';
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=.05;this.controls.maxDistance=150;
    this.output=new StereoOutput(this.renderer);this.strength=30;this.convergence=0;this.root=new T.Group();this.scene.add(this.root);
    this.scene.add(new T.HemisphereLight(0xcbe8f5,0x48534b,2.5));const light=new T.DirectionalLight(0xfff1d3,3.2);light.position.set(7,12,8);this.scene.add(light);const fill=new T.DirectionalLight(0x9ec4ed,1.8);fill.position.set(-8,4,-5);this.scene.add(fill);
    this.grid=new T.GridHelper(40,40,0x44635f,0x2c3f43);this.grid.material.transparent=true;this.grid.material.opacity=.45;this.scene.add(this.grid);
    this.clip=new T.Plane(new T.Vector3(-1,0,0),5);this.highlight=null;this.busySpark=false;this.onError=onError;this.onNavigationChange=typeof onNavigationChange==='function'?onNavigationChange:()=>{};this.streamingSession=null;
    // Navigation deliberately has no dependency on a specific controller brand.
    // It consumes the browser's standard Gamepad mapping, while an optional
    // streaming/scan adapter can supply accurate collision data synchronously.
    this.navigation={mode:'orbit',keys:new Set(),yaw:0,pitch:0,speed:1.8,sprintMultiplier:1.8,lookSensitivity:.0022,gamepadLookSensitivity:1.65,deadzone:.2,groundY:0,eyeHeight:1.65,radius:.22,collisionProvider:null,collisionMesh:null,spawn:null,stereoIpd:.064,stereoFocus:2.5,pointerLockBlocked:false,gamepadId:null,gamepadProfile:'standard',gamepadProfilePreference:'auto',gamepadCalibration:null};
    this._navigationForward=new T.Vector3();this._navigationRight=new T.Vector3();this._navigationDown=new T.Vector3(0,-1,0);this._navigationRaycaster=new T.Raycaster();this._navigationGroundRaycaster=new T.Raycaster();
    this._onNavigationKeyDown=e=>{if(this.navigation.mode==='orbit'||/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName||''))return;if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){this.navigation.keys.add(e.code);e.preventDefault();}};
    this._onNavigationKeyUp=e=>{this.navigation.keys.delete(e.code);};
    this._navigationDrag=null;
    this._isNavigationPointerLocked=()=>document.pointerLockElement===this.renderer.domElement;
    this._updateNavigationPointerClass=()=>{const canvas=this.renderer.domElement;canvas.classList.toggle('navigation-look',this._isNavigationPointerLocked());canvas.classList.toggle('navigation-drag',!!this._navigationDrag&&!this._isNavigationPointerLocked());};
    this._notifyNavigationState=()=>this.onNavigationChange(this.getNavigationState());
    this._onNavigationMouseMove=e=>{if(this._isNavigationPointerLocked()&&this.navigation.mode!=='orbit')this.applyFirstPersonLook(e.movementX,e.movementY);};
    this._onNavigationPointerMove=e=>{
      const drag=this._navigationDrag;
      if(this.navigation.mode==='orbit'||!drag||drag.pointerId!==e.pointerId||this._isNavigationPointerLocked())return;
      if(!(e.buttons&1)){this._endNavigationDrag(e);return;}
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
      if(dx||dy)this.applyFirstPersonLook(dx,dy);
    };
    this._onNavigationPointerLockChange=()=>{if(this._isNavigationPointerLocked()){this.navigation.pointerLockBlocked=false;this._endNavigationDrag();}this._updateNavigationPointerClass();this._notifyNavigationState();};
    this._onNavigationPointerLockError=()=>{if(this.navigation.mode!=='orbit'){this.navigation.pointerLockBlocked=true;this._updateNavigationPointerClass();this._notifyNavigationState();}};
    window.addEventListener('keydown',this._onNavigationKeyDown);window.addEventListener('keyup',this._onNavigationKeyUp);document.addEventListener('mousemove',this._onNavigationMouseMove);document.addEventListener('pointerlockchange',this._onNavigationPointerLockChange);document.addEventListener('pointerlockerror',this._onNavigationPointerLockError);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    let start=0,frames=0,lastFrame=0;this.renderer.setAnimationLoop(time=>{try{
      const delta=Math.min(.1,Math.max(0,(time-lastFrame)/1000));lastFrame=time;
      if(this.navigation.mode==='orbit')this.controls.update();else this._updateFirstPerson(delta);
      this.streamingSession?.update?.(this.camera,delta);
      const stereo=this._stereoParameters();
      if(this.spark&&this.current?.splat&&!this.busySpark){this.busySpark=true;this.spark.update({scene:this.scene,camera:this.camera}).catch(e=>{onError(e.message);this.spark.visible=false;}).finally(()=>this.busySpark=false);}
      this.output.render(this.scene,this.camera,stereo.separation,stereo.focus,eyeCamera=>this.streamingSession?.beforeEyeRender?.(eyeCamera));
      frames++;if(time-start>1000){onStats({fps:Math.round(frames*1000/(time-start)),triangles:this.renderer.info.render.triangles,mode:this.output.mode});start=time;frames=0;}
    }catch(e){this.renderer.setAnimationLoop(null);onError(`Darstellung angehalten: ${e.message}`);}});
    let down;this.renderer.domElement.addEventListener('pointerdown',e=>{if(this.navigation.mode!=='orbit'&&e.button===0){down=null;this._beginNavigationDrag(e);this.requestNavigationPointerLock();e.preventDefault();return;}down=[e.clientX,e.clientY];});this.renderer.domElement.addEventListener('pointermove',this._onNavigationPointerMove);this.renderer.domElement.addEventListener('pointerup',e=>{
      if(this.navigation.mode!=='orbit'){this._endNavigationDrag(e);return;}if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||this.output.mode!=='mono'||this.output.calibration||this.current?.splat)return;
      const r=this.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hit=ray.intersectObject(this.root,true).find(h=>h.object.isMesh);this.select(hit?.object);onSelect(hit?.object);
    });this.renderer.domElement.addEventListener('pointercancel',e=>this._endNavigationDrag(e));
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.renderer.setAnimationLoop(null);onError('Grafikspeicher-Kontext verloren. Bitte die Seite neu laden oder eine kleinere Datei verwenden.');});
  }
  resize(){const r=this.container.getBoundingClientRect();this.renderer.setSize(Math.max(1,r.width),Math.max(1,r.height));this.camera.aspect=r.width/Math.max(1,r.height);this.camera.updateProjectionMatrix();}
  setOutputMode(mode){
    if(!['mono','sbs','tb','rows','left','right'].includes(mode))throw new Error('Unbekanntes Ausgabeformat.');
    this.output.mode=mode;
    // Calibration deliberately owns the output until it is turned off. Clear
    // it here so switching back to 2D can never leave a stale stereo frame.
    this.output.calibration=false;
    this.renderer.setRenderTarget(null);this.renderer.clear(true,true,true);
    return mode;
  }
  _beginNavigationDrag(event){
    if(this.navigation.mode==='orbit'||event.button!==0)return false;
    this._navigationDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    try{this.renderer.domElement.setPointerCapture?.(event.pointerId);}catch{}
    this._updateNavigationPointerClass();return true;
  }
  _endNavigationDrag(event){
    const drag=this._navigationDrag;if(!drag||event?.pointerId!==undefined&&drag.pointerId!==event.pointerId)return;
    try{this.renderer.domElement.releasePointerCapture?.(drag.pointerId);}catch{}
    this._navigationDrag=null;this._updateNavigationPointerClass();
  }
  _stereoParameters(){
    const distance=this.camera.position.distanceTo(this.controls.target);
    // An Ego camera has no meaningful orbit distance.  Keep its eye spacing
    // physically stable for every scene type, otherwise the stereo geometry
    // jumps as soon as the orbit target is replaced by the forward look point.
    if(this.navigation.mode!=='orbit'){
      return {separation:this.navigation.stereoIpd*this.strength/100,focus:Math.max(.05,this.navigation.stereoFocus*(1+this.convergence/100))};
    }
    return {separation:distance*this.strength/10000,focus:distance*(1+this.convergence/100)};
  }
  _clearCurrent(){
    this.setNavigationMode('orbit');
    if(this.spark)this.spark.visible=false;
    if(this.streamingSession){try{this.streamingSession.dispose?.();}catch(error){this.onError?.(`Streaming-Szene konnte nicht vollständig beendet werden: ${error.message||error}`);}this.streamingSession=null;}
    if(this.current){this.root.remove(this.current.object);disposeObject(this.current.object);this.current=null;}
    this.renderer.clippingPlanes=[];
  }
  async setModel(data){
    const bounds=data.bounds?.clone()||new T.Box3().setFromObject(data.object);
    if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)){disposeObject(data.object);throw new Error('Die Datei enthält keine endliche, sichtbare 3D-Geometrie.');}
    if(data.splat&&!this.spark){const {SparkRenderer}=await import('@sparkjsdev/spark');this.spark=new SparkRenderer({renderer:this.renderer,autoUpdate:false,enableLod:false});this.scene.add(this.spark);}
    this.select(null);this._clearCurrent();this.sceneBounds=null;this.current=data;this.root.position.set(0,0,0);this.root.scale.setScalar(1);this.root.rotation.set(0,0,0);
    this.root.add(data.object);const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=10/Math.max(size.x,size.y,size.z,1e-6);
    this.root.scale.setScalar(scale);this.root.position.copy(center).multiplyScalar(-scale);this.grid.position.y=-size.y*scale/2-.05;
    this.normalizedSize=size.clone().multiplyScalar(scale);this.sourceSize=size;this.scale=scale;this.renderer.clippingPlanes=[];this._configureNavigationForModel(data,bounds,scale);
    this.fit();if(this.spark)this.spark.visible=!!data.splat;this.setPointSize(3);return{size,scale};
  }
  /**
   * Attaches a scene that owns its own LOD/cache lifecycle.  Unlike normal
   * file imports it preserves source-world coordinates, so a scan's collision
   * mesh and its declared spawn point remain meaningful for walk-through mode.
   */
  setStreamingScene({root,session,bounds,spawn,collisionMesh,collisionProvider,stereoIpd=.064,stereoFocus=2.5,kind='Streaming-Szene',unit='Meter'}={}){
    if(!session)throw new Error('Eine Streaming-Sitzung wird benötigt.');
    const box=bounds?.isBox3?bounds.clone():bounds?.min&&bounds?.max?new T.Box3(new T.Vector3(...bounds.min),new T.Vector3(...bounds.max)):null;
    if(!box||box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw new Error('Die Streaming-Szene enthält keine gültigen räumlichen Grenzen.');
    this.select(null);this._clearCurrent();this.root.position.set(0,0,0);this.root.scale.setScalar(1);this.root.rotation.set(0,0,0);
    const holder=root?.isObject3D?root:new T.Group();
    if(root?.isObject3D)this.root.add(holder);
    this.current={object:holder,kind,unit,streaming:true};this.streamingSession=session;
    this.navigation.stereoIpd=Number.isFinite(stereoIpd)&&stereoIpd>0?stereoIpd:.064;this.navigation.stereoFocus=Number.isFinite(stereoFocus)&&stereoFocus>0?stereoFocus:2.5;
    this.normalizedSize=box.getSize(new T.Vector3());this.sourceSize=this.normalizedSize.clone();this.scale=1;this.sceneBounds=box.clone();this.grid.position.y=box.min.y-.05;
    this.renderer.clippingPlanes=[];this._configureNavigationForModel({groundY:box.min.y,eyeHeight:1.65,walkSpeed:2.4,collisionMesh,collisionProvider,spawn},box,1);
    if(spawn)this.setWalkSpawn(spawn);
    this.fit();return{size:this.normalizedSize.clone(),scale:1,kind,unit};
  }
  fit(direction){
    const size=this.normalizedSize||new T.Vector3(10,10,10),radius=size.length()/2,center=this.sceneBounds?.getCenter(new T.Vector3())||new T.Vector3();
    const angle=Math.min(T.MathUtils.degToRad(this.camera.fov/2),Math.atan(Math.tan(T.MathUtils.degToRad(this.camera.fov/2))*this.camera.aspect));
    const distance=radius/Math.sin(angle)*1.08;this.controls.target.copy(center);const d=direction||new T.Vector3(1,.65,1.1).normalize();this.camera.position.copy(center).add(d.normalize().multiplyScalar(distance));this.camera.near=Math.max(.001,distance/10000);this.camera.far=Math.max(1000,distance*100);this.camera.updateProjectionMatrix();this.controls.update();
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
  /**
   * Enables the presentation navigation mode. `walk` keeps the camera at a
   * configured eye height; `fly` additionally permits Q/E and trigger ascent.
   * The caller should provide a scene spawn point for production scans.
   */
  setNavigationMode(mode='orbit',settings={}){
    if(!['orbit','walk','fly'].includes(mode))throw new Error('Unbekannter Navigationsmodus. Erlaubt sind orbit, walk oder fly.');
    const nav=this.navigation;
    if(Number.isFinite(settings.speed)&&settings.speed>0)nav.speed=settings.speed;
    if(Number.isFinite(settings.eyeHeight)&&settings.eyeHeight>0)nav.eyeHeight=settings.eyeHeight;
    if(Number.isFinite(settings.groundY))nav.groundY=settings.groundY;
    if(Number.isFinite(settings.radius)&&settings.radius>=0)nav.radius=settings.radius;
    if(settings.collisionProvider!==undefined)this.setNavigationCollisionProvider(settings.collisionProvider);
    if(settings.collisionMesh!==undefined)this.setNavigationCollisionMesh(settings.collisionMesh);
    if(settings.spawn)this.setWalkSpawn(settings.spawn);
    if(mode==='orbit'){
      nav.mode='orbit';nav.keys.clear();this._endNavigationDrag();this.controls.enabled=true;
      if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock?.();
      const state=this.getNavigationState();this._notifyNavigationState();return state;
    }
    if(nav.mode==='orbit')this._captureNavigationAngles();
    // An orbit view commonly looks down onto a model.  Carrying that pitch to
    // an eye-height walk camera feels like a bent horizon, so start each new
    // ground walk level while preserving the useful left/right heading.
    if(mode==='walk'&&nav.mode!=='walk'&&settings.levelHorizon!==false)nav.pitch=0;
    nav.mode=mode;this.controls.enabled=false;
    if(settings.reset!==false&&nav.spawn)this.camera.position.copy(nav.spawn);
    if(mode==='walk'&&!nav.collisionProvider)this._snapWalkToGround(this.camera.position);
    this._applyNavigationPose();const state=this.getNavigationState();this._notifyNavigationState();return state;
  }
  getNavigationState(){const n=this.navigation,providerCollision=typeof n.collisionProvider?.hasCollision==='function'?n.collisionProvider.hasCollision():!!n.collisionProvider;return{mode:n.mode,speed:n.speed,groundY:n.groundY,eyeHeight:n.eyeHeight,hasCollision:!!(providerCollision||n.collisionMesh),hasSpawn:!!n.spawn,pointerLocked:this._isNavigationPointerLocked(),pointerLockBlocked:n.pointerLockBlocked,gamepadProfile:n.gamepadProfilePreference==='auto'?n.gamepadProfile:n.gamepadProfilePreference,gamepadProfilePreference:n.gamepadProfilePreference,hasGamepadCalibration:!!n.gamepadCalibration};}
  navigationState(){return this.getNavigationState();}
  configureNavigation(settings={}){return this.setNavigationMode(settings.mode||this.navigation.mode,settings);}
  setGamepadProfile(profile='auto'){
    if(!['auto','standard','legacy-trigger-axis'].includes(profile))throw new Error('Unbekanntes Controller-Profil.');
    this.navigation.gamepadProfilePreference=profile;
    return this.getNavigationState();
  }
  gamepadSnapshot(){
    const gamepad=this._firstConnectedGamepad();
    if(!gamepad)return null;
    return {id:gamepad.id,index:gamepad.index,mapping:gamepad.mapping||'',axes:Array.from(gamepad.axes||[],value=>Number.isFinite(value)?value:0)};
  }
  setGamepadCalibration(calibration=null){
    if(calibration===null){this.navigation.gamepadCalibration=null;return this.getNavigationState();}
    const binding=value=>Number.isInteger(value?.index)&&value.index>=0&&Number.isFinite(value?.neutral)&&[1,-1].includes(value?.sign);
    if(typeof calibration?.id!=='string'||!binding(calibration.lookX)||!binding(calibration.lookY)||calibration.lookX.index===calibration.lookY.index)throw new Error('Die Controller-Kalibrierung enthält keine zwei gültigen rechten Stick-Achsen.');
    this.navigation.gamepadCalibration={id:calibration.id,lookX:{...calibration.lookX},lookY:{...calibration.lookY}};
    return this.getNavigationState();
  }
  setNavigationSpeed(speed){if(!Number.isFinite(speed)||speed<=0)throw new Error('Die Gehgeschwindigkeit muss größer als Null sein.');this.navigation.speed=speed;return speed;}
  setNavigationCollisionProvider(provider){
    if(provider!==null&&provider!==undefined&&typeof provider.resolveMove!=='function')throw new Error('Ein Kollisionsanbieter benötigt eine synchrone resolveMove-Funktion.');
    this.navigation.collisionProvider=provider||null;
  }
  setNavigationCollisionMesh(mesh){this.navigation.collisionMesh=mesh?.isObject3D?mesh:null;}
  /** Position is in BrowsEye presentation coordinates. Streaming adapters may call this after mapping a source spawn point. */
  setWalkSpawn(position){
    const p=position?.isVector3?position.clone():Array.isArray(position)?new T.Vector3(...position):null;
    if(!p||!p.toArray().every(Number.isFinite))throw new Error('Der Startpunkt für die Begehung ist ungültig.');
    this.navigation.spawn=p;return p.clone();
  }
  resetWalkPosition(){if(!this.navigation.spawn)return false;this.camera.position.copy(this.navigation.spawn);this._applyNavigationPose();return true;}
  requestNavigationPointerLock(){
    if(this.navigation.mode==='orbit')return false;
    try{const result=this.renderer.domElement.requestPointerLock?.();if(result?.catch)result.catch(()=>{this.navigation.pointerLockBlocked=true;this._updateNavigationPointerClass();this._notifyNavigationState();});return !!result||typeof this.renderer.domElement.requestPointerLock==='function';}catch{this.navigation.pointerLockBlocked=true;this._updateNavigationPointerClass();this._notifyNavigationState();return false;}
  }
  applyFirstPersonLook(deltaX,deltaY){
    if(this.navigation.mode==='orbit'||!Number.isFinite(deltaX)||!Number.isFinite(deltaY))return;
    const nav=this.navigation;nav.yaw-=deltaX*nav.lookSensitivity;nav.pitch=T.MathUtils.clamp(nav.pitch-deltaY*nav.lookSensitivity,-Math.PI*.48,Math.PI*.48);this._applyNavigationPose();
  }
  _configureNavigationForModel(data,bounds,scale){
    const nav=this.navigation;
    const sourceGround=Number.isFinite(data.groundY)?data.groundY:bounds.min.y;
    nav.groundY=sourceGround*scale+this.root.position.y;
    nav.eyeHeight=Number.isFinite(data.eyeHeight)&&data.eyeHeight>0?data.eyeHeight*scale:T.MathUtils.clamp(1.65*scale,Math.max(.08,this.normalizedSize.y*.08),Math.max(.18,this.normalizedSize.y*.55));
    nav.speed=Number.isFinite(data.walkSpeed)&&data.walkSpeed>0?data.walkSpeed*scale:Math.max(.25,2.4*scale);
    // Ordinary imports are centred and scaled for presentation.  Convert the
    // real-world 64 mm eye spacing and comfortable focus distance into that
    // same presentation space so entering Ego mode does not distort stereo.
    nav.stereoIpd=Number.isFinite(data.stereoIpd)&&data.stereoIpd>0?data.stereoIpd*scale:.064*scale;
    nav.stereoFocus=Number.isFinite(data.stereoFocus)&&data.stereoFocus>0?data.stereoFocus*scale:Math.max(.05,2.5*scale);
    nav.collisionProvider=data.collisionProvider||null;nav.collisionMesh=data.collisionMesh?.isObject3D?data.collisionMesh:null;
    if(Array.isArray(data.spawn)&&data.spawn.length===3&&data.spawn.every(Number.isFinite)){
      nav.spawn=new T.Vector3(...data.spawn).multiplyScalar(scale).add(this.root.position);
    }else nav.spawn=null;
  }
  _captureNavigationAngles(){
    const direction=this.camera.getWorldDirection(this._navigationForward);this.navigation.yaw=Math.atan2(-direction.x,-direction.z);this.navigation.pitch=Math.asin(T.MathUtils.clamp(direction.y,-1,1));
  }
  _applyNavigationPose(){
    const nav=this.navigation;if(nav.mode==='walk'&&!nav.collisionProvider&&!nav.collisionMesh)this.camera.position.y=nav.groundY+nav.eyeHeight;
    this.camera.rotation.set(nav.pitch,nav.yaw,0,'YXZ');this.camera.updateMatrixWorld();
    const direction=this.camera.getWorldDirection(this._navigationForward);this.controls.target.copy(this.camera.position).add(direction);
  }
  _firstConnectedGamepad(){
    if(typeof navigator==='undefined'||typeof navigator.getGamepads!=='function')return null;
    return Array.from(navigator.getGamepads()||[]).find(gamepad=>gamepad?.connected)||null;
  }
  _gamepadNavigation(){
    const gamepad=this._firstConnectedGamepad(),nav=this.navigation;
    const id=gamepad?`${gamepad.index}:${gamepad.id}`:null;
    if(id!==nav.gamepadId){nav.gamepadId=id;nav.gamepadProfile=gamepad?detectGamepadProfile(gamepad):'standard';}
    const profile=nav.gamepadProfilePreference==='auto'?nav.gamepadProfile:nav.gamepadProfilePreference;
    const calibration=nav.gamepadCalibration?.id===gamepad?.id?nav.gamepadCalibration:null;
    return gamepadNavigationFrame(gamepad,{deadzone:nav.deadzone,profile,calibration});
  }
  _updateFirstPerson(deltaSeconds){
    if(!deltaSeconds)return;
    const nav=this.navigation,keys=nav.keys,pad=this._gamepadNavigation();
    const keyboardX=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
    const keyboardForward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
    const keyboardRise=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
    if(pad.connected&&(pad.lookX||pad.lookY)){nav.yaw-=pad.lookX*nav.gamepadLookSensitivity*deltaSeconds;nav.pitch=T.MathUtils.clamp(nav.pitch-pad.lookY*nav.gamepadLookSensitivity*deltaSeconds,-Math.PI*.48,Math.PI*.48);}
    const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight')||pad.sprint;
    // Trigger input is deliberately discarded on the ground: LT/RT may only
    // change height in Free Flight, never tilt or move an Ego camera.
    const rise=nav.mode==='fly'?keyboardRise+pad.rise:0;
    const intent=movementIntent({moveX:keyboardX+pad.moveX,forward:keyboardForward+pad.forward,rise},{speed:nav.speed*(sprint?nav.sprintMultiplier:1),deltaSeconds,fly:nav.mode==='fly'});
    if(intent.right||intent.forward||intent.up){
      this._navigationForward.set(0,0,-1).applyEuler(this.camera.rotation);this._navigationForward.y=0;if(this._navigationForward.lengthSq()<1e-8)this._navigationForward.set(0,0,-1);this._navigationForward.normalize();
      this._navigationRight.crossVectors(this._navigationForward,new T.Vector3(0,1,0)).normalize();
      const delta=this._navigationRight.multiplyScalar(intent.right).addScaledVector(this._navigationForward,intent.forward);delta.y=intent.up;this._resolveNavigationMove(delta);
    }
    this._applyNavigationPose();
  }
  _resolveNavigationMove(delta){
    const nav=this.navigation,from=this.camera.position.clone();let next=from.clone().add(delta);
    if(nav.collisionProvider){
      try{
        const result=nav.collisionProvider.resolveMove({position:from.clone(),delta:delta.clone(),radius:nav.radius,groundY:nav.groundY,eyeHeight:nav.eyeHeight,mode:nav.mode});
        const candidate=result?.position||result;if(candidate?.isVector3)next.copy(candidate);else if(Number.isFinite(candidate?.x)&&Number.isFinite(candidate?.y)&&Number.isFinite(candidate?.z))next.set(candidate.x,candidate.y,candidate.z);
      }catch(error){this.onError?.(`Kollisionsprüfung deaktiviert: ${error.message||'ungültige Antwort'}`);nav.collisionProvider=null;}
    }else if(nav.collisionMesh&&Math.hypot(delta.x,delta.z)>1e-6){
      const horizontal=new T.Vector3(delta.x,0,delta.z),length=horizontal.length();horizontal.divideScalar(length);this._navigationRaycaster.set(from.clone().add(new T.Vector3(0,-nav.eyeHeight*.45,0)),horizontal);
      const hit=this._navigationRaycaster.intersectObject(nav.collisionMesh,true)[0];if(hit&&hit.distance<length+nav.radius){next.x=from.x;next.z=from.z;}
    }
    if(nav.mode==='walk'&&!nav.collisionProvider)this._snapWalkToGround(next);this.camera.position.copy(next);
  }
  _snapWalkToGround(position){
    const nav=this.navigation;
    if(!nav.collisionMesh){position.y=nav.groundY+nav.eyeHeight;return position;}
    // The collision mesh is a lightweight floor/wall proxy, never the full
    // splat cloud. Start just above eye height to avoid selecting ceilings.
    const origin=position.clone();origin.y=Math.max(origin.y+.15,nav.groundY+nav.eyeHeight+.15);
    this._navigationGroundRaycaster.set(origin,this._navigationDown);this._navigationGroundRaycaster.far=Math.max(5,nav.eyeHeight*3);
    const floor=this._navigationGroundRaycaster.intersectObject(nav.collisionMesh,true)[0];position.y=floor?floor.point.y+nav.eyeHeight:nav.groundY+nav.eyeHeight;return position;
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
  screenshot(){const stereo=this._stereoParameters();this.output.render(this.scene,this.camera,stereo.separation,stereo.focus,eyeCamera=>this.streamingSession?.beforeEyeRender?.(eyeCamera));return new Promise(resolve=>this.renderer.domElement.toBlob(resolve,'image/png'));}
}
