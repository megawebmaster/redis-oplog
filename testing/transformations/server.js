import { Random } from 'meteor/random';
import { assert } from 'chai';
import { Items } from './collections';

Meteor.publish('transformations_items', function () {
  return Items.find();
});

Meteor.methods({
  transformations_boot() {
    Items.remove({});
    Items.insert({ context: 'client', title: 'hello1' });
  },
});

describe('Transformations - Server Test', function () {
  it('Should transform properly', function () {
    const context = Random.id();
    Items.insert({ context, title: 'hello2' });
    const item = Items.findOne({ context });
    assert.isTrue(item.defaultServerTransform);
  });
});
