// Merge two `drivers` rows that denote the same person (spec §13.1, Appendix A).
//
// Never called automatically: the UI lets a human pick the survivor. When run, it
//  1. repoints the loser's `mission_vehicles` to the survivor (keeping the
//     denormalised driver_name/driver_code in sync),
//  2. deletes the loser (done before any code re-assignment so its UNIQUE code frees up),
//  3. folds the loser's code(s) into the survivor (`code` if the survivor had none,
//     otherwise `alt_codes`).
//
// Takes an injected PostgREST-style client so the sequence is unit-testable with a
// mock (see `driversApi.merge` for the production call site).
export async function mergeDrivers(client, survivor, loser) {
  if (!survivor?.id || !loser?.id) throw new Error('mergeDrivers: missing driver id')
  if (survivor.id === loser.id) throw new Error('mergeDrivers: survivor and loser are the same driver')

  const survivorCode = survivor.code || null
  const loserCode = loser.code || null

  const alt = new Set((survivor.alt_codes || []).filter(Boolean))
  for (const c of loser.alt_codes || []) if (c) alt.add(c)
  if (loserCode && loserCode !== survivorCode) alt.add(loserCode)

  // 1. Repoint mission vehicles to the survivor.
  const { error: e1 } = await client
    .from('mission_vehicles')
    .update({
      driver_id: survivor.id,
      driver_name: survivor.name || loser.name || null,
      driver_code: survivorCode || loserCode,
    })
    .eq('driver_id', loser.id)
  if (e1) throw e1

  // 2. Drop the loser.
  const { error: e2 } = await client.from('drivers').delete().eq('id', loser.id)
  if (e2) throw e2

  // 3. Update the survivor: adopt the loser's code if it had none, record the rest.
  const patch = {}
  if (!survivorCode && loserCode) patch.code = loserCode
  const effectiveCode = patch.code || survivorCode
  const nextAlt = [...alt].filter((c) => c !== effectiveCode)
  if (nextAlt.length) patch.alt_codes = nextAlt

  if (Object.keys(patch).length) {
    const { error: e3 } = await client.from('drivers').update(patch).eq('id', survivor.id)
    if (e3) throw e3
  }

  return {
    survivorId: survivor.id,
    survivorName: survivor.name || loser.name || null,
    removedId: loser.id,
    code: effectiveCode,
    altCodes: patch.alt_codes || survivor.alt_codes || [],
  }
}
