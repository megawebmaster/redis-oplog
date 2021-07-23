// eslint-disable-next-line
import Redis from 'ioredis';
import Config from '../config';
import { _ } from 'meteor/underscore';
import { Meteor } from 'meteor/meteor';

// Redis requires two connections for pushing and listening to data
let redisPusher;
let redisListener;

/**
 * Returns the pusher for events in Redis
 *
 * @returns {*}
 */
export function getRedisPusher() {
  if (!redisPusher) redisPusher = Redis.createClient(_.extend({}, Config.redis, { retryStrategy: getRetryStrategy() }));
  return redisPusher;
}

/**
 * Returns the listener for events in Redis
 *
 * @param onConnect
 * @returns {*}
 */
export function getRedisListener({ onConnect } = {}) {
  if (!redisListener) {
    redisListener = Redis.createClient(_.extend({}, Config.redis, { retryStrategy: getRetryStrategy() }));
    // we only attach events here
    attachEvents(redisListener, { onConnect });
  }
  return redisListener;
}

/**
 *
 * @param client
 * @param onConnect
 */
function attachEvents(client, { onConnect }) {
  ['connect', 'reconnecting', 'error', 'end'].forEach((fn) => {
    redisListener.on(fn, Meteor.bindEnvironment(function (...args) {
      if (fn === 'connect' && onConnect) onConnect();
      if (Config.redisExtras.events[fn]) return Config.redisExtras.events[fn](...args);
    }));
  });
}

/**
 * Retrieves the retry strategy that can be modified
 * @returns {Function}
 */
function getRetryStrategy() {
  return function (...args) {
    if (Config.redisExtras.retryStrategy) return Config.redisExtras.retryStrategy(...args);
  };
}
