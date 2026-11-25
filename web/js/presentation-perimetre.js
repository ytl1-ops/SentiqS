// Le PÉRIMÈTRE d'une Présentation 1 composée dans l'appli (25/11/2026).
//
// YORO : « Revise Présentation 1 avec des filtres pays, régional d'un pays,
// région ouest ou est Afrique… pour avoir des options de contenus selon les
// besoins. » Ce module ne fait QUE choisir : quels pays, quelle zone d'un
// pays, quelles rubriques, quelle cotation, quelle période. Il ne rédige rien
// et ne note aucun pays. Le rapport lui-même reste celui du job
// (scripts/lib/rapport-grsci.js), qui reçoit le périmètre tel quel.
//
// Double export (navigateur : window.SentiqPerimetre ; Node : require), testé
// par scripts/test/presentation-filtres.test.js.
(function (racine, fabrique) {
  const m = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else racine.SentiqPerimetre = m;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Les cinq régions de l'Union africaine (découpage de l'UA, qui range la
  // Mauritanie au Nord), puis des ensembles d'usage courant en sûreté. Un
  // pays peut figurer dans plusieurs ensembles : ce sont des vues, pas une
  // partition. Membres au 25/11/2026 : la CEDEAO sans les trois pays de l'AES
  // (retrait effectif le 29/01/2025).
  const REGIONS = [
    { id: 'ouest', nom: 'Afrique de l\'Ouest', type: 'ua', pays: ['BJ', 'BF', 'CV', 'CI', 'GM', 'GH', 'GN', 'GW', 'LR', 'ML', 'NE', 'NG', 'SN', 'SL', 'TG'] },
    { id: 'nord', nom: 'Afrique du Nord', type: 'ua', pays: ['DZ', 'EG', 'LY', 'MR', 'MA', 'TN'] },
    { id: 'est', nom: 'Afrique de l\'Est', type: 'ua', pays: ['KM', 'DJ', 'ER', 'ET', 'KE', 'MG', 'MU', 'RW', 'SC', 'SO', 'SS', 'SD', 'TZ', 'UG'] },
    { id: 'centrale', nom: 'Afrique centrale', type: 'ua', pays: ['BI', 'CM', 'CF', 'TD', 'CG', 'CD', 'GQ', 'GA', 'ST'] },
    { id: 'australe', nom: 'Afrique australe', type: 'ua', pays: ['AO', 'BW', 'SZ', 'LS', 'MW', 'MZ', 'NA', 'ZA', 'ZM', 'ZW'] },
    { id: 'aes', nom: 'Alliance des États du Sahel', type: 'ensemble', pays: ['BF', 'ML', 'NE'] },
    { id: 'sahel', nom: 'Sahel', type: 'ensemble', pays: ['MR', 'ML', 'BF', 'NE', 'TD'] },
    { id: 'golfe', nom: 'Golfe de Guinée', type: 'ensemble', pays: ['CI', 'GH', 'TG', 'BJ', 'NG', 'CM', 'GQ', 'GA', 'ST'] },
    { id: 'cedeao', nom: 'CEDEAO', type: 'ensemble', pays: ['BJ', 'CV', 'CI', 'GM', 'GH', 'GN', 'GW', 'LR', 'NG', 'SN', 'SL', 'TG'] },
    { id: 'uemoa', nom: 'UEMOA', type: 'ensemble', pays: ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] },
    { id: 'grands-lacs', nom: 'Grands Lacs', type: 'ensemble', pays: ['BI', 'CD', 'RW', 'UG'] },
    { id: 'corne', nom: 'Corne de l\'Afrique', type: 'ensemble', pays: ['DJ', 'ER', 'ET', 'SO'] },
    { id: 'maghreb', nom: 'Maghreb', type: 'ensemble', pays: ['DZ', 'LY', 'MA', 'MR', 'TN'] },
  ];

  // Les zones d'un pays : régions administratives et localités qui les
  // désignent dans un titre ou un chapô. Une zone est reconnue par un MOT
  // ENTIER (sans accents, sans casse) ; un fait qui ne nomme aucune localité
  // n'est rattaché à aucune zone — on ne devine pas, et le rapport dit
  // combien de faits le filtre a écartés pour cette raison.
  // Côte d'Ivoire : districts autonomes et régions (découpage de 2011).
  const ZONES = {
    CI: [
      { id: 'abidjan', nom: 'Abidjan', lieux: ['Abidjan', 'Cocody', 'Yopougon', 'Abobo', 'Adjamé', '=Plateau', 'Treichville', 'Marcory', 'Koumassi', 'Port-Bouët', 'Attécoubé', 'Bingerville', 'Anyama', 'Songon'] },
      { id: 'sud', nom: 'Sud (Lagunes, Sud-Comoé, Agnéby)', lieux: ['Grand-Bassam', 'Bonoua', 'Aboisso', 'Adiaké', 'Assinie', 'Dabou', 'Jacqueville', 'Grand-Lahou', 'Agboville', 'Adzopé', 'Akoupé', 'Alépé', 'Tiassalé', 'Sikensi', 'Sud-Comoé', 'Lagunes', 'Agnéby-Tiassa', 'La Mé', 'Grands-Ponts'] },
      { id: 'est', nom: 'Est (Comoé, Indénié)', lieux: ['Abengourou', 'Agnibilékrou', 'Bettié', 'Indénié-Djuablin', 'Comoé'] },
      { id: 'centre', nom: 'Centre (Yamoussoukro, Vallée du Bandama, Lacs)', lieux: ['Yamoussoukro', 'Bouaké', 'Dimbokro', 'Bongouanou', 'Daoukro', 'Toumodi', 'Béoumi', 'Katiola', 'Dabakala', 'Sakassou', 'Bocanda', 'M\'Bahiakro', 'Tiébissou', 'Didiévi', 'Gbêkê', 'Hambol', 'Iffou', 'Moronou', 'N\'Zi', 'Bélier', 'Vallée du Bandama', '=Lacs'] },
      { id: 'centre-ouest', nom: 'Centre-Ouest (Haut-Sassandra, Gôh, Marahoué)', lieux: ['Daloa', 'Gagnoa', 'Issia', 'Vavoua', 'Sinfra', 'Bouaflé', 'Zuénoula', 'Oumé', 'Divo', 'Lakota', 'Haut-Sassandra', '=Gôh', 'Marahoué', 'Lôh-Djiboua'] },
      { id: 'ouest', nom: 'Ouest (Montagnes)', lieux: ['=Man', 'Danané', 'Duékoué', 'Guiglo', 'Bangolo', 'Toulépleu', 'Blolequin', 'Biankouma', 'Zouan-Hounien', 'Facobly', 'Kouibly', 'Touba', 'Tonkpi', 'Cavally', 'Guémon', 'Bafing', 'Montagnes'] },
      { id: 'sud-ouest', nom: 'Sud-Ouest (Bas-Sassandra)', lieux: ['San-Pédro', 'San Pedro', 'Sassandra', 'Soubré', 'Tabou', 'Méagui', 'Buyo', 'Grand-Béréby', 'Fresco', 'Gueyo', '=Nawa', 'Gbôklé', 'Bas-Sassandra'] },
      { id: 'nord', nom: 'Nord (Savanes, Denguélé, Woroba)', lieux: ['Korhogo', 'Ferkessédougou', 'Ferké', 'Boundiali', 'Tengréla', 'Ouangolodougou', '=Kong', 'Sinématiali', 'Dikodougou', 'Niakaramandougou', 'Odienné', 'Minignan', 'Madinani', 'Samatiguila', 'Gbéléban', 'Séguéla', 'Mankono', 'Kani', 'Kouto', 'Savanes', '=Poro', 'Tchologo', 'Bagoué', 'Denguélé', 'Folon', 'Kabadougou', 'Woroba', 'Worodougou', '=Béré', 'nord ivoirien'] },
      { id: 'nord-est', nom: 'Nord-Est (Zanzan)', lieux: ['Bondoukou', 'Bouna', 'Tanda', 'Doropo', 'Nassian', 'Téhini', 'Koun-Fao', 'Transua', 'Sandégué', 'Kalamon', 'Zanzan', 'Bounkani', 'Gontougo', 'parc de la Comoé'] },
    ],
    BF: [
      { id: 'centre', nom: 'Centre (Ouagadougou)', lieux: ['Ouagadougou', 'Ouaga', 'Kadiogo', 'Ziniaré', 'Koudougou', 'Manga', '=Pô', 'Tenkodogo', 'Koupéla', 'Oubri', 'Nakambé', 'Nazinon', 'Nando', 'Plateau-Central', 'Centre-Ouest', 'Centre-Est', 'Centre-Sud'] },
      { id: 'sahel', nom: 'Sahel / Liptako', lieux: ['Dori', 'Djibo', 'Gorom-Gorom', 'Sebba', 'Arbinda', 'Aribinda', 'Markoye', 'Tin-Akoff', 'Liptako', 'Soum', 'Séno', 'Oudalan', 'Yagha'] },
      { id: 'nord', nom: 'Nord et Centre-Nord', lieux: ['Ouahigouya', 'Titao', 'Thiou', 'Kaya', 'Kongoussi', 'Barsalogho', 'Boulsa', 'Pissila', 'Kelbo', 'Yaadga', 'Kuilsé', 'Centre-Nord', 'Loroum', 'Yatenga', 'Sanmatenga', '=Bam'] },
      { id: 'est', nom: 'Est (Goulmou, Tapoa)', lieux: ['Fada N\'Gourma', '=Fada', 'Diapaga', 'Gayéri', 'Pama', 'Kantchari', 'Bogandé', 'Manni', 'Goulmou', 'Tapoa', 'Gourma', 'Kompienga', 'Gnagna', 'Komondjari', 'Sirba', 'parc W', 'Arly'] },
      { id: 'ouest', nom: 'Ouest (Mouhoun, Hauts-Bassins, Cascades, Sud-Ouest)', lieux: ['Bobo-Dioulasso', 'Bobo', 'Dédougou', 'Nouna', 'Tougan', 'Solenzo', 'Toma', 'Houndé', 'Orodara', 'Banfora', 'Gaoua', 'Diébougou', 'Dano', 'Sourou', 'Bankui', 'Guiriko', 'Tannounyan', 'Djôrô', 'Boucle du Mouhoun', 'Hauts-Bassins', 'Cascades', 'Sud-Ouest', 'Kossi'] },
    ],
    ML: [
      { id: 'bamako', nom: 'Bamako et Koulikoro', lieux: ['Bamako', 'Kati', 'Koulikoro', 'Kangaba', 'Banamba', 'Dioïla', 'Kolokani', 'Nara'] },
      { id: 'centre', nom: 'Centre (Ségou, Mopti, Bandiagara)', lieux: ['Ségou', 'Mopti', 'Sévaré', 'Bandiagara', 'Djenné', 'Bankass', 'Koro', 'Douentza', 'Tenenkou', 'Youwarou', '=San', 'Macina', 'Niono', '=Boni', 'Hombori', 'Diafarabé'] },
      { id: 'nord', nom: 'Nord (Tombouctou, Gao, Kidal, Ménaka, Taoudéni)', lieux: ['Tombouctou', 'Gao', 'Kidal', 'Ménaka', 'Taoudéni', 'Tessalit', 'Aguelhok', 'Anéfis', 'Ansongo', 'Bourem', 'Léré', 'Goundam', 'Niafunké', '=Ber', 'Tin-Zaouatène', 'Andéramboukane', 'Tinzaouaten', 'Azawad'] },
      { id: 'sud-ouest', nom: 'Sud et Ouest (Sikasso, Kayes)', lieux: ['Sikasso', 'Koutiala', 'Bougouni', 'Kadiolo', 'Yorosso', 'Kayes', 'Kita', 'Nioro', 'Diéma', 'Kéniéba', 'Yélimané', 'Bafoulabé', 'Kéniéba', 'Nioro du Sahel', 'Diboli'] },
    ],
    NE: [
      { id: 'niamey', nom: 'Niamey', lieux: ['Niamey'] },
      { id: 'ouest', nom: 'Ouest (Tillabéri, Dosso)', lieux: ['Tillabéri', 'Tillaberi', 'Téra', 'Ouallam', 'Ayorou', 'Banibangou', 'Torodi', 'Makalondi', 'Abala', 'Filingué', '=Say', 'Dosso', 'Gaya', 'Dogondoutchi', 'Liptako', 'Tahoua', 'Tillia', 'Tassara', 'Konni', 'Birni-N\'Konni'] },
      { id: 'sud-est', nom: 'Sud et Est (Maradi, Zinder, Diffa)', lieux: ['Maradi', 'Zinder', 'Diffa', 'Bosso', 'Mainé-Soroa', 'Nguigmi', 'Tessaoua', 'Madarounfa', 'Guidan-Roumdji', 'Matameye', 'Magaria', 'lac Tchad'] },
      { id: 'nord', nom: 'Nord (Agadez)', lieux: ['Agadez', 'Arlit', 'Bilma', 'Tchirozérine', 'Iférouane', 'Dirkou', 'Assamaka', 'Aïr', 'Djado'] },
    ],
    NG: [
      { id: 'nord-est', nom: 'Nord-Est (Borno, Yobe, Adamawa)', lieux: ['Borno', 'Maiduguri', 'Yobe', 'Damaturu', 'Adamawa', 'Yola', 'Gombe', 'Bauchi', 'Taraba', 'Jalingo', 'Bama', 'Gwoza', 'Monguno', 'Dikwa', 'Konduga', 'Sambisa'] },
      { id: 'nord-ouest', nom: 'Nord-Ouest (Zamfara, Katsina, Sokoto, Kano, Kaduna)', lieux: ['Zamfara', 'Gusau', 'Katsina', 'Sokoto', 'Kebbi', 'Kano', 'Kaduna', 'Jigawa', 'Birnin Kebbi', 'Zaria'] },
      { id: 'centre', nom: 'Centre (Middle Belt, Abuja)', lieux: ['Abuja', 'FCT', '=Plateau', 'Jos', 'Benue', 'Makurdi', 'Niger State', 'Minna', 'Kogi', 'Lokoja', 'Kwara', 'Ilorin', 'Nasarawa', 'Lafia', 'Southern Kaduna'] },
      { id: 'sud-ouest', nom: 'Sud-Ouest (Lagos, Ogun, Oyo)', lieux: ['Lagos', 'Ikeja', 'Lekki', '=Ogun', 'Abeokuta', 'Oyo', 'Ibadan', 'Osun', 'Osogbo', '=Ondo', 'Akure', 'Ekiti', 'Ado-Ekiti'] },
      { id: 'sud-est', nom: 'Sud-Est', lieux: ['Anambra', 'Awka', 'Onitsha', 'Enugu', '=Imo', 'Owerri', '=Abia', 'Umuahia', 'Aba', 'Ebonyi', 'Abakaliki'] },
      { id: 'sud-sud', nom: 'Sud-Sud (delta du Niger)', lieux: ['=Rivers', 'Port Harcourt', 'Delta State', 'Warri', 'Asaba', 'Bayelsa', 'Yenagoa', 'Akwa Ibom', 'Uyo', 'Cross River', 'Calabar', '=Edo', 'Benin City', 'Niger Delta'] },
    ],
    GH: [
      { id: 'accra', nom: 'Accra et côte', lieux: ['Accra', 'Tema', 'Kasoa', 'Greater Accra', 'Cape Coast', 'Takoradi', 'Sekondi', 'Winneba', 'Central Region', 'Western Region'] },
      { id: 'centre', nom: 'Centre (Ashanti, Bono)', lieux: ['Kumasi', 'Ashanti', 'Obuasi', 'Sunyani', 'Techiman', '=Bono', 'Eastern Region', 'Koforidua'] },
      { id: 'nord', nom: 'Nord (Northern, Upper East, Upper West)', lieux: ['Tamale', 'Bolgatanga', 'Bawku', '=Wa', 'Yendi', 'Bimbilla', 'Northern Region', 'Upper East', 'Upper West', 'Savannah Region', 'North East Region', 'Damongo', 'Walewale', 'Nalerigu'] },
      { id: 'est', nom: 'Est (Volta, Oti)', lieux: ['=Ho', 'Volta Region', '=Oti', 'Hohoe', 'Aflao', 'Keta', 'Nkwanta', 'Dambai'] },
    ],
    TG: [
      { id: 'lome', nom: 'Lomé et Maritime', lieux: ['Lomé', 'Lome', 'Aného', 'Tsévié', 'Maritime', 'Kpalimé'] },
      { id: 'centre', nom: 'Plateaux et Centrale', lieux: ['Atakpamé', 'Sokodé', 'Tchamba', 'Blitta', '=Plateaux', '=Centrale', 'Bassar', '=Kara'] },
      { id: 'nord', nom: 'Nord (Savanes)', lieux: ['Dapaong', 'Mango', 'Kpendjal', 'Tône', 'Cinkassé', 'Tandjouaré', '=Oti', 'Savanes', 'Kpendjal-Ouest'] },
    ],
    BJ: [
      { id: 'sud', nom: 'Sud (Cotonou, Porto-Novo)', lieux: ['Cotonou', 'Porto-Novo', 'Abomey-Calavi', 'Ouidah', 'Sèmè', 'Sèmè-Kpodji', 'Littoral', 'Atlantique', 'Ouémé', '=Mono', 'Couffo', 'Lokossa', 'Abomey', 'Bohicon', '=Zou', '=Plateau'] },
      { id: 'centre', nom: 'Centre (Collines)', lieux: ['Dassa', 'Savalou', 'Savè', 'Glazoué', 'Collines'] },
      { id: 'nord', nom: 'Nord (Alibori, Atacora, Borgou, Donga)', lieux: ['Parakou', 'Kandi', 'Malanville', 'Natitingou', 'Tanguiéta', 'Karimama', 'Banikoara', 'Djougou', 'Matéri', 'Kérou', 'Ségbana', 'Nikki', 'Alibori', 'Atacora', 'Borgou', 'Donga', 'parc W', 'Pendjari'] },
    ],
    GN: [
      { id: 'conakry', nom: 'Conakry et Basse-Guinée', lieux: ['Conakry', 'Kaloum', '=Ratoma', 'Matoto', 'Dixinn', 'Matam', 'Coyah', 'Dubréka', 'Forécariah', 'Boké', 'Kindia', 'Fria', 'Boffa', 'Kamsar', 'Basse-Guinée'] },
      { id: 'moyenne', nom: 'Moyenne-Guinée', lieux: ['Labé', 'Mamou', 'Pita', 'Dalaba', 'Koubia', 'Lélouma', 'Tougué', 'Gaoual', 'Koundara', 'Fouta', 'Moyenne-Guinée'] },
      { id: 'haute', nom: 'Haute-Guinée', lieux: ['Kankan', 'Siguiri', 'Kouroussa', 'Dabola', 'Faranah', 'Mandiana', 'Kérouané', 'Dinguiraye', 'Haute-Guinée'] },
      { id: 'forestiere', nom: 'Guinée forestière', lieux: ['Nzérékoré', 'N\'Zérékoré', 'Kissidougou', 'Guéckédou', 'Macenta', 'Beyla', '=Lola', 'Yomou', 'Guinée forestière', 'Simandou'] },
    ],
    SN: [
      { id: 'dakar', nom: 'Dakar et Thiès', lieux: ['Dakar', 'Pikine', 'Guédiawaye', 'Rufisque', 'Keur Massar', 'Thiès', 'Mbour', 'Saly', 'Diamniadio', 'Tivaouane'] },
      { id: 'centre', nom: 'Centre (Touba, Kaolack, Diourbel)', lieux: ['Touba', 'Diourbel', 'Mbacké', 'Kaolack', 'Fatick', 'Kaffrine', 'Louga'] },
      { id: 'nord', nom: 'Nord (Saint-Louis, Matam)', lieux: ['Saint-Louis', 'Podor', 'Richard-Toll', 'Dagana', 'Matam', 'Ourossogui'] },
      { id: 'sud-est', nom: 'Sud et Est (Casamance, Tambacounda, Kédougou)', lieux: ['Ziguinchor', 'Casamance', 'Bignona', 'Oussouye', 'Sédhiou', 'Kolda', 'Tambacounda', 'Kédougou', 'Bakel', 'Saraya'] },
    ],
    LR: [
      { id: 'monrovia', nom: 'Monrovia et Montserrado', lieux: ['Monrovia', 'Montserrado', 'Paynesville', 'Bushrod', 'Kakata', 'Margibi'] },
      { id: 'nord-ouest', nom: 'Nord-Ouest (Lofa, Bong, Grand Cape Mount)', lieux: ['Lofa', 'Voinjama', 'Foya', '=Bong', 'Gbarnga', 'Grand Cape Mount', 'Bomi', 'Gbarpolu'] },
      { id: 'sud-est', nom: 'Sud-Est (Nimba, Grand Gedeh, Maryland)', lieux: ['Nimba', 'Ganta', 'Sanniquellie', 'Grand Gedeh', 'Zwedru', 'Maryland', 'Harper', 'River Gee', 'Sinoe', 'Grand Kru', 'Rivercess', 'Grand Bassa', 'Buchanan'] },
    ],
    CM: [
      { id: 'centre-sud', nom: 'Centre, Sud et Littoral (Yaoundé, Douala)', lieux: ['Yaoundé', 'Douala', 'Littoral', 'Edéa', 'Kribi', 'Ebolowa', 'Bertoua', 'Mbalmayo'] },
      { id: 'nord', nom: 'Grand Nord (Extrême-Nord, Nord, Adamaoua)', lieux: ['Extrême-Nord', 'Far North', 'Maroua', 'Mora', 'Kolofata', 'Mokolo', 'Kousséri', 'Garoua', 'Ngaoundéré', 'Adamaoua', 'Mayo-Tsanaga', 'Logone-et-Chari', 'Mayo-Sava'] },
      { id: 'nosoco', nom: 'Nord-Ouest et Sud-Ouest (régions anglophones)', lieux: ['Bamenda', 'Buea', 'Kumba', 'Limbe', 'Nord-Ouest', 'Sud-Ouest', 'North-West', 'South-West', 'Northwest', 'Southwest', 'Ambazonia', 'Ndop', 'Kumbo', 'Mamfe', 'NOSO'] },
      { id: 'ouest', nom: 'Ouest et Est', lieux: ['Bafoussam', 'Dschang', 'Foumban', 'Garoua-Boulaï', 'Batouri'] },
    ],
    TD: [
      { id: 'ndjamena', nom: 'N\'Djamena', lieux: ['N\'Djamena', 'Ndjamena'] },
      { id: 'lac', nom: '=Lac', lieux: ['=Lac', '=Bol', 'Baga Sola', 'Ngouboua', 'lac Tchad'] },
      { id: 'est', nom: 'Est (Ouaddaï, Sila, Wadi Fira)', lieux: ['Abéché', 'Adré', 'Ouaddaï', 'Sila', 'Goz Beïda', 'Wadi Fira', 'Biltine', 'Farchana'] },
      { id: 'nord', nom: 'Nord (Tibesti, Borkou, Ennedi)', lieux: ['Tibesti', 'Borkou', 'Ennedi', 'Faya', 'Faya-Largeau', 'Bardaï', '=Fada', 'Miski', 'Kouri Bougoudi'] },
      { id: 'sud', nom: 'Sud (Logone, Moyen-Chari, Mandoul)', lieux: ['Moundou', 'Sarh', 'Doba', 'Logone', 'Moyen-Chari', 'Mandoul', 'Mayo-Kebbi', 'Pala', 'Koumra'] },
    ],
    CD: [
      { id: 'kinshasa', nom: 'Kinshasa et Kongo-Central', lieux: ['Kinshasa', 'Kongo-Central', 'Matadi', 'Boma'] },
      { id: 'est', nom: 'Est (Nord-Kivu, Sud-Kivu, Ituri)', lieux: ['Nord-Kivu', 'North Kivu', 'Sud-Kivu', 'South Kivu', 'Ituri', 'Goma', 'Bukavu', 'Beni', 'Butembo', 'Bunia', 'Rutshuru', 'Masisi', 'Uvira', 'Djugu', 'Lubero', 'Walikale', 'Fizi', 'Minembwe', 'Kivu'] },
      { id: 'sud-est', nom: 'Sud-Est (Katanga, Kasaï)', lieux: ['Lubumbashi', 'Kolwezi', 'Haut-Katanga', 'Lualaba', 'Tanganyika', 'Kalemie', 'Haut-Lomami', 'Kasaï', 'Kananga', 'Mbuji-Mayi', 'Tshikapa', 'Katanga'] },
      { id: 'nord', nom: 'Nord et centre (Tshopo, Équateur, Uele)', lieux: ['Kisangani', 'Tshopo', 'Équateur', 'Mbandaka', 'Gemena', 'Bas-Uele', 'Haut-Uele', 'Isiro', 'Kwilu', 'Kikwit', 'Maï-Ndombe', 'Kwamouth'] },
    ],
    MZ: [
      { id: 'nord', nom: 'Nord (Cabo Delgado, Niassa, Nampula)', lieux: ['Cabo Delgado', 'Pemba', 'Palma', 'Mocímboa da Praia', 'Mocimboa', 'Macomia', 'Ancuabe', 'Muidumbe', 'Montepuez', 'Niassa', 'Lichinga', 'Nampula', 'Nacala', 'Memba', 'Eráti'] },
      { id: 'centre', nom: 'Centre (Sofala, Manica, Zambézia, Tete)', lieux: ['Beira', 'Sofala', 'Manica', 'Chimoio', 'Zambézia', 'Quelimane', 'Tete', 'Gorongosa'] },
      { id: 'sud', nom: 'Sud (Maputo, Gaza, Inhambane)', lieux: ['Maputo', 'Matola', 'Xai-Xai', 'Inhambane', 'Chókwè'] },
    ],
  };

  function sansAccents(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, '\'').toLowerCase();
  }
  function echapper(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Un motif par zone, compilé une fois : mot entier, sans accents. Un lieu
  // écrit « =Man » ne compte qu'avec sa majuscule : « Man », « Kong », « Wa »,
  // « San », « Plateau » sont aussi des mots courants (« man killed »,
  // « un plateau de télévision »).
  const MOTIFS = {};
  const plat = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, '\'');
  function motifZone(cy, z) {
    const k = cy + '|' + z.id;
    if (!MOTIFS[k]) {
      const motif = (l) => echapper(l).replace(/[\s-]+/g, '[\\s-]+');
      const souple = z.lieux.filter((l) => l[0] !== '=').map((l) => motif(sansAccents(l)));
      const strict = z.lieux.filter((l) => l[0] === '=').map((l) => motif(plat(l.slice(1))));
      MOTIFS[k] = {
        souple: souple.length ? new RegExp('(?:^|[^a-z0-9])(?:' + souple.join('|') + ')(?=$|[^a-z0-9])') : null,
        strict: strict.length ? new RegExp('(?:^|[^A-Za-z0-9])(?:' + strict.join('|') + ')(?=$|[^A-Za-z0-9])') : null,
      };
    }
    return MOTIFS[k];
  }
  function nomme(cy, z, t) {
    const m = motifZone(cy, z);
    return !!((m.souple && m.souple.test(' ' + sansAccents(t) + ' ')) || (m.strict && m.strict.test(' ' + plat(t) + ' ')));
  }

  function region(id) { return REGIONS.find((r) => r.id === id) || null; }
  function zonesDe(cy) { return (ZONES[cy] || []).map((z) => ({ id: z.id, nom: z.nom, lieux: z.lieux.map((l) => l.replace(/^=/, '')) })); }
  function zone(cy, id) { return (ZONES[cy] || []).find((z) => z.id === id) || null; }

  /**
   * La zone d'un fait, ou null : le titre d'abord, puis les textes cités, et
   * en dernier la ville notée par la page. Cette ville ne compte que pour un
   * lieu sans homonyme : la page l'a trouvée sans tenir compte de la casse,
   * et elle notait « Man » pour un article sur l'Allemagne (cumul de
   * novembre 2026).
   */
  function zoneDuFait(cy, f) {
    const zs = ZONES[cy] || [];
    if (!zs.length || !f) return null;
    const textes = [f.titreFr || f.titre, f.titre, f.resumeFr, f.resume, f.texteFr, f.texte]
      .concat((f.extraits || []).flatMap((e) => [e && e.resume, e && e.long]));
    for (const t of textes) {
      if (!t) continue;
      const z = zs.find((x) => nomme(cy, x, t));
      if (z) return z.id;
    }
    if (f.ville) {
      const z = zs.find((x) => { const m = motifZone(cy, x); return m.souple && m.souple.test(' ' + sansAccents(f.ville) + ' '); });
      if (z) return z.id;
    }
    return null;
  }

  const RANG_COTATION = { confirme: 0, probable: 1, non_confirme: 2 };
  const LIBELLE_COTATION = { confirme: 'Confirmé seulement', probable: 'Confirmé et Probable' };
  const LIBELLE_RUBRIQUE = { politique: 'Politique', humanitaire: 'Social', securite: 'Sécurité', divers: 'Divers' };

  /**
   * Les faits d'un pays qui passent les critères. `rubriqueDe` vient du
   * générateur (une seule règle de rubrique). Retourne aussi combien de faits
   * le filtre de zone a écartés faute de localité.
   */
  function filtrerFaits(faits, cy, c, rubriqueDe) {
    const crit = c || {};
    let sansLieu = 0;
    const garde = (faits || []).filter((f) => {
      if (crit.depuisMs && (f.publieMs || 0) < crit.depuisMs) return false;
      if (crit.cotation && RANG_COTATION[f.cotation || 'non_confirme'] > RANG_COTATION[crit.cotation]) return false;
      if (crit.rubriques && crit.rubriques.length && rubriqueDe && !crit.rubriques.includes(rubriqueDe(f))) return false;
      if (crit.zone && crit.zonePays === cy) {
        const z = zoneDuFait(cy, f);
        if (!z) { sansLieu++; return false; }
        if (z !== crit.zone) return false;
      }
      return true;
    });
    return { faits: garde, sansLieu };
  }

  const MAJ = (t) => String(t).toUpperCase();

  /**
   * Le périmètre transmis au générateur (voir perimetreModele dans
   * scripts/lib/rapport-grsci.js). `pays` : les données de chaque pays
   * ({ cy, nom, faits }, faits du mois déjà regroupés). Critères :
   *  - mode 'pays' : `cy`, `zone` facultative ;
   *  - mode 'region' : `region` (id de REGIONS) et `principal` facultatif
   *    (un pays mis en tête avec ses rubriques, comme la Côte d'Ivoire dans
   *    le modèle) ;
   *  - `rubriques`, `cotation`, `jours` (période), `max`, `jour` (fin).
   */
  function composer(pays, c, rubriqueDe) {
    const crit = Object.assign({}, c || {});
    const parCy = new Map((pays || []).map((d) => [d.cy, d]));
    const fin = crit.jour || new Date().toISOString().slice(0, 10);
    let debut = null;
    if (crit.jours) {
      const t = Date.parse(fin + 'T00:00:00Z') - (crit.jours - 1) * 86400000;
      const d0 = new Date(Math.max(t, Date.parse(fin.slice(0, 7) + '-01T00:00:00Z'))).toISOString().slice(0, 10);
      crit.depuisMs = Date.parse(d0 + 'T00:00:00Z');
      debut = d0;
    }
    const reg = crit.mode === 'region' ? region(crit.region) : null;
    const liste = crit.mode === 'region' ? (reg ? reg.pays : []) : [crit.cy];
    const z = crit.mode === 'pays' && crit.zone ? zone(crit.cy, crit.zone) : null;
    if (z) crit.zonePays = crit.cy;
    let sansLieu = 0;
    const retenus = [];
    const absents = [];
    for (const cy of liste) {
      const d = parCy.get(cy);
      if (!d) continue;
      const r = filtrerFaits(d.faits, cy, crit, rubriqueDe);
      sansLieu += r.sansLieu;
      const copie = Object.assign({}, d, { faits: r.faits });
      if (r.faits.length || cy === crit.principal || crit.mode === 'pays') retenus.push(copie);
      else absents.push(d.nom);
    }
    retenus.sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
    absents.sort((a, b) => String(a).localeCompare(String(b), 'fr'));

    const criteres = [];
    let libelle;
    let principal = null;
    let groupe = null;
    if (crit.mode === 'pays') {
      const d = retenus[0] || null;
      const nom = d ? d.nom : crit.cy;
      libelle = nom + (z ? ' — ' + z.nom.replace(/\s*\(.*\)$/, '') : '');
      criteres.push('Pays : ' + nom);
      if (z) criteres.push('Zone : ' + z.nom);
      if (d) principal = { d, titre: 'FAITS MARQUANTS — ' + MAJ(libelle), sommaire: 'FAITS MARQUANTS — ' + MAJ(libelle), image: crit.cy === 'CI' && !z ? 'carte-ci.jpg' : 'afrique.png' };
    } else {
      libelle = reg ? reg.nom : 'Région';
      criteres.push('Région : ' + libelle + ' (' + liste.length + ' pays)');
      const p = crit.principal ? retenus.find((d) => d.cy === crit.principal) : null;
      if (p) {
        principal = { d: p, titre: 'FAITS MARQUANTS — ' + MAJ(p.nom), sommaire: 'FAITS MARQUANTS — ' + MAJ(p.nom), image: p.cy === 'CI' ? 'carte-ci.jpg' : 'afrique.png' };
        criteres.push('Pays mis en tête : ' + p.nom);
      }
      groupe = { titre: MAJ(libelle), sommaire: MAJ(libelle), image: 'afrique.png', pays: retenus.filter((d) => d !== p) };
    }
    if (crit.rubriques && crit.rubriques.length && crit.rubriques.length < 4) criteres.push('Rubriques : ' + crit.rubriques.map((r) => LIBELLE_RUBRIQUE[r] || r).join(', '));
    if (crit.cotation && LIBELLE_COTATION[crit.cotation]) criteres.push('Cotation : ' + LIBELLE_COTATION[crit.cotation]);
    if (crit.jours) criteres.push('Période : ' + crit.jours + ' derniers jours');
    if (crit.max) criteres.push('Au plus ' + crit.max + ' actus par ' + (crit.mode === 'pays' ? 'rubrique' : 'pays'));
    if (z && sansLieu) criteres.push(sansLieu + ' actu' + (sansLieu > 1 ? 's' : '') + ' du pays sans localité précise, non retenue' + (sansLieu > 1 ? 's' : '') + ' par le filtre de zone');
    const total = retenus.reduce((n, d) => n + d.faits.length, 0);
    return { libelle, criteres, absents, max: crit.max || null, debut, principal, groupe, total, sansLieu };
  }

  return { REGIONS, ZONES, region, zonesDe, zone, zoneDuFait, filtrerFaits, composer, sansAccents };
}));
