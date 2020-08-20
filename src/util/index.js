const nbt = require('prismarine-nbt');
const util = require('util');

const constants = require('../constants');

const parseNbt = util.promisify(nbt.parse);

function removeFormatting(i) {
  return i.replace(/§./g, '');
}

async function decodeData(buffer) {
  const parsedNbt = await parseNbt(buffer);
  return nbt.simplify(parsedNbt);
}

function getNestedObjects(object = {}, pathString = '') {
  const path = pathString.split('.');
  for (let i = 0; i < path.length; i += 1) {
    if (object[path[i]] === undefined) {
      return false;
    }
    // eslint-disable-next-line no-param-reassign
    object = object[path[i]];
  }
  return object;
}

function fromEntries(array) {
  return array.reduce((object, [key, value]) => {
    // eslint-disable-next-line no-param-reassign
    object[key] = value;
    return object;
  }, {});
}

/*
 * Pick certain keys from obj.
 *
 * Options:
 *    regexp: A regex object that the keys must pass.
 *        Defaults to .*
 *    filter: A function that is passed both the key
 *        and value, and returns a boolean. Defaults
 *        to (() => true).
 *    keyMap: A function that remaps all keys that
 *        pass the above two tests. Defaults to
 *        (key => key).
 *    valueMap: Same as keyMap, but for the values.
 */
function pickKeys(object, options) {
  const regexp = options.regexp || /.+/;
  const filter = options.filter || (() => true);
  const keyMap = options.keyMap || ((key) => key);
  const valueMap = options.valueMap || ((value) => value);

  return fromEntries(Object.entries(object)
    .filter(([key, value]) => regexp.test(key) && filter(key, value))
    .map(([key, value]) => [keyMap(key), valueMap(value)]));
}

function removeZeroes(object = {}) {
  const newObject = {};
  Object.keys(object).forEach((entry) => {
    const value = object[entry];
    if (value !== 0) {
      newObject[entry] = value;
    }
  });
  return newObject;
}

function getLevelByXp(xp = 0, runecrafting) {
  const xpTable = runecrafting ? constants.runecraftingXp : constants.levelingXp;
  if (Number.isNaN(xp)) {
    return {
      xp: 0,
      level: 0,
      xpCurrent: 0,
      xpForNext: xpTable[1],
      progress: 0,
    };
  }

  let xpTotal = 0;
  let level = 0;
  let xpForNext = Infinity;
  const maxLevel = Object.keys(xpTable)
    .sort((a, b) => Number(a) - Number(b))
    .map((a) => Number(a))
    .pop();

  for (let x = 1; x <= maxLevel; x += 1) {
    xpTotal += xpTable[x];
    if (xpTotal > xp) {
      xpTotal -= xpTable[x];
      break;
    } else {
      level = x;
    }
  }

  const xpCurrent = Math.floor(xp - xpTotal);
  if (level < maxLevel) xpForNext = Math.ceil(xpTable[level + 1]);
  const progress = Math.max(0, Math.min(xpCurrent / xpForNext, 1)).toFixed(2);

  return {
    xp,
    level,
    maxLevel,
    xpCurrent,
    xpForNext,
    progress,
  };
}

function getSlayerLevel(slayer, slayerName) {
  const { xp, claimedLevels } = slayer;
  let progress;
  let xpForNext = 0;

  const maxLevel = Math.max(Object.keys(constants.slayerXp[slayerName]).length);
  const currentLevel = Object.keys(claimedLevels).length;
  if (currentLevel < maxLevel) {
    const nextLevel = constants.slayerXp[slayerName][currentLevel + 1];

    progress = xp / nextLevel;
    xpForNext = nextLevel;
  } else {
    progress = 1;
  }

  return {
    currentLevel, xp, maxLevel, progress, xpForNext,
  };
}

function getPetLevel(pet) {
  const rarityOffset = constants.petRarityOffset[pet.rarity];
  const levels = constants.petLevels.slice(rarityOffset, rarityOffset + 99);

  const xpMaxLevel = levels.reduce((a, b) => a + b, 0);
  let xpTotal = 0;
  let level = 1;

  let xpForNext;

  for (let i = 0; i < 100; i += 1) {
    xpTotal += levels[i];

    if (xpTotal > pet.exp) {
      xpTotal -= levels[i];
      break;
    } else {
      level += 1;
    }
  }

  let xpCurrent = Math.floor(pet.exp - xpTotal);
  let progress;

  if (level < 100) {
    xpForNext = Math.ceil(levels[level - 1]);
    progress = Math.max(0, Math.min(xpCurrent / xpForNext, 1));
  } else {
    level = 100;
    xpCurrent = pet.exp - levels[99];
    xpForNext = 0;
    progress = 1;
  }

  return {
    level,
    xpCurrent,
    xpForNext,
    progress,
    xpMaxLevel,
  };
}

function getBonusStat(level, skill, max, incrementation) {
  const skillStats = constants.bonus_stats[skill];
  const steps = Object.keys(skillStats)
    .sort((a, b) => a - b)
    .map((a) => Number(a));

  const bonus = { ...constants.statTemplate };

  for (let x = steps[0]; x <= max; x += incrementation) {
    if (level < x) break;

    const skillStep = steps.slice().reverse().find((a) => a <= x);

    const skillBonus = skillStats[skillStep];

    Object.keys(skillBonus).forEach((key) => {
      bonus[key] += skillBonus[key];
    });
  }

  return bonus;
}

module.exports = {
  removeFormatting,
  removeZeroes,
  decodeData,
  getNestedObjects,
  pickKeys,
  getLevelByXp,
  getSlayerLevel,
  getPetLevel,
  getBonusStat,
};
