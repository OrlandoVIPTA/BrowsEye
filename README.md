# BrowsEye by VIPTA GmbH

BrowsEye ist die lokale und webfähige Präsentationsschicht für 3D-Exponate und Digital Twins. Ein Exponat kann auf einem normalen Bildschirm, in einem Browser, im Museums-Kiosk oder stereoskopisch auf einem StereoVisor gezeigt werden.

Die Software lädt keine Dateien in eine Cloud hoch. Für professionelle Ausstellungen werden geprüfte Ausstellungs-Pakete verwendet; Originaldaten bleiben beim Museum oder beim Digitalisierungspartner.

## Für eine Vorführung starten

1. Für die Windows-Anwendung `Start-BrowsEye-Player.bat` doppelklicken. Für eine Ausstellung ohne Bedienleisten gibt es `Start-BrowsEye-Kiosk.bat`.
2. In BrowsEye ein Beispiel wählen oder eigene Dateien öffnen.
3. Für den StereoVisor unter **Perspektive** das gewünschte Ausgabeformat auswählen.
4. Das Fenster auf den StereoVisor ziehen und **Präsentieren** wählen.

## Berührungsfreie Museumssteuerung

Unter **Perspektive → Berührungsfreie Steuerung** kann eine normale USB-Webcam eingeschaltet werden. Die Kamera darf oberhalb oder unterhalb des Displays sitzen; die Auswahl dient der dokumentierten Stationskonfiguration. MediaPipe verarbeitet die Kamerabilder samt Hand-Landmarken ausschließlich lokal auf der Workstation. Es gibt keinen Upload und keine Cloud-Verbindung.

- Daumen und Zeigefinger zusammenführen und kurz halten: Objekt greifen.
- Eine greifende Hand bewegen: Ansicht drehen.
- Zwei greifende Hände weiter auseinander oder zusammen bewegen: zoomen.
- Finger öffnen: bewusst loslassen. Bei verlorenem oder mehrdeutigem Tracking bleibt die Ansicht stehen.

Für eine ruhige Ausstellung sollte jeweils nur eine Person gleichzeitig steuern. Die Live-Abnahme mit der vorgesehenen USB-Webcam, Montagehöhe, Raumlicht und dem echten StereoVisor bleibt Teil der Stationsinstallation.

Die fertige Workstation-Anwendung liegt unter `release/win-unpacked/BrowsEye Player.exe`. `Start-BrowsEye.bat` startet weiterhin die Browser-Version für Vorschau und Entwicklung. `npm run build` erzeugt die lokale Browser-Version unter `dist/`. `npm start` startet diese Version auf `http://localhost:4174`.

## Produktbausteine

- **BrowsEye Player:** Offline-Player für StereoVisor, Kiosk und Ausstellung.
- **BrowsEye Web:** Derselbe Inhalt für Museum-Webseite, Tablet und QR-Code.
- **BrowsEye Studio:** Künftig der geschützte Import- und Veröffentlichungsbereich für Fachdateien, Metadaten und Rechte.
- **Stereo-Adapter:** Künftig eine Ergänzung für bestehende WebGL-Viewer von Partnern wie Digitalisierungshäusern.

## Aktueller Stand

Die Preview kann Modelle, Punktwolken, Splats, IFC, STEP/IGES/BREP, einfache Moleküle und einen klar begrenzten DICOM-Teil lokal darstellen. Die Formatübersicht in der Anwendung sagt bei jedem Format ausdrücklich, ob es direkt unterstützt wird oder einen Export benötigt.

Die eigentliche Ausstellung arbeitet mit einem kleinen Manifest. Es enthält Titel, Beschreibung, Rechte, Herkunft, Sprache und erzählte Stationen, während das Modell selbst austauschbar bleibt. Die genaue Struktur steht in [EXHIBIT-PACKAGE.md](EXHIBIT-PACKAGE.md).

## Bewusste Grenzen der Preview

- Revit, SolidWorks, CATIA, GEOVIA, PyMOL- und Schrödinger-Projekte werden noch nicht direkt gelesen. Sie werden über offene Austauschformate oder lizenzierte Konverter angebunden.
- Medizinische Daten sind ausschließlich eine technische Forschungsansicht und nicht diagnostisch validiert.
- Die reale Stereo-Qualität muss auf dem jeweiligen StereoVisor, mit dessen Auflösung und OSD-Einstellung, geprüft werden.
- Große Museumsbestände brauchen anschließend eine Kachel-/Streaming-Stufe; sie sollen nicht als einzelne Rohdatei im Besucher-Viewer landen.

## Rechte und Datenhoheit

Ein Ausstellungs-Paket soll immer die Freigabe, Urheberschaft, Lizenz und Quelle mitführen. Es ersetzt kein Archiv und keine fachliche Datenbank. Für Partner bedeutet das: Sie behalten Originaldaten und Nutzungsrechte, während BrowsEye nur die freigegebene Präsentationsfassung ausliefert.
