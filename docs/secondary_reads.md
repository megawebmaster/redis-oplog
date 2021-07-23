# Reading from secondary DB nodes

If you don't set `secondaryReads` to a Boolean value (`true`/`false`) we parse your `MONGO_URL`.

This functionality affects two things:

1. Forces default strategy for limits (see below)
2. Automatically enables race conditions detection if `raceDetection` is `null` (set to `null` useful if you want the
   same settings.json in development as in production)

## Race Conditions Detector

> You will see in your server logs `RedisOplog: RaceDetectionManager started` when it starts up

Given we are counting on internal caching (and potentially secondary reads) this detector is very important. It reads
from your primary DB node (if you are reading from secondary nodes we will create a connector to your primary DB node)
to fetch a clean copy of the document in the case where data is changing too fast to guarantee the cache is accurate.
Observers will be triggered for changed values.

The setting `raceDetectionDelay` value is important, we check within that time window if the same fields were affected
by a prior mutation. If so, we get the doc from the primary DB node. A crude collision detector is in place to prevent
multiple meteor instances from making the same fetch call to the DB. The one that does make the call to the DB will
update all the other meteor nodes.

You will get a warning in the console like
this: `Redios-Oplog: Potential race condition users-<_ID> [updatedAt, password]`
which will indicate that we caught a potential race condition and are handling it (set `debug` to true to see the
sequence of events)

> If you are facing weird data issues and suspect we are not catching all race conditions, set `raceDetectionDelay` to
> a very large value then see if that fixes it and watch your logs, you can then tweak the value for your setup

If you have fields that change often and you don't care about their value (e.g. `updatedAt`) you can disable race
detection on these fields on the server at startup: `this.collection.setRaceFieldsToIgnore(['updatedAt'])`

## Forcing default update strategy -- (e.g. when using limits in cursors)

When a cursor has option `{limit:n}` redis-oplog has to query the DB at each change to get the current `n` valid
documents. This is a killer in DB and app performance and often unnecessary from the client-side. You can disable this
re-querying of the DB by forcing the `default` strategy

`collection.find({selector:value},{limit:n, sort:{...}, default:true} )`

This will run the first query from the DB with the limit and sort (and get `n` documents), but then behaves as a regular
`find` from that point on (i.e. inserts, updates and removes that match the selector will trigger normal reactivity).
This is likely to be sufficient most of the time. If you are reading from secondary DB nodes without this change, you
WILL hit race conditions; you have updated the primary db node and are re-querying right away before secondaries get the
data updates.

> When `secondaryReads` is `true`, the default strategy is enabled automatically for queries with `limit`, you don't
> have to do anything
