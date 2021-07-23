import getChannels from '../../cache/lib/getChannels';
import Config from '../../config';
import { DDP } from 'meteor/ddp';
import { _ } from 'meteor/underscore';

/**
 * @param collection
 * @param _config
 */
export default function (collection, _config) {
  if (!_config || typeof _config == 'function') _config = {};

  const defaultOverrides = {};

  if (!DDP._CurrentMethodInvocation.get()) {
    // If we're not in a method, then we can postpone sending to our observers
    // Users can force by explicitly passing optimistic: true
    defaultOverrides.optimistic = false;
  }

  const queryConfig = _.omit(_config, 'channel', 'channels', 'optimistic', 'pushToRedis');
  const redisConfig = _.extend({}, Config.mutationDefaults, defaultOverrides, _config);

  redisConfig._channels = getChannels(collection._name, redisConfig);

  return [redisConfig, queryConfig];
}
