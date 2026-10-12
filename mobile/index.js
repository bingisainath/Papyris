/**
 * @format
 */

// Must load first: gives the encryption code (src/crypto) a secure random number generator
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
