# Bibel-canvas

Et rolig lerret for å strukturere bibeltekst visuelt — uten fast metode. Ord blir brikker du kan flytte, gruppere og binde sammen.

## Kom i gang

```bash
npm install
npm run dev
```

Appen kjører på `http://localhost:5173/bibel-canvas/`.

```bash
npm test
npm run build
```

## GitHub Pages

Workflowen `.github/workflows/pages.yml` bygger og publiserer til [https://thomtarzan.github.io/bibel-canvas/](https://thomtarzan.github.io/bibel-canvas/).

I innstillingene for depotet må Pages-kilden stå på **GitHub Actions**.

Vite bruker base `/bibel-canvas/`, så stil og skript lastes under den stien.

## Prosjektfil

Lagre og åpne er lokal JSON. Filnavnet kommer fra referanse og dato, for eksempel `Rom-8-1-4_2026-10-08.json`. PNG og SVG bruker samme navn. Arbeidet lagres også automatisk i nettleserens localStorage.

Filer fra runde 1 (`version: 1`) åpnes fortsatt. De blir til versjon 2 i minnet, med de gamle pilene festet til de samme brikkene.

## Relasjoner, symboler og rammer

Åtte relasjoner tegnes som store omrisspiler: årsak, hensikt, resultat, betingelse, innsømmelse, tid, sammenligning og middel. Tast 1–8 velger relasjon. Middel betyr middel eller ledsagende omstendighet. Fri tekst finnes i tillegg.

Pilen kan dras fritt på lerretet. Slippes enden nær et ord, en frase eller en gruppe, fester den seg og følger med. Ellers blir den liggende. Endene kan flyttes etterpå, og relasjonen kan byttes uten å tegne på nytt.

Symboler: apposisjon (=), motsetning (≠), tillegg (+), konklusjon (∴), innskutt (stiplet ramme rundt utvalget) og hovedpåstand (tykk markering). Rolleikon kan skjules samlet.

Rammer har sterk farge, tykkelse og heltrukken eller stiplet strek. Navnene, for eksempel subjekt, verb og gjentakelse, er bare forslag. De kan endres og slettes, og ligger i prosjektfilen.

## Avgrensning

Kun latinsk skrift (norsk og engelsk). Gresk og hebraisk er ikke støttet. Overskrifter fra nettbibler fjernes ikke automatisk. Eldre piler som var buet eller stiplet, tegnes som de nye omrisspilene. Stilen blir liggende i filen.
