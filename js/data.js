// Crowns of Asterra — static, data-driven definitions.
(function () {
  const A = (globalThis.A = globalThis.A || {});

  A.SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  A.CAPITAL = 'aurelion';
  A.WIN_PROVINCES = 18;
  A.RECOG_SEASONS = 8;
  A.RECOG_PROVINCES = 10;

  // Unit classes. cost = gold per recruited batch; gold/food = upkeep per 100 men per season.
  A.UNITS = {
    inf: { name: 'Infantry', glyph: 'I', batch: 100, cost: 30, gold: 3, food: 4, move: 2, power: 1.0, value: 1.0,
      desc: 'Reliable line troops. Holding infantry blunt cavalry charges and can escalade walls.' },
    arc: { name: 'Archers', glyph: 'A', batch: 100, cost: 40, gold: 4, food: 4, move: 2, power: 0.5, ranged: 0.75, range: 3, value: 1.1,
      desc: 'Volley from 2-3 tiles (4 from hills or walls). Weak in melee, poor against forest cover.' },
    cav: { name: 'Cavalry', glyph: 'C', batch: 100, cost: 75, gold: 7, food: 6, move: 4, power: 1.35, value: 1.8,
      desc: 'Fast. Charging 2+ tiles adds 40% damage; deadly to archers and siege crews, poor in forest and marsh.' },
    sie: { name: 'Siege crews', glyph: 'S', batch: 40, cost: 60, gold: 5, food: 2, move: 1, power: 0.25, ranged: 0.9, range: 4, value: 1.5,
      desc: 'Engines that batter walls from 4 tiles away. Nearly helpless in melee.' },
  };

  A.TERRAIN = {
    plains: { name: 'Plains', def: 1.0, mix: { forest: 0.1, hill: 0.08, marsh: 0 } },
    forest: { name: 'Forest', def: 1.15, mix: { forest: 0.4, hill: 0.05, marsh: 0.05 } },
    hills: { name: 'Hills', def: 1.15, mix: { forest: 0.1, hill: 0.35, marsh: 0 } },
    mountain: { name: 'Mountain', def: 1.25, mix: { forest: 0.1, hill: 0.45, marsh: 0 } },
    marsh: { name: 'Marsh', def: 1.1, mix: { forest: 0.1, hill: 0, marsh: 0.4 } },
    coast: { name: 'Coast', def: 1.0, mix: { forest: 0.05, hill: 0.05, marsh: 0.15 } },
  };

  A.RESOURCES = {
    iron: { name: 'Iron', note: 'Infantry cost 25% less to recruit here.' },
    horses: { name: 'Horses', note: 'Cavalry can always be raised here and cost 20% less.' },
    timber: { name: 'Timber', note: 'Siege crews can always be raised here and cost 30% less.' },
    grain: { name: 'Grain', note: 'Food production +50%.' },
    trade: { name: 'Trade', note: '+15 gold each season.' },
  };

  A.SEALS = {
    dawn: 'Seal of Dawn', dusk: 'Seal of Dusk', winds: 'Seal of Winds', tides: 'Seal of Tides', embers: 'Seal of Embers',
  };
  A.BEAST = 'Ilvareth the Starwyrm';
  A.SEAL_SITES = ['skyreach', 'hollowfen', 'stonecross', 'emberfall'];

  A.DIFF = {
    easy: { name: 'Squire', blurb: 'Rivals are poorer, cautious, and leave you alone for the first six seasons. +150 gold.', aiIncome: 0.85, threshold: 1.7, grace: 6, playerGold: 150 },
    normal: { name: 'Knight', blurb: 'An even contest. Rivals leave you alone for three seasons.', aiIncome: 1.0, threshold: 1.4, grace: 3, playerGold: 0 },
    hard: { name: 'Warlord', blurb: 'Rivals are richer, bolder, and strike from the first season.', aiIncome: 1.2, threshold: 1.2, grace: 0, playerGold: 0 },
  };

  // Factions. extra = starting troops added to the seat garrison.
  A.FACTIONS = [
    { id: 'val', name: 'House Valmere', short: 'Valmere', color: '#d2a52e', ink: '#3a2a00', ruler: 'isolde', seat: 'aurelion', gold: 520, food: 320, seals: ['dawn'],
      extra: {}, mix: ['inf', 'arc', 'inf', 'cav'], ai: { agg: 0.3, honor: 0.85 }, rating: 'Hard start',
      blurb: 'Regents of the empty throne. They hold the royal capital and the Seal of Dawn, with a full treasury and gifted envoys — but every rival road leads to their gates.' },
    { id: 'dra', name: 'House Drakenholt', short: 'Drakenholt', color: '#b23a2e', ink: '#fff', ruler: 'garrick', seat: 'frosthelm', gold: 300, food: 300, seals: [],
      extra: { inf: 300 }, mix: ['inf', 'inf', 'arc', 'cav'], ai: { agg: 0.8, honor: 0.6 }, rating: 'Easy start',
      blurb: 'Mountain dukes with the best generals in the realm and iron for cheap infantry. Secure northern seat; poor farmland and blunt diplomacy.' },
    { id: 'tho', name: 'House Thornwood', short: 'Thornwood', color: '#3d7f46', ink: '#fff', ruler: 'maelis', seat: 'elderglade', gold: 320, food: 340, seals: [],
      extra: { arc: 250 }, mix: ['arc', 'inf', 'arc', 'inf'], ai: { agg: 0.45, honor: 0.7 }, rating: 'Easy start',
      blurb: 'Forest wardens of the west. Deep woods favour their massed archers, and timber makes siege crews cheap. Balanced officers; far from the capital.' },
    { id: 'sun', name: 'House Sunmere', short: 'Sunmere', color: '#2f6aa8', ink: '#fff', ruler: 'caspian', seat: 'pearlhaven', gold: 480, food: 320, seals: [],
      extra: { sie: 40 }, mix: ['inf', 'arc', 'sie', 'cav'], ai: { agg: 0.4, honor: 0.6 }, rating: 'Moderate start',
      blurb: 'Merchant princes of the southern coast. The richest provinces and the finest diplomat in Asterra, but a modest army.' },
    { id: 'ash', name: 'House Ashgrave', short: 'Ashgrave', color: '#74489a', ink: '#fff', ruler: 'varek', seat: 'duskmire', gold: 320, food: 300, seals: ['dusk'],
      extra: { inf: 100, arc: 100 }, mix: ['inf', 'arc', 'inf', 'cav'], ai: { agg: 0.6, honor: 0.2 }, rating: 'Moderate start',
      blurb: 'Marsh counts who keep the Seal of Dusk in secret. Cunning officers and hard-to-assault fens; distrusted by nearly everyone.' },
    { id: 'sto', name: 'House Stormcrest', short: 'Stormcrest', color: '#2a8f86', ink: '#fff', ruler: 'brynja', seat: 'galehaven', gold: 300, food: 320, seals: [],
      extra: { cav: 250 }, mix: ['cav', 'inf', 'cav', 'arc'], ai: { agg: 0.7, honor: 0.5 }, rating: 'Moderate start',
      blurb: 'Riders of the north-eastern highlands. Horse country gives them cheap, plentiful cavalry — superb in open fields, clumsy against walls.' },
  ];
  A.FDEF = {};
  A.FIDS = A.FACTIONS.map((f) => ((A.FDEF[f.id] = f), f.id));
  A.fname = (f) => (f && A.FDEF[f] ? A.FDEF[f].name : 'the Free Folk');
  A.fcolor = (f) => (f && A.FDEF[f] ? A.FDEF[f].color : '#9a8f78');

  // id, name, terrain, x, y, owner, prosperity, farms, fort, resource, landmark
  A.PROV_DEF = [
    ['frosthelm', 'Frosthelm', 'mountain', 300, 80, 'dra', 48, 38, 3, null, null],
    ['ironvale', 'Ironvale', 'hills', 170, 160, 'dra', 45, 40, 1, 'iron', null],
    ['greywatch', 'Greywatch', 'hills', 430, 150, 'dra', 42, 45, 2, null, null],
    ['skyreach', 'Skyreach', 'mountain', 570, 75, null, 30, 28, 2, null, 'Sky Altar'],
    ['windmere', 'Windmere', 'plains', 700, 125, 'sto', 46, 55, 1, 'horses', null],
    ['galehaven', 'Galehaven', 'hills', 860, 80, 'sto', 50, 42, 3, null, null],
    ['highmoor', 'Highmoor', 'plains', 880, 215, 'sto', 40, 52, 1, null, null],
    ['elderglade', 'Elderglade', 'forest', 85, 300, 'tho', 50, 50, 3, null, null],
    ['mossford', 'Mossford', 'forest', 215, 265, 'tho', 44, 48, 1, 'timber', null],
    ['briarwick', 'Briarwick', 'forest', 150, 420, 'tho', 42, 52, 1, null, null],
    ['hollowfen', 'Hollowfen', 'marsh', 295, 375, null, 28, 35, 1, null, 'Sunken Shrine'],
    ['aurelion', 'Aurelion', 'plains', 500, 330, 'val', 70, 55, 3, null, 'Crown Vault'],
    ['kingsfield', 'Kingsfield', 'plains', 400, 255, 'val', 52, 70, 1, 'grain', null],
    ['goldbridge', 'Goldbridge', 'plains', 575, 440, 'val', 58, 50, 1, 'trade', null],
    ['stonecross', 'Stonecross', 'hills', 630, 250, null, 36, 38, 1, null, "Old King's Cairn"],
    ['lanternford', 'Lanternford', 'plains', 400, 455, null, 38, 50, 1, null, null],
    ['duskmire', 'Duskmire', 'marsh', 905, 400, 'ash', 48, 44, 3, null, null],
    ['ravenmoor', 'Ravenmoor', 'marsh', 775, 330, 'ash', 40, 46, 1, null, null],
    ['cindermarch', 'Cindermarch', 'hills', 805, 500, 'ash', 44, 40, 2, 'iron', null],
    ['emberfall', 'Emberfall', 'hills', 700, 590, null, 30, 30, 1, null, 'Star Crater'],
    ['pearlhaven', 'Pearlhaven', 'coast', 450, 620, 'sun', 60, 48, 3, null, null],
    ['tidewater', 'Tidewater', 'coast', 300, 560, 'sun', 48, 56, 1, null, null],
    ['coralport', 'Coralport', 'coast', 585, 605, 'sun', 55, 42, 1, 'trade', null],
    ['dunmarrow', 'Dunmarrow', 'plains', 170, 545, null, 34, 54, 1, null, null],
  ];
  A.PROV_ORDER = A.PROV_DEF.map((p) => p[0]);

  A.EDGES = [
    ['frosthelm', 'ironvale'], ['frosthelm', 'greywatch'], ['ironvale', 'mossford'], ['greywatch', 'kingsfield'],
    ['greywatch', 'skyreach'], ['skyreach', 'windmere'], ['skyreach', 'stonecross'], ['windmere', 'galehaven'],
    ['windmere', 'highmoor'], ['galehaven', 'highmoor'], ['windmere', 'stonecross'], ['highmoor', 'ravenmoor'],
    ['elderglade', 'mossford'], ['elderglade', 'briarwick'], ['mossford', 'kingsfield'], ['mossford', 'hollowfen'],
    ['briarwick', 'hollowfen'], ['briarwick', 'dunmarrow'], ['hollowfen', 'lanternford'], ['hollowfen', 'kingsfield'],
    ['kingsfield', 'aurelion'], ['aurelion', 'stonecross'], ['aurelion', 'goldbridge'], ['aurelion', 'lanternford'],
    ['stonecross', 'ravenmoor'], ['ravenmoor', 'duskmire'], ['ravenmoor', 'goldbridge'], ['duskmire', 'cindermarch'],
    ['cindermarch', 'goldbridge'], ['cindermarch', 'emberfall'], ['emberfall', 'coralport'], ['coralport', 'goldbridge'],
    ['coralport', 'pearlhaven'], ['pearlhaven', 'lanternford'], ['pearlhaven', 'tidewater'], ['tidewater', 'lanternford'],
    ['tidewater', 'dunmarrow'], ['lanternford', 'goldbridge'],
  ];

  // id, name, faction, leadership, administration, diplomacy, loyalty, trait, bio
  A.OFFICER_DEF = [
    ['isolde', 'Regent Isolde Valmere', 'val', 52, 88, 85, 100, 'Prudent', 'Keeper of the empty throne for eleven years. She trusts ledgers over lances and has never lost a negotiation she chose to begin.'],
    ['corwin', 'Ser Corwin Hale', 'val', 76, 45, 40, 86, 'Steadfast', 'Captain of the Crown Guard. Plain-spoken, immovable, and convinced the capital can be held against anyone.'],
    ['pell', 'Chancellor Odran Pell', 'val', 25, 90, 70, 68, 'Schemer', 'He can find gold in an empty vault and a loophole in any oath. Whether he serves the Regent or himself is an open question.'],
    ['lysa', 'Lysa Merrow', 'val', 56, 60, 78, 76, 'Idealist', 'A young envoy who believes the realm can be mended with words. She has been right more often than the generals admit.'],

    ['garrick', 'Duke Garrick Drakenholt', 'dra', 92, 48, 35, 100, 'Warlike', 'The Iron Duke has won every pitched battle he has fought and resents every season spent not fighting one.'],
    ['hilda', 'Hilda Ironbrow', 'dra', 80, 40, 30, 88, 'Steadfast', "Garrick's shield-captain since the border wars. She holds a line the way a mountain holds snow."],
    ['torvald', 'Torvald Kessk', 'dra', 68, 55, 45, 58, 'Ambitious', 'A capable marcher lord who counts the days until a Drakenholt makes a mistake he can profit from.'],
    ['anselm', 'Brother Anselm', 'dra', 30, 78, 66, 80, 'Pious', 'Quartermaster-monk of Frosthelm. Feeds armies on stone soup and prayer, and somehow they march.'],

    ['maelis', 'Lady Maelis Thornwood', 'tho', 70, 75, 68, 100, 'Patient', 'Warden of the western woods. She plants oaks she will never see grown and plans wars the same way.'],
    ['fenn', 'Fenn Quickarrow', 'tho', 82, 35, 50, 82, 'Bold', 'Master of the greenwood bows. He has never met a formation he did not want to shoot from a tree line.'],
    ['oswin', 'Oswin Barkwright', 'tho', 40, 85, 55, 78, 'Steadfast', 'Steward of mills and timber roads. Provinces prosper under him and nobody quite notices why.'],
    ['rhosyn', 'Rhosyn Vael', 'tho', 60, 50, 80, 62, 'Ambitious', 'A silver-tongued cousin of the house who thinks the wrong Thornwood sits in Elderglade.'],

    ['caspian', 'Prince Caspian Sunmere', 'sun', 58, 80, 90, 100, 'Charming', 'He has dined with every ruler in Asterra and owes money to none of them. The coast adores him.'],
    ['dario', 'Admiral Dario Venn', 'sun', 78, 50, 55, 80, 'Bold', 'Commander of the pearl fleet turned reluctant land general. Thinks of every battlefield as a harbour to be taken.'],
    ['mirelle', 'Mirelle Saltwind', 'sun', 35, 88, 75, 72, 'Prudent', 'Mistress of the counting houses. Knows the price of grain in every market and the price of every councillor.'],
    ['jorah', 'Jorah Tidecaller', 'sun', 66, 45, 40, 56, 'Mercenary', 'A sellsword captain on a long contract. Brave enough, as long as the pay arrives before the enemy does.'],

    ['varek', 'Count Varek Ashgrave', 'ash', 75, 65, 72, 100, 'Treacherous', 'Smiles in council, sharpens knives at home. He has kept the Seal of Dusk hidden for twenty years.'],
    ['nyx', 'Nyx Sablethorn', 'ash', 70, 40, 82, 70, 'Schemer', 'Spymistress of the fens. Half the rumours in the realm begin with her and the other half end with her.'],
    ['grum', 'Grum Bogwarden', 'ash', 84, 30, 20, 85, 'Steadfast', 'A giant of the marsh levy who speaks in grunts and wins with ambushes.'],
    ['edda', 'Edda Veil', 'ash', 45, 80, 60, 62, 'Prudent', 'Keeper of the Duskmire archives. She knows what the seals truly do and would rather nobody used them.'],

    ['brynja', 'Warden Brynja Stormcrest', 'sto', 88, 55, 50, 100, 'Bold', 'First rider of the highlands. She took her seat by riding down three rivals in one morning.'],
    ['ulric', 'Ulric Farrider', 'sto', 85, 30, 35, 80, 'Warlike', 'Leads the vanguard horse. Has outrun every supply train ever assigned to him.'],
    ['sene', 'Sene Cloudreader', 'sto', 40, 72, 85, 76, 'Pious', 'Sky-priestess and envoy. Reads omens in the wind, and treaties in the pauses between words.'],
    ['hakon', 'Hakon Two-Rivers', 'sto', 66, 62, 48, 60, 'Ambitious', 'A clan chief who joined the Stormcrests late and reminds them of it often.'],
  ];

  // Wanderers who may offer their service through events.
  A.WANDERER_DEF = [
    ['tamsin', 'Tamsin Greaves', null, 79, 52, 44, 60, 'Bold', 'A captain cashiered for winning a battle she was ordered to lose. Looking for a banner worth following.'],
    ['ibram', 'Master Ibram Zoll', null, 28, 92, 70, 65, 'Prudent', 'An exiled treasurer who balanced the books of three courts and was thanked by none.'],
    ['kestrel', 'Kestrel Dane', null, 62, 48, 88, 58, 'Charming', 'A wandering herald who knows every house motto and every house scandal.'],
    ['bors', 'Old Bors the Unbowed', null, 86, 25, 30, 70, 'Steadfast', 'A grey veteran of the last royal host. Says he has one more campaign in him.'],
  ];

  A.START_REL = [['val', 'sun', 15], ['dra', 'sto', -15], ['ash', 'val', -20], ['tho', 'dra', -10], ['sun', 'ash', -5], ['tho', 'sun', 10], ['sto', 'ash', -5]];
})();
