# BrowsEye Ausstellungs-Paket

Ein Ausstellungs-Paket ist ein Ordner mit einem `browseye-exhibit.json` und den dazugehörigen Dateien. Es ist für eine Ausstellung oder einen freigegebenen Digital Twin bestimmt. Die Originaldaten werden nicht verändert und gehören nicht in diesen Ordner.

```text
Mein-Exponat/
├── browseye-exhibit.json
├── model/
│   ├── exponat.glb
│   └── texture.webp
└── media/
    └── detail.jpg
```

## Kleinste gültige Datei

```json
{
  "schema": "browseye-exhibit/1",
  "id": "museum.beispiel.exponat-001",
  "title": { "de": "Mein Exponat", "en": "My Exhibit" },
  "source": { "kind": "file", "asset": "model/exponat.glb" },
  "rights": { "status": "rights-reserved", "holder": "Beispielmuseum", "credit": "3D-Modell: Beispielmuseum" }
}
```

## Vollständigeres Beispiel

```json
{
  "schema": "browseye-exhibit/1",
  "id": "museum.beispiel.exponat-001",
  "version": "1.0.0",
  "title": {
    "de": "Bronzezeitliche Amphore",
    "en": "Bronze Age Amphora"
  },
  "summary": {
    "de": "Ein digital zugängliches Objekt aus der Sammlung.",
    "en": "A digitally accessible object from the collection."
  },
  "source": { "kind": "file", "asset": "model/amphora.glb" },
  "metadata": {
    "institution": "Beispielmuseum",
    "inventoryNumber": "INV-2026-001",
    "creator": "Unbekannt",
    "date": "ca. 1200 v. Chr.",
    "place": "Beispielort",
    "originalFormat": "Photogrammetrie",
    "digitalTwin": "https://sammlung.example.org/object/INV-2026-001"
  },
  "rights": {
    "status": "rights-reserved",
    "holder": "Beispielmuseum",
    "credit": "3D-Digitalisat © Beispielmuseum",
    "usage": {
      "de": "Nur für diese Ausstellung und die freigegebene Web-Präsentation.",
      "en": "For this exhibition and the approved web presentation only."
    }
  },
  "story": [
    {
      "id": "overview",
      "title": { "de": "Das Objekt", "en": "The object" },
      "text": { "de": "Drehen Sie das Objekt frei.", "en": "Rotate the object freely." },
      "camera": { "target": [0, 0, 0], "distance": 7 }
    },
    {
      "id": "detail",
      "title": { "de": "Ein Detail", "en": "A detail" },
      "text": { "de": "Hier wird eine Besonderheit erklärt.", "en": "A feature is explained here." },
      "camera": { "target": [0.2, 0.1, 0.4], "distance": 3 }
    }
  ],
  "media": [
    {
      "type": "image",
      "asset": "media/detail.jpg",
      "alt": { "de": "Detailansicht", "en": "Detail view" }
    },
    {
      "type": "document",
      "asset": "media/objektblatt.pdf",
      "alt": { "de": "Objektblatt", "en": "Object record" }
    }
  ],
  "presentation": {
    "autoRotate": false,
    "preferredStereo": "rows",
    "idleResetSeconds": 90
  }
}
```

## Regeln

- `schema`, `id`, `title`, `source` und `rights` sind Pflichtfelder.
- `source.kind` ist `file` für eine lokale Modell-Datei oder `demo` nur für eingebaute Entwicklungsbeispiele.
- `source.asset` muss relativ zum Paketordner liegen. Absolute Pfade und `..` sind nicht erlaubt.
- Titel, Zusammenfassung, Rechtehinweis und Story können Deutsch (`de`) und Englisch (`en`) enthalten.
- `story.camera.target` und `story.camera.distance` verwenden die Einheit und das Koordinatensystem des gelieferten Modells. Bei einem GLB in Metern sind dies Meter; BrowsEye passt die Ansicht intern an die Bildschirmgröße an.
- `media` kann freigegebene Bilder, Audio, Video und Dokumente aus demselben Paket enthalten. Diese werden lokal im Informationsbereich angezeigt oder als Dokument heruntergeladen.
- Ein Paket enthält nur freigegebene, abgeleitete Ausstellungsdaten. Rohscans, Projektdateien, RVT-Modelle und vertrauliche Messdaten bleiben außerhalb.
- Für große Gelände, Bauwerke und Punktwolken folgt eine spätere 3D-Tiles-Streaming-Stufe; das Manifest bleibt dabei gleich.
