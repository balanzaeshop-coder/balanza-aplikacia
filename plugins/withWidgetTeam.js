const { withXcodeProject } = require('@expo/config-plugins');

const TEAM_ID = 'CWQTX63DGQ';
const WIDGET_BUNDLE_ID = '"sk.balanza.walkingpad.BalanzaWidgets"';

module.exports = function withWidgetTeam(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const buildConfigs = project.pbxXCBuildConfigurationSection();

    Object.values(buildConfigs).forEach((buildConfig) => {
      if (
        buildConfig.buildSettings &&
        buildConfig.buildSettings.PRODUCT_BUNDLE_IDENTIFIER === WIDGET_BUNDLE_ID
      ) {
        buildConfig.buildSettings.DEVELOPMENT_TEAM = `"${TEAM_ID}"`;
        buildConfig.buildSettings.CODE_SIGN_STYLE = '"Automatic"';
      }
    });

    return config;
  });
};
