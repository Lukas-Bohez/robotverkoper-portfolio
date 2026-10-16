# Het ontwerp van het verkopersplatform (Figma)

Het ontwerp is **eerst in Figma gemaakt, daarna pas in code**, zoals de klant vroeg in [#129](https://github.com/afsd-mct/26-ratty-raccoon/issues/129) (*"Werken met Figma, niet meteen in code"*). Het bestand staat in de repo: [`Advanced Fullstack Development.fig`](<../Advanced Fullstack Development.fig>) (open het in Figma met *File → Open file*, of sleep het erin). De afbeeldingen hieronder zijn exports van dat bestand, zodat je het ook op GitHub kunt bekijken.

Het bestand heeft drie pagina's: **Inspiratie** (waar het ontwerp op leunt), **Components** (de bouwstenen met varianten) en **Design** (het designsysteem, de flow en alle schermen).

## De flow

![De flow: een robot aan een bedrijf geven](flow.png)

Elk scherm bestaat voor **desktop (1440 px)** en voor **telefoon (390 px)**. De schermen "Bedrijven" en "Robots" bestaan ook in **donkere modus**.

## Schermen

| Nr | Scherm | Wat | Gemaakt in code |
| --- | --- | --- | --- |
| 01 | Inloggen | E-mail en wachtwoord, geen Google-login | `seller-pwa/src/views/LoginView.vue` |
| 02 | Bedrijven | Lijst met robots en defecten per bedrijf, zonder personeel of klantgegevens | `CompaniesView.vue` |
| 03 | Nieuw bedrijf | Naam, adres en e-mail van de eerste beheerder | `NewCompanyView.vue` |
| 04 | Robots van een bedrijf | Statusbadge en batterij per robot, robot toekennen (één geïsoleerde etenrobot) | `CompanyRobotsView.vue` |
| 05 | API-sleutel | Eén keer getoond, en vanzelf naar de robot-app gestuurd | `components/ApiKeyDialog.vue` |
| 06 | Accounts en rollen | Rollen van een bedrijf, zoals kok en lader | `CompanyRolesView.vue` |
| 07 | Robotdefecten | Defecten zien en een robot vervangen | `DefectsView.vue` |
| 08 | Bekijken als rol | Zien wat een rol ziet, zonder iets te kunnen wijzigen | `RolePreviewView.vue` |
| 09 | Team | Eigen medewerkers met rol Beheerder of Technicus, en het logboek | `TeamView.vue` |
| 10 | Defect melden | Een defect van een robot melden | `components/ReportDefectDialog.vue` |

### Desktop

| | |
| --- | --- |
| ![01 Inloggen](01-inloggen-desktop.png) | ![02 Bedrijven](02-bedrijven-desktop.png) |
| ![03 Nieuw bedrijf](03-nieuw-bedrijf-desktop.png) | ![04 Robots van een bedrijf](04-robots-desktop.png) |
| ![05 API-sleutel](05-api-sleutel-desktop.png) | ![06 Accounts en rollen](06-accounts-en-rollen-desktop.png) |
| ![07 Robotdefecten](07-robotdefecten-desktop.png) | ![08 Bekijken als rol](08-bekijken-als-rol-desktop.png) |
| ![09 Team](09-team-desktop.png) | ![10 Defect melden](10-defect-melden-desktop.png) |

### Telefoon

<p>
<img src="01-inloggen-telefoon.png" width="190" alt="01 Inloggen">
<img src="02-bedrijven-telefoon.png" width="190" alt="02 Bedrijven">
<img src="03-nieuw-bedrijf-telefoon.png" width="190" alt="03 Nieuw bedrijf">
<img src="04-robots-telefoon.png" width="190" alt="04 Robots van een bedrijf">
<img src="05-api-sleutel-telefoon.png" width="190" alt="05 API-sleutel">
</p>
<p>
<img src="06-accounts-en-rollen-telefoon.png" width="190" alt="06 Accounts en rollen">
<img src="07-robotdefecten-telefoon.png" width="190" alt="07 Robotdefecten">
<img src="08-bekijken-als-rol-telefoon.png" width="190" alt="08 Bekijken als rol">
<img src="09-team-telefoon.png" width="190" alt="09 Team">
<img src="10-defect-melden-telefoon.png" width="190" alt="10 Defect melden">
</p>

### Donkere modus

| Desktop | Desktop | Telefoon |
| --- | --- | --- |
| ![02 Bedrijven, donker](02-bedrijven-desktop-donker.png) | ![04 Robots, donker](04-robots-desktop-donker.png) | <img src="02-bedrijven-telefoon-donker.png" width="190" alt="02 Bedrijven, donker, telefoon"> |

De donkere schermen zijn dezelfde schermen met de modus **Dark** van de Semantic-variabelen. Er is niets opnieuw getekend.

## Het designsysteem

![Het designsysteem: variabelen, contrast en tekststijlen](designsysteem.png)

- **Variabelen in twee lagen.** *Base* (ruwe kleuren, bv. `base/indigo/600`) en *Semantic* (de rol in de interface, bv. `semantic/action/primary`, met een waarde voor **Light** en voor **Dark**). Daarnaast *Spacing* (`space/*`) en *Radius* (`radius/*`). Alle kleuren, paddings, gaps en hoeken in de schermen zijn aan variabelen gebonden: er staan geen losse kleurwaarden in de schermen.
- **8px-grid.** Alle paddings, gaps en maten zijn veelvouden van 8 (4 als halve stap).
- **60-30-10.** 60% rustige neutrale vlakken, 30% structuur (tekst, randen), 10% accent: de primaire actie valt altijd op.
- **Contrast (WCAG 2.1 AA).** Elke tekstkleur is gecontroleerd op zijn achtergrond, in Light en in Dark (de tabel staat in het designsysteem). Tekst op een zachte achtergrond heeft eigen tokens (`*-text`) die in de donkere modus lichter zijn.
- **Tekststijlen.** Heading/Page 32, Heading/Section 24, Heading/Card 20, Body/Default 16, Body/Small 14, Label/Default 14 en Caption 12. Elke tekst gebruikt een stijl.
- **Auto layout** overal, behalve in de vier schermen met een dialoog over een gedimde pagina (05 en 10), die bewust vrije frames zijn.

## De componenten

Elk scherm gebruikt **instances** van deze componenten (meer dan 190 in totaal), niet losse nagemaakte vormen.

![Header](component-header.png)

| Component | Varianten | |
| --- | --- | --- |
| **Button** | `variant` primary, secondary, danger; `size` md, sm | ![Button](component-button.png) |
| **Badge** | `tone` success, danger, warning, primary, neutral | ![Badge](component-badge.png) |
| **Field** | `state` default, error; `hint` yes, no | ![Field](component-field.png) |
| **Alert** | `tone` primary, success, warning, danger | ![Alert](component-alert.png) |
| **Header** | `device` desktop of mobile, `active` het menu-item | zie hierboven |
| **RoleRow** | `locked` yes, no | ![RoleRow](component-rolerow.png) |
| **CompanyCard** | `defect` none, some | ![CompanyCard](component-companycard.png) |

## Inspiratie

Het ontwerp leunt op de feedback van de klant, op vlootbeheer-dashboards en op de bezorgrobots van Uber Eats. Per wens van de klant staat in [`../../docs/klantfeedback-129.md`](../../docs/klantfeedback-129.md) wat er gedaan is.

| | |
| --- | --- |
| ![Wat de klant vraagt](inspiratie-klant.png) | ![Uit vlootbeheer-dashboards](inspiratie-vlootbeheer.png) |
| ![Uit de bezorgrobots](inspiratie-ubereats.png) | ![Mood](inspiratie-mood.png) |

![60-30-10](inspiratie-60-30-10.png)

![Het 8px-grid](inspiratie-8px-grid.png)
