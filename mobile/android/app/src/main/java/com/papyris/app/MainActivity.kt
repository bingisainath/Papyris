package com.papyris.app

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Papyris"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Back on the first screen (React Navigation has nowhere to go back to).
   *
   * React Native 0.82 handles this by switching off its back callback and never switching it on again,
   * so after leaving the app once, every later back skipped React Navigation and closed the app (even
   * inside a chat). Going to the background like Android's home screen keeps the callback, and the app
   * opens again where it was.
   */
  override fun invokeDefaultOnBackPressed() {
    moveTaskToBack(true)
  }
}
