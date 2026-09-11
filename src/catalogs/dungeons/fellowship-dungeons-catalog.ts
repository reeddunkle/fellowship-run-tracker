type FellowshipDungeonDefinition = {
  readonly dungeonId: string;
  readonly mapId: string;
  readonly name: string;
};

export const FELLOWSHIP_DUNGEON = {
  CITHRELS_FALL: {
    dungeonId: "7",
    mapId: "1",
    name: "Cithrel's Fall",
  },
  EMPYREAN_SANDS: {
    dungeonId: "6",
    mapId: "27",
    name: "Empyrean Sands",
  },
  EVERDAWN_GROVE: {
    dungeonId: "11",
    mapId: "26",
    name: "Everdawn Grove",
  },
  GODFALL_QUARRY: {
    dungeonId: "25",
    mapId: "32",
    name: "Godfall Quarry",
  },
  HEART_OF_TUZARI: {
    dungeonId: "5",
    mapId: "6",
    name: "The Heart of Tuzari",
  },
  RANSACK_OF_DRAKHEIM: {
    dungeonId: "23",
    mapId: "17",
    name: "Ransack of Drakheim",
  },
  RUINS_OF_REGATH: {
    dungeonId: "29",
    mapId: "35",
    name: "Ruins of Regath",
  },
  SAILORS_ABYSS: {
    dungeonId: "15",
    mapId: "24",
    name: "Sailor's Abyss",
  },
  SCRYERS_PEAK: {
    dungeonId: "31",
    mapId: "37",
    name: "Scryer's Peak",
  },
  SILKEN_HOLLOW: {
    dungeonId: "24",
    mapId: "30",
    name: "Silken Hollow",
  },
  STORMWATCH: {
    dungeonId: "12",
    mapId: "20",
    name: "Stormwatch",
  },
  URRAK_MARKETS: {
    dungeonId: "21",
    mapId: "29",
    name: "Urrak Markets",
  },
  // WOODLAND_GLADE: {
  //   dungeonId: "28",
  //   mapId: null,
  //   name: "Woodland Glade",
  // },
  WRAITHTIDE_VAULT: {
    dungeonId: "13",
    mapId: "10",
    name: "Wraithtide Vault",
  },
  WYRMHEART: {
    dungeonId: "8",
    mapId: "22",
    name: "Wyrmheart",
  },
  XUL_THE_BLOOD_MONOLITH: {
    dungeonId: "30",
    mapId: "38",
    name: "Xul, The Blood Monolith",
  },
} as const satisfies Record<string, FellowshipDungeonDefinition>;

// type FellowshipDungeonKey = keyof typeof FELLOWSHIP_DUNGEON;

// type FellowshipDungeon =
//   (typeof FELLOWSHIP_DUNGEON)[FellowshipDungeonKey];
