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
      let modified = false;

      // 1. Add use_modular_headers! globally right after `platform :ios`
      if (!podfile.includes('use_modular_headers!')) {
        const withGlobal = podfile.replace(
          /^(platform :ios.*\n)/m,
          '$1use_modular_headers!\n'
        );
        if (withGlobal !== podfile) {
          podfile = withGlobal;
          modified = true;
        }
      }

      // 2. Also add targeted pod declarations after use_expo_modules! (belt and suspenders)
      if (!podfile.includes("pod 'GoogleUtilities', :modular_headers => true")) {
        const withPods = podfile.replace(
          /(\s+use_expo_modules!\s*\n)/,
          `$1  pod 'GoogleUtilities', :modular_headers => true\n  pod 'RecaptchaInterop', :modular_headers => true\n`
        );
        if (withPods !== podfile) {
          podfile = withPods;
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
