# BrowsEye by VIPTA GmbH

> **BrowsEye Standard 1.0 · öffentlicher Open-Development-Referenzstand · nicht für den kommerziellen Einsatz**  
> „Standard“ bezeichnet den von VIPTA freigegebenen Referenzstand für Entwicklung, Tests, Forschung und die technische Partner-Evaluierung. Er ist kein kommerzielles Produkt, kein Angebot und keine Freigabe für einen kommerziellen Betrieb. Details stehen in [LICENSE](LICENSE).

BrowsEye ist die lokale und webfähige Präsentationsschicht für 3D-Exponate und Digital Twins. Ein Exponat kann auf einem normalen Bildschirm, in einem Browser, im Museums-Kiosk oder stereoskopisch auf einem StereoVisor gezeigt werden.

## Offene Developer Community

Dieser Quellcode darf ausdrücklich heruntergeladen, untersucht und als technische Idee diskutiert werden. Wir laden Museen, Digitalisierungspartner, CAD-/BIM-Anbieter, Entwicklerinnen und Entwickler sowie Teams mit eigenen Stereo-Lösungen ein, ihn zu testen und Rückmeldungen oder Verbesserungen zu teilen.

BrowsEye zeigt einen möglichen Ansatz für offene 3D-, Stereo- und Handsteuerungs-Workflows. Es ist keine fertige Antwort auf alle Anforderungen und kein Produktversprechen. Gerade deshalb sind praktische Erfahrungen mit anderen Displays, Viewern, Datenformaten und Stereo-Pipelines willkommen.

## Grafik-Technik: WebGL / OpenGL ES

Die Browser-Ansicht verwendet **WebGL** über Three.js. WebGL ist die Web-Grafikschnittstelle der OpenGL-ES-Familie und nutzt die Grafikhardware des jeweiligen Geräts. Dieses Projekt ist keine offizielle OpenGL- oder Khronos-Group-Software und wird von ihnen weder bereitgestellt noch unterstützt.

Die Software lädt keine Dateien in eine Cloud hoch. Für professionelle Ausstellungen werden geprüfte Ausstellungs-Pakete verwendet; Originaldaten bleiben beim Museum oder beim Digitalisierungspartner.

## Für eine Vorführung starten

1. Für die Windows-Anwendung `release/win-unpacked/BrowsEye Player.exe` doppelklicken. Für eine Ausstellung ohne Bedienleisten steht der Kiosk-Startmodus zur Verfügung.
2. In BrowsEye ein Beispiel wählen oder eigene Dateien öffnen.
3. Für den StereoVisor unter **Perspektive** das gewünschte Ausgabeformat auswählen.
4. Das Fenster auf den StereoVisor ziehen und **Präsentieren** wählen.

## Große Streaming-Szenen und Begehung

Für sehr große Villen, Yachten, Hotels und Punktwolken gibt es jetzt den Button **Streaming-Szene**. Er ist bewusst vom normalen Dateidialog getrennt: Der Direktimport bleibt für überschaubare Einzeldateien begrenzt, während eine Streaming-Szene nur die räumlich sichtbaren Detailbereiche von SSD, lokalem Server oder HTTPS nachlädt.

- **BrowsEye Player unter Windows:** Auf **Streaming-Szene → Lokalen Szenenordner wählen** klicken und den Ordner mit `browseye-streaming-scene.json`, `.lcc` oder `.lcc2` auswählen. Der Player stellt ausschließlich diesen gewählten Ordner lokal bereit; er kopiert keine 5-GB-Szene in den Arbeitsspeicher.
- **BrowsEye Web:** Eine HTTPS- oder lokale HTTP-URL zum Szenenpaket eingeben. Der Host muss CORS für die BrowsEye-Website erlauben.
- **Offenes Szenenpaket:** gekachelte GLB-Dateien mit LOD, räumlichen Grenzen, Startpunkt und optionalem Kollisionsmodell. Das Schema steht in [STREAMING-SCENES.md](STREAMING-SCENES.md).
- **XGRIDS LCC/LCC2:** Der Viewer enthält die Anbindung, aber nicht das proprietäre XGRIDS SDK. Es wird mit dem von XGRIDS lizenzierten Web-SDK ergänzt; Anleitung und Abnahmehinweise stehen in [LCC-STREAMING-INTEGRATION.md](LCC-STREAMING-INTEGRATION.md).

