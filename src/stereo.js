import * as T from 'three';
export const modes = { mono:0, sbs:1, tb:2, rows:3, left:4, right:5 };
export function eyeAspect(width, height) { return Math.max(1,width) / Math.max(1,height); }
export function updateRig(rig, camera, width, height, separation, focus) {
  camera.aspect = eyeAspect(width, height);
  camera.focus = Math.max(camera.near * 2, focus);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  rig.aspect = 1; rig.eyeSep = separation; rig.update(camera);
  for (const eye of [rig.cameraL, rig.cameraR]) {
    eye.layers.mask = camera.layers.mask;
    eye.near = camera.near; eye.far = camera.far;
    eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();
    eye.updateMatrixWorld();
  }
}
export class StereoOutput {
  constructor(renderer) {
    this.renderer = renderer; this.rig = new T.StereoCamera();
    this.mode = 'mono'; this.swap = false; this.parity = 0; this.calibration = false;
    this.left = new T.WebGLRenderTarget(1,1); this.right = this.left.clone();
    this.material = new T.ShaderMaterial({depthTest:false, depthWrite:false, uniforms: {
      leftEye:{value:this.left.texture},rightEye:{value:this.right.texture},mode:{value:0},swap:{value:false},parity:{value:0},height:{value:1},aspect:{value:1},calibration:{value:false},
    }, vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader:`
      uniform sampler2D leftEye; uniform sampler2D rightEye;
      uniform int mode; uniform bool swap; uniform float parity; uniform float height;
      uniform float aspect; uniform bool calibration; varying vec2 vUv;
      void main(){
        vec2 uv=vUv; bool left=true;
        if(mode==1){left=uv.x<0.5;uv.x=fract(uv.x*2.);}
        else if(mode==2){left=uv.y>=0.5;uv.y=fract(uv.y*2.);}
        else if(mode==3){left=mod(height-1.-floor(gl_FragCoord.y)+parity,2.)<1.;}
        else if(mode==5){left=false;}
        if(swap)left=!left;
        if(calibration){
          vec2 p=(uv-.5)*vec2(aspect,1.); float d=length(p);
          vec3 color=vec3(.025,.04,.05);
          float ring=1.-smoothstep(.002,.006,abs(d-.28));
          float cross=1.-smoothstep(.001,.003,min(abs(p.x),abs(p.y)));
          color=mix(color,vec3(.9),max(ring,cross*.35));
          if(uv.y>.82&&uv.y<.88&&abs(uv.x-.5)<.17)color=left?vec3(.2,1.,.7):vec3(1.,.5,.2);
          // One white block = left, two = right; remains readable through a lens.
          if(uv.y>.12&&uv.y<.18&&(abs(uv.x-.46)<.02||(!left&&abs(uv.x-.54)<.02)))color=vec3(1.);
          gl_FragColor=vec4(color,1.);
        }else{gl_FragColor=left?texture2D(leftEye,uv):texture2D(rightEye,uv);}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
    this.scene = new T.Scene(); this.scene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material)); this.camera=new T.Camera();
    this.size = new T.Vector2();
  }
  /**
   * `beforeEyeRender` lets streaming renderers prepare camera-specific data.
   * It is intentionally called separately for both eyes: Gaussian splats and
   * other view-sorted data must not reuse the centre-camera ordering in stereo.
   */
  render(scene, camera, separation, focus, beforeEyeRender) {
    const r=this.renderer; r.getDrawingBufferSize(this.size);
    const [w,h]=[this.size.x,this.size.y];
    updateRig(this.rig,camera,w,h,separation,focus);
    if(this.mode==='mono'&&!this.calibration){beforeEyeRender?.(camera);r.setRenderTarget(null);r.render(scene,camera);return;}
    const tw=this.mode==='sbs'?Math.max(1,Math.floor(w/2)):w;
    const th=['tb','rows'].includes(this.mode)?Math.max(1,Math.floor(h/2)):h;
    if(this.left.width!==tw||this.left.height!==th){this.left.setSize(tw,th);this.right.setSize(tw,th);}
    if(!this.calibration){
      beforeEyeRender?.(this.rig.cameraL);r.setRenderTarget(this.left);r.render(scene,this.rig.cameraL);
      beforeEyeRender?.(this.rig.cameraR);r.setRenderTarget(this.right);r.render(scene,this.rig.cameraR);
    }
    const u=this.material.uniforms;u.mode.value=modes[this.mode]??0;u.swap.value=this.swap;u.parity.value=this.parity;u.height.value=h;u.aspect.value=w/h;u.calibration.value=this.calibration;
    r.setRenderTarget(null);r.render(this.scene,this.camera);
  }
  dispose(){this.left.dispose();this.right.dispose();this.material.dispose();this.scene.children[0].geometry.dispose();}
}
