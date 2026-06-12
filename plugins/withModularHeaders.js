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

      if (podfile.includes("pod 'GoogleUtilities', :modular_headers => true")) {
        return config;
      }

      const result = podfile.replace(
        /(\s+use_expo_modules!\s*\n)/,
        `$1  pod 'GoogleUtilities', :modular_headers => true\n  pod 'RecaptchaInterop', :modular_headers => true\n`
      );

      if (result !== podfile) {
        fs.writeFileSync(podfilePath, result);
      }

      return config;
    },
  ]);
};
