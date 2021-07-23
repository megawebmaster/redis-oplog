# Advanced Features

## Dynamic docs -- i.e. skipping DB write

```
collection.update(_id,{$set:{message:"Hello there!"}}, {skipDB:true} )
collection.insert({message:"Hello there!"}, {skipDB:true} )
```

This is useful for temporary changes that the client (and other Meteor instances) may need but should not go into the
DB. This option is only available for `insert` and `update`:

1. For `remove` -- you can remove from cache directly with `deleteCache`
2. For `upsert` -- we count on the DB to validate if the doc exists so defeats the purpose of skipping DB

**Note: If skipping DB on `insert` and you don't provide `_id`, a random one will be created for consistency**

## Skipping Diffs

As mentioned, we do a diff vs the existing doc in the cache before we send out the `update` message to Redis and to the
DB. This option avoids unnecessary hits to the DB and change messages to your other Meteor instances. This option to
disable diff-ing is useful for cases where you don't want to diff (e.g. when you are sure the doc has changed or diffing
can be computationally expensive)

`collection.update(_id,{$set:{message:"Hello there!"}}, {skipDiff:true} )`

> You can use `skipDB` and `skipDiff` together, there is no conflict

## Watchers - i.e. server-server updates

This is similar to Vents in the original `redis-oplog`. It allows updates to be sent to other Meteor instances directly.
This is useful when the data loop is closed -- you don't have any potential for updates elsewhere.

Here is a complete example to illustrate (only relevant code shown):

A user logs in with different clients (in our case the webapp and a Chrome extension). We don't want to be listening to
expensive user-only DB changes for each user in two Meteor instances per user, especially when the data is well-known.
So we send data back and forth between the Meteor instances where the user is logged in.

```
// we are only using dispatchInsert in the example below ... but you get the picture
import { 
  addToWatch, 
  removeFromWatch, 
  dispatchUpdate, 
  dispatchInsert, 
  dispatchRemove 
} from 'meteor/megawebmaster:redis-oplog'

const collection = new Mongo.Collection('messages')

// not necessary if you are only doing inserts as we send the full doc to redis
// but if you are doing updates, prevents DB queries
collection.startCaching()

onLogin = (userId) => {
    // first argument is the collection to affect / watch
    // second argument is the unique channel ID, we are using userId in our case
    addToWatch('messages', userId)
}

onMessage = (userId, text) => {
    const date = new Date()
    const _id = collection.insert({$set:{text, date, userId}})
    // first argument is the collection, second argument is the channel ID
    // IMPORTANT: doc HAS to include the document _id
    dispatchInsert('messages', userId, {_id, text, date})
}

onLogout = (userId) => {
    removeFromWatch('messages', userId)
}
```
