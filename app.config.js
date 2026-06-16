const isIOS = process.env.EAS_BUILD_PLATFORM === 'ios';

module.exports = {
  expo: {
    name: 'Balanza',
    slug: 'walkingpad-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0D0C14',
    },
    plugins: [
      './plugins/withWidgetTeam',
      './plugins/withResourceBundleFix',
      './plugins/withModularHeaders',
      // iOS only
      ...(isIOS ? [
        'expo-apple-authentication',
        [
          'react-native-widget-extension',
          {
            widgetsFolder: 'widgets',
            frequentUpdates: true,
            groupIdentifier: 'group.sk.balanza.walkingpad',
            deploymentTarget: '16.4',
          },
        ],
        [
          '@kingstinct/react-native-healthkit',
          {
            NSHealthShareUsageDescription: 'Balanza číta dáta z Apple Health pre lepšie štatistiky aktivity',
            NSHealthUpdateUsageDescription: 'Balanza zapisuje tvoje tréningy, kroky, vzdialenosť a kalórie do Apple Health',
          },
        ],
      ] : []),
      // Both platforms
      [
        'react-native-ble-plx',
        {
          isBackgroundEnabled: false,
          modes: ['central'],
          bluetoothAlwaysPermission: 'Táto appka potrebuje Bluetooth na pripojenie k chodiacemu pásu',
        },
      ],
      'expo-font',
      'expo-web-browser',
      [
        'expo-camera',
        {
          cameraPermission: 'Balanza používa kameru na pridávanie fotiek dňa.',
        },
      ],
      [
        'expo-notifications',
        {
          iosDisplayInForeground: true,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Balanza potrebuje prístup k fotkám pre ukladanie fotiek dňa',
          cameraPermission: 'Balanza používa kameru na pridávanie fotiek dňa.',
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: 'com.googleusercontent.apps.456011197309-rl6u5ajjip4jr0vg1nulip2p0c9te6j5',
        },
      ],
    ],
    scheme: 'balanza',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'sk.balanza.walkingpad',
      teamId: 'CWQTX63DGQ',
      infoPlist: {
        NSBluetoothAlwaysUsageDescription: 'Táto appka potrebuje Bluetooth na pripojenie k chodiacemu pásu',
        NSBluetoothPeripheralUsageDescription: 'Táto appka potrebuje Bluetooth na pripojenie k chodiacemu pásu',
        NSCameraUsageDescription: 'Balanza používa kameru na pridávanie fotiek dňa.',
        ITSAppUsesNonExemptEncryption: false,
        NSSupportsLiveActivities: true,
      },
      entitlements: {
        'com.apple.developer.healthkit': true,
        'com.apple.developer.healthkit.access': [],
        'com.apple.security.application-groups': ['group.sk.balanza.walkingpad'],
      },
      buildNumber: '5',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#E8E5EF',
      },
      googleServicesFile: './google-services.json',
      package: 'sk.balanza.walkingpad',
      permissions: [
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
      versionCode: 2,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: '82a97529-76b0-4729-9af9-98b0a17dff21',
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: 'BalanzaWidgets',
                  bundleIdentifier: 'sk.balanza.walkingpad.BalanzaWidgets',
                  entitlements: {
                    'com.apple.security.application-groups': [
                      'group.sk.balanza.walkingpad',
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
};
