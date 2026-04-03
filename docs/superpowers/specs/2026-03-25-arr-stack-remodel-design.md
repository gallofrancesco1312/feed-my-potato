# FeedMyPotato ARR Stack Remodel — Design Spec

## Overview

Ricostruzione di FeedMyPotato attorno allo stack ARR (Radarr, Sonarr, Prowlarr), trasformandola da interfaccia manuale di ricerca/download a **dashboard unificata** che aggrega e controlla i servizi ARR da un unico pannello.

### Approccio scelto: API Gateway Puro

FeedMyPotato diventa un thin client che parla esclusivamente con le API REST di Sonarr, Radarr, Prowlarr e qBittorrent. Le API routes di Next.js fanno solo proxy e aggregazione — nessuna logica di business nel backend.

### Cosa cambia

- **Rimosso:** Jackett, FlareSolverr diretto, logica custom di ricerca/cleanup/monitoraggio completamento, gestione filesystem
- **Aggiunto:** Radarr (film), Sonarr (serie TV), Prowlarr (indexer)
- **Mantenuto:** qBittorrent (download client), Next.js 15 + React, Tailwind CSS, shadcn, SSE per download real-time
- **Migrazione:** big bang — ricostruzione completa, nessun periodo di coesistenza

## Architettura

```
┌─────────────────────────────────────────────────────┐
│              FeedMyPotato (Next.js 15)                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Frontend (React)                           │   │
│  │  - Dashboard (overview aggregato)           │   │
│  │  - Cerca (film + serie, unified search)     │   │
│  │  - Film (libreria Radarr)                   │   │
│  │  - Serie TV (libreria Sonarr)               │   │
│  │  - Download (attività in corso)             │   │
│  │  - Calendario (prossime uscite)             │   │
│  │  - Cronologia (attività recenti)            │   │
│  │  - Indexer (gestione Prowlarr)              │   │
│  │  - Sistema (salute servizi + config)        │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  API Routes (Gateway)                       │   │
│  │  - /api/radarr/*   → proxy Radarr API       │   │
│  │  - /api/sonarr/*   → proxy Sonarr API       │   │
│  │  - /api/prowlarr/* → proxy Prowlarr API     │   │
│  │  - /api/qbit/*     → proxy qBittorrent API  │   │
│  │  - /api/system     → health check aggregato │   │
│  │  - /api/config     → configurazione FMP     │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Lib (client API per ogni servizio)         │   │
│  │  - radarr.ts   (film CRUD, ricerca, profili)│   │
│  │  - sonarr.ts   (serie CRUD, ricerca, epis.) │   │
│  │  - prowlarr.ts (indexer CRUD, sync, test)   │   │
│  │  - qbittorrent.ts (download, stato)         │   │
│  │  - config.ts   (configurazione locale)      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
        ↓            ↓            ↓            ↓
   ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐
   │ Radarr │  │ Sonarr │  │ Prowlarr │  │qBittorrent│
   │ :7878  │  │ :8989  │  │  :9696   │  │  :8080   │
   └────────┘  └────────┘  └──────────┘  └──────────┘
```

### Principi chiave

- Le API routes non contengono logica di business — solo proxy, aggregazione e normalizzazione risposte
- Ogni servizio ARR ha il suo client TypeScript dedicato in `lib/`
- La configurazione (URL + API key/credenziali di ogni servizio) in `config.json`
- SSE mantenuto per il monitoraggio download in tempo reale via qBittorrent

### Cosa viene rimosso dal codebase

- `lib/jackett.ts` — sostituito da Prowlarr
- `lib/cleanup.ts` — Sonarr/Radarr gestiscono import e rinomina automaticamente
- `lib/torrent-monitor.ts` — il monitoraggio si semplifica (solo stato download, no logica di completamento)
- `lib/library.ts` — la libreria si legge da Sonarr/Radarr, non dal filesystem
- Jackett e FlareSolverr rimossi dal docker-compose

## Pagine e Funzionalità

### Dashboard (`/`)

