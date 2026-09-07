/**
 * Android-compatible String Resource System for HÕIMU
 * References string resources mapped from res/values/strings.xml
 * Supports Jetpack Compose style `stringResource(R.string.key)` or `stringResource('key')`.
 */

export const STRING_RESOURCES = {
  // Core Application Identity
  app_name: 'HÕIMU',
  app_tagline: 'Bioregionaalne Päikesepunk Võrgukogukond',
  app_description: 'Võrguühenduseta P2P raadiovõrk, vastastikune abi ja maastiku avastamine',
  package_name: 'ee.hoimu.app',
  custom_url_scheme: 'ee.hoimu.app',
  title_activity_main: 'HÕIMU',

  // Navigation Tabs
  nav_mesh: 'Võrk',
  nav_map: 'Kaart',
  nav_exchange: 'Vahetus',
  nav_logbook: 'Päevik',
  nav_profile: 'Profiil',

  // Onboarding Step 1: Welcome & Solarpunk Philosophy
  onboarding_welcome_badge: 'Samm 1 / 5 • Tere tulemast',
  onboarding_welcome_title: 'Võrguühenduseta Bioregionaalne Kogukonnavõrk',
  onboarding_welcome_subtitle: 'Päikesepunk side, hajutatud vastastikune abi ja kohalik autonoomia',
  onboarding_welcome_desc:
    'HÕIMU on avatud lähtekoodiga vastupanuvõimeline väli-tarkvara, mis töötab 100% ilma interneti, mobiilimastide ja keskserveriteta. Seadmed suhtlevad vahetult raadiolainete (BLE ja Wi-Fi Direct) kaudu.',
  solarpunk_core_title: 'Päikesepunki Aluspõhimõtted',
  solarpunk_concept_offline_title: '100% Sõltumatu ja Võrguvaba',
  solarpunk_concept_offline_desc:
    'Side ja andmevahetus toimib ka siis, kui üleriigiline elektrivõrk või internet on maas.',
  solarpunk_concept_crypto_title: 'Privaatsus ja Ed25519 Krüptoidentiteet',
  solarpunk_concept_crypto_desc:
    'Puuduvad kasutajakontod pilves või telefoninumbriga sidumine. Sinu seade loob lokaalse krüptovõtme.',
  solarpunk_concept_mutual_aid_title: 'Mitte-rahaline Kinkemajandus',
  solarpunk_concept_mutual_aid_desc:
    'Vaheta seemneid, päikeseenergiat, tööriistu ja oskusi ilma rahaliste vahendajateta.',

  // Onboarding Step 2: User Profile Creation
  onboarding_profile_badge: 'Samm 2 / 5 • Loo Identiteet',
  onboarding_profile_title: 'Loo Oma Hõimu Raadioprofiil',
  onboarding_profile_subtitle: 'Kutsung, bioregionaalne tutvustus ja esmased oskused',
  onboarding_profile_desc:
    'See profiil edastatakse sinu läheduses olevatele hõimlastele raadiomajaka (BLE Beacon) kaudu. Sa võid igal ajal andmeid muuta või pseudonüümi kasutada.',
  field_callsign_label: 'Raadiokutsung (Callsign)',
  field_callsign_placeholder: 'nt. Kullerkupp, Männikäbi, Rändur-42',
  field_callsign_helper: 'Võrgusõlme unikaalne hüüdnimi eetris (3-24 tähemärki)',
  field_callsign_error: 'Kutsung peab olema vähemalt 3 sümbolit pikk',
  field_callsign_random: 'Juhuslik Kutsung',
  field_bio_label: 'Bioregionaalne Enesetutvustus',
  field_bio_placeholder: 'Kirjelda lühidalt oma asukohta, tausta või mida kogukonnaga jagada soovid...',
  field_bio_helper: 'Lokaalselt allkirjastatud enesekirjeldus lähedalasuvatele naabritele',
  field_skills_label: 'Sinu Oskused ja Teadmised',
  field_skills_helper: 'Vali valdkonnad, milles saad kriisis või igapäevaelus naabreid abistada',
  avatar_seed_label: 'Avatari Geneetiline Kood',
  avatar_seed_helper: 'Iga kutsung genereerib unikaalse päikesepunk orgaanilise avatari',
  btn_dice_avatar: 'Uus avatar',
  btn_add_custom_skill: 'Lisa oskus',
  custom_skill_prompt: 'Sisesta oskuse nimi',

  // Predefined Skills
  skill_solar_energy: 'Päikeseenergia & Akud',
  skill_permaculture: 'Permakultuur & Aiandus',
  skill_radio_comms: 'Raadioside & Antennid',
  skill_first_aid: 'Esmaabi & Ravimtaimed',
  skill_bicycle_repair: 'Rattamehaanika & Tööriistad',
  skill_foraging: 'Seened, Marjad & Korilus',
  skill_woodworking: 'Puutöö & Varjualused',
  skill_seed_saving: 'Seemnepank & Paljundus',
  skill_fermentation: 'Hoidised & Käärimine',
  skill_water_purification: 'Vee Puhastamine',

  // Onboarding Step 3: Mesh Networking & Privacy Deep Dive
  onboarding_mesh_privacy_badge: 'Samm 3 / 5 • Võrgu Arhitektuur',
  onboarding_mesh_privacy_title: 'Kuidas HÕIMU Võrk ja Privaatsus Töötavad?',
  onboarding_mesh_privacy_subtitle: 'Tsentraalivaba relee, hüppelt-hüppele levik ja turvalisus',
  onboarding_mesh_privacy_desc:
    'Tutvu sellega, kuidas teated liiguvad seadmest seadmesse ilma telekommunikatsiooniettevõtete või riikliku taristuta.',
  mesh_concept_p2p_title: 'Hüppelt-hüppele Levi (Store & Forward)',
  mesh_concept_p2p_desc:
    'Kui sihtkoht on kaugel, kannavad vahepealsed telefonid sõnumit edasi kui usaldusväärsed releed, tagades suurema leviala.',
  mesh_concept_zero_cloud_title: 'Null-Pilve Salvestus (Zero-Cloud)',
  mesh_concept_zero_cloud_desc:
    'Ühtegi faili, asukohta ega sõnumit ei saadeta tsentraalsesse serverisse. Kõik andmed elavad ainult sinu seadme kohalikus mälus.',
  mesh_concept_ed25519_title: 'Asümmeetriline Krüpteering',
  mesh_concept_ed25519_desc:
    'Otsesõnumid naabritega krüpteeritakse vastuvõtja avaliku võtmega – isegi releesõlmed ei näe sõnumi sisu.',
  mesh_concept_sybil_title: 'Kogukondlik Usaldusvõrk (Web-of-Trust)',
  mesh_concept_sybil_desc:
    'Usaldusskoor põhineb reaalsetel silmast-silma vahetustel ja teiste sõlmede kinnitustel, kaitstes võrku rünnakute eest.',

  // Onboarding Step 4: Initial Mesh Visibility Preferences
  onboarding_visibility_badge: 'Samm 4 / 5 • Nähtavus & Raadio',
  onboarding_visibility_title: 'Määra Esialgsed Võrgu Nähtavuse Eelistused',
  onboarding_visibility_subtitle: 'Vali kuidas ja millal sinu seade raadiolaineid levitab',
  onboarding_visibility_desc:
    'Saad igal hetkel lülituda stealth-režiimi või piirata asukoha täpsust, et kaitsta oma privaatsust või säästa akut.',
  visibility_mode_label: 'Võrgusõlme Nähtavusrežiim',
  visibility_public_title: 'Avalik Majakas (Avatud Koostöö)',
  visibility_public_desc:
    'Sinu kutsung ja valitud oskused on nähtavad teistele lähedalasuvatele hõimlastele.',
  visibility_stealth_title: 'Relee Režiim (Stealth Helper)',
  visibility_stealth_desc:
    'Aitad edastada võrgupakette, kuid ei kuuluta aktiivselt oma identiteeti ega oskusi.',
  visibility_listen_title: 'Ainult Kuulamine (Incognito)',
  visibility_listen_desc:
    'Võtad vastu ainult hädaabiteateid ja kaardiuuendusi ilma raadiosignaali välja saatmata.',
  pref_ble_title: 'Bluetooth Low Energy (BLE 5.0)',
  pref_ble_desc:
    'Ülimadal energiakulu, 30–80 meetrit leviala, sobib pidevaks taustal majakaks.',
  pref_wifi_direct_title: 'Wi-Fi Direct P2P',
  pref_wifi_direct_desc:
    'Kiirem andmevahetus suuremate failide ja kaartide sünkroonimiseks (kuni 150m).',
  pref_location_precision_label: 'Asukohakoordinaatide Täpsus Kaardil',
  pref_loc_obfuscated: 'Hajutatud (±500m Raadius) • Soovitatav',
  pref_loc_exact: 'Täpne GPS Koordinaat',
  pref_loc_none: 'Peidetud (Ainult Raadiosignaali Kaugus)',
  pref_beacon_interval_label: 'Majaka Kuulutamise Intervall',
  pref_interval_balanced: 'Tasakaalustatud (Iga 30s)',
  pref_interval_powersave: 'Akusäästlik (Iga 120s)',
  pref_interval_realtime: 'Reaalajas (Iga 5s)',
  pref_sos_relay_title: 'Automaatne Hädaabi (SOS) Vahendamine',
  pref_sos_relay_desc:
    'Edasta automaatselt kriisi- ja hädaabisõnumeid ka siis, kui telefon on unerežiimis.',

  // Onboarding Step 5: Review & Node Activation
  onboarding_review_badge: 'Samm 5 / 5 • Valmis Tööks',
  onboarding_review_title: 'Kinnita ja Käivita Oma Hõimusõlm',
  onboarding_review_subtitle: 'Sinu kohalik identiteet on loodud ja krüptovõtmed genereeritud',
  onboarding_review_desc:
    'Oled valmis astuma kohalikku päikesepunk võrgustikku. Kõik seadistused salvestatakse turvaliselt seadme kohalikku mällu.',
  summary_identity_card: 'Identiteedikaart',
  summary_callsign_label: 'Kutsung',
  summary_skills_label: 'Valitud Oskused',
  summary_visibility_label: 'Võrgurežiim',
  summary_location_label: 'Asukoha Privaatsus',
  summary_crypto_key_label: 'Ed25519 Avalik Sõrmejälg',
  btn_activate_node: 'Käivita HÕIMU Sõlm',
  btn_next_step: 'Järgmine Samm',
  btn_prev_step: 'Eelmine Samm',
  btn_skip: 'Jäta Vahele',
  step_indicator: 'Samm %1$d / %2$d',

  // D3.js Radar Chart & Trust Profile Strings
  trust_profile_title: 'Usaldusprofiil (D3 Radar)',
  trust_profile_subtitle: 'Mitmemõõtmeline P2P usaldusmõõdikute polar-radar',
  metric_completed_exchanges: 'Teostatud vahetused',
  metric_community_endorsements: 'Kogukonna soovitused',
  metric_relay_reliability: 'Relee usaldusväärsus',
  metric_trust_score: 'Usaldusindeks',
  metric_signal_quality: 'RF signaali kvaliteet',
  metric_relayed_packets: 'Edastatud paketid',
  community_baseline_label: 'Kogukonna baastase',
  node_profile_legend: 'Sõlme tegelik tase',
  btn_trust_ledger: 'Usaldusraamat',
  btn_send_p2p_message: 'Saada P2P Sõnum',
  toast_onboarding_completed_title: '🎉 Hõimusõlm Edukalt Aktiveeritud!',
  toast_onboarding_completed_desc:
    'Tere tulemast HÕIMU võrku, @%1$s! Sinu seade kuulab ja levitab kohalikku raadiosignaali.',
} as const;

