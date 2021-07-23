import { assert } from 'chai';
import { Items } from './collections';
import { callWithPromise, waitForHandleToBeReady } from '../lib/sync_utils';
import { Random } from 'meteor/random';

describe('Collection Defaults', () => {
  it('should detect changes based on mutation defaults', function (done) {
    const context = Random.id();
    const handle = Meteor.subscribe('collection_defaults.items', { context });
    waitForHandleToBeReady(handle).then(() => {
      const cursor = Items.find({});

      const observer = cursor.observeChanges({
        added(docId, doc) {
          assert.isObject(doc);
          callWithPromise('collection_defaults.items.update', {
            _id: docId
          }, {
            $set: {
              number: 10
            }
          });
        },
        changed(docId, doc) {
          assert.equal(doc.number, 10);
          handle.stop();
          observer.stop();
          done();
        }
      });

      callWithPromise('collection_defaults.items.insert', {
        text: 'hello',
        context
      });
    });
  });
});
