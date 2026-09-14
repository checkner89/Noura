const base = require('./app.json').expo;
const enableHealthKit = process.env.NOURA_ENABLE_HEALTHKIT === '1';
const enableICloud = process.env.NOURA_ENABLE_ICLOUD === '1';
const plugins = [...(base.plugins || [])];
if (enableHealthKit) {
  plugins.push(['@appeeky/expo-healthkit', {
    healthSharePermission: 'Noura liest nur die von dir freigegebenen Apple-Health-Daten, um Zusammenhänge mit deinem Tagebuch besser einzuordnen.',
    healthUpdatePermission: false,
    isBackgroundDeliveryEnabled: false,
  }]);
}
if (enableICloud) {
  plugins.push(['expo-cloudkit', {
    containerIds: ['iCloud.de.noura.healthtracker'],
    iCloudContainerEnvironment: 'Production',
  }]);
}
module.exports = {
  expo: {
    ...base,
    plugins,
    extra: {
      ...(base.extra || {}),
      nouraCapabilities: { healthKit: enableHealthKit, iCloud: enableICloud },
    },
  },
};
