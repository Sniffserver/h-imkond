# 🌲 HÕIMU: Kasutusjuhend (User Manual v0.2.0-beta.1)

> HÕIMU on autonoomne, kriisikindel ja kogukonnapõhine võrguühenduseta (off-grid) terminal, mis aitab hoida sidet ja jagada ressursse ka siis, kui internet ja mobiililevi kaovad.

---

## 🧭 Sisukord
1. [Sissejuhatus & Filosoofia](#1-sissejuhatus--filosoofia)
2. [5-Vahekaardiga Navigatsioon](#2-5-vahekaardiga-navigatsioon)
    - [Täna (Today)](#1-täna-today)
    - [Avasta (Explore / Map)](#2-avasta-explore--map)
    - [Ühendu (Connect / Mesh & Exchange)](#3-ühendu-connect--mesh--exchange)
    - [Ohutus (Safety / SOS)](#4-ohutus-safety--sos)
    - [Rohkem (More / Progress & Settings)](#5-rohkem-more--progress--settings)
3. [Välioperatsioonide Režiimid (Field Modes)](#3-välioperatsioonide-režiimid-field-modes)
    - [Kinnaste Režiim (Glove Mode)](#kinnaste-režiim-glove-mode)
    - [Otsese Päikese Režiim (Direct Sun Mode)](#otsese-päikese-režiim-direct-sun-mode)
    - [Käsupalett (Command Palette `Ctrl+K`)](#käsupalett-command-palette-ctrlk)
4. [Privaatne Edenemissüsteem (3-Track Progress)](#4-privaatne-edenemissüsteem-3-track-progress)
5. [Riistvaralised LED Märguanded & Pi Gateway](#5-riistvaralised-led-märguanded--pi-gateway)
6. [Korduma Kippuvad Küsimused (KKK)](#6-korduma-kippuvad-küsimused-kkk)

---

## 1. Sissejuhatus & Filosoofia

HÕIMU sündis solarpunk-visioonist: luua detsentraliseeritud tehnoloogiline ökosüsteem, mis ei sõltu suurkorporatsioonide pilveserveritest, kaabliühendustest ega tsentraalsest elektritootmisest. 

Rakendus salvestab andmed otse Sinu seadmesse (**LocalStorage & IndexedDB**) ning edastab sõnumeid otse ühelt seadmelt teisele, kasutades raadiolaineid (**LoRa 868MHz, BLE 5.0+, Wi-Fi Direct**).

---

## 2. 5-Vahekaardiga Navigatsioon

HÕIMU v0.2.0 kasutab lihtsustatud 5-vahekaardiga arhitektuuri:

### 1. Täna (Today)
*   **Päeva ülevaade:** Bioregionaalne ilmateade, päikeseenergia laadimisvõimsus (W) ja võrgu tervis.
*   **Aktiivsed soovid:** Kohesed vasted Sinu soovidele kohalikul ressursiturul (*Wishlist Matches*).
*   **Kiirtoimingud:** Ühe puutega teate saatmine, ressursi lisamine või kaardi avamine.

### 2. Avasta (Explore / Map)
*   **Offline Vektorkaart:** Kiire (<1.5s laadimine), mälusäästlik topograafiline kaart.
*   **Kogukonna ressursid:** Joogivee allikad, meditsiinipunktid, päikesejaamad ja tööriistade laenutus.
*   **ASCII Varukaart:** Kui seadmel puudub WebGL või graafikakiirendi tugi, lülitub kaart automaatselt tekstipõhisele ASCII režiimile.

### 3. Ühendu (Connect / Mesh & Exchange)
*   **Võrguvestlus (Mesh Chat):** Otsesõnumid ja avalik eetriside (Broadcast), mis levivad hüppelt-hüpkele.
*   **Aida & Börs (Resource Barter):** Tööriistade, seemnete ja energia jagamine ilma rahata.
*   **Oskuste Vahetus (Skills Registry):** Kohalikud mentorid päikeseelektri, permakultuuri ja raadioside alal.
*   **Raadioradar (Wardrive / Pathfinder):** Passiivne WiFi ja BLE seadmete kaardistamine.

### 4. Ohutus (Safety / SOS)
*   **SOS Häiremajakas:** Ühe puutega kriisiteate edastamine kõigil 433MHz ja BLE sagedustel.
*   **Kriisijuhendid:** Võrguühenduseta esmaabi-, veepuhastus- ja evakuatsioonijuhendid.
*   **Võrgu Diagnostika:** Reaalajas signaalitugevuse (RSSI), aku oleku ja pakettide kadu kontroll.

### 5. Rohkem (More / Progress & Settings)
*   **Privaatne Edenemine:** 3-suunaline vastupidavuse ülevaade ilma avaliku võistlemiseta.
*   **DAO Nõukogu:** Kogukonna otsused ja ruuthääletus (*Quadratic Voting*).
*   **Seaded & Varukoopiad:** Parooliga krüpteeritud varukoopiad ja kohene tehase algseadistus (*Factory Reset*).

---

## 3. Välioperatsioonide Režiimid (Field Modes)

### Kinnaste Režiim (Glove Mode)
Suurendab kõiki puutealasid ja nuppe vähemalt 56×56 pikslini ning lisab tugeva vibratsiooni/heli tagasiside, võimaldades terminali kasutada paksude töökinnastega metsas või ehitusel.

### Otsese Päikese Režiim (Direct Sun Mode)
Aktiveerib maksimaalse kontrastiga must-valge e-ink laadse režiimi, mis on selgelt loetav ka ereda suvise päikesevalguse käes.

### Käsupalett (Command Palette `Ctrl+K` / `⌘K`)
Võimaldab kogenud operaatoritel kiiresti hüpata mis tahes funktsiooni, kaardikihi või seadistuse juurde ilma menüüdes surfamata.

---

## 4. Privaatne Edenemissüsteem (3-Track Progress)

HÕIMU asendas avalikud edetabelid kolme privaatse edenemisrajaga:
1. **Valmisolek (Preparedness):** Offline kaartide allalaadimine ja hädaabiakude laetus.
2. **Side (Connection):** Usaldussidemed ja lähedalasuvad aktiivsed võrgusõlmed.
3. **Panus (Contribution):** Naabruskonna abistamine ja ressursside jagamine.

---

## 5. Riistvaralised LED Märguanded & Pi Gateway

Kui Sinu seadmega on ühendatud **WS2812B NeoPixel LED-moodul** või Raspberry Pi Zero 2 W lüüs:
*   🟢 **Rohekas-sinine hingav:** Süsteem on ooterežiimis, võrk toimib.
*   🔵 **Sinine laine (Chaser):** Uus krüpteeritud võrgusõnum.
*   🟡 **Kuldne sädelus:** Sinu soovile leiti sobiv vaste ressursiturul.
*   🔴 **Kiire punane vilkumine:** **HÄIRE / SOS!** Läheduses on aktiveeritud kriisiteade.

---

## 6. Korduma Kippuvad Küsimused (KKK)

#### K: Kas rakendus vajab töötamiseks internetti või SIM-kaarti?
**V:** Ei. HÕIMU on loodud täielikult offline-rakendusena. Kaardid, sõnumid, tehingud ja hääletused salvestatakse telefoni mällu ja levitatakse otse seadmete vahel raadiolainete või Wi-Fi otseühenduse abil.

#### K: Kuidas ma saan andmeid teise kasutajaga jagada?
**V:** Kui kohtute füüsiliselt või satute teineteise raadioulatusse, vahetavad seadmed automaatselt asünkroonseid krüpteeritud andmepakette (CRDT delta olekuid), sünkroonides kaardid ja tehingud märkamatult.

#### K: Kuidas kaitstakse minu privaatsust?
**V:** Kõik sõnumid on krüpteeritud ja identiteedid on kaitstud krüptograafiliste võtmetega (WebCrypto Ed25519 & AES-256). Tsentraalsed serverid puuduvad.

---

## 1. Sissejuhatus & Filosoofia

HÕIMU sündis solarpunk-visioonist: luua detsentraliseeritud tehnoloogiline ökosüsteem, mis ei sõltu suurkorporatsioonide pilveserveritest, kaabliühendustest ega tsentraalsest elektritootmisest. 

Rakendus salvestab andmed otse Sinu seadmesse (**LocalStorage & IndexedDB**) ning edastab sõnumeid otse ühelt seadmelt teisele, kasutades raadiolaineid (**LoRa, ESP-NOW, BLE**).

---

## 2. Põhifunktsioonide Kasutamine

### Kaardi ja Asukohapunktid (Map View)
*   **Mis see on?** Interaktiivne võrguühenduseta topograafiline kaart, mis töötab täielikult ilma internetita.
*   **Kuidas kasutada?**
    1.  Ava vaheleht **Kaart (Map)**.
    2.  Näed reaalajas enda asukohta ning lähedal asuvate teiste "hõimude" ehk kasutajate asukohapunkte (Mesh Nodes).
    3.  Võid kaardile lisada märkeid (nt veevõtukoht, abiotsingu punkt, meditsiinitelk), tehes kaardil soovitud asukohas topeltklõpsu.
    4.  Sinu lisatud punktid levivad teistele kasutajatele asünkroonselt, kui seadmed satuvad üksteise lähedusse.

### Ressursivahetus ja Wishlist (Exchange)
*   **Mis see on?** Kohalik turg ja soovide nimekiri bartersüsteemi põhimõttel.
*   **Kuidas kasutada?**
    1.  Navigeeri vahelehele **Vahetus (Exchange)**.
    2.  Näed nimekirja kohalikest ressurssidest: kes pakub päikesepaneeli laadimist, kes puhast vett või seemneid.
    3.  **Soovi lisamine (Wishlist):** Kui vajad midagi (nt "akutrell" või "ravimid"), vajuta nupule "Lisa soov". Kui kellegi pakutav ressurss kattub Sinu sooviga, loob süsteem automaatse matši (*Wishlist Match*).

### Võrguvestlus ja Sõnumid (Mesh Chat)
*   **Mis see on?** Krüpteeritud sõnumside, mis edastatakse võrgusõlmede kaudu hüppelt-hüpkele (Mesh routing).
*   **Kuidas kasutada?**
    1.  Ava vaheleht **Võrk (Mesh)**.
    2.  Vali nimekirjast mõni lähedalolev võrgupartner või vali "Üldine kanal" (Broadcast) kõigile kuulutamiseks.
    3.  Kirjuta sõnum ja vajuta saada.
    4.  Sõnumid allkirjastatakse krüptograafiliselt Sinu unikaalse võtmega (**WebCrypto Ed25519**), tagades, et keegi teine ei saa Sinu nime all valeinfot levitada.

### Tegevuste ja Radari Otsing (Pathfinder Mode)
*   **Mis see on?** Passiivne ümbruse raadiosageduslik kaardistamine (wardriving), mis aitab avastada varjatud WiFi ja Bluetooth tugijaamu kriisiolukorras.
*   **Kuidas kasutada?**
    1.  Ava **Pathfinder** režiim.
    2.  Liikudes piirkonnas ringi, skannib süsteem taustal WiFi sagedusi ja Bluetooth signaale.
    3.  Tuvastatud seadmed joonistatakse dünaamilisele radarile ja salvestatakse seadme kohalikku mällu.
    4.  Iga uus avastus annab helisignaali (mille saab soovi korral vaigistada).

### Detsentraliseeritud Ühistu hääletused (DAO)
*   **Mis see on?** Kohalik otsustusorgan, kus kogukond saab hääletada ressursside jagamise ja kriisilahenduste üle ilma keskvalitsuseta.
*   **Kuidas kasutada?**
    1.  Mine vahelehele **Profiil** või **Vahetus** ja klõpsa nupule **DAO Council / Mesh Council**.
    2.  Siin on üleval kogukonna algatatud ettepanekud (nt "Käivitada Tuulemäe ühine joogivee puurkaev").
    3.  Hääleta **Poolt** või **Vastu**. Sinu hääle kaal ja usaldusväärsus skaleeruvad vastavalt Sinu panusele kogukonnas (Symbiosis Score).

---

## 3. Riistvaralised LED Märguanded

Kui Sinu seadmega on ühendatud **WS2812B NeoPixel LED-moodul** (ESP32 kaudu), annab süsteem Sulle valgussignaale taustal toimuvast:

*   🟢 **Rahulik hingav rohekas-sinine**: Süsteem on ooterežiimis, kõik on korras ja võrk toimib.
*   🔵 **Liikuv sinine laine (Chaser)**: Sulle saabus uus krüpteeritud võrgusõnum.
*   🟡 **Kuldne sädelus**: Sinu lisatud soovile leiti sobiv vaste ressursiturul (*Wishlist Match*).
*   🔴 **Kiire punane vilkumine**: **HÄIRE / SOS!** Keegi läheduses on käivitanud kriisirežiimi.

---

## 4. Korduma Kippuvad Küsimused (KKK)

#### K: Kas rakendus vajab töötamiseks internetti või SIM-kaarti?
**V:** Ei. HÕIMU on loodud täielikult offline-rakendusena. Kaardid, sõnumid, tehingud ja hääletused salvestatakse telefoni mällu ja levitatakse otse seadmete vahel raadiolainete või Wi-Fi otseühenduse abil.

#### K: Kuidas ma saan andmeid teise kasutajaga jagada?
**V:** Kui kohtute füüsiliselt või satute teineteise raadioulatusse, vahetavad seadmed automaatselt asünkroonseid krüpteeritud andmepakette (CRDT delta olekuid), sünkroonides kaardid ja tehingud märkamatult.

#### K: Kuidas kaitstakse minu privaatsust?
**V:** Kõik sõnumid on krüpteeritud ja identiteedid on kaitstud krüptograafiliste võtmetega. Kuna puuduvad tsentraalsed serverid, ei ole kellegil võimalik Sinu asukohta või vestlusi pealt kuulata väljastpoolt füüsilist võrguulatust.
