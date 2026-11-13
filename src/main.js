import './style.css';
import * as T from 'three';
import { Viewer } from './viewer.js';
import { createDemo,demoList } from './demos.js';
import { formats,extension,canImport,unsupportedMessage } from './formats.js';
import { importFile,importDicom } from './importers.js';
import { disposeObject } from './geometry.js';
import { initializeExperienceLayer } from './experience.js';
import { HandTracking } from './hand-tracking.js';
import { createLccCollisionProvider, isLccStreamingPath, loadXgridsScene } from './lcc-streaming.js';
import { loadBrowseyeStreamingScene } from './streaming-viewer.js';
const paths={eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',plus:'M12 5v14M5 12h14',folder:'M3 7V5h6l2 2h10v13H3Z',cube:'m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10v9M3 8l9 5 9-5',building:'M4 21V4h11v17M15 10h5v11M2 21h20M7 8h2m2 0h1M7 12h2m2 0h1M7 16h2m2 0h1',terrain:'m2 19 6-12 4 6 3-10 7 16H2Z',molecule:'M8 7l8 3-3 9M8 7l5 12M6 5h4v4H6ZM14 8h4v4h-4ZM11 17h4v4h-4Z',layers:'m2 8 10-5 10 5-10 5-10-5Zm0 5 10 5 10-5M2 18l10 5 10-5',arrow:'m8 5 7 7-7 7',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',fit:'M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M8 8h8v8H8Z',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',camera:'M3 7h5l2-3h4l2 3h5v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',info:'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',grid:'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',reset:'M3 10a9 9 0 1 1 1 8M3 4v6h6',file:'M5 3h9l5 5v13H5ZM14 3v6h5',shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.cube}"/></svg>`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('#app').innerHTML=`
<header class="topbar"><a class="brand" href="/" aria-label="BrowsEye Startseite"><span class="brand-eye">${icon('eye')}</span><span>Brows<span class="brand-accent">Eye</span><small>BY VIPTA GMBH</small></span></a><div class="header-center"><span class="version">STANDARD 1.0</span><span>Eine neue Perspektive auf Ihre Daten.</span></div><div class="header-actions"><span class="local-badge"><i></i> Lokal auf Ihrem Gerät</span><button id="streaming-button" class="quiet">${icon('layers')} Streaming-Szene</button><button id="formats-button" class="quiet">${icon('info')} Formate</button><button id="open-button" class="primary">${icon('plus')} Dateien öffnen</button></div></header>
<div class="workspace"><aside class="sidebar"><div class="sidebar-heading"><span>ARBEITSBEREICH</span><span class="tiny-dot"></span></div><div class="tabs"><button class="selected" id="tab-examples">Beispiele</button><button id="tab-files">Meine Dateien <span id="file-count">0</span></button></div>
<div id="examples"><div class="section-label">ENTDECKEN</div><div class="demo-list">${demoList.map(d=>`<button class="demo-card" data-demo="${d.id}"><span class="demo-icon ${d.id}">${icon(d.icon)}</span><span><strong>${d.name}</strong><small>${d.category}</small></span>${icon('arrow','chevron')}</button>`).join('')}</div><p class="sidebar-note">Sofort ausprobieren.<br>Alle Beispiele werden lokal erzeugt.</p></div>
<div id="files" hidden><div class="section-label">GELADENE DATEIEN</div><div id="file-list"><p class="empty">Noch keine Dateien.<br>Öffnen Sie Ihr erstes Modell.</p></div></div>
<button id="drop-card" class="drop-card">${icon('folder')}<strong>Ihr Modell. Ihre Perspektive.</strong><span>Dateien hier ablegen<br>oder zum Auswählen klicken</span><small>IFC · STEP · PLY · OBJ · PDB + mehr</small></button><button id="folder-button" class="folder-button">${icon('folder')} Ganzen Ordner auswählen</button>
<div class="scene-section"><div class="section-label">SZENENINHALT <span id="object-count">0</span></div><div id="scene-tree"></div></div><div class="sidebar-footer">${icon('shield')} Dateien bleiben auf diesem Rechner.</div></aside>
<main id="stage"><div class="stage-heading"><div class="eyebrow"><span class="status-dot"></span><span id="model-kind">ARCHITEKTUR-DEMO</span></div><h1 id="model-title">Atrium</h1><p id="model-note">Raum, Licht & Struktur</p></div><button id="settings-toggle" class="stage-settings" title="Ansichtseinstellungen" aria-label="Ansichtseinstellungen">${icon('settings')}</button>
<section id="settings" class="settings-panel"><div class="panel-heading"><h2>Perspektive</h2><span>STEREOVISOR READY</span></div><label class="field-label" for="output-mode">Ausgabeformat</label><select id="output-mode"><option value="mono">2D · normale Ansicht</option><option value="sbs">3D · Half Side-by-Side</option><option value="tb">3D · Half Top-Bottom</option><option value="rows">3D · Zeilenweise</option><option value="left">Nur linkes Auge</option><option value="right">Nur rechtes Auge</option></select><p id="mode-hint" class="hint">Modelle auf jedem Bildschirm erkunden.</p>
<div class="range-heading"><label for="depth">Stereotiefe</label><output id="depth-value">30 %</output></div><input id="depth" type="range" min="0" max="100" value="30"><div class="range-heading"><label for="convergence">Tiefen-Nullpunkt</label><output id="convergence-value">0 %</output></div><input id="convergence" type="range" min="-70" max="100" value="0"><label class="switch-row"><span>Linkes / rechtes Auge tauschen</span><input id="swap" type="checkbox" role="switch"></label><label class="switch-row" id="parity-row" hidden><span>Zeilen um eine Position tauschen</span><input id="parity" type="checkbox" role="switch"></label>
<div class="panel-divider"></div><div class="view-row"><span>Darstellung</span><button id="wireframe" title="Drahtgitter umschalten" aria-label="Drahtgitter umschalten">${icon('cube')}</button><button id="grid" class="active" title="Bodenraster umschalten" aria-label="Bodenraster umschalten">${icon('grid')}</button></div><div class="range-heading"><label for="clip">Schnitt entlang X</label><output id="clip-value">Aus</output></div><input id="clip" type="range" min="0" max="100" value="100"><div class="range-heading"><label for="point-size">Punktgröße</label><output id="point-value">3</output></div><input id="point-size" type="range" min="1" max="12" value="3">
<button id="calibration" class="calibration">${icon('eye')} Stereo-Testbild anzeigen</button><p class="hint calibration-hint" hidden>Durch jede Linse muss der Kreis rund sein. Links: grün, ein Block. Rechts: orange, zwei Blöcke. Monitorformat passend einstellen; im Vollbild prüfen.</p><div class="panel-divider"></div><section class="gesture-controls"><h3>Berührungsfreie Steuerung</h3><button id="gesture-toggle" class="gesture-toggle">${icon('camera')} Webcam einschalten</button><p id="gesture-status" class="hint gesture-status">Aus · Kamerabilder bleiben auf diesem Gerät.</p><label class="field-label" for="gesture-camera">USB-Webcam</label><select id="gesture-camera"><option value="">Standardkamera</option></select><label class="field-label" for="gesture-placement">Kamera montiert</label><select id="gesture-placement"><option value="above">Oberhalb des Displays</option><option value="below">Unterhalb des Displays</option></select><button id="gesture-preview-toggle" class="quiet gesture-preview-toggle">Kameravorschau anzeigen</button><p class="hint gesture-help">Eine Person steuert: Daumen und Zeigefinger zusammenführen und kurz halten. Eine Hand dreht; zwei greifende Hände zoomen. Finger öffnen = bewusst loslassen.</p></section>
<div class="panel-divider"></div><section class="navigation-controls"><h3>Begehung & Controller</h3><label class="field-label" for="navigation-mode">Navigation</label><select id="navigation-mode"><option value="orbit">Objekt erkunden</option><option value="walk">Ego · am Boden gehen</option><option value="fly">Freies Fliegen</option></select><div class="range-heading"><label for="walk-speed">Geschwindigkeit</label><output id="walk-speed-value">2,4 m/s</output></div><input id="walk-speed" type="range" min="0.25" max="12" step="0.25" value="2.4"><label class="field-label" for="controller-profile">Xbox-Controller</label><select id="controller-profile"><option value="auto">Automatisch erkennen</option><option value="standard">Standard Xbox</option><option value="legacy-trigger-axis">Xbox · LT/RT getrennt</option></select><p id="controller-profile-status" class="hint">LT/RT dürfen in Ego keinen Blick steuern.</p><button id="controller-calibrate" class="quiet controller-calibrate">Rechten Stick kalibrieren</button><button id="controller-calibration-reset" class="quiet controller-calibration-reset" hidden>Kalibrierung zurücksetzen</button><p id="controller-calibration-status" class="hint controller-calibration-status">Vor dem Start alle Sticks und Trigger loslassen. Dann wird nur der rechte Stick exakt eingemessen.</p><div class="navigation-actions"><button id="navigation-toggle" class="gesture-toggle">${icon('terrain')} Begehung starten</button><button id="navigation-reset" title="Zum Startpunkt zurückkehren" aria-label="Zum Startpunkt zurückkehren">${icon('reset')}</button></div><p id="navigation-status" class="hint navigation-status">WASD oder linker Stick: gehen · Maus oder rechter Stick: umsehen · Shift/A: schneller.</p></section>
<div id="volume-controls" hidden><div class="panel-divider"></div><h3>Volumen / Schnitte</h3><div class="range-heading"><label for="slice">Schicht</label><output id="slice-value"></output></div><input id="slice" type="range" min="0" max="63" value="32"><div class="range-heading"><label for="window">Fensterbreite</label><output id="window-value"></output></div><input id="window" type="range" min="1" max="2000" value="1200"><div class="range-heading"><label for="level">Fenstermitte</label><output id="level-value"></output></div><input id="level" type="range"><label class="switch-row"><span>3D-Isofläche · Vorschau</span><input id="surface" type="checkbox" role="switch"></label><div class="range-heading"><label for="threshold">Schwellenwert</label><output id="threshold-value"></output></div><input id="threshold" type="range"></div>
</section>
<div id="selection" class="selection" hidden></div><div id="gesture-hud" class="gesture-hud" hidden><i></i><span id="gesture-hud-status">Webcam bereit</span></div><video id="gesture-preview" class="gesture-preview" muted playsinline hidden></video><div class="viewport-toolbar"><div class="view-presets"><button class="active" data-view="perspective">Perspektive</button><button data-view="front">Vorne</button><button data-view="top">Oben</button></div><span class="toolbar-separator"></span><button id="fit" title="Modell einpassen (R)" aria-label="Modell einpassen">${icon('fit')}</button><button id="screenshot" title="Ansicht als PNG speichern" aria-label="Ansicht als PNG speichern">${icon('camera')}</button><button id="fullscreen" title="Präsentation im Vollbild (F)" aria-label="Präsentation im Vollbild">${icon('expand')}<span>Präsentieren</span></button></div>
<div class="navigation-hint"><span>Ziehen <b>Drehen</b></span><span>Scrollen <b>Zoom</b></span><span>Rechts ziehen <b>Verschieben</b></span></div><div class="axis-widget" aria-hidden="true"><span class="axis-y">Y</span><span class="axis-x">X</span><span class="axis-z">Z</span></div><div id="loading" hidden><div class="spinner"></div><strong id="loading-label">Modell wird geöffnet …</strong><span>Verarbeitung auf Ihrem Gerät</span></div><div id="drop-overlay" hidden>${icon('folder')}<strong>Dateien ablegen und entdecken</strong><span>Modelle und Begleitdateien gemeinsam auswählen</span></div><button id="exit-presentation">${icon('close')} Präsentation verlassen · Esc / H</button></main></div>
<footer class="statusbar"><span><i class="status-dot"></i><span id="status-text">Bereit</span></span><span id="dimensions">Ansicht wird vorbereitet</span><span class="status-right"><span id="format-badge">2D</span><span id="fps">— FPS</span><span>WebGL 2</span></span></footer><div id="toast" role="status" hidden></div>
<input id="file-input" type="file" multiple hidden><input id="folder-input" type="file" webkitdirectory multiple hidden>
<dialog id="formats-dialog"><div class="dialog-header"><div><div class="eyebrow">BROWSEYE · FORMATKOMPASS</div><h2>Viele Welten. Ein Viewer.</h2><p>Direkte Importe und ehrliche Grenzen dieser ersten Version.</p></div><button id="close-dialog" aria-label="Formatübersicht schließen">${icon('close')}</button></div><div class="format-grid">${formats.map(f=>`<article><div class="format-card-head"><h3>${f.group}</h3><span class="support ${f.state==='Direkt'?'direct':f.state==='Teilumfang'?'partial':f.state==='Streaming'?'direct':'convert'}">${f.state}</span></div><div class="extensions">${f.extensions.map(e=>`<span>.${e}</span>`).join('')}</div><p>${f.detail}</p></article>`).join('')}</div><div class="dialog-footer">Direktimport: bis 256 MB je Datei / 512 MB je Auswahl. Große Szenen werden über den separaten Streaming-Modus kachelweise geladen. Keine externen Uploads.<br>Open Source: <a href="/licenses/three.txt" target="_blank" rel="noopener">Three.js</a> · <a href="/licenses/web-ifc.txt" target="_blank" rel="noopener">web-ifc</a> · <a href="/licenses/occt-import-js.txt" target="_blank" rel="noopener">Open CASCADE</a> · <a href="/licenses/@sparkjsdev-spark.txt" target="_blank" rel="noopener">Spark</a> · <a href="/licenses/dicom-parser.txt" target="_blank" rel="noopener">dicomParser</a></div></dialog>
<dialog id="streaming-dialog"><div class="dialog-header"><div><div class="eyebrow">BROWSEYE · STREAMING SCENES</div><h2>Große Szene öffnen</h2><p>LCC/LCC2 oder ein BrowsEye-Szenenmanifest werden abschnittsweise nachgeladen.</p></div><button id="close-streaming-dialog" aria-label="Streaming-Dialog schließen">${icon('close')}</button></div><label class="field-label" for="streaming-url">URL zur Szene</label><input id="streaming-url" type="url" autocomplete="off" spellcheck="false" placeholder="/scenes/villa/meta.lcc2 oder …/browseye-streaming-scene.json"><p class="hint">LCC/LCC2 benötigt das lizenzierte XGRIDS Web SDK im Player. Öffnen Sie LCC-Pakete über einen lokalen HTTP-Server oder HTTPS, nicht als einzelne Datei.</p><div class="streaming-dialog-actions"><button id="streaming-local" class="quiet" hidden>${icon('folder')} Lokalen Szenenordner wählen</button><button id="streaming-open" class="primary">${icon('layers')} Streaming starten</button></div></dialog>`;
const $=id=>document.getElementById(id);let viewer,busy=false,entries=[],activeEntry=-1,allFiles=[],currentName='',noticeTimer;
function notice(message,error=false){$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('toast').hidden=true,error?18000:6000);}
function setBusy(value,label){busy=value;$('loading').hidden=!value;$('loading-label').textContent=label||'Modell wird geöffnet …';$('status-text').textContent=value?'Import läuft …':'Bereit';document.querySelectorAll('[data-demo],#file-list button,#open-button,#folder-button,#drop-card,#streaming-button,#streaming-open,#streaming-local').forEach(b=>b.disabled=value);}
try{viewer=new Viewer($('stage'),({fps})=>$('fps').textContent=`${fps} FPS`,object=>{const el=$('selection');el.hidden=!object;if(object)el.textContent=`${object.name||'Geometrie'}${object.userData.expressID?` · IFC #${object.userData.expressID}`:''}`;},message=>notice(message,true),()=>updateNavigationUi());}catch(error){$('loading').hidden=false;$('loading-label').textContent='WebGL 2 ist nicht verfügbar. Bitte Chrome oder Edge mit aktivierter Hardwarebeschleunigung verwenden.';throw error;}
function tab(which){$('examples').hidden=which!=='examples';$('files').hidden=which!=='files';$('tab-examples').classList.toggle('selected',which==='examples');$('tab-files').classList.toggle('selected',which==='files');}
$('tab-examples').onclick=()=>tab('examples');$('tab-files').onclick=()=>tab('files');
function renderFiles(){const list=$('file-list');list.replaceChildren();entries.forEach((entry,i)=>{const b=document.createElement('button');b.className=`file-card ${activeEntry===i?'active':''}`;b.innerHTML=`${icon('file')}<span><strong>${esc(entry.name)}</strong><small>${entry.dicom?'DICOM-Serie':esc(extension(entry.name).toUpperCase())}${entry.error?' · Fehler':''}</small></span>`;b.title=entry.name;b.disabled=busy;b.onclick=()=>loadEntry(i);list.append(b);});$('file-count').textContent=entries.length;}
function updateTree(object){const tree=$('scene-tree');tree.replaceChildren();const nodes=[];object.traverse(o=>{if((o.isMesh||o.isPoints)&&!o.isBox3Helper)nodes.push(o);});$('object-count').textContent=nodes.length;for(const node of nodes.slice(0,80)){const b=document.createElement('button');b.className='tree-item';b.innerHTML=`${icon(node.isPoints?'terrain':'cube')}<span>${esc(node.name||'Geometrie')}</span>`;b.onclick=()=>{viewer.select(node);$('selection').hidden=false;$('selection').textContent=node.name||'Geometrie';};tree.append(b);}if(nodes.length>80){const p=document.createElement('p');p.className='hint';p.textContent=`… und ${nodes.length-80} weitere Objekte`;tree.append(p);}}
function configureVolume(controller){$('volume-controls').hidden=!controller;if(!controller)return;const v=controller.volume;
  for(const [id,min,max,value] of [['slice',0,v.slices.length-1,controller.index],['window',1,Math.max(2,(v.max-v.min)*2),controller.window],['level',v.min,v.max,controller.level],['threshold',v.min,v.max,controller.threshold]]){const input=$(id);input.min=min;input.max=max;input.step=id==='slice'?1:'any';input.value=value;$(id+'-value').textContent=id==='slice'?`${+value+1} / ${v.slices.length}`:Math.round(value);}
  $('surface').checked=viewer.current.object.children.some(o=>o.isMarchingCubes&&o.visible);$('surface').disabled=v.slices.length<3;
}
async function show(data,name){
  try{await viewer.setModel(data);}catch(e){if(viewer.current!==data)disposeObject(data.object);throw e;}
  currentName=name;$('model-title').textContent=name;$('model-kind').textContent=data.kind;$('model-note').textContent=data.note||'Lokale 3D-Datei';$('dimensions').textContent=`Quelle: ${data.unit||'Einheit unbekannt'} · auf Ansicht eingepasst`;$('selection').hidden=true;
  $('clip').value=100;$('clip-value').textContent='Aus';$('clip').disabled=!!data.splat;$('point-size').value=3;$('point-value').textContent=3;$('wireframe').classList.remove('active');
  updateTree(data.object);configureVolume(data.controller);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='perspective'));
}
function sceneNameFromUrl(url){
  const part=decodeURIComponent(new URL(url,location.href).pathname.split('/').filter(Boolean).pop()||'Streaming-Szene');
  return part.replace(/\.(lcc2?|json)$/i,'')||'Streaming-Szene';
}
function boxFromMetadata(raw){
  if(raw?.isBox3)return raw.clone();
  const min=raw?.min||raw?.Min||raw?.minimum,max=raw?.max||raw?.Max||raw?.maximum;
  if(!min||!max)return null;
  const asVector=value=>value?.isVector3?value.clone():Array.isArray(value)?new T.Vector3(...value):new T.Vector3(value.x,value.y,value.z);
  try{const box=new T.Box3(asVector(min),asVector(max));return box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)?null:box;}catch{return null;}
}
function lccBounds(session,configuredBounds){
  const configured=boxFromMetadata(configuredBounds);if(configured)return{box:configured,known:true};
  const reported=boxFromMetadata(session.getBounds?.());if(reported)return{box:reported,known:true};
  // Some exports expose bounds only after a first LOD cycle. The fallback is
  // intentionally marked as provisional rather than pretending it is data.
  return{box:new T.Box3(new T.Vector3(-30,0,-30),new T.Vector3(30,16,30)),known:false};
}
const validVector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?[...value]:null;
const optionalText=value=>typeof value==='string'&&value.trim()?value.trim():undefined;
const positiveNumber=value=>Number.isFinite(value)&&value>0?value:undefined;
async function xgridsSceneOptions(url){
  let raw=globalThis.BrowsEyeXgrids;
  try{const imported=await import(/* @vite-ignore */ '/vendor/xgrids/browseye-xgrids.config.js');raw=imported.default||imported.config||globalThis.BrowsEyeXgrids||raw;}catch{}
  const desktop=await window.browseyeDesktop?.xgridsConfig?.();
  if(desktop?.error)throw new Error(`${desktop.error} (${desktop.path})`);
  if(desktop?.config&&typeof desktop.config==='object'&&!Array.isArray(desktop.config))raw={...(raw&&typeof raw==='object'?raw:{}),...desktop.config,scenes:desktop.config.scenes??raw?.scenes};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return{};
  const pathname=new URL(url,location.href).pathname.toLowerCase();
  const scene=(Array.isArray(raw.scenes)?raw.scenes:[]).find(entry=>{
    const match=optionalText(entry?.match)?.toLowerCase();return match&&(match==='*'||pathname.endsWith(match));
  })||{};
  return{
    moduleUrl:optionalText(scene.moduleUrl)||optionalText(raw.moduleUrl),appKey:optionalText(scene.appKey)||optionalText(raw.appKey),
    maxHostCacheSize:positiveNumber(scene.maxHostCacheSize)||positiveNumber(raw.maxHostCacheSize),maxGpuCacheSize:positiveNumber(scene.maxGpuCacheSize)||positiveNumber(raw.maxGpuCacheSize),
    bounds:scene.bounds||raw.bounds,spawn:validVector(scene.spawn)||validVector(raw.spawn),stereoIpd:positiveNumber(scene.stereoIpd)||positiveNumber(raw.stereoIpd),stereoFocus:positiveNumber(scene.stereoFocus)||positiveNumber(raw.stereoFocus),
  };
}
function defaultSceneSpawn(bounds){const center=bounds.getCenter(new T.Vector3());return [center.x,bounds.min.y+1.65,center.z];}
function showStreaming({runtime,root,bounds,spawn,collisionMesh,collisionProvider,stereoIpd,stereoFocus,kind,note,name}){
  viewer.setStreamingScene({root,session:runtime,bounds,spawn,collisionMesh,collisionProvider,stereoIpd,stereoFocus,kind,unit:'Meter'});
  currentName=name;$('model-title').textContent=name;$('model-kind').textContent=kind;$('model-note').textContent=note;$('dimensions').textContent='Streaming · sichtbare Detailbereiche werden bei Bedarf geladen';$('selection').hidden=true;
  $('clip').value=100;$('clip-value').textContent='Aus';$('clip').disabled=true;$('wireframe').classList.remove('active');configureVolume(null);updateTree(root||new T.Group());
  activeEntry=-1;renderFiles();document.querySelectorAll('[data-demo]').forEach(b=>b.classList.remove('active'));
  viewer.setNavigationMode('walk',{reset:true});updateNavigationUi();
}
async function loadStreamingPath(value){
  if(busy)return;
  let url;try{url=new URL(value,location.href);}catch{notice('Bitte geben Sie eine gültige HTTP(S)-Adresse für die Streaming-Szene an.',true);return;}
  if(!['http:','https:'].includes(url.protocol)){notice('Streaming-Szenen müssen über HTTP oder HTTPS bereitgestellt werden.',true);return;}
  if(url.protocol==='http:'&&url.origin!==location.origin&&!['localhost','127.0.0.1'].includes(url.hostname)){notice('Für eine fremde Netzwerkadresse bitte HTTPS verwenden. HTTP ist nur für den lokalen Entwicklungsserver vorgesehen.',true);return;}
  setBusy(true,'Streaming-Szene wird vorbereitet …');
  try{
    const name=sceneNameFromUrl(url.href);
    if(isLccStreamingPath(url.href)){
      const xgrids=await xgridsSceneOptions(url.href);
      const lcc=await loadXgridsScene({
        dataPath:url.href,moduleUrl:xgrids.moduleUrl,appKey:xgrids.appKey,maxHostCacheSize:xgrids.maxHostCacheSize,maxGpuCacheSize:xgrids.maxGpuCacheSize,THREE:T,renderer:viewer.renderer,scene:viewer.scene,camera:viewer.camera,
        onProgress:value=>{$('loading-label').textContent=`LCC/LCC2 wird vorbereitet · ${Math.round(value*100)} %`;},
        onError:error=>notice(error.message||'LCC/LCC2 konnte nicht geladen werden.',true),
      });
      const boundsInfo=lccBounds(lcc,xgrids.bounds),bounds=boundsInfo.box,spawn=xgrids.spawn||defaultSceneSpawn(bounds);
      const collisionProvider=createLccCollisionProvider(lcc);
      const collisionActive=collisionProvider?.hasCollision?.();
      const runtime={
        update(){},
        beforeEyeRender:eyeCamera=>{lcc.setCamera(eyeCamera);lcc.update();},
        dispose:()=>lcc.dispose(),
      };
      showStreaming({runtime,bounds,spawn,collisionProvider,stereoIpd:xgrids.stereoIpd,stereoFocus:xgrids.stereoFocus,kind:'XGRIDS LCC2 · Streaming',name,note:collisionActive?'LCC/LCC2 · LOD-Streaming über XGRIDS SDK · Kollision aktiv':'LCC/LCC2 · LOD-Streaming über XGRIDS SDK · Bodenbindung aktiv'});
      notice(`${collisionActive?'LCC/LCC2 geöffnet. Detailbereiche werden beim Bewegen nachgeladen; XGRIDS-Kollision ist aktiv.':'LCC/LCC2 geöffnet. Detailbereiche werden beim Bewegen nachgeladen. Für Wände und Treppen ist eine Kollisionsgeometrie im XGRIDS-Export nötig.'}${boundsInfo.known?'':' Für diese Datei wurden keine räumlichen Grenzen gemeldet: Bitte bounds und spawn in der lokalen XGRIDS-Konfiguration hinterlegen.'}`);
    }else{
      const streaming=await loadBrowseyeStreamingScene(url.href,{onProgress:({loaded,active})=>{$('loading-label').textContent=`Streaming-Kacheln aktiv · ${loaded} geladen / ${active} im Cache`;}});
      const collisionMesh=await streaming.loadCollision();
      showStreaming({runtime:streaming,root:streaming.root,bounds:streaming.bounds,spawn:streaming.spawn||defaultSceneSpawn(streaming.bounds),collisionMesh,kind:'BrowsEye Streaming Scene',name,note:'Räumliche LOD-Kacheln · sichtbare Bereiche werden nachgeladen'});
      notice(collisionMesh?'Streaming-Szene geöffnet. Kollisionsgeometrie und Bodenbindung sind aktiv.':'Streaming-Szene geöffnet. Bodenbindung ist aktiv; für Wände und Treppen bitte ein Kollisionsmodell ergänzen.');
    }
    $('streaming-dialog').close();
  }catch(error){notice(error.message||'Streaming-Szene konnte nicht geöffnet werden.',true);}
  finally{setBusy(false);}
}
async function loadDemo(id){if(busy)return;setBusy(true,'Beispiel wird aufgebaut …');try{const data=await createDemo(id);await show(data,demoList.find(d=>d.id===id).name);activeEntry=-1;renderFiles();document.querySelectorAll('[data-demo]').forEach(b=>b.classList.toggle('active',b.dataset.demo===id));}catch(e){notice(e.message,true);}finally{setBusy(false);}}
async function loadEntry(index){if(busy)return;const entry=entries[index];setBusy(true,`${entry.name} wird geöffnet …`);try{const data=entry.dicom?await importDicom(entry.files):await importFile(entry.file,allFiles);await show(data,entry.name);activeEntry=index;entry.error=false;document.querySelectorAll('[data-demo]').forEach(b=>b.classList.remove('active'));}catch(e){entry.error=true;notice(e.message||'Import fehlgeschlagen.',true);}finally{setBusy(false);renderFiles();}}
async function acceptFiles(selected){if(busy)return;const files=Array.from(selected);if(!files.length)return;if(files.reduce((sum,f)=>sum+f.size,0)>512*1024*1024){notice('Bitte höchstens 512 MB je Auswahl öffnen.',true);return;}
  const dicom=[];for(const file of files){if(['dcm','dicom'].includes(extension(file.name)))dicom.push(file);else if(!file.name.includes('.')&&file.size>=132){const marker=await file.slice(128,132).text();if(marker==='DICM')dicom.push(file);}}
  // Folder selections from scanners often contain a tiny environment PLY plus
  // several point-cloud LODs. Put the actual point_cloud export first so the
  // first automatic open shows the scene rather than its small environment.
  const primaryScore=file=>extension(file.name)==='ply'&&/point[_-]?cloud/i.test(file.name)?1:0;
  const candidates=files.filter(f=>canImport(f.name)&&!dicom.includes(f)).sort((a,b)=>primaryScore(b)-primaryScore(a)||b.size-a.size);
  const unsupported=files.filter(f=>!canImport(f.name)&&!dicom.includes(f)&&!['mtl','bin','png','jpg','jpeg','webp','bmp','tga','json','txt','md'].includes(extension(f.name)));
  if(!candidates.length&&!dicom.length){notice(unsupportedMessage(unsupported[0]?.name||files[0].name),true);return;}
  allFiles=files;entries=candidates.map(file=>({name:file.name,file}));if(dicom.length)entries.push({name:`DICOM · ${dicom.length} ${dicom.length===1?'Schicht':'Schichten'}`,dicom:true,files:dicom});activeEntry=-1;renderFiles();tab('files');await loadEntry(0);if(unsupported.length)notice(`${unsupported.length} weitere Datei(en) benötigen Konvertierung. ${unsupportedMessage(unsupported[0].name)}`,true);
}
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>loadDemo(b.dataset.demo));
for(const id of ['open-button','drop-card'])$(id).onclick=()=>$('file-input').click();$('folder-button').onclick=()=>$('folder-input').click();
for(const id of ['file-input','folder-input'])$(id).onchange=async e=>{await acceptFiles(e.target.files);e.target.value='';};
let dragCount=0;window.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragCount++;$('drop-overlay').hidden=false;}});window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('dragleave',()=>{if(--dragCount<=0){dragCount=0;$('drop-overlay').hidden=true;}});window.addEventListener('drop',e=>{e.preventDefault();dragCount=0;$('drop-overlay').hidden=true;acceptFiles(e.dataTransfer.files);});
const hints={mono:'Modelle auf jedem Bildschirm erkunden.',sbs:'Am StereoVisor „Side by Side“ wählen. Im Vollbild prüfen; die schmale Vorschau ist beabsichtigt.',tb:'Am StereoVisor „Top Bottom“ wählen. Erst der Monitor stellt die Proportionen wieder her.',rows:'Nur bei 1:1-Pixelzuordnung. Vollbild, native Auflösung und Zeilenparität am Gerät prüfen.',left:'Einzelansicht der linken Kamera zur Kontrolle.',right:'Einzelansicht der rechten Kamera zur Kontrolle.'};
function saveDevice(){try{localStorage.setItem('browseye.device.v1',JSON.stringify({mode:viewer.output.mode,swap:viewer.output.swap,parity:viewer.output.parity}));}catch{}}
function setMode(mode){if(!(mode in hints))mode='mono';viewer.setOutputMode(mode);$('output-mode').value=mode;$('mode-hint').textContent=hints[mode];$('format-badge').textContent={mono:'2D',sbs:'HALF-SBS',tb:'HALF-TB',rows:'ZEILEN',left:'LINKS',right:'RECHTS'}[mode];$('parity-row').hidden=mode!=='rows';$('calibration').classList.remove('active');$('calibration-hint').hidden=true;saveDevice();}
try{const stored=JSON.parse(localStorage.getItem('browseye.device.v1')||'null');if(stored){viewer.output.swap=!!stored.swap;viewer.output.parity=stored.parity===1?1:0;$('swap').checked=viewer.output.swap;$('parity').checked=!!viewer.output.parity;setMode(stored.mode);}}catch{}
try{viewer.setGamepadProfile(localStorage.getItem('browseye.controller-profile.v1')||'auto');}catch{}
try{const stored=JSON.parse(localStorage.getItem('browseye.controller-calibration.v1')||'null');if(stored)viewer.setGamepadCalibration(stored);}catch{}
$('output-mode').onchange=e=>setMode(e.target.value);$('depth').oninput=e=>{viewer.strength=+e.target.value;$('depth-value').textContent=`${e.target.value} %`;};$('convergence').oninput=e=>{viewer.convergence=+e.target.value;$('convergence-value').textContent=`${e.target.value} %`;};$('swap').onchange=e=>{viewer.output.swap=e.target.checked;saveDevice();};$('parity').onchange=e=>{viewer.output.parity=+e.target.checked;saveDevice();};
$('settings-toggle').onclick=()=>$('settings').hidden=!$('settings').hidden;$('wireframe').onclick=e=>{const b=e.currentTarget;b.classList.toggle('active');viewer.setWireframe(b.classList.contains('active'));};$('grid').onclick=e=>{viewer.grid.visible=!viewer.grid.visible;e.currentTarget.classList.toggle('active',viewer.grid.visible);};$('clip').oninput=e=>{viewer.setClip(+e.target.value);$('clip-value').textContent=e.target.value==='100'?'Aus':`${e.target.value} %`;};$('point-size').oninput=e=>{viewer.setPointSize(+e.target.value);$('point-value').textContent=e.target.value;};
$('calibration').onclick=e=>{viewer.output.calibration=!viewer.output.calibration;e.currentTarget.classList.toggle('active',viewer.output.calibration);document.querySelector('.calibration-hint').hidden=!viewer.output.calibration;};
let handTracking;
function controllerConnected(){try{return Array.from(navigator.getGamepads?.()||[]).some(Boolean);}catch{return false;}}
let controllerCalibrationFlow=null;
const controllerCalibrationHelp={
  horizontal:'Jetzt nur den rechten Stick nach RECHTS halten. Alle anderen Sticks und Trigger loslassen; dann erneut klicken.',
  vertical:'Jetzt den rechten Stick nach UNTEN halten und erneut klicken.',
};
function controllerAxisCapture(snapshot,baseline,excludedIndex){
  let result=null;
  for(let index=2;index<snapshot.axes.length;index++){
    if(index===excludedIndex)continue;
    // DirectInput controllers often park their combined LT/RT axis at -1 or
    // +1. It is never a right-stick axis and must not be stored as one.
    if(Math.abs(baseline[index]||0)>=.9)continue;
    const delta=(snapshot.axes[index]||0)-(baseline[index]||0);
    if(!result||Math.abs(delta)>Math.abs(result.delta))result={index,delta};
  }
  return result&&Math.abs(result.delta)>=.25?result:null;
}
function refreshControllerCalibrationUi(){
  const state=viewer.navigationState(),button=$('controller-calibrate'),reset=$('controller-calibration-reset'),status=$('controller-calibration-status');
  reset.hidden=!state.hasGamepadCalibration;
  if(controllerCalibrationFlow){button.textContent=controllerCalibrationFlow.stage==='horizontal'?'Horizontale Achse übernehmen':'Vertikale Achse übernehmen';status.textContent=controllerCalibrationHelp[controllerCalibrationFlow.stage];return;}
  button.textContent='Rechten Stick kalibrieren';
  status.textContent=state.hasGamepadCalibration?'Dieser Xbox-Controller ist kalibriert. LT und RT werden nicht als Blickachse verwendet.':'Vor dem Start alle Sticks und Trigger loslassen. Dann wird nur der rechte Stick exakt eingemessen.';
}
function advanceControllerCalibration(){
  const snapshot=viewer.gamepadSnapshot();
  if(!snapshot){notice('Kein Controller erkannt. Bitte eine Taste am Xbox-Controller drücken.',true);return;}
  if(!controllerCalibrationFlow){
    controllerCalibrationFlow={id:snapshot.id,baseline:[...snapshot.axes],stage:'horizontal'};
    refreshControllerCalibrationUi();return;
  }
  if(snapshot.id!==controllerCalibrationFlow.id){notice('Es wurde ein anderer Controller erkannt. Bitte Kalibrierung neu starten.',true);controllerCalibrationFlow=null;refreshControllerCalibrationUi();return;}
  const prior=controllerCalibrationFlow.lookX?.index;
  const capture=controllerAxisCapture(snapshot,controllerCalibrationFlow.baseline,controllerCalibrationFlow.stage==='vertical'?prior:undefined);
  if(!capture){notice('Keine eindeutige Bewegung erkannt. Den angeforderten rechten Stick bitte weiter ausschlagen und dann erneut klicken.',true);return;}
  const binding={index:capture.index,neutral:controllerCalibrationFlow.baseline[capture.index]||0,sign:capture.delta<0?-1:1};
  if(controllerCalibrationFlow.stage==='horizontal'){controllerCalibrationFlow.lookX=binding;controllerCalibrationFlow.stage='vertical';refreshControllerCalibrationUi();return;}
  const calibration={id:controllerCalibrationFlow.id,lookX:controllerCalibrationFlow.lookX,lookY:binding};
  try{viewer.setGamepadCalibration(calibration);localStorage.setItem('browseye.controller-calibration.v1',JSON.stringify(calibration));controllerCalibrationFlow=null;notice('Xbox-Controller kalibriert. LT und RT beeinflussen den Blick in Ego nicht.');updateNavigationUi();refreshControllerCalibrationUi();}catch(error){notice(error.message||'Controller konnte nicht kalibriert werden.',true);}
}
function updateNavigationUi(){
  const state=viewer.navigationState(),mode=state.mode;
  $('navigation-mode').value=mode;$('walk-speed').value=Math.max(+$('walk-speed').min,Math.min(+$('walk-speed').max,state.speed));$('walk-speed-value').textContent=`${state.speed.toLocaleString('de-DE',{maximumFractionDigits:2})} m/s`;
  $('controller-profile').value=state.gamepadProfilePreference;$('controller-profile').disabled=state.hasGamepadCalibration;
  const profileLabel={standard:'Standard Xbox', 'legacy-trigger-axis':'Xbox · LT/RT getrennt'}[state.gamepadProfile]||'Automatisch erkennen';
  $('controller-profile-status').textContent=state.hasGamepadCalibration?'Aktiv: individuell kalibriert. In Ego bleiben LT und RT ohne Wirkung; im freien Flug steuern sie nur die Höhe.':`Aktiv: ${profileLabel}. In Ego bleiben LT und RT ohne Wirkung; im freien Flug steuern sie nur die Höhe.`;
  $('navigation-toggle').classList.toggle('active',mode!=='orbit');$('navigation-toggle').innerHTML=mode==='orbit'?`${icon('terrain')} Begehung starten`:`${icon('close')} Begehung beenden`;
  $('navigation-reset').disabled=!state.hasSpawn;
  const controller=controllerConnected()?'Controller erkannt · ':'Kein Controller · ';
  const collision=state.hasCollision?'Wände und Böden folgen der Kollisionsgeometrie.':'Bodenbindung aktiv · für Wände und Treppen Kollisionsmodell ergänzen.';
  const mouse=state.pointerLocked?'Freier Mausblick aktiv · Esc beendet ihn.':state.pointerLockBlocked?'Maus: linke Taste halten und ziehen · der Browser blockiert nur den freien Gaming-Mausblick.':'Maus: in die Szene klicken und ziehen · freier Gaming-Mausblick wird versucht.';
  $('navigation-status').textContent=mode==='orbit'?`${controller}WASD, Maus und Sticks werden erst im Begehungsmodus verwendet.`:`${controller}WASD / linker Stick: bewegen · ${mouse} Rechter Stick: umsehen · Shift oder A: schneller. ${mode==='fly'?'Q/E und Trigger: Höhe.':collision}`;
}
function setNavigationFromUi(mode){
  if(mode!=='orbit'&&handTracking?.running){handTracking.stop('Begehungsmodus aktiv');$('gesture-toggle').classList.remove('active');$('gesture-toggle').innerHTML=`${icon('camera')} Webcam einschalten`;$('gesture-preview').hidden=true;}
  try{viewer.setNavigationMode(mode,{speed:+$('walk-speed').value,reset:mode!=='orbit'});updateNavigationUi();}
  catch(error){notice(error.message||'Begehungsmodus konnte nicht aktiviert werden.',true);}
}
$('navigation-mode').onchange=e=>setNavigationFromUi(e.target.value);
$('navigation-toggle').onclick=()=>setNavigationFromUi(viewer.navigationState().mode==='orbit'?($('navigation-mode').value==='orbit'?'walk':$('navigation-mode').value):'orbit');
$('navigation-reset').onclick=()=>{if(viewer.resetWalkPosition())notice('Zum Startpunkt der Szene zurückgekehrt.');updateNavigationUi();};
$('walk-speed').oninput=e=>{try{viewer.setNavigationSpeed(+e.target.value);updateNavigationUi();}catch(error){notice(error.message,true);}};
$('controller-profile').onchange=e=>{try{viewer.setGamepadProfile(e.target.value);localStorage.setItem('browseye.controller-profile.v1',e.target.value);updateNavigationUi();}catch(error){notice(error.message,true);}};
$('controller-calibrate').onclick=advanceControllerCalibration;
$('controller-calibration-reset').onclick=()=>{controllerCalibrationFlow=null;viewer.setGamepadCalibration(null);localStorage.removeItem('browseye.controller-calibration.v1');updateNavigationUi();refreshControllerCalibrationUi();notice('Controller-Kalibrierung zurückgesetzt.');};
window.addEventListener('gamepadconnected',updateNavigationUi);window.addEventListener('gamepaddisconnected',updateNavigationUi);
function setGestureStatus(message,mode='idle'){
  $('gesture-status').textContent=message;
  $('gesture-hud-status').textContent=message;
  $('gesture-hud').dataset.mode=mode;
  $('gesture-hud').hidden=!handTracking?.running;
  viewer.controls.enabled=mode==='idle'&&viewer.navigationState().mode==='orbit';
}
function setGestureDevices(devices){
  const select=$('gesture-camera'),previous=select.value;
  select.replaceChildren(new Option('Standardkamera',''));
  devices.forEach((device,index)=>select.add(new Option(device.label||`USB-Webcam ${index+1}`,device.deviceId)));
  if([...select.options].some(option=>option.value===previous))select.value=previous;
}
handTracking=new HandTracking({
  onOrbit:({dx,dy})=>viewer.applyHandOrbit(dx,dy),
  onZoom:({delta})=>viewer.applyHandZoom(delta),
  onStatus:setGestureStatus,
  onError:message=>notice(message,true),
  onDevices:setGestureDevices,
  preview:$('gesture-preview'),
});
try{const storedGesture=JSON.parse(localStorage.getItem('browseye.gesture.v1')||'null');if(storedGesture?.placement)$('gesture-placement').value=storedGesture.placement;}catch{}
$('gesture-placement').onchange=()=>{try{localStorage.setItem('browseye.gesture.v1',JSON.stringify({placement:$('gesture-placement').value}));}catch{}};
$('gesture-toggle').onclick=async e=>{
  const button=e.currentTarget;
  if(handTracking.running||handTracking.starting){handTracking.stop();button.classList.remove('active');button.innerHTML=`${icon('camera')} Webcam einschalten`;$('gesture-preview').hidden=true;return;}
  button.disabled=true;
  try{
    await handTracking.start($('gesture-camera').value);
    if(handTracking.running){button.classList.add('active');button.innerHTML=`${icon('close')} Webcam ausschalten`;$('gesture-hud').hidden=false;}
  }catch(error){notice(error.message||'Webcam konnte nicht gestartet werden.',true);}
  finally{button.disabled=false;}
};
$('gesture-camera').onchange=async()=>{
  if(!handTracking.running)return;
  handTracking.stop('Kamera wird gewechselt …');
  $('gesture-toggle').classList.remove('active');
  $('gesture-toggle').click();
};
$('gesture-preview-toggle').onclick=()=>{
  const preview=$('gesture-preview');preview.hidden=!preview.hidden;
  $('gesture-preview-toggle').textContent=preview.hidden?'Kameravorschau anzeigen':'Kameravorschau ausblenden';
};
window.addEventListener('pagehide',()=>handTracking.stop());
for(const id of ['slice','window','level','threshold'])$(id).oninput=e=>{const c=viewer.current?.controller;if(!c)return;try{const value=+e.target.value;if(id==='slice')c.setSlice(value);else if(id==='threshold')c.setSurface($('surface').checked,value);else{c[id]=value;c.setSlice(c.index);}$(id+'-value').textContent=id==='slice'?`${value+1} / ${c.volume.slices.length}`:Math.round(value);}catch(error){notice(error.message,true);}};
$('surface').onchange=e=>{try{viewer.current?.controller?.setSurface(e.target.checked,+$('threshold').value);}catch(error){e.target.checked=false;notice(error.message,true);}};
$('fit').onclick=()=>viewer.fit();document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.remove('active'));b.classList.add('active');viewer.fit({front:new T.Vector3(0,0,1),top:new T.Vector3(0,1,.0001)}[b.dataset.view]);});
async function present(){try{if(document.fullscreenElement){await document.exitFullscreen();document.body.classList.remove('presenting');}else{document.body.classList.add('presenting');await document.documentElement.requestFullscreen();}viewer.resize();}catch(e){document.body.classList.remove('presenting');notice('Vollbild wurde vom Browser nicht freigegeben. Mit H können Sie die Bedienfelder ausblenden.',true);}}
$('fullscreen').onclick=present;$('exit-presentation').onclick=async()=>{document.body.classList.remove('presenting');if(document.fullscreenElement)await document.exitFullscreen();viewer.resize();};document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('presenting');viewer.resize();});
$('screenshot').onclick=async()=>{const blob=await viewer.screenshot();if(!blob){notice('Bild konnte nicht gespeichert werden.',true);return;}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`BrowsEye-${currentName.replace(/[^\p{L}\p{N}_-]/gu,'_')}-${viewer.output.mode}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('formats-button').onclick=()=>$('formats-dialog').showModal();$('close-dialog').onclick=()=>$('formats-dialog').close();$('formats-dialog').onclick=e=>{if(e.target===$('formats-dialog'))$('formats-dialog').close();};
$('streaming-button').onclick=()=>{$('streaming-dialog').showModal();$('streaming-url').focus();};$('close-streaming-dialog').onclick=()=>$('streaming-dialog').close();$('streaming-dialog').onclick=e=>{if(e.target===$('streaming-dialog'))$('streaming-dialog').close();};$('streaming-open').onclick=()=>loadStreamingPath($('streaming-url').value);$('streaming-url').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();loadStreamingPath(e.currentTarget.value);}};
if(window.browseyeDesktop?.pickStreamingScene){$('streaming-local').hidden=false;$('streaming-local').onclick=async()=>{try{const selected=await window.browseyeDesktop.pickStreamingScene();if(!selected?.url)return;$('streaming-url').value=selected.url;await loadStreamingPath(selected.url);}catch(error){notice(error.message||'Szenenordner konnte nicht geöffnet werden.',true);}};}
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$('formats-dialog').open||$('streaming-dialog').open)return;if(e.key.toLowerCase()==='f')present();if(e.key.toLowerCase()==='r'){if(viewer.navigationState().mode==='orbit')viewer.fit();else viewer.resetWalkPosition();}if(e.key.toLowerCase()==='h'){document.body.classList.toggle('presenting');viewer.resize();}if(e.key==='Escape'&&!document.fullscreenElement&&document.pointerLockElement!==viewer.renderer.domElement){document.body.classList.remove('presenting');viewer.resize();}});
await loadDemo('atrium');
updateNavigationUi();
refreshControllerCalibrationUi();
initializeExperienceLayer({ viewer, show, setBusy, notice, icon, setMode });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