Panoramica aggregata di tutto il sistema:
- **Statistiche rapide:** totale film, serie, episodi, spazio disco usato (da API Radarr/Sonarr)
- **Download attivi:** lista compatta dei download in corso (da qBittorrent via SSE)
- **Prossime uscite:** i prossimi 7 giorni dal calendario Sonarr/Radarr
- **Attività recente:** ultimi 10 eventi dalla cronologia Sonarr/Radarr
- **Salute sistema:** stato di connessione dei 4 servizi (verde/rosso)

### Cerca (`/search`)

Ricerca unificata film + serie:
- Un unico campo di ricerca con toggle "Film / Serie TV / Tutti"
- Quando "Tutti" è selezionato, il frontend chiama `/api/radarr/lookup` e `/api/sonarr/lookup` in parallelo e unisce i risultati, distinguendoli con un badge "Film" o "Serie"
- Risultati con poster, anno, valutazione, overview (da API lookup di Radarr/Sonarr)
- Per ogni risultato: stato (già in libreria / disponibile / non monitorato)
- Click su un risultato → modale di aggiunta con scelta profilo qualità e root folder
- Ricerche recenti mantenute in localStorage (come oggi)

### Film (`/movies`)

Libreria Radarr:
- Griglia/lista dei film con poster, titolo, anno, qualità, stato (scaricato/mancante/monitorato)
- Filtri: stato, qualità, anno, ordinamento
- Click su film → dettaglio con info, file presenti, cronologia, possibilità di ri-cercare o eliminare
- Bulk actions: monitorare/demonitorare, cercare, eliminare

### Serie TV (`/series`)

Libreria Sonarr:
- Griglia/lista serie con poster, titolo, network, stagioni, stato
- Click su serie → vista stagioni → vista episodi con stato per episodio
- Monitoraggio granulare (intera serie, singola stagione, singolo episodio)
- Ricerca manuale per episodi mancanti

### Download (`/downloads`)

Monitoraggio download attivi:
- Lista download da qBittorrent con progresso, velocità, ETA (SSE come oggi)
- Per ogni download: etichetta "Film" o "Serie" determinata incrociando l'hash del torrent con le code di Radarr (`/api/radarr/queue`) e Sonarr (`/api/sonarr/queue`)
- Azioni: pausa, resume, elimina
- Coda Sonarr/Radarr: mostra anche gli item in coda di importazione

### Calendario (`/calendar`)

Vista calendario delle uscite:
- Vista settimanale/mensile
- Episodi da Sonarr + film da Radarr combinati
- Indicatore visivo: già scaricato / in download / mancante

### Cronologia (`/history`)

Attività recenti aggregate:
- Eventi da Sonarr (episodi scaricati, importati, falliti)
- Eventi da Radarr (film scaricati, importati, falliti)
- Filtro per tipo e per data

### Indexer (`/indexers`)

Gestione Prowlarr:
- Lista indexer configurati con stato (attivo/errore)
- Aggiunta/modifica/rimozione indexer
- Test di connettività per singolo indexer
- Sync status verso Sonarr/Radarr

### Sistema (`/system`)

Configurazione e salute:
- **Stato servizi:** ping + versione di Radarr, Sonarr, Prowlarr, qBittorrent
- **Configurazione FeedMyPotato:** URL e API key per ogni servizio (estensione della pagina Settings attuale ai 4 servizi)
- **Test connettività:** verifica raggiungibilità di ogni servizio
- **Info disco:** spazio disponibile nelle root folder

## Configurazione

```json
{
  "radarr": { "url": "http://radarr:7878", "apiKey": "..." },
  "sonarr": { "url": "http://sonarr:8989", "apiKey": "..." },
  "prowlarr": { "url": "http://prowlarr:9696", "apiKey": "..." },
  "qbittorrent": { "url": "http://qbittorrent:8080", "username": "admin", "password": "..." }
}
```

Il campo `plexFolder` viene rimosso — Sonarr/Radarr gestiscono le root folder autonomamente.

## API Routes

