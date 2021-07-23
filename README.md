# Welcome to the Redis Oplog

**Note**: This a clone of the scalable [redis-oplog](https://github.com/ramezrafla/redis-oplog) to make it work with
Redis Sentinel. It has more streamlined docs and is published as `megawebmaster:redis-oplog` in version 4.x to
AtmosphereJS.

### Difference from `zegenie:redis-oplog`

This package uses `ioredis` as its Redis client which has full support of Redis including Sentinel. Thanks to that you
can achieve high availability of Redis cluster and configure connection to your needs.

### LICENSE: MIT

## First a Word of Thanks

[Theo](https://github.com/theodorDiaconu) has done the community a great service with redis-oplog. It has become a
cornerstone of any major deployment of Meteor. This clone is a major improvement for highly / infinitely scalable Meteor
apps. It does have less features (no Vent or SyntheticEvent) as it is optimized for a specific use-case that the
original redis-oplog failed to address. We understand we are not the target audience so are grateful for the starting
point.

## Problem Statement

We were facing three major issues with the original redis-oplog

1. We faced major issues with redis-oplog in production on AWS Elatic-Beanstalk, out-of-memory & disconnects from redis.
   After some research we found that redis-oplog duplicates data (2x for each observer) and re-duplicates for each new
   observer (even if it's the same collection and same data)
2. DB hits were killing us, each update required multiple hits to update the data then pull it again. This is also
   another major negative -- not scalable and slow. The approach of keeping pulling from DB to get around the very rare
   race condition is unsustainable.
3. We want to read from MongoDB secondaries to scale faster. The only way to properly scale with the current redis-oplog
   is (very) costly sharding.

In addition, the code was becoming complex and hard to understand (with dead code and need for optimization). This is
owing to many hands getting involved and its aim to cover as many use cases as possible.**Such an important
building-block for us had to be easily maintainable**.

## What we did

This version of redis-oplog is more streamlined:

- Uses a single central timed cache at the collection-level, which is also the same place that provides data for
  `findOne` / `find` -- so full data consistency within the app
- Uses redis to transmit changed (and cleared) fields (we do an actual diff) to other meteor instance caches --
  consistency again and reduction of db hits as the meteor instances are 'helping' each other out
- During `update`, we mutate the cache and send the changed (and cleared) fields to the DB and redis -- instead of the
  current find, update, then find again which has 2 more hits than needed (which also slows down the application)
- During `insert`, we build the doc and send it via redis to other instances
- During `remove`, we send the ids to be removed to other instances
- We use secondary DB reads in our app. If you have more reads --> spin up more secondaries (Note: You don't have to use
  secondaries, just know that this package makes it possible)
- Optimized data sent via redis, only what REALLY changed
- Added **Watchers** and **dynamic docs** (see advanced section below)
- Added internal support for `collection-hooks` when caching (see Collection-hooks section below)
- Added a race conditions detector which queries the DB (master node) and updates its cache (read below)

In other words, this is not a Swiss-Army knife, it is made for a very specific purpose: **scalable read-intensive
real-time application**

## Results

- We reduced the number of meteor instances by 3x
- No more out of memory and CPU spikes in Meteor -- more stable loads which slowly goes up with number of users
- Faster updates (including to client) given fewer DB hits and less data sent to redis (and hence, the other meteor
  instances' load is reduced)
- We substantially reduced the load on our DB instances -- from 80% to 7% on primary (secondaries went up a bit, which
  is fine as they were idle anyway)

## Installation

```
meteor add megawebmaster:redis-oplog
```

**Important**: Make sure `megawebmaster:redis-oplog` is at the top of your `.meteor/packages` file

Configure it via Meteor settings:

```
// settings.json
{
    ...
    "redisOplog": {}
}

// default full configuration
{
  ...
  "redisOplog": {
    "redis": {
      "port": 6379, // Redis port
      "host": "127.0.0.1" // Redis host
    },
    "retryIntervalMs": 1000, // Retries in 1 second to reconnect to redis if the connection failed
    "mutationDefaults": {
        "optimistic": true, // Does not do a sync processing on the diffs. But it works by default with client-side mutations.
        "pushToRedis": true // Pushes to redis the changes by default
    },
    "cacheTimeout": 30*60*1000, // 30 mins -- Cache timeout, any data not accessed within that time is removed [READ BELOW BEFORE CHANGING]
    "cacheTimer": 5*60*1000, // 5 mins -- Time interval to check the cache for timeouts i.e. the granularity of cacheTimeout [READ BELOW BEFORE CHANGING]
    "secondaryReads": null, // Are you reading from secondary DB nodes
    "raceDetectionDelay": 1000, // How long until all mongo nodes are assumed to have been 
    "raceDetection": true, // set to null to automate this (see Race Conditions Detector below)
    "debug": false, // Will show timestamp and activity of redis-oplog
  }
}
```

### Important Notes

- To make sure it is compatible with other packages which extend the `Mongo.Collection` methods, make sure you go to
  `.meteor/packages` and put `megawebmaster:redis-oplog` as the first option.
- RedisOplog does not work with _insecure_ package, a warning is issued.
- Updates with **positional selectors** are done directly on the DB for now until this
  [PR](https://github.com/meteor/meteor/pull/9721) is pulled in. Just keep this in mind in terms of your db hits.
- This package **does not support ordered** observers. You **cannot** use `addedBefore`, `changedBefore` etc. This
  behavior is unlikely to change as it requires quite a bit of work and is not useful for the original developer.
  Frankly, you should use an `order` field in your doc and order at run-time / on the client.
- If you have **large documents**, caching could result in memory issues as we store the full document in the cache
  (for performance reasons, so we don't start matching missing fields etc. for the rare use case). You may need to tweak
  `cacheTimeout`. In such a use case I recommend you have a separate collection for these big fields and prevent caching
  on it or have shorter timeout.

## Setup & basic usage

**Notes:**

1. All setup is server-side only, the following methods are not exposed client-side (nor should they be)
2. Please review the API section (as well as the Important Notes section) below

### Caching

Caching is the most important update over original `redis-oplog`. Without it, you are hitting DB with every query as if
you used the original package.

In your code, for the collections you want to cache (which should really be most of your data):

```
collection.startCaching()
```

To get an idea of cache hits vs misses you can call the following method from your browser console in **development**

```
Meteor.call('__getCollectionStats','myCollectionName',console.log)
```

If you want to do this in production add `REDIS_OPLOG_COLLECTION_STATS=1` to your environment variables and add
appropriate access controls (if needed).

This is sample data from our production servers for the `users` collection -- **99% hits!!**:

```
{
    hitRatio: 98.85108236349966
    hits: 6143833
    misses: 71408
}
```

### Disabling Redis

1. For **collections** for which you want to skip redis updates entirely (but you can still cache). This is useful for
   data that is needed for a given user only (for example: analytics collection) or large docs:
   ```
   collection.disableRedis()
   ```
2. For specific **mutations** add `{ pushToRedis: false }` in options, for example:
   ```
   collection.insert({ test: 'value' }, { pushToRedis:false })
   ```

### Clearing fields -- $unset

When an `$unset` update is made, we send the fields to be cleared via Redis to the other Meteor instances. Furthermore,
when we detect a `$set` of top-level field to `null` or `undefined`, we clear those fields too. This is to get around
what many believe is a bug in Mongo; a null setter should be the same as `$unset`. Be careful if you are using strict
equality with `null` (i.e. `=== null`) as it will fail in your application (not that you should, this is bad practice).

### Collection-hooks

The package [collection-hooks](https://github.com/Meteor-Community-Packages/meteor-collection-hooks) is very popular as
it allows you to call methods before / after DB calls. Unfortunately when caching a collection, this package causes
collisions (as you may mutate DB-version of the doc, resulting in collision with cache). As such, we override the
following methods to give you the same functionality as `collection-hooks` **only when the collection is cached - i.e.
when you call `collection.startCaching()`**. Please refer to the original package for the signature of `cb` below:

```
collection.before.<find, findOne, insert, update, remove>(cb)
collection.after.<find, findOne, insert, update, remove>(cb)
collection.direct.<find, findOne, insert,update,remove>(cb)
```

**Notes:**

* We do not support `this.transform` & `this.previous` inside the callbacks as in the original package -- if it's
  needed, PRs are welcome
* We do not yet support `<before, after, direct>.upsert` -- not sure we ever well, please create a PR if you need it

## Docs

- [How it works?](docs/how_it_works.md)
- [Optimistic UI](docs/optimistic_ui.md)
- [Cache Persistence and Clearing](docs/cache_persistence.md)
- [Reading from secondary DB nodes](docs/secondary_reads.md)
- [Fail-over](docs/failover.md)
- [Outside mutations](docs/outside_mutations.md)
- [Fine-tuning](docs/finetuning.md)
- [API](docs/api.md)

## For Developers

The major areas that have seen changes from the original redis-oplog

- `mongo/extendMongoCollection`: Added support for caching
- `mongo/mutator`: Support for caching, removed sending the whole doc for the deprecated option `protectRaceConditions`,
  check which fields have REALLY changed and only send those, build inserts locally
- `mongo/observeMultiplex`: We now call on the cache to get the data, no more local caching of any data, uses projector
  to send the right fields down
- `cache/observableCollection`: No longer caching of data, just IDs; uses cache to build initial adds
- `redis/redisSubscriptionManager`: Many changes to support using Cache -- removed `getDoc` method
- `redis/watchManager` and `redis/customPublish`: New feature to allow server-server data transfers (see advanced
  section above)
- The redis signaling has been cleaned to remove unused keys (e.g. 'mt', 'id') and synthetic events (we now use
  watchers), to include cleared fields ('c' -- i.e. $unset) and forced update / insert for avoiding race conditions ('
  fu' / 'fi'). For more details check `lib/constants`

Everywhere else, **major code cleanups** and removal of unused helpers in various `/lib` folders

## Contributors

This project exists thanks to all the people who contributed (to the original redis-oplog).
<a href="graphs/contributors"><img src="https://opencollective.com/redis-oplog/contributors.svg?width=890" /></a>

