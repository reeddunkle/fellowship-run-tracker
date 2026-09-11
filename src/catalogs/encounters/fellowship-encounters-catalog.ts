type FellowshipEncounterDefinition = {
  readonly dungeonId: string;
  readonly encounterId: string;
  readonly name: string;
};

export const FELLOWSHIP_ENCOUNTER = {
  "1": {
    dungeonId: "7",
    encounterId: "1",
    name: "Noor",
  },
  "2": {
    dungeonId: "7",
    encounterId: "2",
    name: "Ancient Koros",
  },
  "3": {
    dungeonId: "7",
    encounterId: "3",
    name: "Cithrel",
  },
  "10": {
    dungeonId: "5",
    encounterId: "10",
    name: "Moar'gore, Master of Sacrifice",
  },
  "11": {
    dungeonId: "5",
    encounterId: "11",
    name: "Vun'Kahr, the Thorned Maw",
  },
  "12": {
    dungeonId: "5",
    encounterId: "12",
    name: "Prophet Ez'rath",
  },
  "13": {
    dungeonId: "13",
    encounterId: "13",
    name: "First Mate Marrow",
  },
  "14": {
    dungeonId: "13",
    encounterId: "14",
    name: "Bael'Aurum",
  },
  "15": {
    dungeonId: "13",
    encounterId: "15",
    name: "Deathless Katrine",
  },
  "20": {
    dungeonId: "23",
    encounterId: "20",
    name: "Fodir Kaldur",
  },
  "21": {
    dungeonId: "23",
    encounterId: "21",
    name: "Chilgar the Drowned",
  },
  "22": {
    dungeonId: "23",
    encounterId: "22",
    name: "Auga Handhafi",
  },
  "26": {
    dungeonId: "12",
    encounterId: "26",
    name: "Warlord Brogg",
  },
  "27": {
    dungeonId: "8",
    encounterId: "27",
    name: "Apostate Veras",
  },
  "28": {
    dungeonId: "15",
    encounterId: "28",
    name: "Sinthara",
  },
  "30": {
    dungeonId: "11",
    encounterId: "30",
    name: "Malgut the Fetid",
  },
  "31": {
    dungeonId: "6",
    encounterId: "31",
    name: "Sin-Magir",
  },
  "32": {
    dungeonId: "21",
    encounterId: "32",
    name: "Drazhul the Fleshbroker and Slavetrader Brull",
  },
  "33": {
    dungeonId: "24",
    encounterId: "33",
    name: "Vexira",
  },
  "34": {
    dungeonId: "25",
    encounterId: "34",
    name: "Godfall Titan",
  },
  "35": {
    dungeonId: "29",
    encounterId: "35",
    name: "Xurath",
  },
  "36": {
    dungeonId: "31",
    encounterId: "36",
    name: "Varux",
  },
} as const satisfies Record<string, FellowshipEncounterDefinition>;

// type FellowshipEncounterKey = keyof typeof FELLOWSHIP_ENCOUNTER;

// type FellowshipEncounter =
//   (typeof FELLOWSHIP_ENCOUNTER)[FellowshipEncounterKey];