Ogni route è un proxy sottile che:
1. Legge la config per ottenere URL + credenziali del servizio target
2. Inoltra la richiesta, normalizza la risposta
3. Restituisce errori strutturati (`{ error, service, status }`)

### Radarr (`/api/radarr/*`)

| Route | Metodi | Scopo |
|---|---|---|
| `/api/radarr/movie` | GET, POST, DELETE | CRUD film |
| `/api/radarr/movie/[id]` | GET, PUT, DELETE | Dettaglio/modifica/elimina film |
| `/api/radarr/lookup` | GET `?term=` | Ricerca film per titolo |
| `/api/radarr/command` | POST | Comandi (ricerca, scan disco) |
| `/api/radarr/queue` | GET | Coda download/importazione |
| `/api/radarr/history` | GET | Cronologia attività |
| `/api/radarr/calendar` | GET `?start=&end=` | Uscite programmate |
| `/api/radarr/qualityprofile` | GET | Profili qualità disponibili |
| `/api/radarr/rootfolder` | GET | Root folder configurate |
| `/api/radarr/diskspace` | GET | Spazio disco |
| `/api/radarr/health` | GET | Stato di salute |

### Sonarr (`/api/sonarr/*`)

| Route | Metodi | Scopo |
|---|---|---|
| `/api/sonarr/series` | GET, POST, DELETE | CRUD serie |
| `/api/sonarr/series/[id]` | GET, PUT, DELETE | Dettaglio/modifica/elimina serie |
| `/api/sonarr/episode` | GET `?seriesId=` | Episodi di una serie |
| `/api/sonarr/lookup` | GET `?term=` | Ricerca serie per titolo |
| `/api/sonarr/command` | POST | Comandi (ricerca, scan) |
| `/api/sonarr/queue` | GET | Coda download/importazione |
| `/api/sonarr/history` | GET | Cronologia attività |
| `/api/sonarr/calendar` | GET `?start=&end=` | Uscite episodi |
| `/api/sonarr/qualityprofile` | GET | Profili qualità |
| `/api/sonarr/rootfolder` | GET | Root folder |
| `/api/sonarr/health` | GET | Stato di salute |

### Prowlarr (`/api/prowlarr/*`)

| Route | Metodi | Scopo |
|---|---|---|
| `/api/prowlarr/indexer` | GET, POST, PUT, DELETE | CRUD indexer |
| `/api/prowlarr/indexer/[id]/test` | POST | Test singolo indexer |
| `/api/prowlarr/indexerstatus` | GET | Stato indexer |
| `/api/prowlarr/applicationsync` | POST | Sync verso Sonarr/Radarr |
| `/api/prowlarr/health` | GET | Stato di salute |

### qBittorrent (`/api/qbit/*`)

| Route | Metodi | Scopo |
|---|---|---|
| `/api/qbit/torrents` | GET | Lista download attivi |
| `/api/qbit/torrents` | PATCH | Pausa/resume |
| `/api/qbit/torrents/[hash]` | DELETE | Elimina torrent |

### Sistema

| Route | Metodi | Scopo |
|---|---|---|
| `/api/stream` | GET (SSE) | Stato real-time download |
| `/api/config` | GET, PUT | Lettura/scrittura config |
| `/api/system/health` | GET | Health check aggregato tutti i servizi |
| `/api/test/[service]` | GET | Test connettività singolo servizio |

## Data Flow

### Ricerca e aggiunta film

```
Utente cerca "Inception"
  → Frontend GET /api/radarr/lookup?term=Inception
    → API route GET radarr:7878/api/v3/movie/lookup?term=Inception
      → Risposta con metadati TMDB (poster, anno, overview, tmdbId)
  → Utente clicca "Aggiungi"
  → Frontend POST /api/radarr/movie { tmdbId, qualityProfileId, rootFolderPath, monitored: true, searchForMovie: true }
    → Radarr aggiunge il film, notifica Prowlarr, cerca sui tracker, invia a qBittorrent
  → SSE /api/stream riporta il progresso del download
  → Radarr importa automaticamente al completamento
```

### Ricerca e aggiunta serie