In **Perspektive → Begehung & Controller** stehen drei Modi zur Verfügung: Objekt erkunden, Ego-Perspektive am Boden und freies Fliegen. Im Ego-Modus: `WASD` gehen, Maus/rechter Stick umsehen, `Shift` beziehungsweise Controller-Taste A beschleunigen. Linker Stick bewegt; im Flugmodus steuern `Q`/`E` bzw. Trigger die Höhe. Ein exportiertes Kollisionsmodell oder LCC-Kollisionsdaten werden für Wände, Böden und Treppen benötigt; ohne sie hält BrowsEye die Kamera am definierten Boden. Bei gestreamten Meter-Szenen verwendet der Ego-Modus eine stabile reale Stereo-Basis (maximal 64 mm bei 100 % Stereotiefe), statt sie von der Orbit-Kameraentfernung abhängig zu machen.

### Gaming-Steuerung: Maus, Tastatur und Controller

Für eine Begehung zuerst unter **Perspektive → Begehung & Controller** den Modus **Ego-Perspektive am Boden** oder **Freies Fliegen** wählen und anschließend in die 3D-Szene klicken.

| Eingabe | Funktion |
| --- | --- |
| `W` `A` `S` `D`, linker Stick oder Steuerkreuz | bewegen |
| Maus oder rechter Stick | Blickrichtung / Sichtfeld |
| `Shift`, A/Cross, rechter Schulterknopf oder linker Stick gedrückt | schneller bewegen |
| `Q`/`E` oder linker/rechter Trigger | Höhe im freien Flug |
| `R` | an den definierten Startpunkt zurückkehren |
| `Esc` | freien Mausblick verlassen |

Nach einem Klick versucht BrowsEye den freien Gaming-Mausblick (**Pointer Lock**) zu aktivieren. Im Windows-Player ist diese Freigabe für die lokale BrowsEye-Szene vorgesehen: Der Mauszeiger verschwindet, und die Blickrichtung lässt sich wie in einem Spiel auch über den Bildschirmrand hinaus steuern. `Esc` gibt den Mauszeiger wieder frei.

Ein Browser, eine eingebettete Vorschau oder eine Sicherheitsrichtlinie kann diesen freien Modus ablehnen. Dann bleibt die Bedienung trotzdem vollständig nutzbar: In der 3D-Szene die **linke Maustaste gedrückt halten und ziehen**, um sich umzusehen. Der rechte Controller-Stick funktioniert unabhängig davon weiter. Der Controller verwendet die übliche System-/Browser-Gamepad-Belegung; bei der ersten Nutzung gegebenenfalls einmal eine Taste drücken. Eine verständliche Fehlerhilfe steht in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

### Xbox: rechter Stick einmal exakt einmessen

Einzelne Windows-/Treiberkombinationen melden Trigger- und Stick-Achsen anders als ein Standard-Xbox-Controller. Falls LT/RT den Blick beeinflussen oder der rechte Stick nicht sauber in beide Richtungen dreht, in **Begehung & Controller** auf **Rechten Stick kalibrieren** klicken:

1. Alle Sticks und Trigger loslassen und einmal klicken.
2. Nur den rechten Stick nach **rechts** halten und **Horizontale Achse übernehmen** klicken.
3. Nur den rechten Stick nach **unten** halten und **Vertikale Achse übernehmen** klicken.

BrowsEye speichert danach ausschließlich diese zwei gemessenen Achsen für diesen Controller. In der Ego-Perspektive bleiben LT/RT ohne Wirkung; nur im Modus **Freies Fliegen** steuern sie die Höhe. Die Schaltfläche **Kalibrierung zurücksetzen** entfernt die Zuordnung wieder.

