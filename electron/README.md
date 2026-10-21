# BrowsEye Player – Workstation-Shell

Dieser Ordner ist die Grundlage für die installierbare Windows-Version von BrowsEye. Sie verwendet die gleiche lokale Web-Anwendung wie der Browser- und Kioskmodus, startet aber in einer kontrollierten Chromium-Umgebung.

## Befehle

```text
npm run build
npm run desktop
npm run desktop:kiosk
```

- `desktop` öffnet den Player als normale Anwendung.
- `desktop:kiosk` öffnet den Player im Vollbild ohne Browser-Bedienelemente.
- `--presentation` ist für eine betreute StereoVisor-Vorführung gedacht.

`npm run package:windows` erzeugt die erste lokale Windows-Ausgabe unter `release/win-unpacked/`. Sie ist bewusst noch kein signierter, öffentlicher Installer.

Die Shell startet ausschließlich einen lokalen Server auf `127.0.0.1`. Sie ruft keine externen Webadressen auf, verweigert Browser-Berechtigungen und stellt dem Viewer weder Node.js noch beliebigen Dateisystemzugriff bereit.

Vor einer öffentlichen Auslieferung sind noch notwendig:

1. Die reale Grafikkarte und der echte StereoVisor werden mit Half-SBS, Half-Top-Bottom und Zeilenmodus geprüft.
2. Die Kiosk-Startoption und der Rücksetz-Timer werden mit einem konkreten Museum getestet.
3. Ein Windows-Code-Signing-Zertifikat wird für den öffentlichen Installer eingerichtet.
