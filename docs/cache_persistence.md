# Cache Persistence and Clearing

> This RedisOplog will keep in cache any doc that is part of an active subscription or was last accessed within
> the `cacheTimeout` delay

- `cacheTimeout` (ms) is the max time a document can be unaccessed (if it is not part of a sub) before it is deleted -
  default 30 minutes
- `cacheTimer` (ms) sets the delay of the `setTimeout` timer that checks cache documents' last access delay vs
  `cacheTimeout` - default 5 minutes

In other words, your worst-case delay before clearing a document (assuming it is not part of a subscription) is
`cacheTimeout + cacheTimer`. Don't set `cacheTimer` too low not to overload your server with frequent checks. If you set
it too high you risk overloading your memory.

> Once a cached document is no longer part of a subscription, it will be cleared at the next cleanup cycle if it has
> not been accessed within `cacheTimeout` delay

Each project is different, so watch your memory usage to make sure your `cacheTimeout` does not bust your heap memory.
It's a tradeoff, DB hits vs Meteor instance memory. Regardless, you are using way less memory than the original
redis-oplog (which stored the same data for every different subscription)  - if you have large docs, see notes at end of
this doc

TODO: Link to correct section
