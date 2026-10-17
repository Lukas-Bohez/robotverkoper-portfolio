import type { Migration } from '../migration.interface.js'

/**
 * A defect used to have a stored `status` (open, replaced, closed) and an `id` of its own. Now the status follows
 * from what happened to the defect (who took it, whether the technician arrived, how it was resolved), and a defect
 * carries the information a technician needs: the condition of the robot, where it stands, the safety check, and
 * the call for a technician. This migration moves the old documents to the new shape.
 */
const migration: Migration = {
  id: 4,
  description:
    'Defects: the status is worked out; condition, place, technician, safety check and soft delete',
  async up(db) {
    const defects = db.collection('defects')

    // How it was resolved: the old status said it
    await defects.updateMany(
      { status: 'closed', resolution: { $exists: false } },
      { $set: { resolution: 'repaired' } },
    )
    await defects.updateMany(
      { status: 'replaced', resolution: { $exists: false } },
      { $set: { resolution: 'replaced' } },
    )

    // The fields that are new: nobody took the old defects, and nobody knows more about them
    const empty = {
      assignedTo: null,
      claimedAt: null,
      onSiteAt: null,
      checklistDone: [],
      resolution: null,
      resolvedBy: null,
      resolutionNote: null,
      condition: null,
      location: null,
      callRequestedAt: null,
      calledBy: null,
      helpRequestedAt: null,
      coldAt: null,
      deletedAt: null,
    }
    for (const [field, value] of Object.entries(empty)) {
      await defects.updateMany({ [field]: { $exists: false } }, { $set: { [field]: value } })
    }

    // The indexes on the old status and the old id go first (a unique index on a removed field treats it as null, so
    // removing `id` from a second defect would collide with the first one)
    for (const name of ['defects_id', 'defects_status']) {
      try {
        await defects.dropIndex(name)
      } catch {
        // The index is not there: nothing to drop
      }
    }
    // The old status and the id of its own are gone: the document id (`_id`) is the id now
    await defects.updateMany({}, { $unset: { status: '', id: '' } })

    await defects.createIndex({ robotId: 1, resolvedAt: 1 }, { name: 'defects_robot' })
    await defects.createIndex({ assignedTo: 1, resolvedAt: 1 }, { name: 'defects_technician' })
    await defects.createIndex({ coldAt: 1, createdAt: -1 }, { name: 'defects_cold' })
  },
}

export default migration
