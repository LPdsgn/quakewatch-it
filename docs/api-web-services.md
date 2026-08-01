# INGV ONT — Web Services e API sismiche

Documentazione tecnica per l’integrazione dei dati dell’**Osservatorio Nazionale Terremoti (ONT)** dell’**Istituto Nazionale di Geofisica e Vulcanologia (INGV)**. I servizi pubblici sono basati sugli standard **FDSN** e consentono di ottenere eventi sismici, metadati delle stazioni e forme d’onda.[^1]

> **Nota operativa:** per consumare dati aggiornati non è necessario effettuare scraping delle interfacce ISIDe/OSIRIDE. La via prevista per integrazioni applicative è l’uso dei Web Services FDSN dell’INGV.[^1]

## Risorse ufficiali

- **Pagina ONT “Web Services e Software”**
https://terremoti.ingv.it/webservices_and_software
Panoramica ufficiale dei servizi FDSN messi a disposizione dall’ONT.[^1]
- **API FDSN Event — endpoint base**
https://webservices.ingv.it/fdsnws/event/1/
API per la ricerca di eventi sismici in formato QuakeML o testo.[^2]
- **Specifica OpenAPI dell’endpoint Event**
https://ingv.github.io/openapi/fdsnws/event/0.0.1/event.yaml
Definizione machine-readable OpenAPI 3 dell’API eventi.[^2]
- **Repository OpenAPI INGV**
https://github.com/INGV/openapi
Repository ufficiale delle definizioni OpenAPI disponibili.[^2]
- **ISIDe — Italian Seismological Instrumental and Parametric Data-Base**
https://terremoti.ingv.it/iside
Banca dati dei terremoti localizzati dalla sala di sorveglianza sismica INGV; offre esportazioni in QuakeML, testo, KML e Atom.[^3]
- **FDSN — specifiche dei servizi**
https://www.fdsn.org/webservices/
Standard internazionali alla base degli endpoint Event, Station e DataSelect.
- **QuakeML**
https://quake.ethz.ch/quakeml/
Standard XML per la rappresentazione di informazioni sismologiche.
- **ObsPy**
https://docs.obspy.org/
Libreria Python che supporta direttamente i servizi FDSN e i formati sismologici, inclusi QuakeML, StationXML e miniSEED.


## Architettura dei servizi

L’ONT espone servizi compatibili FDSN per tre domini: **eventi sismici**, **metadati delle stazioni** e **forme d’onda**. La documentazione pubblica identifica esplicitamente l’API `fdsnws/event` e le relative definizioni OpenAPI.[^2][^1]


| Dominio | Endpoint | Scopo | Formati |
| :-- | :-- | :-- | :-- |
| Eventi | `fdsnws/event/1` | Catalogo dei terremoti e relativi parametri | QuakeML, testo |
| Stazioni | `fdsnws/station/1` | Reti, stazioni, canali e sensori | StationXML, testo |
| Forme d’onda | `fdsnws/dataselect/1` | Segnali sismici per canale e intervallo temporale | miniSEED |

Base URL:

```text
https://webservices.ingv.it/
```


## FDSN Event

### Endpoint

```text
GET https://webservices.ingv.it/fdsnws/event/1/query
```

Restituisce eventi sismici filtrabili per tempo, area geografica, magnitudo e profondità. L’INGV descrive questo servizio come API per informazioni sugli eventi in formato QuakeML e testo.[^2]

### Parametri principali

| Parametro | Tipo | Descrizione |
| :-- | :-- | :-- |
| `starttime` | ISO 8601 | Inizio dell’intervallo temporale |
| `endtime` | ISO 8601 | Fine dell’intervallo temporale |
| `minlatitude` / `maxlatitude` | Numero | Limiti geografici latitudinali |
| `minlongitude` / `maxlongitude` | Numero | Limiti geografici longitudinali |
| `latitude` / `longitude` | Numero | Coordinate del centro della ricerca |
| `maxradius` | Numero | Raggio massimo dal punto centrale, generalmente in gradi |
| `minmagnitude` / `maxmagnitude` | Numero | Intervallo di magnitudo |
| `mindepth` / `maxdepth` | Numero | Intervallo di profondità, in km |
| `eventid` | Stringa | Identificativo di uno specifico evento |
| `limit` | Intero | Numero massimo di risultati |
| `offset` | Intero | Offset per paginazione |
| `orderby` | Stringa | Ordinamento, ad esempio `time` o `magnitude` |
| `format` | Stringa | Formato di output, ad esempio `quakeml` o `text` |

