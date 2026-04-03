# FeedMyPotato

Web app per cercare, scaricare e gestire contenuti multimediali direttamente nella tua libreria Plex — tutto da un'unica interfaccia.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

---

## Come funziona

```
Browser → FeedMyPotato (Next.js) → Jackett → Torrent indexers
                                → qBittorrent → /media/plex ← Plex
```

1. Cerchi un film o serie su FeedMyPotato
2. Jackett interroga tutti gli indexer configurati e restituisce i risultati ordinati per seed
3. Scegli il torrent e lo invii direttamente a qBittorrent
4. Il download viene salvato nella cartella Plex — Plex lo rileva automaticamente

---

## Stack

| Componente | Ruolo |
|---|---|
| **Next.js 15** | Frontend + API routes (App Router) |
| **Jackett** | Aggregatore di torrent indexer |
| **qBittorrent** | Client torrent con WebUI/API |
| **FlareSolverr** | Bypass Cloudflare per indexer protetti |

---

## Avvio rapido

### Prerequisiti

- Docker e Docker Compose
- Una libreria Plex esistente su disco

### 1. Clona il repo

```bash
git clone https://github.com/gallofrancesco1312/feed-my-potato.git
cd feed-my-potato
```

### 2. Crea il file di configurazione

Crea `config.json` nella root del progetto:

```json
{
  "plexFolder": "/media/plex",
  "jackett": {
    "url": "http://jackett:9117",
    "apiKey": ""
  },
  "qbittorrent": {
    "url": "http://qbittorrent:8080",
    "username": "admin",
    "password": ""
  }
}
```

> La `apiKey` di Jackett e la password di qBittorrent si impostano dopo il primo avvio dalla pagina **Impostazioni**.

### 3. Adatta i volumi in `docker-compose.yml`

```yaml
volumes:
  - /percorso/tua/libreria/plex:/media/plex
```

### 4. Avvia i container

```bash
docker compose up -d
```

### 5. Configura Jackett

1. Apri [http://localhost:9117](http://localhost:9117)
2. Aggiungi gli indexer che vuoi usare
3. Copia la **API Key** dalla dashboard
4. Incollala in FeedMyPotato → **Impostazioni**

### 6. Configura qBittorrent

1. Apri [http://localhost:8080](http://localhost:8080) (credenziali default: `admin` / password generata al primo avvio — vedi log del container)
2. Cambia la password nelle impostazioni di qBittorrent
3. Inserisci le credenziali in FeedMyPotato → **Impostazioni**
4. Imposta la cartella di download su `/media/plex`

### 7. Apri FeedMyPotato

[http://localhost:3000](http://localhost:3000)

---

## Pagine

| Pagina | Percorso | Descrizione |
|---|---|---|
| **Cerca** | `/search` | Ricerca torrent via Jackett, risultati ordinati per seed |
| **Download** | `/downloads` | Monitoraggio download attivi in tempo reale (SSE) |
| **Libreria** | `/library` | File nella cartella Plex con possibilità di eliminazione |
| **Impostazioni** | `/settings` | Configurazione URL, credenziali e test connessione |

---

## API Routes

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/search?q=...` | Cerca torrent su Jackett |
| `GET` | `/api/torrents` | Lista torrent attivi in qBittorrent |
| `POST` | `/api/torrents` | Aggiunge un torrent (magnet o URL) |
| `PATCH` | `/api/torrents` | Pausa / riprende un torrent |
| `DELETE` | `/api/torrents` | Rimuove un torrent |
| `GET` | `/api/stream` | Stream SSE progresso download |
| `GET` | `/api/library` | Lista file nella libreria Plex |
| `DELETE` | `/api/library` | Elimina un file dalla libreria |
| `GET` | `/api/config` | Legge la configurazione |
| `PUT` | `/api/config` | Salva la configurazione |
| `GET` | `/api/test/jackett` | Testa la connessione a Jackett |
| `GET` | `/api/test/qbittorrent` | Testa la connessione a qBittorrent |

---

## Sviluppo locale

```bash
npm install
npm run dev
```

App disponibile su [http://localhost:3000](http://localhost:3000).

Per i test:

```bash
npm test
```

---

## Struttura del progetto

```
feed-my-potato/
├── app/
│   ├── api/          # Route handler Next.js
│   ├── search/       # Pagina ricerca
│   ├── downloads/    # Pagina download
│   ├── library/      # Pagina libreria
│   └── settings/     # Pagina impostazioni
├── components/       # Componenti React (Sidebar, tabelle, ecc.)
├── lib/              # Logica server (Jackett, qBittorrent, config, libreria)
├── Dockerfile
└── docker-compose.yml
```

---

## Porte esposte

| Servizio | Porta |
|---|---|
| FeedMyPotato | `3000` |
| qBittorrent WebUI | `8080` |
| Jackett | `9117` |
| FlareSolverr | `8191` |
| qBittorrent (torrent) | `16881` |
