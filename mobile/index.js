/**
 * @format
 */

// Must load first: gives the encryption code (src/crypto) a secure random number generator
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { handlePushesInBackground } from './src/notifications/push';
import { showMessageNotification } from './src/notifications/messageNotification';
import { name as appName } from './app.json';

// Before the app starts: chat notifications arriving while it's closed are decrypted and shown here
handlePushesInBackground(showMessageNotification);

AppRegistry.registerComponent(appName, () => App);