### Esempio: ultimi eventi

```bash
curl -G 'https://webservices.ingv.it/fdsnws/event/1/query' \
  --data-urlencode 'format=text' \
  --data-urlencode 'orderby=time' \
  --data-urlencode 'limit=100'
```


### Esempio: Campi Flegrei

Bounding box orientativo per l’area flegrea:

```bash
curl -G 'https://webservices.ingv.it/fdsnws/event/1/query' \
  --data-urlencode 'format=text' \
  --data-urlencode 'starttime=2026-08-01T00:00:00' \
  --data-urlencode 'endtime=2026-08-01T23:59:59' \
  --data-urlencode 'minlatitude=40.75' \
  --data-urlencode 'maxlatitude=40.90' \
  --data-urlencode 'minlongitude=13.95' \
  --data-urlencode 'maxlongitude=14.30' \
  --data-urlencode 'minmagnitude=1' \
  --data-urlencode 'orderby=time'
```


### Esempio: QuakeML

```bash
curl -G 'https://webservices.ingv.it/fdsnws/event/1/query' \
  --data-urlencode 'format=quakeml' \
  --data-urlencode 'starttime=2026-08-01T00:00:00' \
  --data-urlencode 'endtime=2026-08-01T23:59:59'
```


## FDSN Station

### Endpoint

```text
GET https://webservices.ingv.it/fdsnws/station/1/query
```

Fornisce i metadati di reti, stazioni, location e canali. È il servizio da usare per identificare correttamente quali sensori e canali sono disponibili prima di richiedere forme d’onda.

### Parametri utili

| Parametro | Esempio | Descrizione |
| :-- | :-- | :-- |
| `network` | `CH` | Codice della rete |
| `station` | `ABC` | Codice della stazione |
| `location` | `--` | Codice location |
| `channel` | `HHZ` | Codice canale |
| `level` | `network`, `station`, `channel`, `response` | Livello di dettaglio richiesto |
| `starttime`, `endtime` | ISO 8601 | Validità temporale dei metadati |
| `format` | `xml` o `text` | Formato di output |

### Esempio: canali della rete CH

```bash
curl -G 'https://webservices.ingv.it/fdsnws/station/1/query' \
  --data-urlencode 'network=CH' \
  --data-urlencode 'level=channel' \
  --data-urlencode 'format=xml'
```


## FDSN DataSelect

### Endpoint

```text
GET https://webservices.ingv.it/fdsnws/dataselect/1/query
```

Restituisce dati di forma d’onda per una combinazione rete/stazione/location/canale e una finestra temporale. Il formato di risposta è tipicamente **miniSEED**, quindi il consumo lato browser non è in genere pratico senza un backend o una libreria specializzata.

### Parametri essenziali

| Parametro | Esempio | Descrizione |
| :-- | :-- | :-- |
| `net` | `IV` | Codice rete |
| `sta` | `ABC` | Codice stazione |
| `loc` | `--` | Location code |
| `cha` | `HHZ` | Codice canale |
| `start` | `2026-08-01T00:00:00` | Inizio finestra |
| `end` | `2026-08-01T00:10:00` | Fine finestra |

### Esempio

```bash
curl -G 'https://webservices.ingv.it/fdsnws/dataselect/1/query' \
  --data-urlencode 'net=IV' \
  --data-urlencode 'sta=XXXX' \
  --data-urlencode 'loc=--' \
  --data-urlencode 'cha=HHZ' \
  --data-urlencode 'start=2026-08-01T00:00:00' \
  --data-urlencode 'end=2026-08-01T00:10:00' \
  --output waveform.mseed
```

> Sostituire `XXXX` con una stazione effettivamente disponibile, ottenuta in precedenza tramite `fdsnws/station`.

## ISIDe e OSIRIDE

**ISIDe** è la banca dati parametrica italiana per gli eventi localizzati dalla sala di sorveglianza sismica INGV. Comprende informazioni estese, incluse incertezze, versioni successive delle localizzazioni e delle magnitudo — dalle stime automatiche a quelle riviste e perfezionate — ed espone download in QuakeML, testo, KML e Atom.[^3]

