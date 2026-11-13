# BrowsEye – Hilfe bei Maus und Controller

## Die Maus verändert die Blickrichtung nicht

1. Unter **Perspektive → Begehung & Controller** zuerst **Ego-Perspektive am Boden** oder **Freies Fliegen** wählen.
2. In die große 3D-Szene klicken – nicht auf die Seitenleiste oder einen Bedienknopf.
3. Im Windows-Player aktiviert sich normalerweise der freie Gaming-Mausblick: Der Mauszeiger verschwindet und die Ansicht lässt sich durch Mausbewegungen drehen. Mit `Esc` wird der Mauszeiger wieder freigegeben.
4. Falls die Meldung oder der Hinweis sagt, dass der Browser den freien Mausblick blockiert: **linke Maustaste in der 3D-Szene gedrückt halten und ziehen**. Das ist die eingebaute Rückfallebene und verändert das Sichtfeld ebenfalls.

**Was bedeutet Pointer Lock?** Das ist keine Cloud-, Kamera- oder Datenfreigabe. Es erlaubt nur, dass der Player den Mauszeiger während der Begehung lokal für die Spielsteuerung festhält. Der Windows-Player erteilt diese Berechtigung ausschließlich für seine eigene lokale BrowsEye-Seite.

In einer eingebetteten Web-Vorschau kann der umgebende Website-Betreiber den freien Mausblick bewusst sperren. Für eine vollwertige Vorführung daher den Windows-Player oder eine BrowsEye-Webseite verwenden, deren Einbettung Pointer Lock erlaubt. Die Klick-und-Zieh-Steuerung bleibt auch dort verfügbar.

## Der Controller reagiert nicht

1. Controller per USB, Funkempfänger oder Bluetooth mit Windows verbinden und gegebenenfalls einmal eine Taste drücken.
2. Begehungsmodus starten und die 3D-Szene anklicken.
3. **Linker Stick** oder Steuerkreuz bewegt die Kamera; **rechter Stick** dreht die Blickrichtung.
4. **A/Cross**, rechter Schulterknopf oder Druck auf den linken Stick beschleunigt. Im Modus **Freies Fliegen** steuern die Trigger die Höhe.

BrowsEye nutzt die normale Gamepad-Unterstützung des Betriebssystems und Browsers. Xbox-, PlayStation-, Logitech- und viele andere Standard-Controller funktionieren deshalb ohne ein Hersteller-SDK, sofern Windows sie als Gamepad erkennt. Wenn ein Controller nach dem Verbinden nicht erscheint, Browser beziehungsweise Player schließen, den Controller verbinden und den Player erneut starten.

### LT/RT drehen die Ansicht oder der rechte Stick arbeitet nur teilweise

Unter **Begehung & Controller** auf **Rechten Stick kalibrieren** klicken. Dabei unbedingt genau diese drei Schritte durchführen:

1. Alle Sticks und Trigger loslassen und einmal klicken.
2. Ausschließlich den rechten Stick nach **rechts** halten und **Horizontale Achse übernehmen** klicken.
3. Ausschließlich den rechten Stick nach **unten** halten und **Vertikale Achse übernehmen** klicken.

Danach nutzt BrowsEye nur die zwei wirklich gemessenen rechten Stick-Achsen. LT/RT dürfen in **Ego-Perspektive am Boden** weder Blick noch Position verändern; im Modus **Freies Fliegen** steuern sie ausschließlich die Höhe. Falls die Messung versehentlich mit einem gedrückten Trigger erfolgt ist, **Kalibrierung zurücksetzen** wählen und wiederholen.

## WASD bewegt nicht

- Die Steuerung greift nur im Modus **Ego-Perspektive am Boden** oder **Freies Fliegen**.
- Ein Eingabefeld oder Auswahlmenü darf dabei nicht aktiv sein; einmal in die 3D-Szene klicken.
- In **Objekt erkunden** bleiben die normalen Drehen-, Zoomen- und Verschieben-Werkzeuge aktiv.
