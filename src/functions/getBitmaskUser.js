const { DateTime } = require("luxon");
const { resoudreEvenements, formaterEvenement } = require("./fetchEvenements");

const SLOT_MINUTES = 5

async function getBitmaskUser(evenements, windowStart, windowEnd, slotMin = SLOT_MINUTES) {
    

    const intervallesOccupes = evenements.map(e => {
        //l'evenement doit avoir ete formate auparavant

        const startDt = DateTime.fromISO(e.debut)
        const endDt = DateTime.fromISO(e.fin)
        return {
            start: Math.max(startDt.toMillis(), windowStart),
            end: Math.min(endDt.toMillis(), windowEnd)
        }
    });

    const mask = genererBitmask(intervallesOccupes, windowStart, windowEnd, slotMin);

    // Phase 2 : await cache.set(getCleCache(userId, windowStart, windowEnd), mask, ttl);
    return mask;
}

function genererBitmask(intervallesOccupes, windowStart, windowEnd, slotMin = SLOT_MINUTES) {
  const nbSlots = Math.ceil((windowEnd - windowStart) / (slotMin * 60000));
  const mask = new Uint8Array(nbSlots).fill(1); // 1 = libre par défaut

  for (const { start, end } of intervallesOccupes) {
    const i0 = Math.max(0, Math.floor((start - windowStart) / (slotMin * 60000))); //find occupee
    const i1 = Math.min(nbSlots, Math.ceil((end - windowStart) / (slotMin * 60000))); //find dispos
    for (let i = i0; i < i1; i++) mask[i] = 0; //fill with occupe
  }
  return mask;
}

function intersectMasks(masks) {
  const result = masks[0].slice();
  for (let m = 1; m < masks.length; m++) {
    for (let i = 0; i < result.length; i++) {
      result[i] &= masks[m][i];
    }
  }
  return result;
}

function maskToInterval(mask, windowStart, slotMin = SLOT_MINUTES) {
  const out = [];
  let start = null;
  for (let i = 0; i <= mask.length; i++) {
    const libre = i < mask.length && mask[i] === 1;
    if (libre && start === null) start = i;
    if (!libre && start !== null) {
      out.push({
        debut: windowStart + start * slotMin * 60000,
        fin: windowStart + i * slotMin * 60000
      });
      start = null;
    }
  }
  return out;
}

function findDisposFriend(evenementsAmi, eventStart, eventEnd, seuilRatio = 0.6, slotMin = SLOT_MINUTES) {
  const mask = genererBitmask(
    evenementsAmi.map(e => ({
      start: Math.max(DateTime.fromISO(e.debut, { zone: 'utc' }).toMillis(), eventStart),
      end: Math.min(DateTime.fromISO(e.fin, { zone: 'utc' }).toMillis(), eventEnd)
    })),
    eventStart, eventEnd, slotMin
  );

  const intervalles = maskToInterval(mask, eventStart, slotMin);
  const dureeEvent = eventEnd - eventStart;
  const seuilMs = dureeEvent * seuilRatio;

  return intervalles.filter(iv => (iv.fin - iv.debut) >= seuilMs);
}

module.exports = {getBitmaskUser, intersectMasks, maskToInterval, findDisposFriend}