Per integrazioni software è preferibile considerare ISIDe e OSIRIDE come interfacce di consultazione/gestione e adottare gli endpoint FDSN pubblici come livello di accesso programmatico. Il repository ufficiale INGV pubblica la definizione OpenAPI di `fdsnws/event`; non risulta, nelle fonti ufficiali consultate, una REST API JSON separata e documentata specificamente per OSIRIDE.[^1][^2]

## Strategia di polling

Gli endpoint FDSN sono servizi di interrogazione HTTP; non vanno trattati come feed WebSocket push. Per una dashboard di monitoraggio, implementare polling, deduplicazione e aggiornamento degli eventi.

- Intervallo consigliato: 30–60 secondi, modulandolo in funzione del traffico e delle necessità applicative
- Finestra di recupero sovrapposta: 5–15 minuti, per intercettare aggiornamenti e ritardi di pubblicazione
- Chiave primaria: usare `eventid` quando disponibile
- Aggiornamenti: salvare orario origine, magnitudo, coordinate, profondità e timestamp di acquisizione
- Revisioni: non assumere che la prima localizzazione o magnitudo sia definitiva
- Resilienza: gestire timeout, HTTP 4xx/5xx, retry esponenziale e cache locale
- Rate limiting: limitare le chiamate al minimo necessario e preferire query ristrette per area e tempo


## Esempio TypeScript

```ts
type Earthquake = {
  eventId: string;
  time: string;
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  place: string;
};

const endpoint = new URL(
  'https://webservices.ingv.it/fdsnws/event/1/query',
);

endpoint.search = new URLSearchParams({
  format: 'text',
  starttime: new Date(Date.now() - 10 * 60_000).toISOString(),
  minlatitude: '40.75',
  maxlatitude: '40.90',
  minlongitude: '13.95',
  maxlongitude: '14.30',
  minmagnitude: '0',
  orderby: 'time',
}).toString();

const response = await fetch(endpoint);

if (!response.ok) {
  throw new Error(`INGV FDSN error: ${response.status}`);
}

const text = await response.text();
// Effettuare il parsing in base all'header e al formato text restituito.
console.log(text);
```

> In una web app frontend, verificare preliminarmente gli header CORS effettivamente restituiti dal servizio. In caso di limitazioni CORS o per non esporre la logica di polling ai client, usare un endpoint server-side/proxy con cache.

## Formati

| Formato | Uso principale | Note |
| :-- | :-- | :-- |
| QuakeML | Eventi e dati parametrici completi | XML standard sismologico |
| Text | Query semplici e integrazioni leggere | Più semplice da elaborare in JavaScript |
| StationXML | Metadati sismologici | Reti, stazioni, canali e risposte strumentali |
| miniSEED | Forme d’onda | Formato binario, adatto a librerie specializzate |
| KML | Visualizzazione cartografica | Utilizzabile in strumenti GIS e Google Earth |
| Atom | Feed di aggiornamento | Utile quando disponibile nell’interfaccia ISIDe |

## Licenze e attribuzione

Verificare le condizioni d’uso, i vincoli di ridistribuzione e la formulazione dell’attribuzione direttamente nelle pagine ufficiali INGV prima della pubblicazione o della commercializzazione di un servizio derivato. Per dati scientifici e localizzazioni preliminari, indicare sempre chiaramente la fonte come **INGV — Osservatorio Nazionale Terremoti** e prevedere che i parametri siano soggetti a revisione.[^3][^1]
<span style="display:none">[^10][^11][^12][^13][^14][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://terremoti.ingv.it/webservices_and_software

[^2]: https://github.com/INGV/openapi

[^3]: https://terremoti.ingv.it/iside

[^4]: https://github.com/INGV/openapi/blob/master/src/fdsnws/event/0.0.1/openapi.yaml

[^5]: https://terremoti.ingv.it/bsi?id=10.13127/BSI/201701.01

[^6]: https://terremoti.ingv.it/instruments/network/3A

[^7]: https://terremoti.ingv.it/help

[^8]: https://terremoti.ingv.it/instruments/network/AC

[^9]: https://terremoti.ingv.it/bsi?id=10.13127/BSI/201703

[^10]: https://terremoti.ingv.it/bsi?id=10.13127/BSI/201601

[^11]: https://terremoti.ingv.it/bsi?id=10.13127/BSI/201702

[^12]: https://terremoti.ingv.it/bsi?id=10.13127/BSI/201602

[^13]: https://terremoti.ingv.it/bsi?id=10.13127/BSI/201701

[^14]: https://terremoti.ingv.it/bsi?id=10.13127/BSI/201603.01

