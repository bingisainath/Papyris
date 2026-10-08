// src/utils/camera.ts
// The app declares the camera permission (for scanning QR codes to link devices). On Android that
// means the system camera used for photos also needs it granted first, or it refuses to open.
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { Alert } from 'react-native';

/** True if the camera may be used now; asks if needed, and offers Settings if it was refused for good. */
export async function cameraAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS asks by itself the first time
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    Alert.alert('Camera is off for Papyris', 'Allow the camera in your phone settings to take photos and scan codes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings() },
    ]);
  }
  return false;
}
