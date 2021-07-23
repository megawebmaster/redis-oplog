// eslint-disable-next-line
Package.describe({
  name: 'megawebmaster:redis-oplog',
  version: '4.0.0',
  // Brief, one-line summary of the package.
  summary: 'Replacement for Meteor\'s MongoDB oplog implementation',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/megawebmaster/redis-oplog',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

// eslint-disable-next-line
Npm.depends({
  ioredis: '4.26.0',
});

// eslint-disable-next-line
Package.onUse(function (api) {
  api.use([
    'underscore',
    'ecmascript',
    'ejson',
    'minimongo',
    'mongo',
    'random',
    'ddp-server',
    'diff-sequence',
    'id-map',
    'mongo-id',
    'tracker'
  ]);

  api.mainModule('redis-oplog.js', 'server');
});

// eslint-disable-next-line
Package.onTest(function (api) {
  api.use('megawebmaster:redis-oplog');

  // extensions
  api.use('aldeed:collection2@3.4.1');
  api.use('reywood:publish-composite@1.7.3');

  api.use('ecmascript');
  api.use('tracker');
  api.use('mongo');
  api.use('random');
  api.use('matb33:collection-hooks@1.1.0');

  api.use(['meteortesting:mocha']);

  api.mainModule('testing/main.server.js', 'server');
  api.addFiles('testing/publishComposite/boot.js', 'server');
  api.addFiles('testing/optimistic-ui/boot.js', 'server');

  api.mainModule('testing/main.client.js', 'client');
});
