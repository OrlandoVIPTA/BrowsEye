# StereoVisor Splat Player – Vor-Ort-Installation

Dieser Ordner ist komplett eigenständig – kein Internetzugang nötig.

## 1. Installieren (einmalig)

1. Diesen ganzen Ordner (`offline-package`) auf den Ziel-Rechner kopieren
   (z.B. per USB-Stick).
2. Prüfen, ob Node.js schon installiert ist: Eingabeaufforderung öffnen,
   `node --version` eingeben. Kommt eine Versionsnummer zurück → weiter zu
   Schritt 4.
3. Falls nicht: Doppelklick auf `node-installer\node-v24.18.0-x64.msi`,
   durch den Installer durchklicken (Standardeinstellungen reichen).
4. Fertig.

## 2. Starten (jedes Mal)

Doppelklick auf **`start.bat`**.

- Es öffnet sich automatisch der Standard-Browser mit dem Player
  (`http://localhost:4173`).
- **Wichtig:** Ein zusätzliches, minimiertes Konsolenfenster ("StereoVisor
  Player Server") bleibt in der Taskleiste offen – das ist der laufende
  Server. Wird es geschlossen, stoppt der Player. Das Browser-Fenster kann
  frei bewegt/auf den StereoVisor gezogen werden, das Server-Fenster nicht
  anfassen.

## 3. Bedienung

Siehe Checkliste in `dist/../README.md` des Hauptprojekts bzw. kurz
zusammengefasst:

1. Browserfenster auf den StereoVisor-Monitor ziehen, **F** drücken
   (Vollbild).
2. Oben rechts **"Ordner öffnen…"** klicken und den Ordner mit den
   Splat-Dateien (`.ply`/`.spz`/`.splat`/`.ksplat`) auswählen.
3. **Navigation** (neu): mit der Maus ziehen = Objekt drehen, Scrollen =
   Zoom, Rechts-Ziehen = Verschieben. **Taste R** springt jederzeit zur
   gespeicherten Startansicht zurück. Optional: Button "SpaceMouse
   verbinden…" für eine echte 3Dconnexion-6-Achsen-Maus (noch nicht an
   echter Hardware getestet – falls es nicht sauber reagiert, einfach mit
   der normalen Maus weiterarbeiten).
4. **Taste M**: zwischen Beide Augen / Nur Links / Nur Rechts umschalten
   (zum Debuggen).
5. **Taste H**: Bedienpanel ein-/ausblenden (für das Publikum sollte es
   ausgeblendet sein).
6. Regler links: Eye Distance, Convergence-Offset, Field of View – werden
   automatisch pro Szene gespeichert. Die Zero-Parallax-Ebene (Tiefen-
   Nullpunkt) folgt jetzt automatisch dem Zoom-Abstand zum Objekt, der
   Convergence-Regler ist nur noch eine Fein-Korrektur obendrauf.
7. Falls die Tiefe invertiert wirkt: **Swap Eyes**-Knopf im Panel, oder am
   StereoVisor selbst im OSD-Menü **3D Setting → L/R Priority** umschalten.

**Browser:** Chrome oder Edge verwenden (Firefox unterstützt die zum
Ordner-Zugriff nötige Browser-Funktion nicht).

**Wichtig bei Rechnern mit zwei Grafikkarten (z.B. Intel + NVIDIA):**
Windows lässt den Browser standardmäßig auf der schwachen Intel-Grafik
laufen. Einstellungen → System → Anzeige → Grafik → Chrome bzw. Edge
hinzufügen → Optionen → **Hohe Leistung** (NVIDIA) → Speichern → Browser
komplett neu starten. Kontrolle: im Task-Manager (Leistung) muss dann die
NVIDIA-GPU Last zeigen, nicht die Intel-GPU.

**Demo-Szenen:** Im Ordner `demo-scenes` liegen drei Testdateien – im
Player "Ordner öffnen…" und genau diesen Ordner wählen.

**Am StereoVisor selbst vorher prüfen (OSD-Menü):**
- 3D Setting → 3D Format → **Line by Line** (Werkseinstellung ist "Side By
  Side" – muss umgestellt werden)
- 2D/3D → 3D
- Image Setting → Aspect Ratio → Full
- Other Setting → Input Select → richtigen Port (HDMI-1/HDMI-2/DP) wählen
