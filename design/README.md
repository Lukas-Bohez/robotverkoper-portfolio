# Het ontwerp van het verkopersplatform (Figma)

Het ontwerp is **eerst in Figma gemaakt, daarna pas in code**, zoals de klant vroeg in [#129](https://github.com/afsd-mct/26-ratty-raccoon/issues/129) (*"Werken met Figma, niet meteen in code"*). Het bestand staat in de repo: [`Advanced Fullstack Development.fig`](<../Advanced Fullstack Development.fig>) (open het in Figma met *File → Open file*, of sleep het erin). De afbeeldingen hieronder zijn exports van dat bestand, zodat je het ook op GitHub kunt bekijken.

**Van wie:** dit ontwerp is van **Lukas** en gaat enkel over zijn deel, het verkopersplatform. Er staan geen schermen van Maciej in en er wordt niets over beweerd ([wie wat doet, bovenaan de README](https://github.com/afsd-mct/26-ratty-raccoon/blob/develop/README.md#wie-doet-wat)).

Het bestand heeft drie pagina's: **Inspiratie** (waar het ontwerp op leunt), **Components** (de bouwstenen met varianten) en **Design** (het designsysteem, de flows en alle schermen).

**Twee gebruikers, twee schermen.** Sinds de feedback van de klant van 16/10/2026 ([#137](https://github.com/afsd-mct/26-ratty-raccoon/issues/137), [`../../docs/klantfeedback-137.md`](https://github.com/afsd-mct/26-ratty-raccoon/blob/develop/docs/klantfeedback-137.md)) is het ontwerp opgesplitst naar wie het gebruikt:

| Wie | Waar | Schermen |
| --- | --- | --- |
| **De beheerder** (superadmin) | Vooral op een **computer** (1440 px). Op een telefoon kan hij kijken, maar rechten aanpassen doet hij op een computer | 01 tot 16 |
| **De technicus** | Op een **telefoon** (390 px), onderweg en bij de robot. Eigen dashboard en een eigen flow | 17 tot 23 |

## De flows

![De flow: een robot aan een bedrijf geven](flow.png)

![De flow van de technicus](flow-technicus.png)

![De flow van de beheerder](flow-beheerder.png)

Elk scherm bestaat voor **desktop (1440 px)** of voor **telefoon (390 px)**, naargelang wie het gebruikt. De oude schermen (01 tot 10) bestaan voor allebei. De schermen "Bedrijven" en "Robots" bestaan ook in **donkere modus**. De **taalkiezer** (EN, NL, FR, DE) staat in de header, behalve op het inlogscherm: wie niet ingelogd is, ziet geen menu.

## Schermen

| Nr | Scherm | Wat | Gemaakt in code |
| --- | --- | --- | --- |
| 01 | Inloggen | E-mail en wachtwoord, geen Google-login. **Zonder menu, taalkiezer, e-mailbadge en "Uitloggen"**: wie nog niet is ingelogd, mag die niet zien | `seller-pwa/src/views/LoginView.vue` |
| 02 | Bedrijven | Lijst met robots en defecten per bedrijf, zonder personeel of klantgegevens. Per bedrijf **Robots openen**, **Rollen openen** en **Archiveren** (geen verwijderen: soft delete), en een schakelaar voor gearchiveerde bedrijven | `CompaniesView.vue` |
| 03 | Nieuw bedrijf | Naam, adres en e-mail van de eerste beheerder | `NewCompanyView.vue` |
| 04 | Robots van een bedrijf | Per robot een status en **logische knoppen**: Details, en wat nu past (Defect melden, of Technieker oproepen). Robot toekennen (één geïsoleerde etenrobot) | `CompanyRobotsView.vue` |
| 05 | API-sleutel | Eén keer getoond, en vanzelf naar de robot-app gestuurd | `components/ApiKeyDialog.vue` |
| 06 | Rollen en rechten van een bedrijf | **Een tabel**: rechten tegenover rollen (Kok, Lader, Ober), met Bekijken als rol, Kopiëren en Preset toepassen | `CompanyRolesView.vue` |
| 07 | Robotdefecten | Alle defecten met status, lading en filters per jaar; een robot vervangen | `DefectsView.vue` |
| 08 | Bekijken als rol | Zien wat een rol ziet, zonder iets te kunnen wijzigen | `RolePreviewView.vue` |
| 09 | Team | Eigen medewerkers met hun rol; **Archiveren** in plaats van verwijderen; Rollen aanpassen; logboek per jaar | `TeamView.vue` |
| 10 | Defect melden | Een defect van een robot melden | `components/ReportDefectDialog.vue` |
| 11 | Robot | Alles over één robot: toestand (gekanteld, batterij, klep, temperatuur, verbinding, foutcode), lading, geschiedenis, **acties** (Technieker oproepen, Vervangen met QR, Defect sluiten, QR-code tonen, Uit dienst nemen) | `RobotView.vue` |
| 12 | Defect (beheerder) | Wat is er mis, **alle info voor de technieker**, wie komt er, locatie, verloop en **andere defecten in de buurt** | `DefectDetailView.vue` |
| 13 | Rollen en rechten van het team | **Tabel van rechten per rol**, met extra rechten (claims), de talen van elke rol en niet-opgeslagen wijzigingen | `TeamRolesView.vue` |
| 14 | Rol bewerken | Naam **per taal** (NL, EN, FR, DE) en extra rechten | `components/RoleEditDrawer.vue` |
| 15 | Rollenpresets | Een rol opslaan en **kopiëren naar een ander bedrijf** | `RolePresetsView.vue` |
| 16 | Archief en geschiedenis | Gearchiveerde accounts, rollen, robots en bedrijven **herstellen**; filters per jaar en **koude opslag** voor oud werk | `ArchiveView.vue` |
| 17 | Technicus-dashboard | Mijn taken, dichtbij en alle open defecten, met tellers; eten aan boord staat bovenaan | `views/TechnicianDashboardView.vue` |
| 18 | Defect (technicus) | Hetzelfde als 12, voor een telefoon, met vaste knoppen onderaan | `DefectDetailView.vue` |
| 19 | Ter plaatse | Veiligheidscontrole (eten eruit, robot stabiel, klep, batterij) en **andere defecten in de buurt oppakken** | `OnSiteView.vue` |
| 20 | Vervangen: oude robot scannen | **QR-code** op de kapotte robot, zodat de technicus bij de juiste robot staat | `ReplaceRobotView.vue` |
| 21 | Vervangen: nieuwe robot scannen | **QR-code** op de nieuwe robot (serienummer en model) | `ReplaceRobotView.vue` |
| 22 | Vervangen: wissel bevestigen | Nieuwe robot neemt naam, bedrijf en een nieuwe sleutel over | `ReplaceRobotView.vue` |
| 23 | Wissel gelukt | Sleutel gestuurd, defect afgesloten | `ReplaceRobotView.vue` |

### De popups

Elke popup is een vrij frame met een gedimde pagina erachter, zoals 05 en 10. Op een telefoon zijn het sheets die van onderen komen.

| Nr | Popup | Wanneer |
| --- | --- | --- |
| P1 | Technieker oproepen | Vanuit 04, 07, 11 en 12. Eén knop: **het kanaal maakt niet uit** (de technieker krijgt een melding met alle info) |
| P2 | Account archiveren | Vanuit 09. Ook voor een rol, robot of bedrijf. Het is **soft delete**: bewaard, niet verwijderd |
| P3 | Herstellen uit het archief | Vanuit 16 |
| P4 | Defect sluiten | Hoe is het opgelost en wat deed de technicus |
| P5 | Rol kopiëren naar een bedrijf | Vanuit 06 en 15 |
| P6 | QR-code van een robot | Vanuit 11, om op de robot te plakken |
| P7 | Meer acties (telefoon) | Vanuit 18: vervangen, sluiten, hulp vragen, route openen |
| P8 | Hulp vragen (telefoon) | Een collega of de beheerder krijgt een melding |
| P9 | Taal kiezen (telefoon) | EN, NL, FR en DE |
| P10 | Rol kiezen (dropdown geopend) | Laat zien wat er gebeurt als je in 09 op het veld Rol klikt |

### Desktop

| | |
| --- | --- |
| ![01 Inloggen](01-inloggen-desktop.png) | ![02 Bedrijven](02-bedrijven-desktop.png) |
| ![03 Nieuw bedrijf](03-nieuw-bedrijf-desktop.png) | ![04 Robots van een bedrijf](04-robots-desktop.png) |
| ![05 API-sleutel](05-api-sleutel-desktop.png) | ![06 Rollen en rechten van een bedrijf](06-accounts-en-rollen-desktop.png) |
| ![07 Robotdefecten](07-robotdefecten-desktop.png) | ![08 Bekijken als rol](08-bekijken-als-rol-desktop.png) |
| ![09 Team](09-team-desktop.png) | ![10 Defect melden](10-defect-melden-desktop.png) |
| ![11 Robot](11-robot-desktop.png) | ![12 Defect](12-defect-desktop.png) |
| ![13 Rollen en rechten van het team](13-rollen-en-rechten-team-desktop.png) | ![14 Rol bewerken](14-rol-bewerken-desktop.png) |
| ![15 Rollenpresets](15-rollenpresets-desktop.png) | ![16 Archief en geschiedenis](16-archief-desktop.png) |

### Telefoon

<p>
<img src="01-inloggen-telefoon.png" width="190" alt="01 Inloggen">
<img src="02-bedrijven-telefoon.png" width="190" alt="02 Bedrijven">
<img src="03-nieuw-bedrijf-telefoon.png" width="190" alt="03 Nieuw bedrijf">
<img src="04-robots-telefoon.png" width="190" alt="04 Robots van een bedrijf">
<img src="05-api-sleutel-telefoon.png" width="190" alt="05 API-sleutel">
</p>
<p>
<img src="06-accounts-en-rollen-telefoon.png" width="190" alt="06 Rollen">
<img src="07-robotdefecten-telefoon.png" width="190" alt="07 Robotdefecten">
<img src="08-bekijken-als-rol-telefoon.png" width="190" alt="08 Bekijken als rol">
<img src="09-team-telefoon.png" width="190" alt="09 Team">
<img src="10-defect-melden-telefoon.png" width="190" alt="10 Defect melden">
</p>

### De technicus op zijn telefoon

<p>
<img src="17-technicus-dashboard-telefoon.png" width="190" alt="17 Technicus-dashboard">
<img src="18-defect-telefoon.png" width="190" alt="18 Defect">
<img src="19-ter-plaatse-telefoon.png" width="190" alt="19 Ter plaatse">
<img src="20-vervangen-oude-robot-telefoon.png" width="190" alt="20 Oude robot scannen">
</p>
<p>
<img src="21-vervangen-nieuwe-robot-telefoon.png" width="190" alt="21 Nieuwe robot scannen">
<img src="22-vervangen-bevestigen-telefoon.png" width="190" alt="22 Wissel bevestigen">
<img src="23-wissel-gelukt-telefoon.png" width="190" alt="23 Wissel gelukt">
</p>

### Popups

| | | |
| --- | --- | --- |
| ![P1 Technieker oproepen](popup-1-technieker-oproepen.png) | ![P2 Account archiveren](popup-2-account-archiveren.png) | ![P3 Herstellen](popup-3-herstellen.png) |
| ![P4 Defect sluiten](popup-4-defect-sluiten.png) | ![P5 Rol kopiëren](popup-5-rol-kopieren.png) | ![P6 QR-code](popup-6-qr-code.png) |
| ![P10 Rol kiezen](popup-10-rol-kiezen.png) | | |

<p>
<img src="popup-7-meer-acties-telefoon.png" width="190" alt="P7 Meer acties">
<img src="popup-8-hulp-vragen-telefoon.png" width="190" alt="P8 Hulp vragen">
<img src="popup-9-taal-kiezen-telefoon.png" width="190" alt="P9 Taal kiezen">
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
- **Tekststijlen.** Heading/Page 32, Heading/Section 24, Heading/Card 20, Body/Default 16 (en Body/Medium en Body/Strong), Body/Small 14, Label/Default 14, Caption 12 (en Caption/Medium). Elke tekst gebruikt een stijl.
- **Auto layout** overal, behalve in de schermen met een popup over een gedimde pagina (05, 10, 14 en P1 tot P10), die bewust vrije frames zijn.
- **Een keuze is een dropdown, nooit een tekstveld.** Waar iemand uit bekende waarden kiest (een rol, een bedrijf, het model, hoe erg, hoe opgelost, een extra recht), staat een **Select** met een pijltje. Een tekstveld (**Field**) blijft alleen waar iemand echt iets schrijft: een naam, een e-mailadres, een omschrijving. Reden (feedback leerkrachten, 16/10): een tekstveld als `area:actie` is voor een klant onbegrijpelijk. De extra rechten in 14 heten daarom *Facturen exporteren*, niet `exports:invoices`.
- **Iconen** zijn SVG's van één set (Lucide-vormen, 24 px, lijn van 2 px) in de kleur van de tekst ernaast. Een icoon staat nooit alleen: er staat altijd een woord bij.

## De componenten

Elk scherm gebruikt **instances** van deze componenten (meer dan 780 in totaal), niet losse nagemaakte vormen.

![Header](component-header.png)

| Component | Varianten | |
| --- | --- | --- |
| **Button** | `variant` primary, secondary, danger; `size` md, sm | ![Button](component-button.png) |
| **Badge** | `tone` success, danger, warning, primary, neutral | ![Badge](component-badge.png) |
| **Field** | `state` default, error; `hint` yes, no | ![Field](component-field.png) |
| **Alert** | `tone` primary, success, warning, danger | ![Alert](component-alert.png) |
| **Header** | `device` desktop of mobile, `active` het menu-item. Met een **taalkiezer EN, NL, FR, DE** (NL is de taal van het ontwerp). Op de telefoon staat er een knop "NL" naast "Menu" | zie hierboven |
| **RoleRow** | `locked` yes, no | ![RoleRow](component-rolerow.png) |
| **CompanyCard** | `defect` none, some. Met twee knoppen: Robots openen en Rollen openen | ![CompanyCard](component-companycard.png) |
| **Chip** | `state` default, active: een filter (status, jaar) | ![Chip](component-chip.png) |
| **Toggle** | `state` off, on: een schakelaar met een tekst (gearchiveerd tonen) | ![Toggle](component-toggle.png) |
| **Checkbox** | `state` unchecked, checked, locked: een cel van de tabel met rechten | ![Checkbox](component-checkbox.png) |
| **StatTile** | `tone` neutral, danger, warning, success: een getal met een label | ![StatTile](component-stattile.png) |
| **InfoTile** | `tone` ok, warning, danger; `icon` (gekanteld, batterij, klep, temperatuur, verbinding, foutcode, wiel) | ![InfoTile](component-infotile.png) |
| **TaskCard** | `state` open, enroute, onsite; `cargo` yes, no: een defect in het dashboard van de technicus | ![TaskCard](component-taskcard.png) |
| **BottomNav** | `active` taken, defecten, scan, meer: het menu van de technicus op een telefoon | ![BottomNav](component-bottomnav.png) |
| **Stepper** | `step` 1, 2, 3: de stappen van het vervangen met QR | ![Stepper](component-stepper.png) |
| **Select** | `state` closed, open; `hint` yes, no: een dropdown (rol, bedrijf, model, ernst). Open toont de lijst met het gekozen item aangevinkt | ![Select](component-select.png) |
| **Dialog** | `device` desktop of phone; `tone` default of danger: een bevestiging als popup of sheet | ![Dialog](component-dialog.png) |

## Inspiratie

Het ontwerp leunt op de feedback van de klant, op vlootbeheer-dashboards en op de bezorgrobots van Uber Eats. Per wens van de klant staat in [`../../docs/klantfeedback-129.md`](https://github.com/afsd-mct/26-ratty-raccoon/blob/develop/docs/klantfeedback-129.md) en [`../../docs/klantfeedback-137.md`](https://github.com/afsd-mct/26-ratty-raccoon/blob/develop/docs/klantfeedback-137.md) wat er gedaan is.

| | |
| --- | --- |
| ![Wat de klant vraagt](inspiratie-klant.png) | ![Uit vlootbeheer-dashboards](inspiratie-vlootbeheer.png) |
| ![Uit de bezorgrobots](inspiratie-ubereats.png) | ![Mood](inspiratie-mood.png) |

![60-30-10](inspiratie-60-30-10.png)

![Het 8px-grid](inspiratie-8px-grid.png)
