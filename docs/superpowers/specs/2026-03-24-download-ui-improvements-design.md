# Design: Miglioramenti UI Sezione Download

**Data:** 2026-03-24
**Stato:** Approvato

---

## Obiettivo

Migliorare la leggibilità e l'utilità della sezione download con tre interventi:

1. Etichette di stato più descrittive
2. Grafico sparkline SVG della velocità di download per ogni torrent
3. Visualizzazione completa dei titoli dei torrent (senza troncamento)

---

## 1. Etichette di stato

**File:** `components/TorrentRow.tsx`

Aggiornamento della mappa `STATE_LABELS` per coprire più stati qBittorrent con label in italiano chiare:

| Chiave stato | Label |
|---|---|
| `downloading` | In download |
| `uploading` | In seeding *(cambio intenzionale: era "Completo", ora riflette che il torrent sta attivamente seedando)* |
| `stalledDL` | In attesa |
| `stalledUP` | In seeding |
| `pausedDL` | In pausa |
| `pausedUP` | In pausa |
| `error` | Errore |
| `checkingDL` | Verifica |
| `queuedDL` | In coda |
| `queuedUP` | In coda |
| `metaDL` | Metadati |
| `forcedDL` | In download |
| `forcedUP` | In seeding |

Gli stati non mappati continuano a mostrare il valore grezzo (`torrent.state`).

---

## 2. Sparkline SVG velocità di download

### Struttura dati

Il componente `downloads/page.tsx` mantiene un `Map<hash, number[]>` (ref, non state) per accumulare la storia delle velocità. Ad ogni messaggio SSE, per ogni torrent viene fatto `push` del `dlspeed` corrente, mantenendo al massimo **30 campioni** (sliding window).

### Componente `SpeedSparkline`

Nuovo componente inline in `TorrentRow.tsx` (o come funzione separata nello stesso file):

- **Dimensioni:** `80×24px`
- **Nessun asse, nessuna label**
- Disegna una `polyline` SVG normalizzata sui valori presenti nell'array
- Colore linea: `purple` quando il torrent è attivo, `gray` quando è in pausa/errore/attesa
- Area sotto la curva: `polyline` chiusa con fill semitrasparente (stesso colore, opacity ~20%)
- Se la storia ha meno di 2 punti, mostra una linea piatta a zero
- Riceve `speeds: number[]` come prop

### SVG — elemento fill area

L'area sotto la curva viene disegnata con un `<polygon>` (non `<polyline>`, che non supporta fill in modo affidabile): si appendono due punti di chiusura `(width, height)` e `(0, height)` all'array di punti normalizzati.

### Normalizzazione

- Se `max === min` (tutti i valori uguali, incluso il caso tutti-zero), la linea è piatta al fondo del viewport: tutti i punti hanno coordinata Y = `height` (24px).
- Se la storia ha meno di 2 punti, si usa la stessa logica della riga piatta.

### Colori

- Torrent attivo (`downloading`, `uploading`, `stalledUP`, `forcedDL`, `forcedUP`): colore `#a855f7` (Tailwind `purple-500`, coerente con l'accento viola dell'app)
- Tutti gli altri stati (pausa, errore, attesa, verifica, coda): colore `#6b7280` (Tailwind `gray-500`)
- Fill sotto la curva: stesso colore con `fillOpacity="0.2"`

### Props di TorrentRow

Aggiunta prop `speedHistory: number[]` a `TorrentRow` (accanto alle prop esistenti).

### Integrazione in downloads/page.tsx

```
speedHistoryRef: useRef<Map<string, number[]>>(new Map())

// Ad ogni update SSE:
torrents.forEach(t => {
  const history = speedHistoryRef.current.get(t.hash) ?? []
  history.push(t.dlspeed)
  if (history.length > 30) history.shift()
  speedHistoryRef.current.set(t.hash, history)
})
// Triggera re-render via setState normale dei torrents

// Alla cancellazione di un torrent:
speedHistoryRef.current.delete(hash)
```

Le entry stale (torrent rimossi senza chiamare delete esplicitamente, es. rimossi esternamente) rimangono in memoria per la durata della sessione: accettabile per un uso normale.

---

### Aggiornamento isPaused

Il check `isPaused` in `TorrentRow.tsx` deve essere aggiornato da:
```ts
const isPaused = torrent.state === 'pausedDL'
```
a:
```ts
const isPaused = torrent.state === 'pausedDL' || torrent.state === 'pausedUP'
```
Questo assicura che il pulsante mostri "Riprendi" anche per torrent completati ma in pausa.

---

## 3. Titoli completi

**File:** `components/TorrentRow.tsx`

Rimozione delle classi `truncate` e `max-w-xs` dal `<p>` che mostra `torrent.name`.
Aggiunta di `break-words` (o `overflow-wrap-break-word` in Tailwind v4) per gestire titoli molto lunghi senza rompere il layout.

---

## File coinvolti

| File | Modifica |
|---|---|
| `components/TorrentRow.tsx` | Etichette, sparkline component, titolo |
| `app/downloads/page.tsx` | Accumulo storia velocità, passaggio prop a TorrentRow |

---

## Non incluso nel scope

- Upload speed nel grafico
- Tooltip/hover sul grafico
- Persistenza della storia velocità oltre la sessione browser