export type StringResourceKey = keyof typeof STRING_RESOURCES;

/**
 * Android R.string resource namespace
 */
export const R = {
  string: Object.keys(STRING_RESOURCES).reduce((acc, key) => {
    (acc as Record<string, string>)[key] = key;
    return acc;
  }, {} as Record<StringResourceKey, StringResourceKey>),
};

/**
 * Android Jetpack Compose style `stringResource(R.string.key)` or `stringResource("key", ...args)` function.
 * Formats strings with %1$s, %2$d, etc. format specifiers.
 */
export function stringResource(
  id: StringResourceKey | string,
  ...formatArgs: (string | number)[]
): string {
  const template =
    id in STRING_RESOURCES
      ? STRING_RESOURCES[id as StringResourceKey]
      : String(id);

  if (formatArgs.length === 0) {
    return template;
  }

  // Handle standard Android format specifiers: %1$s, %1$d, %s, %d
  let formatted = template;
  formatArgs.forEach((arg, index) => {
    const pos = index + 1;
    // Replace %1$s or %1$d
    formatted = formatted.replace(new RegExp(`%${pos}\\$[sd]`, 'g'), String(arg));
  });

  // Also replace unnumbered %s or %d sequentially if present
  let argIndex = 0;
  formatted = formatted.replace(/%[sd]/g, () => {
    if (argIndex < formatArgs.length) {
      return String(formatArgs[argIndex++]);
    }
    return '';
  });

  return formatted;
}
