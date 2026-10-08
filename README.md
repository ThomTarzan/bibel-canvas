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

Lagre og åpne er lokal JSON. Filnavnet kommer fra referanse og dato, for eksempel `Rom-8-1-4_2026-10-08.json`. Arbeidet lagres også automatisk i nettleserens localStorage.

Filen har felter klare for runde 2, uten brukergrensesnitt for dem ennå:

- logikkrolle på brikke (`role`, `roleHidden`): hovedpåstand, grunn, følge, formål, motsetning, forklaring, sitat, spørsmål
- kommentarer (`comments`, med `minimized`)
- skrift globalt og per brikke (`typography`, `fontFamily`, `fontSize`, `fontWeight`) — familiene `elegant` og `neutral`
- eksportvalg (`exportPrefs.hideComments`, `exportPrefs.hideGuides`)

## Avgrensning

Kun latinsk skrift (norsk og engelsk). Gresk og hebraisk er ikke støttet. Overskrifter fra nettbibler fjernes ikke automatisk.