## Berührungsfreie Museumssteuerung

Unter **Perspektive → Berührungsfreie Steuerung** kann eine normale USB-Webcam eingeschaltet werden. Die Kamera darf oberhalb oder unterhalb des Displays sitzen; die Auswahl dient der dokumentierten Stationskonfiguration. MediaPipe verarbeitet die Kamerabilder samt Hand-Landmarken ausschließlich lokal auf der Workstation. Es gibt keinen Upload und keine Cloud-Verbindung.

- Daumen und Zeigefinger zusammenführen und kurz halten: Objekt greifen.
- Eine greifende Hand bewegen: Ansicht drehen.
- Zwei greifende Hände weiter auseinander oder zusammen bewegen: zoomen.
- Finger öffnen: bewusst loslassen. Bei verlorenem oder mehrdeutigem Tracking bleibt die Ansicht stehen.

Für eine ruhige Ausstellung sollte jeweils nur eine Person gleichzeitig steuern. Die Live-Abnahme mit der vorgesehenen USB-Webcam, Montagehöhe, Raumlicht und dem echten StereoVisor bleibt Teil der Stationsinstallation.

Die fertige Workstation-Anwendung liegt unter `release/win-unpacked/BrowsEye Player.exe`. Für die lokale Browser-Entwicklung erzeugt `npm run build` die Web-Version unter `dist/`; `npm start` startet sie auf `http://localhost:4174`.

## Entwicklungsbausteine

- **BrowsEye Player:** Offline-Player für StereoVisor, Kiosk und Ausstellung.
- **BrowsEye Web:** Derselbe Inhalt für Museum-Webseite, Tablet und QR-Code.
- **BrowsEye Studio:** Künftig der geschützte Import- und Veröffentlichungsbereich für Fachdateien, Metadaten und Rechte.
- **Stereo-Adapter:** Künftig eine Ergänzung für bestehende WebGL-Viewer von Partnern wie Digitalisierungshäusern.

## Aktueller Stand

Der aktuelle Standard kann Modelle, Punktwolken, Splats, IFC, STEP/IGES/BREP, einfache Moleküle und einen klar begrenzten DICOM-Teil lokal darstellen. Die Formatübersicht in der Anwendung sagt bei jedem Format ausdrücklich, ob es direkt unterstützt wird oder einen Export benötigt.

Die eigentliche Ausstellung arbeitet mit einem kleinen Manifest. Es enthält Titel, Beschreibung, Rechte, Herkunft, Sprache und erzählte Stationen, während das Modell selbst austauschbar bleibt. Die genaue Struktur steht in [EXHIBIT-PACKAGE.md](EXHIBIT-PACKAGE.md).

## Bekannte Grenzen des aktuellen Standards

- Revit, SolidWorks, CATIA, GEOVIA, PyMOL- und Schrödinger-Projekte werden noch nicht direkt gelesen. Sie werden über offene Austauschformate oder lizenzierte Konverter angebunden.
- Medizinische Daten sind ausschließlich eine technische Forschungsansicht und nicht diagnostisch validiert.
- Die reale Stereo-Qualität muss auf dem jeweiligen StereoVisor, mit dessen Auflösung und OSD-Einstellung, geprüft werden.
- Große Museumsbestände müssen als Kachel-/Streaming-Szene veröffentlicht werden; eine einzelne 5-GB-Rohdatei ist kein sinnvoller Besucher-Import.

## Rechte und Datenhoheit

Ein Ausstellungs-Paket soll immer die Freigabe, Urheberschaft, Lizenz und Quelle mitführen. Es ersetzt kein Archiv und keine fachliche Datenbank. Für Partner bedeutet das: Sie behalten Originaldaten und Nutzungsrechte, während BrowsEye nur die freigegebene Präsentationsfassung ausliefert.
