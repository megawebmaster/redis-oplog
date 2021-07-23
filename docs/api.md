# API

## Setup

- `collection.startCaching(timeout)`: Sets up the database to start caching all documents that are seen through any DB
  `findOne`, `find`, `insert` and `update`. If `timeout` is provided it overrides `cacheTimeout` from settings
- `collection.disableRedis()`:  No updates are sent to redis from this collection **ever**, even if you set
  `{ pushToRedis: true }`
- `collection.disableDiff()`: No diff-ing occurs on `update` (and `upsert`), see section above on **Skipping Diffs**
- `collection.setRaceFieldsToIgnore(['updatedAt'])`: Defines fields to be ignored by the race conditions detector, see
  section on **Race Conditions Detector** in [Reading from secondary DB nodes](secondary_reads.md)

## Watchers API - See Watchers section above

- `addToWatch(collectionName, channelName)`
- `removeFromWatch(collectionName, channelName)`
- `dispatchInsert(collectionName, channelName, doc)`: Note that `doc` **has** to include `_id`
- `dispatchUpdate(collectionName, channelName, doc)`: Note that `doc` **has** to include `_id`
- `dispatchRemove(collectionName, channelName, docId)`
- `dispatchRemove(collectionName, channelName, [docId1, docId2, ...])`

## Internal API - Normally you don't need to know this

- `collection.getCache(id):<Object>`: Normally you would use `findOne`
- `collection.hasCache(id):Boolean`
- `collection.setCache(doc)`: Use carefully, as it overrides the entire doc, normally you would use `update`
- `collection.deleteCache(id or doc)`: Normally you would use `remove`
- `collection.clearCache(selector)`: Removes from cache all docs that match selector; if selector is empty clears the
  whole cache
