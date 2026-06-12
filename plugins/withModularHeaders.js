const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes('use_modular_headers!')) {
        return config;
      }

      // Vlož use_modular_headers! hneď za riadok s platform :ios
      const result = podfile.replace(
        /^(platform :ios.*\n)/m,
        '$1\nuse_modular_headers!\n'
      );

      if (result === podfile) {
        // Fallback: vlož na začiatok súboru
        podfile = 'use_modular_headers!\n\n' + podfile;
      } else {
        podfile = result;
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
