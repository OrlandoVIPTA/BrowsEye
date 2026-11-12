export const formats = [
  { group: '3D & Visualisierung', extensions: ['glb','gltf','obj','stl','ply','fbx','dae','3mf','vtk'], state: 'Direkt', detail: 'Geometrie und verfügbare Materialien. GLTF/OBJ-Begleitdateien gemeinsam auswählen. PLY wird als Netz, Punktwolke oder Gaussian Splat erkannt. VTK: Legacy-PolyData.' },
  { group: 'CAD & Konstruktion', extensions: ['step','stp','iges','igs','brep'], state: 'Direkt', detail: 'Lokale Open-CASCADE-Tessellierung. STEP/IGES werden in Meter umgerechnet; BREP ohne verlässliche Einheit. Anzeige der Flächen, keine CAD-Bearbeitung.' },
  { group: 'Architektur & BIM', extensions: ['ifc'], state: 'Direkt', detail: 'IFC-Geometrie über web-ifc. IFC2x3/IFC4 gemäß Importer. Bauteilnamen und Express-IDs; kein vollständiger BIM-Eigenschaftseditor.' },
  { group: 'Punktwolken & Geodaten', extensions: ['las','xyz','pts','pcd'], state: 'Direkt', detail: 'LAS unkomprimiert (Punktformate 0–3, 6–8), XYZ/PTS mit optional RGB, PCD. Maximal 1 Mio. LAS-/Textpunkte als gleichmäßig ausgedünnte Vorschau. Keine Kartenprojektion.' },
  { group: 'Gaussian Splatting', extensions: ['spz','splat','ksplat','sog'], state: 'Direkt', detail: 'Lokale Darstellung mit Spark. Auch Gaussian-PLY. Große Szenen sind durch Arbeitsspeicher und Grafikkarte begrenzt.' },
  { group: 'XGRIDS Streaming', extensions: ['lcc','lcc2'], state: 'Streaming', detail: 'LCC/LCC2 wird nicht als Einzeldatei importiert. Über „Streaming-Szene“ öffnet BrowsEye das Szenenpaket mit dem lizenzierten XGRIDS Web SDK und lädt nur benötigte Detailbereiche nach.' },
  { group: 'Moleküle', extensions: ['pdb','sdf','mol','mol2'], state: 'Direkt', detail: 'Kugel-Stab-Darstellung. PDB: erstes Modell, alternative Position A; SDF/MOL: V2000, erstes Molekül. Bindungen aus Datei oder geometrisch geschätzt. Keine PyMOL-/Maestro-Sitzungen.' },
  { group: 'Medizinische Bilddaten', extensions: ['dcm','dicom'], state: 'Teilumfang', detail: 'Unkomprimierte DICOM-Part-10-Bilder: Little Endian, 8/16 Bit, MONOCHROME1/2, einzelne Frames. Reguläre Serien als räumliche Schnitte und optionale Isofläche. Kein JPEG/RLE, Enhanced-Multiframe, SEG oder RT. Forschungsansicht, nicht diagnostisch validiert.' },
  { group: 'Revit', extensions: ['rvt','rfa'], state: 'Konvertieren', detail: 'In Revit als IFC exportieren und die IFC-Datei hier öffnen. Native RVT/RFA-Dateien werden nicht eingelesen.' },
  { group: 'SolidWorks & CATIA', extensions: ['sldprt','sldasm','catpart','catproduct','3dxml'], state: 'Konvertieren', detail: 'In der Ursprungssoftware als STEP oder als GLB/OBJ exportieren. Native Teile- und Baugruppendateien benötigen einen separaten Konverter.' },
  { group: 'PyMOL & Schrödinger', extensions: ['pse','psw','mae','maegz','cms','cif','mmcif'], state: 'Konvertieren', detail: 'Strukturen als PDB, SDF (V2000) oder MOL2 exportieren. Darstellungsstile, Sessions und Animationen werden nicht übernommen. mmCIF zunächst in PDB konvertieren.' },
  { group: 'GEOVIA & weitere Geodaten', extensions: ['laz','e57','dwg','dxf','dgn','dem','tif','tiff','geojson','shp','dm'], state: 'Konvertieren', detail: 'Punktwolken als LAS/PLY/XYZ, Oberflächen als OBJ/STL exportieren. Native GEOVIA-Projekte, GIS-Raster, LAZ/E57 und Koordinatenreferenzsysteme benötigen zusätzliche Adapter.' },
];
export const extension = name => name.split('.').pop().toLowerCase();
export const supportFor = name => formats.find(f=>f.extensions.includes(extension(name)));
export const canImport = name => ['Direkt','Teilumfang'].includes(supportFor(name)?.state);
export const maxFileBytes = 256 * 1024 * 1024;
export function unsupportedMessage(name) {
  const match = supportFor(name);
  return match ? `${name}: ${match.detail}` : `${name}: Dieses Format ist noch nicht eingebunden. Bitte als GLB, OBJ, IFC, STEP, PLY oder PDB exportieren.`;
}
