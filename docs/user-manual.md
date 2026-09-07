# 🌲 HÕIMU: Kasutusjuhend (User Manual)

> HÕIMU on autonoomne, kriisikindel ja kogukonnapõhine võrguühenduseta (off-grid) terminal, mis aitab hoida sidet ja jagada ressursse ka siis, kui internet ja mobiililevi kaovad.

---

## 🧭 Sisukord
1. [Sissejuhatus & Filosoofia](#1-sissejuhatus--filosoofia)
2. [Põhifunktsioonide Kasutamine](#2-põhifunktsioonide-kasutamine)
    - [Kaart ja Asukohapunktid (Map View)](#kaardi-ja-asukohapunktid-map-view)
    - [Ressursivahetus ja Wishlist (Exchange)](#ressursivahetus-ja-wishlist-exchange)
    - [Võrguvestlus ja Sõnumid (Mesh Chat)](#võrguvestlus-ja-sõnumid-mesh-chat)
    - [Tegevuste ja Radari Otsing (Pathfinder Mode)](#tegevuste-ja-radari-otsing-pathfinder-mode)
    - [Detsentraliseeritud Ühistu hääletused (DAO)](#detsentraliseeritud-ühistu-hääletused-dao)
3. [Riistvaralised LED Märguanded](#3-riistvaralised-led-märguanded)
4. [Korduma Kippuvad Küsimused (KKK)](#4-korduma-kippuvad-küsimused-kkk)

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