```
Utente cerca "Breaking Bad"
  → Frontend GET /api/sonarr/lookup?term=Breaking+Bad
    → Sonarr risponde con metadati TVDB
  → Utente clicca "Aggiungi", sceglie stagioni da monitorare
  → Frontend POST /api/sonarr/series { tvdbId, qualityProfileId, rootFolderPath, seasons, monitored: true }
    → Sonarr aggiunge, cerca episodi mancanti, scarica via qBittorrent
  → Import automatico al completamento
```

### Health check aggregato

```
Frontend GET /api/system/health
  → API route chiama in parallelo:
    - radarr/api/v3/health + system/status
    - sonarr/api/v3/health + system/status
    - prowlarr/api/v1/health + system/status
    - qbittorrent/api/v2/app/version
  → Risposta unificata con stato per servizio
```

## Gestione Errori

### Errori di connessione (servizio non raggiungibile)

- Risposta `503 { error: "Servizio non raggiungibile", service: "<nome>", detail: "ECONNREFUSED" }`
- Frontend mostra banner per servizio offline, le altre sezioni restano funzionanti
- Dashboard mostra il servizio in rosso nel pannello salute

### Errori di configurazione (URL o API key mancante)

- Risposta `502 { error: "Configurazione mancante", service: "<nome>" }`
- Redirect alla pagina Sistema con evidenziazione del servizio da configurare

### Errori upstream (servizio ARR risponde con errore)

- Risposta con lo stesso status code del servizio + body normalizzato
- Esempio: Radarr 400 "Movie already exists" → `400 { error: "Film già in libreria", service: "radarr" }`

### Timeout

- 15s per chiamate API normali, 30s per operazioni di ricerca
- Risposta `504 { error: "Timeout", service: "<nome>" }`

### Primo avvio

- Se `config.json` non esiste o è vuoto, redirect a `/system` con wizard di setup
- Il wizard testa ogni servizio prima di salvare la configurazione

## Docker Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config.json:/app/config.json
    depends_on:
      - radarr
      - sonarr
      - prowlarr
      - qbittorrent
    restart: unless-stopped

  radarr:
    image: lscr.io/linuxserver/radarr:latest
    ports:
      - "7878:7878"
    volumes:
      - ./radarr-config:/config
      - /mnt/e/PlexMedia:/media/plex
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
    restart: unless-stopped

  sonarr:
    image: lscr.io/linuxserver/sonarr:latest
    ports:
      - "8989:8989"
    volumes:
      - ./sonarr-config:/config
      - /mnt/e/PlexMedia:/media/plex
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
    restart: unless-stopped

  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    ports:
      - "9696:9696"
    volumes:
      - ./prowlarr-config:/config
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
    restart: unless-stopped

  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    ports:
      - "8080:8080"
      - "16881:16881"
      - "16881:16881/udp"
    volumes:
      - ./qbittorrent-config:/config
      - /mnt/e/PlexMedia:/media/plex
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome
      - WEBUI_PORT=8080
    restart: unless-stopped

  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    ports:
      - "8191:8191"
    environment:
      - TZ=Europe/Rome
    restart: unless-stopped
```

### Cambiamenti rispetto all'attuale

- **Rimosso:** Jackett
- **Aggiunti:** Radarr, Sonarr, Prowlarr
- **Mantenuti:** qBittorrent, FlareSolverr (utile per Prowlarr)
- **Volume condiviso:** `/mnt/e/PlexMedia:/media/plex` montato su Radarr, Sonarr e qBittorrent
- **Config separata:** ogni servizio ha la sua cartella config persistente

## Testing

Strategia Jest + React Testing Library, adattata al nuovo stack:
- **Unit test per ogni client** (`lib/radarr.ts`, `lib/sonarr.ts`, `lib/prowlarr.ts`, `lib/qbittorrent.ts`) — mock delle chiamate HTTP
- **Unit test per le API routes** — verifica proxy, normalizzazione errori, gestione timeout
- **Component test** — rendering dei componenti con dati mock dei servizi ARR
- Test esistenti per Jackett, cleanup e torrent-monitor vengono rimossi
